const { query, executeTransaction } = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const { ROLES } = require('../config/roles');
const { getParentsForUser } = require('../utils/parentUserMatch');
const { canAccessStudent, canAccessClass, parseId } = require('../utils/accessControl');
const { listHolidaysInRange, buildHolidayDateSet, applyHolidayOverride } = require('../utils/holidayUtils');
const { toYmd } = require('../utils/dateOnly');
const {
  createStudentUser,
  isUserEmailTaken,
} = require('../utils/createPersonUser');
const {
  syncStudentGuardians,
  resolveLinkedUser,
  loadStudentContactLegacyFields,
  loadStudentLinkedUserIds,
  guardiansIsSlimSchema,
  STUDENT_CONTACT_LATERAL_SELECT,
  STUDENT_CONTACT_LATERAL_JOINS,
} = require('../utils/studentContactSync');
const { getSchoolIdFromRequest } = require('../utils/schoolContext');
const { loadActiveGradeScale, getGradeFromScale } = require('../utils/gradeScaleService');
const { hasColumn, hasTable } = require('../utils/schemaInspector');
const { deleteFileIfExist } = require('../utils/fileDeleteHelper');

const formatGrNumber = (n) => `GR${String(n).padStart(6, '0')}`;

/** Relative path under tenant storage; must match authenticated school. */
function normalizeStudentDocumentPath(schoolId, raw) {
  if (schoolId == null || raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().replace(/\\/g, '/');
  // Allow subfolders (e.g. user_123)
  const m = /^school_(\d+)\/documents\/(?:user_\d+\/)?[a-z0-9._-]+\.pdf$/i.exec(s);
  if (!m) return null;
  if (Number(m[1]) !== Number(schoolId)) return null;
  return s;
}

/** Validates photo path structure. */
function normalizeStudentPhotoPath(schoolId, raw) {
  if (schoolId == null || raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().replace(/\\/g, '/');
  // Allow subfolders (e.g. user_123)
  const m = /^school_(\d+)\/students\/(?:user_\d+\/)?[a-z0-9._-]+\.(jpe?g|png|svg)$/i.exec(s);
  if (!m) return null;
  if (Number(m[1]) !== Number(schoolId)) return null;
  return s;
}

/** Non-fatal warning when an email is already registered in users (student row still saved). */
function buildEmailInUseWarning(field, displayLabel) {
  return {
    code: 'EMAIL_IN_USE',
    field,
    message: `${displayLabel}: Email already in use. Another account already uses this email. The student was saved successfully; no duplicate user was created for this email.`,
  };
}

// Generate next unique GR number for this tenant database (one school per DB).
const generateNextGrNumber = async (client) => {
  const maxRes = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(TRIM(gr_number) FROM '([0-9]+)$') AS INTEGER)), 0) AS max_gr_seq
     FROM students
     WHERE TRIM(COALESCE(gr_number, '')) ~ '^[A-Za-z]*[0-9]+$'`
  );
  const maxSeq = Number(maxRes.rows?.[0]?.max_gr_seq || 0);
  return formatGrNumber(maxSeq + 1);
};

const MAX_UNIQUE_STUDENT_ID_LEN = 50;

/**
 * Column unique_student_ids is NOT NULL + UNIQUE. Auto-generate USI-<admission> when omitted.
 */
async function allocateUniqueStudentIds(client, preferred, admission_number, excludeStudentId = null) {
  const trimPref = preferred != null ? String(preferred).trim() : '';
  if (trimPref) {
    const candidate = trimPref.slice(0, MAX_UNIQUE_STUDENT_ID_LEN);
    const sql = excludeStudentId
      ? 'SELECT 1 FROM students WHERE unique_student_ids = $1 AND id <> $2 LIMIT 1'
      : 'SELECT 1 FROM students WHERE unique_student_ids = $1 LIMIT 1';
    const params = excludeStudentId ? [candidate, excludeStudentId] : [candidate];
    const clash = await client.query(sql, params);
    if (clash.rows.length > 0) {
      const err = new Error('This unique student ID is already in use');
      err.statusCode = 400;
      throw err;
    }
    return candidate;
  }

  return null;
}

const MAX_PEN_NUMBER_LEN = 20;

/**
 * Column pen_number is NOT NULL + UNIQUE (varchar 20). Auto-generate PEN-<admission> when omitted.
 */
async function allocatePenNumber(client, preferred, admission_number, excludeStudentId = null) {
  const trimPref = preferred != null ? String(preferred).trim() : '';
  if (trimPref) {
    const candidate = trimPref.slice(0, MAX_PEN_NUMBER_LEN);
    const sql = excludeStudentId
      ? 'SELECT 1 FROM students WHERE pen_number = $1 AND id <> $2 LIMIT 1'
      : 'SELECT 1 FROM students WHERE pen_number = $1 LIMIT 1';
    const params = excludeStudentId ? [candidate, excludeStudentId] : [candidate];
    const clash = await client.query(sql, params);
    if (clash.rows.length > 0) {
      const err = new Error('This PEN number is already in use');
      err.statusCode = 400;
      throw err;
    }
    return candidate;
  }

  return null;
}

const MAX_AADHAR_NO_LEN = 12;

/**
 * Column aadhar_no is NOT NULL + UNIQUE (varchar 12). Auto-generate AAD-<admission> when omitted.
 */
async function allocateAadharNo(client, preferred, admission_number, excludeStudentId = null) {
  const trimPref = preferred != null ? String(preferred).trim() : '';
  if (trimPref) {
    const candidate = trimPref.slice(0, MAX_AADHAR_NO_LEN);
    const sql = excludeStudentId
      ? 'SELECT 1 FROM students WHERE aadhar_no = $1 AND id <> $2 LIMIT 1'
      : 'SELECT 1 FROM students WHERE aadhar_no = $1 LIMIT 1';
    const params = excludeStudentId ? [candidate, excludeStudentId] : [candidate];
    const clash = await client.query(sql, params);
    if (clash.rows.length > 0) {
      const err = new Error('This Aadhaar number is already in use');
      err.statusCode = 400;
      throw err;
    }
    return candidate;
  }

  return null;
}

// Create new student
const createStudent = async (req, res) => {
  try {
    const {
      academic_year_id, admission_number, admission_date, roll_number, status,
      first_name, last_name, class_id, section_id, gender, date_of_birth,
      blood_group_id, house_id, religion_id, cast_id, phone, email, mother_tongue_id,
      // Parent fields
      father_name, father_email, father_phone, father_occupation, father_image_url,
      mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
      // Guardian fields
      guardian_first_name, guardian_last_name, guardian_relation, guardian_phone,
      guardian_email, guardian_occupation, guardian_address, guardian_image_url,
      father_person_id, mother_person_id, guardian_person_id,
      // Address, siblings, transport, hostel, bank, medical, other
      current_address, permanent_address, address,
      unique_student_ids, pen_number, aadhaar_no, gr_number,
      previous_school, previous_school_address,
      siblings, // New dynamic array
      is_transport_required, route_id, pickup_point_id, vehicle_number,
      is_hostel_required, hostel_id, hostel_room_id,
      bank_name, branch, ifsc,
      known_allergies, medications, medical_condition, other_information,
      medical_document_path, transfer_certificate_path, photo_url,
    } = req.body;

    const tenantSchoolId = getSchoolIdFromRequest(req);
    const medDocPath = normalizeStudentDocumentPath(tenantSchoolId, medical_document_path);
    const tcDocPath = normalizeStudentDocumentPath(tenantSchoolId, transfer_certificate_path);
    const photoUrlPath = normalizeStudentPhotoPath(tenantSchoolId, photo_url);

    // Validate required fields
    if (!admission_number || !first_name || !last_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Admission number, first name, and last name are required'
      });
    }

    let grNormCreate = (gr_number != null ? String(gr_number) : '').trim();

    const addrVal = current_address || address || null;
    const knownAllergiesVal = Array.isArray(known_allergies)
      ? known_allergies.join(',')
      : (typeof known_allergies === 'string' ? known_allergies : (known_allergies || null));
    const medicationsVal = Array.isArray(medications)
      ? medications.join(',')
      : (typeof medications === 'string' ? medications : (medications || null));

    const stuEm = (email || '').toString().trim();
    const stuPh = (phone || '').toString().trim();
    if ((stuEm && !stuPh) || (!stuEm && stuPh)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student email and phone must both be filled for login, or leave both empty.',
      });
    }
    const fEm = (father_email || '').toString().trim();
    const fPh = (father_phone || '').toString().trim();
    if ((fEm && !fPh) || (!fEm && fPh)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Father email and phone must both be filled, or leave both empty.',
      });
    }
    const mEm = (mother_email || '').toString().trim();
    const mPh = (mother_phone || '').toString().trim();
    if ((mEm && !mPh) || (!mEm && mPh)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Mother email and phone must both be filled, or leave both empty.',
      });
    }
    const gEm = (guardian_email || '').toString().trim();
    const gPh = (guardian_phone || '').toString().trim();
    if ((gEm && !gPh) || (!gEm && gPh)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Guardian email and phone must both be filled, or leave both empty.',
      });
    }

    const createResult = await executeTransaction(async (client) => {
      const creationWarnings = [];

      const parseUserId = (v) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      let effFatherName = father_name;
      let effFatherEmail = father_email;
      let effFatherPhone = father_phone;
      let effFatherOcc = father_occupation;
      let fatherUserId = parseUserId(father_person_id);

      let effMotherName = mother_name;
      let effMotherEmail = mother_email;
      let effMotherPhone = mother_phone;
      let effMotherOcc = mother_occupation;
      let motherUserId = parseUserId(mother_person_id);

      let effGFirst = guardian_first_name;
      let effGLast = guardian_last_name;
      let effGPhone = guardian_phone;
      let effGEmail = guardian_email;
      let effGOcc = guardian_occupation;
      let effGAddr = guardian_address;
      let effGRel = guardian_relation;
      let guardianUserId = parseUserId(guardian_person_id);

      const hasParentInfo = Boolean(
        effFatherName || effFatherEmail || effFatherPhone || effFatherOcc ||
        effMotherName || effMotherEmail || effMotherPhone || effMotherOcc
      );
      const hasGuardianInfo = Boolean(
        effGFirst || effGLast || effGPhone || effGEmail || effGOcc || effGRel
      );

      const existingStudent = await client.query(
        'SELECT id FROM students WHERE admission_number = $1 AND is_active = true',
        [admission_number]
      );

      if (existingStudent.rows.length > 0) {
        const err = new Error('Student with this admission number already exists');
        err.statusCode = 400;
        throw err;
      }

      if (!grNormCreate) {
        grNormCreate = await generateNextGrNumber(client);
      }

      let existingGr = await client.query(
        'SELECT id FROM students WHERE TRIM(gr_number) = $1',
        [grNormCreate]
      );
      if (existingGr.rows.length > 0 && (!gr_number || String(gr_number).trim() === '')) {
        // If GR was auto-generated and collided due to concurrency, try one more deterministic step.
        grNormCreate = await generateNextGrNumber(client);
        existingGr = await client.query(
          'SELECT id FROM students WHERE TRIM(gr_number) = $1',
          [grNormCreate]
        );
      }
      if (existingGr.rows.length > 0) {
        const err = new Error('Student with this GR number already exists');
        err.statusCode = 400;
        throw err;
      }

      const uniqueStudentIdsNorm = await allocateUniqueStudentIds(client, unique_student_ids, admission_number);
      const penNumberNorm = await allocatePenNumber(client, pen_number, admission_number);
      const aadharNorm = await allocateAadharNo(client, aadhaar_no, admission_number);

      let result;
      await client.query('SAVEPOINT student_insert');
      try {
        // Primary path: for schemas using correct "religion_id" column and new address columns
        result = await client.query(`
          INSERT INTO students (
            academic_year_id, admission_number, admission_date, roll_number,
            first_name, last_name, class_id, section_id, gender, date_of_birth,
            blood_group_id, house_id, religion_id, cast_id, phone, email,
            mother_tongue_id, is_active,
            address, current_address, permanent_address,
            previous_school, previous_school_address,
            is_transport_required, route_id, pickup_point_id, vehicle_number,
            is_hostel_required, hostel_id, hostel_room_id,
            bank_name, branch, ifsc,
            known_allergies, medications, medical_condition, other_information,
            unique_student_ids, pen_number, aadhar_no, gr_number,
            medical_document_path, transfer_certificate_path, photo_url,
            created_at, modified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, NOW(), NOW())
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male', 'female', 'other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
          date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
          cast_id || null, phone || null, email || null, mother_tongue_id || null,
          status === 'Active' ? true : false,
          addrVal || 'Not Provided',
          current_address || addrVal || 'Not Provided',
          permanent_address || 'Not Provided',
          previous_school || null, previous_school_address || null,
          is_transport_required === true || is_transport_required === 'true',
          route_id || null, pickup_point_id || null, vehicle_number || null,
          is_hostel_required === true || is_hostel_required === 'true',
          hostel_id || null, hostel_room_id || null,
          bank_name || null, branch || null, ifsc || null,
          knownAllergiesVal, medicationsVal,
          medical_condition || null, other_information || null,
          uniqueStudentIdsNorm, penNumberNorm, aadharNorm,
          grNormCreate,
          medDocPath,
          tcDocPath,
          photoUrlPath,
        ]);
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT student_insert');
        // Fallback path: handle legacy schemas that use "reigion_id" and/or lack new address columns
        const hasReligionError = e.message && (e.message.includes('religion_id') || e.message.includes('reigion'));
        const useLegacyReligion = hasReligionError;
        const religionColumn = useLegacyReligion ? 'reigion_id' : 'religion_id';

        result = await client.query(`
          INSERT INTO students (
            academic_year_id, admission_number, admission_date, roll_number,
            first_name, last_name, class_id, section_id, gender, date_of_birth,
            blood_group_id, house_id, ${religionColumn}, cast_id, phone, email,
            mother_tongue_id, is_active,
            address, previous_school, previous_school_address,
            is_transport_required, route_id, pickup_point_id, vehicle_number,
            is_hostel_required, hostel_id, hostel_room_id,
            bank_name, branch, ifsc,
            known_allergies, medications, medical_condition, other_information,
            unique_student_ids, pen_number, aadhar_no, gr_number,
            medical_document_path, transfer_certificate_path, photo_url,
            created_at, modified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, NOW(), NOW())
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male', 'female', 'other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
          date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
          cast_id || null, phone || null, email || null, mother_tongue_id || null,
          status === 'Active' ? true : false,
          addrVal || 'Not Provided',
          previous_school || null, previous_school_address || null,
          is_transport_required === true || is_transport_required === 'true',
          route_id || null, pickup_point_id || null, vehicle_number || null,
          is_hostel_required === true || is_hostel_required === 'true',
          hostel_id || null, hostel_room_id || null,
          bank_name || null, branch || null, ifsc || null,
          knownAllergiesVal, medicationsVal,
          medical_condition || null, other_information || null,
          uniqueStudentIdsNorm, penNumberNorm, aadharNorm,
          grNormCreate,
          medDocPath,
          tcDocPath,
          photoUrlPath,
        ]);
      }

      const studentRow = result.rows[0];

      // Create student user and link (phone/email for login)
      const stuPhone = (phone || '').toString().trim();
      const stuEmail = (email || '').toString().trim();
      if (stuPhone || stuEmail || admission_number) {
        try {
          const studentUserId = await createStudentUser(client, {
            admission_number,
            first_name,
            last_name,
            phone: stuPhone || null,
            email: stuEmail || null
          });
          if (studentUserId) {
            await client.query('UPDATE students SET user_id = $1, modified_at = NOW() WHERE id = $2', [studentUserId, studentRow.id]);
            studentRow.user_id = studentUserId;
          } else if (stuEmail && (await isUserEmailTaken(client, stuEmail))) {
            creationWarnings.push(buildEmailInUseWarning('email', 'Student'));
          }
        } catch (e) {
          console.warn('createStudent: could not create student user:', e.message);
        }
      }

      if (hasParentInfo || hasGuardianInfo) {
        const sync = await syncStudentGuardians(
          client,
          studentRow.id,
          {
            effFatherName,
            effFatherEmail,
            effFatherPhone,
            effFatherOcc,
            effMotherName,
            effMotherEmail,
            effMotherPhone,
            effMotherOcc,
            effGFirst,
            effGLast,
            effGPhone,
            effGEmail,
            effGOcc,
            effGAddr,
            effGRel: guardian_relation,
            fatherUserId,
            motherUserId,
            guardianUserId,
          },
          creationWarnings
        );
        studentRow.guardian_id = sync.primaryGuardianId;
        if (father_image_url && sync.fatherUserId) {
          await client.query(`UPDATE users SET avatar = COALESCE(NULLIF(TRIM($1::text), ''), avatar) WHERE id = $2`, [
            father_image_url,
            sync.fatherUserId,
          ]);
        }
        if (mother_image_url && sync.motherUserId) {
          await client.query(`UPDATE users SET avatar = COALESCE(NULLIF(TRIM($1::text), ''), avatar) WHERE id = $2`, [
            mother_image_url,
            sync.motherUserId,
          ]);
        }
        if (guardian_image_url && sync.guardianUserId) {
          await client.query(`UPDATE users SET avatar = COALESCE(NULLIF(TRIM($1::text), ''), avatar) WHERE id = $2`, [
            guardian_image_url,
            sync.guardianUserId,
          ]);
        }
      }

      // Handle Siblings
      if (Array.isArray(siblings) && siblings.length > 0) {
        for (const sib of siblings) {
          if (!sib.name && !sib.admission_number) continue;
          await client.query(
            `INSERT INTO student_siblings (
              student_id, is_in_same_school, name, class_name, section_name, roll_number, admission_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              studentRow.id,
              sib.is_in_same_school === true || sib.is_in_same_school === 'true',
              sib.name || null,
              sib.class_name || null,
              sib.section_name || null,
              sib.roll_number || null,
              sib.admission_number || null,
            ]
          );
        }
      }

      // Sync current & permanent address into addresses table (per-user address book)
      // so that Student Details and Edit Student form stay in sync.
      if ((current_address || permanent_address || addrVal) && studentRow.user_id) {
        const currentAddrVal = current_address || addrVal || null;
        const permanentAddrVal = permanent_address || null;

        const existingAddr = await client.query(
          'SELECT id FROM addresses WHERE user_id = $1 AND role_id = $2 LIMIT 1',
          [studentRow.user_id, ROLES.STUDENT]
        );

        if (existingAddr.rows.length > 0) {
          await client.query(
            `
            UPDATE addresses SET
              current_address = $1,
              permanent_address = $2,
              person_id = $3
            WHERE id = $4
          `,
            [currentAddrVal, permanentAddrVal, studentRow.id, existingAddr.rows[0].id]
          );
        } else if (currentAddrVal || permanentAddrVal) {
          await client.query(
            `
            INSERT INTO addresses (
              current_address,
              permanent_address,
              user_id,
              role_id,
              person_id,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
          `,
            [currentAddrVal, permanentAddrVal, studentRow.user_id, ROLES.STUDENT, studentRow.id]
          );
        }
      }

      return { studentRow, warnings: creationWarnings };
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Student created successfully',
      data: createResult.studentRow,
      warnings: createResult.warnings || [],
    });
  } catch (error) {
    console.error('Error creating student:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: process.env.NODE_ENV === 'production' ? 'Invalid request' : error.message });
    }
    const devMsg = process.env.NODE_ENV !== 'production' ? (error.message || 'Failed to create student') : 'Failed to create student';
    res.status(500).json({
      status: 'ERROR',
      message: devMsg
    });
  }
};

// Update student
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      academic_year_id, admission_number, admission_date, roll_number, status,
      first_name, last_name, class_id, section_id, gender, date_of_birth,
      blood_group_id, house_id, religion_id, cast_id, phone, email, mother_tongue_id,
      // Parent fields
      father_name, father_email, father_phone, father_occupation, father_image_url,
      mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
      // Guardian fields
      guardian_first_name, guardian_last_name, guardian_relation, guardian_phone,
      guardian_email, guardian_occupation, guardian_address, guardian_image_url,
      father_person_id, mother_person_id, guardian_person_id,
      // Address, siblings, transport, hostel, bank, medical, other
      current_address, permanent_address, address,
      unique_student_ids, pen_number, aadhaar_no, gr_number,
      previous_school, previous_school_address,
      siblings, // New dynamic array
      is_transport_required, route_id, pickup_point_id, vehicle_number,
      is_hostel_required, hostel_id, hostel_room_id,
      bank_name, branch, ifsc,
      known_allergies, medications, medical_condition, other_information,
      medical_document_path, transfer_certificate_path, photo_url,
    } = req.body;

    // Validate required fields
    if (!admission_number || !first_name || !last_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Admission number, first name, and last name are required'
      });
    }

    let grNormUpdate = (gr_number != null ? String(gr_number) : '').trim();

    const addrVal = current_address || address || null;
    const knownAllergiesVal = Array.isArray(known_allergies)
      ? known_allergies.join(',')
      : (typeof known_allergies === 'string' ? known_allergies : (known_allergies || null));
    const medicationsVal = Array.isArray(medications)
      ? medications.join(',')
      : (typeof medications === 'string' ? medications : (medications || null));

    const stuEmUp = (email || '').toString().trim();
    const stuPhUp = (phone || '').toString().trim();
    if ((stuEmUp && !stuPhUp) || (!stuEmUp && stuPhUp)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student email and phone must both be filled for login, or leave both empty.',
      });
    }
    const fEmUp = (father_email || '').toString().trim();
    const fPhUp = (father_phone || '').toString().trim();
    if ((fEmUp && !fPhUp) || (!fEmUp && fPhUp)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Father email and phone must both be filled, or leave both empty.',
      });
    }
    const mEmUp = (mother_email || '').toString().trim();
    const mPhUp = (mother_phone || '').toString().trim();
    if ((mEmUp && !mPhUp) || (!mEmUp && mPhUp)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Mother email and phone must both be filled, or leave both empty.',
      });
    }
    const gEmUp = (guardian_email || '').toString().trim();
    const gPhUp = (guardian_phone || '').toString().trim();
    if ((gEmUp && !gPhUp) || (!gEmUp && gPhUp)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Guardian email and phone must both be filled, or leave both empty.',
      });
    }

    const updateResult = await executeTransaction(async (client) => {
      const updateWarnings = [];

      const parseUserId = (v) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      const fEmUp = (father_email || '').toString().trim();
      const fPhUp = (father_phone || '').toString().trim();
      const mEmUp = (mother_email || '').toString().trim();
      const mPhUp = (mother_phone || '').toString().trim();
      const gEmUp = (guardian_email || '').toString().trim();
      const gPhUp = (guardian_phone || '').toString().trim();

      let effFatherName = father_name;
      let effFatherEmail = father_email;
      let effFatherPhone = father_phone;
      let effFatherOcc = father_occupation;
      let fatherUserId = parseUserId(father_person_id);

      let effMotherName = mother_name;
      let effMotherEmail = mother_email;
      let effMotherPhone = mother_phone;
      let effMotherOcc = mother_occupation;
      let motherUserId = parseUserId(mother_person_id);

      let effGFirst = guardian_first_name;
      let effGLast = guardian_last_name;
      let effGPhone = guardian_phone;
      let effGEmail = guardian_email;
      let effGOcc = guardian_occupation;
      let effGAddr = guardian_address;
      let effGRel = guardian_relation;
      let guardianUserId = parseUserId(guardian_person_id);

      const hasParentInfo = Boolean(
        effFatherName || effFatherEmail || effFatherPhone || effFatherOcc ||
        effMotherName || effMotherEmail || effMotherPhone || effMotherOcc
      );
      const hasGuardianInfo = Boolean(
        effGFirst || effGLast || effGPhone || effGEmail || effGOcc || effGRel
      );

      const existingStudent = await client.query(
        'SELECT id FROM students WHERE admission_number = $1 AND id != $2 AND is_active = true',
        [admission_number, id]
      );

      if (existingStudent.rows.length > 0) {
        const err = new Error('Student with this admission number already exists');
        err.statusCode = 400;
        throw err;
      }

      // Backward-safe behavior for older clients/forms:
      // if GR is missing in request, keep existing student's GR.
      if (!grNormUpdate) {
        const currentGrRes = await client.query(
          'SELECT gr_number FROM students WHERE id = $1 LIMIT 1',
          [id]
        );
        if (currentGrRes.rows.length > 0) {
          grNormUpdate = (currentGrRes.rows[0].gr_number || '').toString().trim();
        }
      }
      if (!grNormUpdate) {
        grNormUpdate = await generateNextGrNumber(client);
      }

      const existingGrRow = await client.query(
        'SELECT id FROM students WHERE TRIM(gr_number) = $1 AND id <> $2',
        [grNormUpdate, id]
      );
      if (existingGrRow.rows.length > 0) {
        const err = new Error('Student with this GR number already exists');
        err.statusCode = 400;
        throw err;
      }

      let resolvedUniqueFromBody = null;
      if (unique_student_ids === undefined) {
        // Keep existing if not in request body
        const curUs = await client.query(
          'SELECT unique_student_ids FROM students WHERE id = $1 LIMIT 1',
          [id]
        );
        if (curUs.rows.length > 0) {
          resolvedUniqueFromBody = curUs.rows[0].unique_student_ids;
        }
      } else {
        // Explicitly provided: null, empty string, or value
        resolvedUniqueFromBody = (unique_student_ids != null ? String(unique_student_ids).trim() : '') || null;
      }
      const uniqueStudentIdsNormUpdate = await allocateUniqueStudentIds(
        client,
        resolvedUniqueFromBody || null,
        admission_number,
        id
      );

      let resolvedPenFromBody = null;
      if (pen_number === undefined) {
        const curPen = await client.query(
          'SELECT pen_number FROM students WHERE id = $1 LIMIT 1',
          [id]
        );
        if (curPen.rows.length > 0) {
          resolvedPenFromBody = curPen.rows[0].pen_number;
        }
      } else {
        resolvedPenFromBody = (pen_number != null ? String(pen_number).trim() : '') || null;
      }
      const penNumberNormUpdate = await allocatePenNumber(
        client,
        resolvedPenFromBody || null,
        admission_number,
        id
      );

      let resolvedAadharFromBody = null;
      if (aadhaar_no === undefined) {
        const curAad = await client.query(
          'SELECT aadhar_no FROM students WHERE id = $1 LIMIT 1',
          [id]
        );
        if (curAad.rows.length > 0) {
          resolvedAadharFromBody = curAad.rows[0].aadhar_no;
        }
      } else {
        resolvedAadharFromBody = (aadhaar_no != null ? String(aadhaar_no).trim() : '') || null;
      }
      const aadharNormUpdate = await allocateAadharNo(
        client,
        resolvedAadharFromBody || null,
        admission_number,
        id
      );

      const existingDocRes = await client.query(
        `SELECT s.medical_document_path, s.transfer_certificate_path, s.photo_url,
                father_u.avatar AS father_avatar, mother_u.avatar AS mother_avatar,
                guardian_u.avatar AS guardian_avatar,
                sync.father_user_id, sync.mother_user_id, sync.guardian_user_id
         FROM students s
         LEFT JOIN LATERAL (
           SELECT 
             MAX(CASE WHEN LOWER(COALESCE(g.guardian_type::text,'')) = 'father' THEN g.user_id END) AS father_user_id,
             MAX(CASE WHEN LOWER(COALESCE(g.guardian_type::text,'')) = 'mother' THEN g.user_id END) AS mother_user_id,
             MAX(CASE WHEN LOWER(COALESCE(g.guardian_type::text,'')) NOT IN ('father', 'mother') THEN g.user_id END) AS guardian_user_id
           FROM guardians g
           WHERE g.student_id = s.id AND g.is_active = true
         ) sync ON true
         LEFT JOIN users father_u ON father_u.id = sync.father_user_id
         LEFT JOIN users mother_u ON mother_u.id = sync.mother_user_id
         LEFT JOIN users guardian_u ON guardian_u.id = sync.guardian_user_id
         WHERE s.id = $1 LIMIT 1`,
        [id]
      );
      const docRow = existingDocRes.rows[0] || {};
      const existingMedDoc = docRow.medical_document_path ?? null;
      const existingTcDoc = docRow.transfer_certificate_path ?? null;
      const existingPhoto = docRow.photo_url ?? null;
      const oldFatherAvatar = docRow.father_avatar ?? null;
      const oldMotherAvatar = docRow.mother_avatar ?? null;
      const oldGuardianAvatar = docRow.guardian_avatar ?? null;

      const tenantSchoolIdUp = getSchoolIdFromRequest(req);

      let medDocPathFinal;
      if (medical_document_path === undefined) {
        medDocPathFinal = existingMedDoc;
      } else if (medical_document_path === null || String(medical_document_path).trim() === '') {
        medDocPathFinal = null;
      } else {
        medDocPathFinal = normalizeStudentDocumentPath(tenantSchoolIdUp, medical_document_path);
        if (!medDocPathFinal) {
          const err = new Error('Invalid medical document path');
          err.statusCode = 400;
          throw err;
        }
      }

      let tcDocPathFinal;
      if (transfer_certificate_path === undefined) {
        tcDocPathFinal = existingTcDoc;
      } else if (transfer_certificate_path === null || String(transfer_certificate_path).trim() === '') {
        tcDocPathFinal = null;
      } else {
        tcDocPathFinal = normalizeStudentDocumentPath(tenantSchoolIdUp, transfer_certificate_path);
        if (!tcDocPathFinal) {
          const err = new Error('Invalid transfer certificate path');
          err.statusCode = 400;
          throw err;
        }
      }
      let photoUrlPathFinal;
      if (photo_url === undefined) {
        photoUrlPathFinal = existingPhoto;
      } else if (photo_url === null || String(photo_url).trim() === '') {
        photoUrlPathFinal = null;
      } else {
        photoUrlPathFinal = normalizeStudentPhotoPath(tenantSchoolIdUp, photo_url);
        if (!photoUrlPathFinal) {
          const err = new Error('Invalid photo URL path');
          err.statusCode = 400;
          throw err;
        }
      }

      let result;
      await client.query('SAVEPOINT sp_student_update');
      try {
        // Primary path: for schemas using correct "religion_id" column
        result = await client.query(`
          UPDATE students SET
            academic_year_id = $1,
            admission_number = $2,
            admission_date = $3,
            roll_number = $4,
            first_name = $5,
            last_name = $6,
            class_id = $7,
            section_id = $8,
            gender = $9,
            date_of_birth = $10,
            blood_group_id = $11,
            house_id = $12,
            religion_id = $13,
            cast_id = $14,
            phone = $15,
            email = $16,
            mother_tongue_id = $17,
            is_active = $18,
            address = $19,
            current_address = $20,
            permanent_address = $21,
            previous_school = $22,
            previous_school_address = $23,
            is_transport_required = $24,
            route_id = $25,
            pickup_point_id = $26,
            vehicle_number = $27,
            is_hostel_required = $28,
            hostel_id = $29,
            hostel_room_id = $30,
            bank_name = $31,
            branch = $32,
            ifsc = $33,
            known_allergies = $34,
            medications = $35,
            medical_condition = $36,
            other_information = $37,
            unique_student_ids = $38,
            pen_number = $39,
            aadhar_no = $40,
            gr_number = $41,
            medical_document_path = $42,
            transfer_certificate_path = $43,
            photo_url = $44,
            modified_at = NOW()
          WHERE id = $45
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male', 'female', 'other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
          date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
          cast_id || null, phone || null, email || null, mother_tongue_id || null,
          status === 'Active' ? true : false,
          addrVal || 'Not Provided',
          current_address || addrVal || 'Not Provided',
          permanent_address || 'Not Provided',
          previous_school || null, previous_school_address || null,
          is_transport_required === true || is_transport_required === 'true',
          route_id || null, pickup_point_id || null, vehicle_number || null,
          is_hostel_required === true || is_hostel_required === 'true',
          hostel_id || null, hostel_room_id || null,
          bank_name || null, branch || null, ifsc || null,
          knownAllergiesVal, medicationsVal,
          medical_condition || null, other_information || null,
          uniqueStudentIdsNormUpdate, penNumberNormUpdate, aadharNormUpdate,
          grNormUpdate,
          medDocPathFinal,
          tcDocPathFinal,
          photoUrlPathFinal,
          id
        ]);
        await client.query('RELEASE SAVEPOINT sp_student_update');

        if (medical_document_path !== undefined && existingMedDoc && existingMedDoc !== medDocPathFinal) {
          await deleteFileIfExist(existingMedDoc);
        }
        if (transfer_certificate_path !== undefined && existingTcDoc && existingTcDoc !== tcDocPathFinal) {
          await deleteFileIfExist(existingTcDoc);
        }
        if (photo_url !== undefined && existingPhoto && existingPhoto !== photoUrlPathFinal) {
          await deleteFileIfExist(existingPhoto);
        }
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT sp_student_update');
        const hasAddrColsError = e.message && (e.message.includes('current_address') || e.message.includes('permanent_address'));
        if (hasAddrColsError) {
          try {
            result = await client.query(`
              UPDATE students SET
                academic_year_id = $1,
                admission_number = $2,
                admission_date = $3,
                roll_number = $4,
                first_name = $5,
                last_name = $6,
                class_id = $7,
                section_id = $8,
                gender = $9,
                date_of_birth = $10,
                blood_group_id = $11,
                house_id = $12,
                religion_id = $13,
                cast_id = $14,
                phone = $15,
                email = $16,
                mother_tongue_id = $17,
                is_active = $18,
                address = $19,
                previous_school = $20,
                previous_school_address = $21,
                is_transport_required = $22,
                route_id = $23,
                pickup_point_id = $24,
                vehicle_number = $25,
                is_hostel_required = $26,
                hostel_id = $27,
                hostel_room_id = $28,
                bank_name = $29,
                branch = $30,
                ifsc = $31,
                known_allergies = $32,
                medications = $33,
                medical_condition = $34,
                other_information = $35,
                unique_student_ids = $36,
                pen_number = $37,
                aadhar_no = $38,
                gr_number = $39,
                medical_document_path = $40,
                transfer_certificate_path = $41,
                modified_at = NOW()
              WHERE id = $42
              RETURNING *
            `, [
              academic_year_id || null, admission_number, admission_date || null, roll_number || null,
              first_name, last_name, class_id || null, section_id || null,
              (gender && typeof gender === 'string' && ['male', 'female', 'other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
              date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
              cast_id || null, phone || null, email || null, mother_tongue_id || null,
              status === 'Active' ? true : false,
              addrVal || 'Not Provided',
              previous_school || null, previous_school_address || null,
              is_transport_required === true || is_transport_required === 'true',
              route_id || null, pickup_point_id || null, vehicle_number || null,
              is_hostel_required === true || is_hostel_required === 'true',
              hostel_id || null, hostel_room_id || null,
              bank_name || null, branch || null, ifsc || null,
              knownAllergiesVal, medicationsVal,
              medical_condition || null, other_information || null,
              uniqueStudentIdsNormUpdate, penNumberNormUpdate, aadharNormUpdate,
              grNormUpdate,
              medDocPathFinal,
              tcDocPathFinal,
              id
            ]);
          } catch (e2) {
            throw e;
          }
        } else if (e.message && (e.message.includes('religion_id') || e.message.includes('reigion'))) {
          result = await client.query(`
            UPDATE students SET
              academic_year_id = $1,
              admission_number = $2,
              admission_date = $3,
              roll_number = $4,
              first_name = $5,
              last_name = $6,
              class_id = $7,
              section_id = $8,
              gender = $9,
              date_of_birth = $10,
              blood_group_id = $11,
              house_id = $12,
              religion_id = $13,
              cast_id = $14,
              phone = $15,
              email = $16,
              mother_tongue_id = $17,
              is_active = $18,
              address = $19,
              current_address = $20,
              permanent_address = $21,
              previous_school = $22,
              previous_school_address = $23,
              is_transport_required = $24,
              route_id = $25,
              pickup_point_id = $26,
              vehicle_number = $27,
              is_hostel_required = $28,
              hostel_id = $29,
              hostel_room_id = $30,
              bank_name = $31,
              branch = $32,
              ifsc = $33,
              known_allergies = $34,
              medications = $35,
              medical_condition = $36,
              other_information = $37,
              unique_student_ids = $38,
              pen_number = $39,
              aadhar_no = $40,
              gr_number = $41,
              medical_document_path = $42,
              transfer_certificate_path = $43,
              modified_at = NOW()
            WHERE id = $44
            RETURNING *
          `, [
            academic_year_id || null, admission_number, admission_date || null, roll_number || null,
            first_name, last_name, class_id || null, section_id || null,
            (gender && typeof gender === 'string' && ['male', 'female', 'other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
            date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
            cast_id || null, phone || null, email || null, mother_tongue_id || null,
            status === 'Active' ? true : false,
            addrVal || 'Not Provided',
            current_address || addrVal || 'Not Provided',
            permanent_address || 'Not Provided',
            previous_school || null, previous_school_address || null,
            is_transport_required === true || is_transport_required === 'true',
            route_id || null, pickup_point_id || null, vehicle_number || null,
            is_hostel_required === true || is_hostel_required === 'true',
            hostel_id || null, hostel_room_id || null,
            bank_name || null, branch || null, ifsc || null,
            knownAllergiesVal, medicationsVal,
            medical_condition || null, other_information || null,
            uniqueStudentIdsNormUpdate, penNumberNormUpdate, aadharNormUpdate,
            grNormUpdate,
            medDocPathFinal,
            tcDocPathFinal,
            id
          ]);
        } else {
          throw e;
        }
        await client.query('RELEASE SAVEPOINT sp_student_update');
      }

      if (result.rows.length === 0) {
        const err = new Error('Student not found');
        err.statusCode = 404;
        throw err;
      }

      const studentRow = result.rows[0];

      const stuPhoneUp = (phone || '').toString().trim();
      const stuEmailUp = (email || '').toString().trim();
      if (!studentRow.user_id && (stuPhoneUp || stuEmailUp || admission_number)) {
        try {
          const studentUserId = await createStudentUser(client, {
            admission_number,
            first_name,
            last_name,
            phone: stuPhoneUp || null,
            email: stuEmailUp || null,
          });
          if (studentUserId) {
            await client.query('UPDATE students SET user_id = $1, modified_at = NOW() WHERE id = $2', [
              studentUserId,
              studentRow.id,
            ]);
            studentRow.user_id = studentUserId;
          } else if (stuEmailUp && (await isUserEmailTaken(client, stuEmailUp))) {
            updateWarnings.push(buildEmailInUseWarning('email', 'Student'));
          }
        } catch (e) {
          console.warn('updateStudent: could not create student user:', e.message);
        }
      }

      if (hasParentInfo || hasGuardianInfo) {
        const sync = await syncStudentGuardians(
          client,
          studentRow.id,
          {
            effFatherName,
            effFatherEmail,
            effFatherPhone,
            effFatherOcc,
            effMotherName,
            effMotherEmail,
            effMotherPhone,
            effMotherOcc,
            effGFirst,
            effGLast,
            effGPhone,
            effGEmail,
            effGOcc,
            effGAddr,
            effGRel: guardian_relation,
            fatherUserId,
            motherUserId,
            guardianUserId,
          },
          updateWarnings
        );
        studentRow.guardian_id = sync.primaryGuardianId;

        if (father_image_url !== undefined && sync.fatherUserId) {
          const newFatherAvatar = (father_image_url || '').toString().trim() || '';
          await client.query(`UPDATE users SET avatar = $1, modified_at = NOW() WHERE id = $2`, [
            newFatherAvatar,
            sync.fatherUserId,
          ]);
          if (oldFatherAvatar && oldFatherAvatar !== newFatherAvatar) {
            await deleteFileIfExist(oldFatherAvatar);
          }
        }
        if (mother_image_url !== undefined && sync.motherUserId) {
          const newMotherAvatar = (mother_image_url || '').toString().trim() || '';
          await client.query(`UPDATE users SET avatar = $1, modified_at = NOW() WHERE id = $2`, [
            newMotherAvatar,
            sync.motherUserId,
          ]);
          if (oldMotherAvatar && oldMotherAvatar !== newMotherAvatar) {
            await deleteFileIfExist(oldMotherAvatar);
          }
        }
        if (guardian_image_url !== undefined && sync.guardianUserId) {
          const newGuardianAvatar = (guardian_image_url || '').toString().trim() || '';
          await client.query(`UPDATE users SET avatar = $1, modified_at = NOW() WHERE id = $2`, [
            newGuardianAvatar,
            sync.guardianUserId,
          ]);
          if (oldGuardianAvatar && oldGuardianAvatar !== newGuardianAvatar) {
            await deleteFileIfExist(oldGuardianAvatar);
          }
        }
      }

      // Sync current & permanent address into addresses table so that
      // Student Details and Edit Student form stay consistent with the DB.
      if ((current_address || permanent_address || addrVal) && studentRow.user_id) {
        const currentAddrVal = current_address || addrVal || 'Not Provided';
        const permanentAddrVal = permanent_address || 'Not Provided';

        const existingAddr = await client.query(
          'SELECT id FROM addresses WHERE user_id = $1 AND role_id = $2 LIMIT 1',
          [studentRow.user_id, ROLES.STUDENT]
        );

        if (existingAddr.rows.length > 0) {
          await client.query(
            `
            UPDATE addresses SET
              current_address = $1,
              permanent_address = $2,
              person_id = $3
            WHERE id = $4
          `,
            [currentAddrVal, permanentAddrVal, studentRow.id, existingAddr.rows[0].id]
          );
        } else if (currentAddrVal || permanentAddrVal) {
          await client.query(
            `
            INSERT INTO addresses (
              current_address,
              permanent_address,
              user_id,
              role_id,
              person_id,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
          `,
            [currentAddrVal, permanentAddrVal, studentRow.user_id, ROLES.STUDENT, studentRow.id]
          );
        }
      }

      // Handle Siblings Update: Clear existing and re-insert
      await client.query('DELETE FROM student_siblings WHERE student_id = $1', [id]);
      if (Array.isArray(siblings) && siblings.length > 0) {
        for (const sib of siblings) {
          if (!sib.name && !sib.admission_number) continue;
          await client.query(
            `INSERT INTO student_siblings (
              student_id, is_in_same_school, name, class_name, section_name, roll_number, admission_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              sib.is_in_same_school === true || sib.is_in_same_school === 'true',
              sib.name || null,
              sib.class_name || null,
              sib.section_name || null,
              sib.roll_number || null,
              sib.admission_number || null,
            ]
          );
        }
      }

      return { studentRow, warnings: updateWarnings };
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student updated successfully',
      data: updateResult.studentRow,
      warnings: updateResult.warnings || [],
    });
  } catch (error) {
    console.error('Error updating student:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: process.env.NODE_ENV === 'production' ? 'Invalid request' : error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ status: 'ERROR', message: process.env.NODE_ENV === 'production' ? 'Not found' : error.message });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ status: 'ERROR', message: error.message });
    }
    const devMsg = process.env.NODE_ENV !== 'production' ? (error.message || 'Failed to update student') : 'Failed to update student';
    res.status(500).json({
      status: 'ERROR',
      message: devMsg
    });
  }
};

const normalizeOverallResult = (val) => {
  const s = String(val || '').trim().toLowerCase();
  if (!s) return 'Not Available';
  if (['pass', 'p', 'passed'].includes(s)) return 'Pass';
  if (['fail', 'f', 'failed'].includes(s)) return 'Fail';
  return 'Not Available';
};

const computeLastClassResult = async (client, studentId, classId, academicYearId) => {
  try {
    if (!studentId) return 'Not Available';
    const params = [studentId];
    const scoped = [];
    if (classId != null) {
      params.push(classId);
      scoped.push(`e.class_id = $${params.length}`);
    }
    if (academicYearId != null) {
      params.push(academicYearId);
      scoped.push(`e.academic_year_id = $${params.length}`);
    }
    const scopedSql = scoped.length > 0 ? `AND ${scoped.join(' AND ')}` : '';
    const examRes = await client.query(
      `SELECT er.exam_id, COALESCE(e.start_date, e.end_date, e.modified_at, e.created_at) AS exam_date
       FROM exam_results er
       LEFT JOIN exams e ON e.id = er.exam_id
       WHERE er.student_id = $1
         AND er.exam_id IS NOT NULL
         ${scopedSql}
       ORDER BY COALESCE(e.start_date, e.end_date, e.modified_at, e.created_at) DESC NULLS LAST, er.exam_id DESC
       LIMIT 1`,
      params
    );
    const latestExamId = examRes.rows[0]?.exam_id;
    if (!latestExamId) return 'Not Available';
    const summary = await client.query(
      `SELECT
         COUNT(*)::int AS subjects_count,
         COALESCE(SUM(CASE WHEN er.is_absent = true THEN 0 ELSE COALESCE(er.marks_obtained, er.obtained_marks, er.marks, er.marks_scored, er.score, 0) END), 0)::numeric AS total_obtained,
         COALESCE(SUM(COALESCE(er.min_marks, er.pass_marks, er.min_mark, er.min, 0)), 0)::numeric AS total_min
       FROM exam_results er
       WHERE er.student_id = $1 AND er.exam_id = $2`,
      [studentId, latestExamId]
    );
    const row = summary.rows[0];
    if (!row || Number(row.subjects_count || 0) === 0) return 'Not Available';
    return Number(row.total_obtained || 0) >= Number(row.total_min || 0) ? 'Pass' : 'Fail';
  } catch (e) {
    console.warn('computeLastClassResult failed:', e.message);
    return 'Not Available';
  }
};

const deactivateLinkedAccountsForLeftStudent = async (client, studentRow) => {
  if (!studentRow) return;

  // Deactivate student login
  if (studentRow.user_id != null) {
    await client.query(
      'UPDATE users SET is_active = false, modified_at = NOW() WHERE id = $1',
      [studentRow.user_id]
    );
  }

  const links = await client.query(
    `SELECT id, user_id FROM guardians WHERE student_id = $1 AND user_id IS NOT NULL`,
    [studentRow.id]
  );
  for (const link of links.rows) {
    await client.query(`UPDATE guardians SET is_active = false, modified_at = NOW() WHERE id = $1`, [link.id]);
    const uid = link.user_id;
    const stillUsed = await client.query(
      `SELECT 1 FROM guardians g
       INNER JOIN students s ON s.id = g.student_id
       WHERE g.user_id = $1 AND s.is_active = true AND g.student_id <> $2 LIMIT 1`,
      [uid, studentRow.id]
    );
    if (stillUsed.rows.length === 0) {
      await client.query(`UPDATE users SET is_active = false, modified_at = NOW() WHERE id = $1`, [uid]);
    }
  }
};

const reactivateLinkedAccountsForRejoinedStudent = async (client, studentRow) => {
  if (!studentRow) return;

  if (studentRow.user_id != null) {
    await client.query(
      'UPDATE users SET is_active = true, modified_at = NOW() WHERE id = $1',
      [studentRow.user_id]
    );
  }

  const links = await client.query(
    `SELECT id, user_id FROM guardians WHERE student_id = $1`,
    [studentRow.id]
  );
  for (const link of links.rows) {
    await client.query(`UPDATE guardians SET is_active = true, modified_at = NOW() WHERE id = $1`, [link.id]);
    if (link.user_id != null) {
      await client.query(`UPDATE users SET is_active = true, modified_at = NOW() WHERE id = $1`, [link.user_id]);
    }
  }
};

/**
 * Bulk promote: update students' academic year / class / section and record history in student_promotions.
 */
const promoteStudents = async (req, res) => {
  try {
    const {
      student_ids: studentIds,
      to_class_id: toClassId,
      to_section_id: toSectionId,
      to_academic_year_id: toAcademicYearId,
      from_academic_year_id: fromAcademicYearId,
    } = req.body;

    // Disallow backward / same-year promotion.
    // Compare by year label (preferred), with id-order fallback.
    const parseYearKey = (name) => {
      const m = String(name || '').match(/\b(19|20)\d{2}\b/);
      return m ? parseInt(m[0], 10) : null;
    };
    if (fromAcademicYearId != null) {
      const yearsRes = await query(
        `SELECT id, year_name
         FROM academic_years
         WHERE id = ANY($1::int[])`,
        [[Number(fromAcademicYearId), Number(toAcademicYearId)]]
      );
      const fromRow = yearsRes.rows.find((r) => Number(r.id) === Number(fromAcademicYearId));
      const toRow = yearsRes.rows.find((r) => Number(r.id) === Number(toAcademicYearId));
      if (fromRow && toRow) {
        const fromKey = parseYearKey(fromRow.year_name);
        const toKey = parseYearKey(toRow.year_name);
        const isForward = (fromKey != null && toKey != null)
          ? toKey > fromKey
          : Number(toAcademicYearId) > Number(fromAcademicYearId);
        if (!isForward) {
          return res.status(400).json({
            status: 'ERROR',
            message: 'Target academic year must be greater than current academic year',
          });
        }
      } else if (Number(toAcademicYearId) <= Number(fromAcademicYearId)) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Target academic year must be greater than current academic year',
        });
      }
    }

    const userId = req.user?.id;
    let promotedByStaffId = null;
    if (userId) {
      const staffRes = await query(
        'SELECT id FROM staff WHERE user_id = $1 AND is_active = true LIMIT 1',
        [userId]
      );
      if (staffRes.rows.length > 0) {
        promotedByStaffId = staffRes.rows[0].id;
      }
    }

    const classCheck = await query(
      `SELECT id FROM classes
       WHERE id = $1 AND academic_year_id = $2 AND COALESCE(is_active, true) = true`,
      [toClassId, toAcademicYearId]
    );
    if (classCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Target class is invalid for the selected academic year',
      });
    }

    const sectionCheck = await query(
      'SELECT id, class_id FROM sections WHERE id = $1 AND COALESCE(is_active, true) = true',
      [toSectionId]
    );
    if (sectionCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Target section not found',
      });
    }
    const secRow = sectionCheck.rows[0];
    if (secRow.class_id != null && Number(secRow.class_id) !== Number(toClassId)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Target section does not belong to the target class',
      });
    }

    const uniqueIds = [...new Set(studentIds.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n)))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'No valid student IDs' });
    }

    const result = await executeTransaction(async (client) => {
      let promoted = 0;
      const impactedClassIds = new Set();
      const impactedSectionIds = new Set();
      for (const sid of uniqueIds) {
        const sRes = await client.query(
          `SELECT id, academic_year_id, class_id, section_id, is_active
           FROM students WHERE id = $1 LIMIT 1`,
          [sid]
        );
        if (sRes.rows.length === 0) {
          const err = new Error(`Student ${sid} not found`);
          err.statusCode = 400;
          throw err;
        }
        const s = sRes.rows[0];
        if (s.is_active === false || s.is_active === 'f' || s.is_active === 0) {
          const err = new Error(`Student ${sid} is not active`);
          err.statusCode = 400;
          throw err;
        }
        if (
          fromAcademicYearId != null &&
          s.academic_year_id != null &&
          Number(s.academic_year_id) !== Number(fromAcademicYearId)
        ) {
          const err = new Error(
            `Student ${sid} is not enrolled in the selected current academic year`
          );
          err.statusCode = 400;
          throw err;
        }

        const fromClassId = s.class_id;
        const fromSectionId = s.section_id;
        const fromYearId = s.academic_year_id;

        await client.query(
          `UPDATE students SET
            academic_year_id = $1,
            class_id = $2,
            section_id = $3,
            modified_at = NOW()
           WHERE id = $4`,
          [toAcademicYearId, toClassId, toSectionId, sid]
        );

        // Maintain class/section aggregates for screens that read no_of_students.
        if (fromClassId != null) impactedClassIds.add(Number(fromClassId));
        if (toClassId != null) impactedClassIds.add(Number(toClassId));
        if (fromSectionId != null) impactedSectionIds.add(Number(fromSectionId));
        if (toSectionId != null) impactedSectionIds.add(Number(toSectionId));

        await client.query(
          `INSERT INTO student_promotions (
            student_id,
            from_class_id,
            to_class_id,
            from_section_id,
            to_section_id,
            from_academic_year_id,
            to_academic_year_id,
            status,
            promoted_by,
            remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            sid,
            fromClassId,
            toClassId,
            fromSectionId,
            toSectionId,
            fromYearId,
            toAcademicYearId,
            'promoted',
            promotedByStaffId,
            null,
          ]
        );
        promoted += 1;
      }

      const canUpdateClassStudentCount = await hasColumn('classes', 'no_of_students');
      const canUpdateSectionStudentCount = await hasColumn('sections', 'no_of_students');

      if (canUpdateClassStudentCount && impactedClassIds.size > 0) {
        await client.query(
          `UPDATE classes c
           SET no_of_students = COALESCE(s.cnt, 0),
               modified_at = NOW()
           FROM (
             SELECT class_id, COUNT(*)::int AS cnt
             FROM students
             WHERE is_active = true AND class_id = ANY($1::int[])
             GROUP BY class_id
           ) s
           WHERE c.id = s.class_id`,
          [[...impactedClassIds]]
        );
        await client.query(
          `UPDATE classes
           SET no_of_students = 0,
               modified_at = NOW()
           WHERE id = ANY($1::int[])
             AND id NOT IN (
               SELECT class_id
               FROM students
               WHERE is_active = true AND class_id = ANY($1::int[])
             )`,
          [[...impactedClassIds]]
        );
      }

      if (canUpdateSectionStudentCount && impactedSectionIds.size > 0) {
        await client.query(
          `UPDATE sections sct
           SET no_of_students = COALESCE(s.cnt, 0),
               modified_at = NOW()
           FROM (
             SELECT section_id, COUNT(*)::int AS cnt
             FROM students
             WHERE is_active = true AND section_id = ANY($1::int[])
             GROUP BY section_id
           ) s
           WHERE sct.id = s.section_id`,
          [[...impactedSectionIds]]
        );
        await client.query(
          `UPDATE sections
           SET no_of_students = 0,
               modified_at = NOW()
           WHERE id = ANY($1::int[])
             AND id NOT IN (
               SELECT section_id
               FROM students
               WHERE is_active = true AND section_id = ANY($1::int[])
             )`,
          [[...impactedSectionIds]]
        );
      }

      return promoted;
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Students promoted successfully',
      data: { promoted: result },
    });
  } catch (error) {
    console.error('Error promoting students:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({
        status: 'ERROR',
        message: error.message || 'Invalid promotion request',
      });
    }
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to promote students',
    });
  }
};

/**
 * Bulk mark students as leaving school from the promotion screen.
 * Stores a full snapshot in leaving_students and deactivates linked accounts.
 */
const leaveStudents = async (req, res) => {
  try {
    const {
      student_ids: studentIds,
      leaving_date: leavingDateRaw,
      reason,
      remarks,
      from_academic_year_id: fromAcademicYearId,
    } = req.body;

    const leavingDate = leavingDateRaw || new Date().toISOString().slice(0, 10);
    const userId = req.user?.id;
    let leftByStaffId = null;

    if (userId) {
      const staffRes = await query(
        'SELECT id FROM staff WHERE user_id = $1 AND is_active = true LIMIT 1',
        [userId]
      );
      if (staffRes.rows.length > 0) leftByStaffId = staffRes.rows[0].id;
    }

    const uniqueIds = [...new Set(studentIds.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n)))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'No valid student IDs' });
    }

    const result = await executeTransaction(async (client) => {
      let left = 0;
      for (const sid of uniqueIds) {
        const sRes = await client.query(
          `SELECT
             s.id, s.user_id, s.guardian_id, s.is_active,
             s.admission_number, s.first_name, s.last_name,
             s.class_id, s.section_id, s.academic_year_id, s.admission_date
           FROM students s
           WHERE s.id = $1
           LIMIT 1`,
          [sid]
        );
        if (sRes.rows.length === 0) {
          const err = new Error(`Student ${sid} not found`);
          err.statusCode = 400;
          throw err;
        }
        const s = sRes.rows[0];
        if (s.is_active === false || s.is_active === 'f' || s.is_active === 0) {
          const err = new Error(`Student ${sid} is already inactive`);
          err.statusCode = 400;
          throw err;
        }
        if (
          fromAcademicYearId != null &&
          s.academic_year_id != null &&
          Number(s.academic_year_id) !== Number(fromAcademicYearId)
        ) {
          const err = new Error(`Student ${sid} is not in the selected current academic year`);
          err.statusCode = 400;
          throw err;
        }

        const alreadyLeft = await client.query(
          'SELECT id FROM leaving_students WHERE student_id = $1 AND is_active = true LIMIT 1',
          [sid]
        );
        if (alreadyLeft.rows.length > 0) {
          const err = new Error(`Student ${sid} already has an active leaving record`);
          err.statusCode = 400;
          throw err;
        }

        const firstHistory = await client.query(
          `SELECT from_class_id, from_section_id, from_academic_year_id
           FROM student_promotions
           WHERE student_id = $1
           ORDER BY promotion_date ASC NULLS LAST, id ASC
           LIMIT 1`,
          [sid]
        );
        const first = firstHistory.rows[0] || {};

        const joiningClassId = first.from_class_id ?? s.class_id ?? null;
        const joiningSectionId = first.from_section_id ?? s.section_id ?? null;
        const joiningAcademicYearId = first.from_academic_year_id ?? s.academic_year_id ?? null;

        const lastClassResult = await computeLastClassResult(
          client,
          sid,
          s.class_id ?? null,
          s.academic_year_id ?? null
        );

        await client.query(
          `INSERT INTO leaving_students (
             student_id, admission_number, student_first_name, student_last_name,
             joining_class_id, joining_section_id, joining_academic_year_id, joining_date,
             last_class_id, last_section_id, last_academic_year_id, leaving_date,
             last_class_result, reason, remarks, left_by, created_by
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8,
             $9, $10, $11, $12,
             $13, $14, $15, $16, $17
           )`,
          [
            sid,
            s.admission_number ?? null,
            s.first_name ?? null,
            s.last_name ?? null,
            joiningClassId,
            joiningSectionId,
            joiningAcademicYearId,
            s.admission_date ?? null,
            s.class_id ?? null,
            s.section_id ?? null,
            s.academic_year_id ?? null,
            leavingDate,
            normalizeOverallResult(lastClassResult),
            reason || null,
            remarks || null,
            leftByStaffId,
            userId || null,
          ]
        );

        await client.query(
          `UPDATE students
           SET is_active = false, modified_at = NOW()
           WHERE id = $1`,
          [sid]
        );

        await deactivateLinkedAccountsForLeftStudent(client, s);
        left += 1;
      }
      return left;
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Students marked as leaving successfully',
      data: { left: result },
    });
  } catch (error) {
    console.error('Error leaving students:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({
        status: 'ERROR',
        message: error.message || 'Invalid leave request',
      });
    }
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to leave students',
    });
  }
};

/**
 * Rejoin a previously left student without creating duplicate student/user records.
 * Reactivates student + linked accounts and closes the active leaving record.
 */
const rejoinStudent = async (req, res) => {
  try {
    const parseYearKey = (name) => {
      const m = String(name || '').match(/\b(19|20)\d{2}\b/);
      return m ? parseInt(m[0], 10) : null;
    };
    const {
      student_id: studentIdRaw,
      to_class_id: toClassIdRaw,
      to_section_id: toSectionIdRaw,
      to_academic_year_id: toAcademicYearIdRaw,
      rejoin_date: rejoinDateRaw,
      reason: rejoinReasonRaw,
      remarks: rejoinRemarksRaw,
    } = req.body;

    const studentId = Number(studentIdRaw);
    const toClassId = Number(toClassIdRaw);
    const toSectionId = Number(toSectionIdRaw);
    const toAcademicYearId = Number(toAcademicYearIdRaw);
    const rejoinDate = rejoinDateRaw || new Date().toISOString().slice(0, 10);
    const rejoinReason = String(rejoinReasonRaw || '').trim() || null;
    const rejoinRemarks = String(rejoinRemarksRaw || '').trim() || null;
    const userId = req.user?.id || null;
    const rejoinedByUserId = userId;

    const classCheck = await query(
      `SELECT id FROM classes
       WHERE id = $1 AND academic_year_id = $2 AND COALESCE(is_active, true) = true`,
      [toClassId, toAcademicYearId]
    );
    if (classCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Target class is invalid for the selected academic year',
      });
    }

    const sectionCheck = await query(
      'SELECT id, class_id FROM sections WHERE id = $1 AND COALESCE(is_active, true) = true',
      [toSectionId]
    );
    if (sectionCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Target section not found',
      });
    }
    if (
      sectionCheck.rows[0].class_id != null &&
      Number(sectionCheck.rows[0].class_id) !== Number(toClassId)
    ) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Target section does not belong to the target class',
      });
    }

    await executeTransaction(async (client) => {
      const studentRes = await client.query(
        `SELECT id, user_id, class_id, section_id, academic_year_id, is_active
         FROM students
         WHERE id = $1
         LIMIT 1`,
        [studentId]
      );
      if (studentRes.rows.length === 0) {
        const err = new Error('Student not found');
        err.statusCode = 400;
        throw err;
      }
      const student = studentRes.rows[0];
      if (student.is_active === true || student.is_active === 't' || student.is_active === 1) {
        const err = new Error('Student is already active');
        err.statusCode = 400;
        throw err;
      }

      const leavingRes = await client.query(
        `SELECT
           id,
           admission_number,
           student_first_name,
           student_last_name,
           last_class_id,
           last_section_id,
           last_academic_year_id,
           leaving_date
         FROM leaving_students
         WHERE student_id = $1 AND COALESCE(is_active, true) = true
         ORDER BY id DESC
         LIMIT 1`,
        [studentId]
      );
      if (leavingRes.rows.length === 0) {
        const err = new Error('No active leaving record found for this student');
        err.statusCode = 400;
        throw err;
      }
      const activeLeaving = leavingRes.rows[0];
      const hasStudentRejoinsTable = await hasTable('student_rejoins');
      if (!hasStudentRejoinsTable) {
        const err = new Error(
          'student_rejoins table is missing. Please run migration 046_create_student_rejoins.sql'
        );
        err.statusCode = 500;
        throw err;
      }

      if (activeLeaving.last_academic_year_id != null) {
        const fromYearId = Number(activeLeaving.last_academic_year_id);
        const yearsRes = await client.query(
          `SELECT id, year_name
           FROM academic_years
           WHERE id = ANY($1::int[])`,
          [[fromYearId, Number(toAcademicYearId)]]
        );
        const fromRow = yearsRes.rows.find((r) => Number(r.id) === fromYearId);
        const toRow = yearsRes.rows.find((r) => Number(r.id) === Number(toAcademicYearId));
        const fromKey = parseYearKey(fromRow?.year_name);
        const toKey = parseYearKey(toRow?.year_name);

        const isForward = (fromKey != null && toKey != null)
          ? toKey > fromKey
          : Number(toAcademicYearId) > fromYearId;

        if (!isForward) {
          const err = new Error(
            'Rejoin academic year must be greater than the student leaving academic year'
          );
          err.statusCode = 400;
          throw err;
        }
      }

      await client.query(
        `UPDATE students
         SET is_active = true,
             academic_year_id = $1,
             class_id = $2,
             section_id = $3,
             modified_at = NOW()
         WHERE id = $4`,
        [toAcademicYearId, toClassId, toSectionId, studentId]
      );

      await client.query(
        `INSERT INTO student_rejoins (
           student_id,
           leaving_student_id,
           admission_number,
           student_first_name,
           student_last_name,
           from_class_id,
           from_section_id,
           from_academic_year_id,
           leaving_date,
           to_class_id,
           to_section_id,
           to_academic_year_id,
           rejoin_date,
           reason,
           remarks,
           rejoined_by,
           created_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17
         )`,
        [
          studentId,
          activeLeaving.id,
          activeLeaving.admission_number ?? null,
          activeLeaving.student_first_name ?? null,
          activeLeaving.student_last_name ?? null,
          activeLeaving.last_class_id ?? student.class_id ?? null,
          activeLeaving.last_section_id ?? student.section_id ?? null,
          activeLeaving.last_academic_year_id ?? student.academic_year_id ?? null,
          activeLeaving.leaving_date ?? null,
          toClassId,
          toSectionId,
          toAcademicYearId,
          rejoinDate,
          rejoinReason,
          rejoinRemarks,
          rejoinedByUserId,
          userId,
        ]
      );

      await reactivateLinkedAccountsForRejoinedStudent(client, student);

      const stampedRemark = rejoinRemarks
        ? `Rejoined: ${rejoinRemarks}`
        : 'Rejoined';
      await client.query(
        `UPDATE leaving_students
         SET is_active = false,
             remarks = CASE
               WHEN remarks IS NULL OR TRIM(remarks) = '' THEN $1
               ELSE remarks || E'\n' || $1
             END,
             modified_at = NOW()
         WHERE id = $2`,
        [stampedRemark, activeLeaving.id]
      );

      const impactedClassIds = new Set();
      const impactedSectionIds = new Set();
      if (student.class_id != null) impactedClassIds.add(Number(student.class_id));
      if (toClassId != null) impactedClassIds.add(Number(toClassId));
      if (student.section_id != null) impactedSectionIds.add(Number(student.section_id));
      if (toSectionId != null) impactedSectionIds.add(Number(toSectionId));

      const canUpdateClassStudentCount = await hasColumn('classes', 'no_of_students');
      const canUpdateSectionStudentCount = await hasColumn('sections', 'no_of_students');

      if (canUpdateClassStudentCount && impactedClassIds.size > 0) {
        await client.query(
          `UPDATE classes c
           SET no_of_students = COALESCE(s.cnt, 0),
               modified_at = NOW()
           FROM (
             SELECT class_id, COUNT(*)::int AS cnt
             FROM students
             WHERE is_active = true AND class_id = ANY($1::int[])
             GROUP BY class_id
           ) s
           WHERE c.id = s.class_id`,
          [[...impactedClassIds]]
        );
        await client.query(
          `UPDATE classes
           SET no_of_students = 0,
               modified_at = NOW()
           WHERE id = ANY($1::int[])
             AND id NOT IN (
               SELECT class_id
               FROM students
               WHERE is_active = true AND class_id = ANY($1::int[])
             )`,
          [[...impactedClassIds]]
        );
      }

      if (canUpdateSectionStudentCount && impactedSectionIds.size > 0) {
        await client.query(
          `UPDATE sections sct
           SET no_of_students = COALESCE(s.cnt, 0),
               modified_at = NOW()
           FROM (
             SELECT section_id, COUNT(*)::int AS cnt
             FROM students
             WHERE is_active = true AND section_id = ANY($1::int[])
             GROUP BY section_id
           ) s
           WHERE sct.id = s.section_id`,
          [[...impactedSectionIds]]
        );
        await client.query(
          `UPDATE sections
           SET no_of_students = 0,
               modified_at = NOW()
           WHERE id = ANY($1::int[])
             AND id NOT IN (
               SELECT section_id
               FROM students
               WHERE is_active = true AND section_id = ANY($1::int[])
             )`,
          [[...impactedSectionIds]]
        );
      }
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Student rejoined successfully',
      data: { student_id: studentId },
    });
  } catch (error) {
    console.error('Error rejoining student:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({
        status: 'ERROR',
        message: error.message || 'Invalid rejoin request',
      });
    }
    if (error.statusCode === 500) {
      return res.status(500).json({
        status: 'ERROR',
        message: error.message || 'Failed to rejoin student',
      });
    }
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to rejoin student',
    });
  }
};

// Get student promotion history
const getStudentPromotions = async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 200 : Math.min(rawLimit, 2000);
    const studentId = req.query.student_id ? parseInt(req.query.student_id, 10) : null;
    const hasStudentFilter = studentId != null && !Number.isNaN(studentId);
    const whereClause = hasStudentFilter ? 'WHERE sp.student_id = $1' : '';
    const params = hasStudentFilter ? [studentId, limit] : [limit];
    const limitParam = hasStudentFilter ? '$2' : '$1';

    const result = await query(
      `SELECT
        sp.id,
        sp.student_id,
        sp.from_class_id,
        sp.to_class_id,
        sp.from_section_id,
        sp.to_section_id,
        sp.from_academic_year_id,
        sp.to_academic_year_id,
        sp.promotion_date,
        sp.status,
        sp.remarks,
        sp.promoted_by,
        sp.created_at,
        sp.modified_at,
        s.admission_number,
        s.roll_number,
        s.first_name,
        s.last_name,
        fc.class_name AS from_class_name,
        tc.class_name AS to_class_name,
        fs.section_name AS from_section_name,
        ts.section_name AS to_section_name,
        fay.year_name AS from_academic_year_name,
        tay.year_name AS to_academic_year_name,
        st.first_name AS promoted_by_first_name,
        st.last_name AS promoted_by_last_name
      FROM student_promotions sp
      LEFT JOIN students s ON s.id = sp.student_id
      LEFT JOIN classes fc ON fc.id = sp.from_class_id
      LEFT JOIN classes tc ON tc.id = sp.to_class_id
      LEFT JOIN sections fs ON fs.id = sp.from_section_id
      LEFT JOIN sections ts ON ts.id = sp.to_section_id
      LEFT JOIN academic_years fay ON fay.id = sp.from_academic_year_id
      LEFT JOIN academic_years tay ON tay.id = sp.to_academic_year_id
      LEFT JOIN staff st ON st.id = sp.promoted_by
      ${whereClause}
      AND s.deleted_at IS NULL
      ORDER BY sp.promotion_date DESC, sp.id DESC
      LIMIT ${limitParam}`,
      params
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student promotion history fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching student promotions:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch student promotion history',
    });
  }
};

// Get leaving students history with join/last snapshots and names.
const getLeavingStudents = async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 200 : Math.min(rawLimit, 2000);

    const result = await query(
      `SELECT
         ls.id,
         ls.student_id,
         ls.admission_number,
         ls.student_first_name,
         ls.student_last_name,
         ls.joining_class_id,
         ls.joining_section_id,
         ls.joining_academic_year_id,
         ls.joining_date,
         ls.last_class_id,
         ls.last_section_id,
         ls.last_academic_year_id,
         ls.leaving_date,
         ls.last_class_result,
         ls.reason,
         ls.remarks,
         ls.left_by,
         ls.created_at,
         ls.modified_at,
         jc.class_name AS joining_class_name,
         js.section_name AS joining_section_name,
         jay.year_name AS joining_academic_year_name,
         lc.class_name AS last_class_name,
         lsn.section_name AS last_section_name,
         lay.year_name AS last_academic_year_name,
         st.first_name AS left_by_first_name,
         st.last_name AS left_by_last_name
       FROM leaving_students ls
       LEFT JOIN classes jc ON jc.id = ls.joining_class_id
       LEFT JOIN sections js ON js.id = ls.joining_section_id
       LEFT JOIN academic_years jay ON jay.id = ls.joining_academic_year_id
       LEFT JOIN classes lc ON lc.id = ls.last_class_id
       LEFT JOIN sections lsn ON lsn.id = ls.last_section_id
       LEFT JOIN academic_years lay ON lay.id = ls.last_academic_year_id
       LEFT JOIN staff st ON st.id = ls.left_by
       WHERE COALESCE(ls.is_active, true) = true
       ORDER BY ls.leaving_date DESC, ls.id DESC
       LIMIT $1`,
      [limit]
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Leaving students fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching leaving students:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch leaving students',
    });
  }
};

// Get rejoined students history with from/to snapshots and actor names.
const getStudentRejoins = async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 200 : Math.min(rawLimit, 2000);

    const exists = await hasTable('student_rejoins');
    if (!exists) {
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Student rejoins table not available yet',
        data: [],
        count: 0,
      });
    }

    const result = await query(
      `SELECT
         sr.id,
         sr.student_id,
         sr.leaving_student_id,
         sr.admission_number,
         sr.student_first_name,
         sr.student_last_name,
         sr.from_class_id,
         sr.from_section_id,
         sr.from_academic_year_id,
         sr.leaving_date,
         sr.to_class_id,
         sr.to_section_id,
         sr.to_academic_year_id,
         sr.rejoin_date,
         sr.reason,
         sr.remarks,
         sr.rejoined_by,
         sr.created_at,
         sr.modified_at,
         fc.class_name AS from_class_name,
         fs.section_name AS from_section_name,
         fay.year_name AS from_academic_year_name,
         tc.class_name AS to_class_name,
         ts.section_name AS to_section_name,
         tay.year_name AS to_academic_year_name,
         u.username AS rejoined_by_username,
         st.first_name AS rejoined_by_first_name,
         st.last_name AS rejoined_by_last_name
       FROM student_rejoins sr
       LEFT JOIN classes fc ON fc.id = sr.from_class_id
       LEFT JOIN sections fs ON fs.id = sr.from_section_id
       LEFT JOIN academic_years fay ON fay.id = sr.from_academic_year_id
       LEFT JOIN classes tc ON tc.id = sr.to_class_id
       LEFT JOIN sections ts ON ts.id = sr.to_section_id
       LEFT JOIN academic_years tay ON tay.id = sr.to_academic_year_id
       LEFT JOIN users u ON u.id = sr.rejoined_by
       LEFT JOIN staff st ON st.user_id = u.id
       WHERE COALESCE(sr.is_active, true) = true AND sr.deleted_at IS NULL
       ORDER BY sr.rejoin_date DESC, sr.id DESC
       LIMIT $1`,
      [limit]
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student rejoins fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching student rejoins:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch student rejoins',
    });
  }
};

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasAcademicYearFilter = academicYearId != null && !Number.isNaN(academicYearId);

    // When scoped to an academic year, client screens (e.g. Student Promotion) need the full roster
    // for that year — not only the first page (default 50 / max 100 from parsePagination).
    let page;
    let limit;
    let offset;
    if (hasAcademicYearFilter) {
      page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const rawLimit = parseInt(req.query.limit, 10);
      limit =
        Number.isNaN(rawLimit) || rawLimit < 1
          ? 5000
          : Math.min(10000, rawLimit);
      offset = (page - 1) * limit;
    } else {
      const p = parsePagination(req.query);
      page = p.page;
      limit = p.limit;
      offset = p.offset;
    }

    const countQuery = hasAcademicYearFilter
      ? `WITH historical_promotions AS (
           SELECT DISTINCT ON (sp.student_id)
             sp.student_id
           FROM student_promotions sp
           INNER JOIN students s ON s.id = sp.student_id
           WHERE sp.from_academic_year_id = $1
             AND COALESCE(sp.status, 'promoted') = 'promoted'
             AND COALESCE(s.is_active, true) = true
             AND COALESCE(s.academic_year_id, 0) <> $1
             AND COALESCE(sp.to_academic_year_id, 0) = COALESCE(s.academic_year_id, 0)
             AND COALESCE(sp.to_academic_year_id, 0) <> COALESCE(sp.from_academic_year_id, 0)
             AND (
               COALESCE(sp.from_class_id, 0) <> COALESCE(sp.to_class_id, 0)
               OR COALESCE(sp.from_section_id, 0) <> COALESCE(sp.to_section_id, 0)
               OR COALESCE(sp.from_academic_year_id, 0) <> COALESCE(sp.to_academic_year_id, 0)
             )
           ORDER BY sp.student_id, COALESCE(sp.promotion_date, sp.created_at) DESC, sp.id DESC
         )
         SELECT (
           (SELECT COUNT(*) FROM students WHERE academic_year_id = $1 AND deleted_at IS NULL)
           +
           (SELECT COUNT(*) FROM historical_promotions)
         )::int AS total`
      : 'SELECT COUNT(*)::int as total FROM students WHERE deleted_at IS NULL';
    const countParams = hasAcademicYearFilter ? [academicYearId] : [];
    const countResult = await query(countQuery, countParams);
    const total = countResult.rows[0].total;

    const selectParams = hasAcademicYearFilter
      ? [academicYearId, limit, offset]
      : [limit, offset];

    const result = await query(hasAcademicYearFilter
      ? `
      WITH historical_promotions AS (
        SELECT DISTINCT ON (sp.student_id)
          sp.student_id,
          sp.from_class_id,
          sp.from_section_id
        FROM student_promotions sp
        INNER JOIN students s ON s.id = sp.student_id
        WHERE sp.from_academic_year_id = $1
          AND COALESCE(sp.status, 'promoted') = 'promoted'
          AND COALESCE(s.is_active, true) = true
          AND COALESCE(s.academic_year_id, 0) <> $1
          AND COALESCE(sp.to_academic_year_id, 0) = COALESCE(s.academic_year_id, 0)
          AND COALESCE(sp.to_academic_year_id, 0) <> COALESCE(sp.from_academic_year_id, 0)
          AND (
            COALESCE(sp.from_class_id, 0) <> COALESCE(sp.to_class_id, 0)
            OR COALESCE(sp.from_section_id, 0) <> COALESCE(sp.to_section_id, 0)
            OR COALESCE(sp.from_academic_year_id, 0) <> COALESCE(sp.to_academic_year_id, 0)
          )
        ORDER BY sp.student_id, COALESCE(sp.promotion_date, sp.created_at) DESC, sp.id DESC
      ),
      combined_students AS (
        SELECT
          s.id,
          s.admission_number,
          s.roll_number,
          s.gr_number,
          s.first_name,
          s.last_name,
          s.gender,
          s.date_of_birth,
          s.place_of_birth,
          s.blood_group_id,
          s.religion_id,
          s.cast_id,
          s.mother_tongue_id,
          s.nationality,
          s.phone,
          s.email,
          s.address,
          s.user_id,
          s.academic_year_id,
          s.class_id,
          s.section_id,
          s.house_id,
          s.admission_date,
          s.previous_school,
          s.photo_url,
          s.is_transport_required,
          s.route_id,
          s.pickup_point_id,
          s.is_hostel_required,
          s.hostel_room_id,
          s.guardian_id,
          COALESCE(s.is_active, true) AS is_active,
          s.created_at,
          ${STUDENT_CONTACT_LATERAL_SELECT},
          COALESCE(s.current_address, addr.current_address, s.address) as current_address,
          COALESCE(s.permanent_address, addr.permanent_address) as permanent_address,
          1 AS source_order
        FROM students s
        ${STUDENT_CONTACT_LATERAL_JOINS}
        LEFT JOIN LATERAL (
          SELECT current_address, permanent_address 
          FROM addresses 
          WHERE user_id = s.user_id 
          ORDER BY id DESC 
          LIMIT 1
        ) addr ON true
        WHERE s.academic_year_id = $1 AND s.deleted_at IS NULL

        UNION ALL

        SELECT
          s.id,
          s.admission_number,
          s.roll_number,
          s.gr_number,
          s.first_name,
          s.last_name,
          s.gender,
          s.date_of_birth,
          s.place_of_birth,
          s.blood_group_id,
          s.religion_id,
          s.cast_id,
          s.mother_tongue_id,
          s.nationality,
          s.phone,
          s.email,
          s.address,
          s.user_id,
          $1 AS academic_year_id,
          hp.from_class_id AS class_id,
          hp.from_section_id AS section_id,
          s.house_id,
          s.admission_date,
          s.previous_school,
          s.photo_url,
          s.is_transport_required,
          s.route_id,
          s.pickup_point_id,
          s.is_hostel_required,
          s.hostel_room_id,
          s.guardian_id,
          false AS is_active,
          s.created_at,
          ${STUDENT_CONTACT_LATERAL_SELECT},
          COALESCE(s.current_address, addr.current_address, s.address) as current_address,
          COALESCE(s.permanent_address, addr.permanent_address) as permanent_address,
          2 AS source_order
        FROM historical_promotions hp
        INNER JOIN students s ON s.id = hp.student_id
        ${STUDENT_CONTACT_LATERAL_JOINS}
        LEFT JOIN LATERAL (
          SELECT current_address, permanent_address 
          FROM addresses 
          WHERE user_id = s.user_id 
          ORDER BY id DESC 
          LIMIT 1
        ) addr ON true
      )
      SELECT
        cs.*,
        c.class_name,
        sec.section_name
      FROM combined_students cs
      LEFT JOIN classes c ON cs.class_id = c.id
      LEFT JOIN sections sec ON cs.section_id = sec.id
      ORDER BY cs.first_name ASC, cs.last_name ASC, cs.source_order ASC
      LIMIT $2 OFFSET $3
    `
      : `
      SELECT
        s.id,
        s.admission_number,
        s.roll_number,
        s.gr_number,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.place_of_birth,
        s.blood_group_id,
        s.religion_id,
        s.cast_id,
        s.mother_tongue_id,
        s.nationality,
        s.phone,
        s.email,
        s.address,
        s.user_id,
        s.academic_year_id,
        s.class_id,
        s.section_id,
        s.house_id,
        s.admission_date,
        s.previous_school,
        s.photo_url,
        s.is_transport_required,
        s.route_id,
        s.pickup_point_id,
        s.is_hostel_required,
        s.hostel_room_id,
        s.guardian_id,
        s.is_active,
        s.created_at,
        c.class_name,
        sec.section_name,
        ${STUDENT_CONTACT_LATERAL_SELECT},
        COALESCE(s.current_address, addr.current_address, s.address) as current_address,
        COALESCE(s.permanent_address, addr.permanent_address) as permanent_address
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      ${STUDENT_CONTACT_LATERAL_JOINS}
      LEFT JOIN LATERAL (
        SELECT current_address, permanent_address 
        FROM addresses 
        WHERE user_id = s.user_id 
        ORDER BY id DESC 
        LIMIT 1
      ) addr ON true
      WHERE s.deleted_at IS NULL
      ORDER BY s.first_name ASC, s.last_name ASC LIMIT $1 OFFSET $2
    `, selectParams);

    const responseRows = hasAcademicYearFilter
      ? result.rows.map(({ source_order, ...row }) => row)
      : result.rows;

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Students fetched successfully',
      data: responseRows,
      count: responseRows.length,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch students'
    });
  }
};

// Get students assigned to a teacher
const getTeacherStudents = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasAcademicYearFilter = academicYearId != null && !Number.isNaN(academicYearId);

    // Get the teacher record for the current user
    const teacherCheck = await query(
      `SELECT t.id, t.staff_id
       FROM teachers t 
       INNER JOIN staff st ON t.staff_id = st.id 
       WHERE st.user_id = $1 AND st.is_active = true`,
      [userId]
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied. User is not an active teacher.' });
    }
    const teacherIds = [...new Set(teacherCheck.rows.map((row) => parseInt(row.id, 10)).filter((id) => Number.isFinite(id)))];
    const staffIds = [...new Set(teacherCheck.rows.map((row) => parseInt(row.staff_id, 10)).filter((id) => Number.isFinite(id)))];
    if (teacherIds.length === 0 || staffIds.length === 0) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied. User is not an active teacher.' });
    }

    const params = [teacherIds, staffIds];
    let academicYearClause = '';
    if (hasAcademicYearFilter) {
      params.push(academicYearId);
      academicYearClause = ` AND s.academic_year_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
        s.id, s.admission_number, s.roll_number, s.first_name, s.last_name, s.gender,
        s.date_of_birth, s.phone, s.email, s.class_id, s.section_id, s.photo_url,
        COALESCE(s.is_active, true) AS is_active,
        c.class_name, sec.section_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE s.is_active = true AND s.deleted_at IS NULL AND (
         EXISTS (
           SELECT 1 FROM class_schedules cs
           WHERE cs.teacher_id = ANY($1::int[])
             AND cs.class_id = s.class_id
             AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
             AND (cs.academic_year_id = s.academic_year_id OR cs.academic_year_id IS NULL)
         )
         OR EXISTS (
           SELECT 1 FROM teachers t
            WHERE t.id = ANY($1::int[]) AND t.class_id = s.class_id
         )
         OR EXISTS (
           SELECT 1 FROM sections sec_map
           WHERE sec_map.id = s.section_id
             AND sec_map.section_teacher_id = ANY($2::int[])
         )
         OR EXISTS (
           SELECT 1 FROM classes c_map
           WHERE c_map.id = s.class_id
             AND (c_map.class_teacher_id = ANY($1::int[]) OR c_map.class_teacher_id = ANY($2::int[]))
         )
       )${academicYearClause}
       ORDER BY s.first_name ASC, s.last_name ASC`,
      params
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Teacher students fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch teacher students'
    });
  }
};

// Get student by ID (with blood_group, religion, cast, mother_tongue names from lookup tables)
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const sid = parseId(id);
    if (!sid) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }
    const baseSelect = `
      s.id, s.admission_number, s.roll_number, s.gr_number, s.first_name, s.last_name,
      s.gender, s.date_of_birth, s.place_of_birth, s.blood_group_id, s.cast_id, s.mother_tongue_id,
      s.nationality, COALESCE(NULLIF(TRIM(s.phone), ''), u.phone) AS phone, COALESCE(NULLIF(TRIM(s.email), ''), u.email) AS email, s.address, s.user_id, s.academic_year_id,
      s.class_id, s.section_id, s.house_id, s.admission_date, s.previous_school,
      s.photo_url, s.is_transport_required, s.route_id, s.pickup_point_id, s.vehicle_number,
      tr.route_name as route_name, tpp.point_name as pickup_point_name,
      s.is_hostel_required, s.hostel_id, s.hostel_room_id, s.guardian_id, s.is_active, s.created_at,
      s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,
      s.medical_document_path, s.transfer_certificate_path,
      c.class_name, sec.section_name,
      ay.year_name as academic_year_name,
      cls_t.id as class_teacher_id,
      cls_t.staff_id as class_teacher_staff_id,
      cls_staff.first_name as class_teacher_first_name,
      cls_staff.last_name as class_teacher_last_name,
      cls_staff.phone as class_teacher_phone,
      cls_staff.email as class_teacher_email,
      cls_staff.address as class_teacher_address,
      bg.blood_group as blood_group_name,
      cast_t.cast_name,
      mt.language_name as mother_tongue_name,
      ${STUDENT_CONTACT_LATERAL_SELECT},
      COALESCE(s.current_address, addr.current_address, s.address) as current_address,
      COALESCE(s.permanent_address, addr.permanent_address) as permanent_address`;
    const fromAndJoins = `
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
      LEFT JOIN teachers cls_t ON (c.class_teacher_id = cls_t.id OR c.class_teacher_id = cls_t.staff_id)
      LEFT JOIN staff cls_staff ON cls_t.staff_id = cls_staff.id
      LEFT JOIN blood_groups bg ON s.blood_group_id = bg.id
      LEFT JOIN casts cast_t ON s.cast_id = cast_t.id
      LEFT JOIN mother_tongues mt ON s.mother_tongue_id = mt.id
      LEFT JOIN routes tr ON s.route_id = tr.id
      LEFT JOIN pickup_points tpp ON s.pickup_point_id = tpp.id
      ${STUDENT_CONTACT_LATERAL_JOINS}
      LEFT JOIN LATERAL (
        SELECT current_address, permanent_address 
        FROM addresses 
        WHERE user_id = s.user_id 
        ORDER BY id DESC 
        LIMIT 1
      ) addr ON true`;
    const whereClause = ` WHERE s.id = $1 AND s.deleted_at IS NULL`;

    let result;
    try {
      result = await query(`
        SELECT ${baseSelect},
          s.religion_id,
          r.religion_name as religion_name
        ${fromAndJoins}
        LEFT JOIN religions r ON s.religion_id = r.id
        ${whereClause}
      `, [sid]);
    } catch (e) {
      const isReligionError = e.message && (e.message.includes('religion_id') || e.message.includes('religions') || e.message.includes('reigion'));
      const isMissingColsError = e.message && (e.message.includes('unique_student_ids') || e.message.includes('pen_number') || e.message.includes('aadhar_no') || e.message.includes('aadhaar_no') || e.message.includes('medical_document_path') || e.message.includes('transfer_certificate_path'));
      const isGrColError = e.message && e.message.includes('gr_number');

      if (isReligionError || isMissingColsError || isGrColError) {
        let safeBaseSelect = baseSelect;
        if (isGrColError) {
          safeBaseSelect = safeBaseSelect.replace('s.roll_number, s.gr_number,', 's.roll_number,');
        }
        if (isMissingColsError) {
          safeBaseSelect = safeBaseSelect.replace('s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,', '');
          safeBaseSelect = safeBaseSelect.replace('s.medical_document_path, s.transfer_certificate_path,', '');
        }
        const relCol = isReligionError ? 's.reigion_id as religion_id' : 's.religion_id';
        const relJoin = isReligionError ? 'LEFT JOIN reigions re ON s.reigion_id = re.id' : 'LEFT JOIN religions r ON s.religion_id = r.id';
        const relName = isReligionError ? 're.reigion_name as religion_name' : 'r.religion_name as religion_name';

        result = await query(`
          SELECT ${safeBaseSelect},
            ${relCol},
            ${relName}
          ${fromAndJoins}
          ${relJoin}
          ${whereClause}
        `, [sid]);
      } else {
        throw e;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Student not found'
      });
    }

    const studentData = result.rows[0];
    const access = await canAccessStudent(req, sid);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }
    try {
      const ids = await loadStudentLinkedUserIds(query, sid);
      Object.assign(studentData, ids);
    } catch (e) {
      console.warn('getStudentById: user IDs merge', e.message);
    }
    try {
      const extra = await query(
        'SELECT bank_name, branch, ifsc, known_allergies, medications, previous_school_address, medical_condition, other_information, vehicle_number FROM students WHERE id = $1',
        [sid]
      );
      if (extra.rows.length > 0) {
        Object.assign(studentData, extra.rows[0]);
      } else {
        studentData.bank_name = studentData.bank_name ?? null;
        studentData.branch = studentData.branch ?? null;
        studentData.ifsc = studentData.ifsc ?? null;
        studentData.known_allergies = studentData.known_allergies ?? null;
        studentData.medications = studentData.medications ?? null;
        studentData.previous_school_address = studentData.previous_school_address ?? null;
        studentData.medical_condition = studentData.medical_condition ?? null;
        studentData.other_information = studentData.other_information ?? null;
        studentData.vehicle_number = studentData.vehicle_number ?? null;
      }
    } catch (e) {
      studentData.bank_name = studentData.bank_name ?? null;
      studentData.branch = studentData.branch ?? null;
      studentData.ifsc = studentData.ifsc ?? null;
      studentData.known_allergies = studentData.known_allergies ?? null;
      studentData.medications = studentData.medications ?? null;
      studentData.previous_school_address = studentData.previous_school_address ?? null;
      studentData.medical_condition = studentData.medical_condition ?? null;
      studentData.other_information = studentData.other_information ?? null;
      studentData.vehicle_number = studentData.vehicle_number ?? null;
    }
    // Dedicated fetch for unique_student_ids, pen_number, aadhaar_no (handles alternate column names)
    try {
      let idRow = null;
      try {
        const idRes = await query(
          'SELECT unique_student_ids, pen_number, aadhar_no, gr_number FROM students WHERE id = $1',
          [sid]
        );
        if (idRes.rows.length > 0) {
          const r = idRes.rows[0];
          idRow = {
            unique_student_ids: r.unique_student_ids ?? null,
            pen_number: r.pen_number ?? null,
            aadhaar_no: r.aadhar_no ?? null,
            gr_number: r.gr_number ?? null
          };
        }
      } catch (e1) {
        console.warn('getStudentById: could not fetch ID fields:', e1.message);
      }
      if (idRow) {
        studentData.unique_student_ids = idRow.unique_student_ids ?? studentData.unique_student_ids ?? null;
        studentData.pen_number = idRow.pen_number ?? studentData.pen_number ?? null;
        studentData.aadhaar_no = idRow.aadhaar_no ?? studentData.aadhaar_no ?? null;
        studentData.gr_number = idRow.gr_number ?? studentData.gr_number ?? null;
      } else {
        studentData.unique_student_ids = studentData.unique_student_ids ?? null;
        studentData.pen_number = studentData.pen_number ?? null;
        studentData.aadhaar_no = studentData.aadhaar_no ?? null;
        studentData.gr_number = studentData.gr_number ?? null;
      }
    } catch (e) {
      studentData.unique_student_ids = studentData.unique_student_ids ?? null;
      studentData.pen_number = studentData.pen_number ?? null;
      studentData.aadhaar_no = studentData.aadhaar_no ?? null;
      studentData.gr_number = studentData.gr_number ?? null;
    }
    try {
      if (studentData.hostel_id || studentData.hostel_room_id) {
        // Tables: hostels (id, hostel_name), hostel_rooms (id, hostel_id, room_number)
        // student.hostel_id -> hostels.id | student.hostel_room_id -> hostel_rooms.id
        // Get hostel from student.hostel_id OR from room's hostel_id (room belongs to hostel)
        const hostelExtra = await query(`
          SELECT 
            h.hostel_name as hostel_name,
            hr.room_number as hostel_room_number
          FROM students s
          LEFT JOIN hostel_rooms hr ON s.hostel_room_id = hr.id
          LEFT JOIN hostels h ON COALESCE(s.hostel_id, hr.hostel_id) = h.id
          WHERE s.id = $1
        `, [sid]);
        if (hostelExtra.rows.length > 0 && hostelExtra.rows[0]) {
          const row = hostelExtra.rows[0];
          studentData.hostel_name = row.hostel_name || null;
          studentData.floor = null;
          studentData.hostel_room_number = row.hostel_room_number != null ? String(row.hostel_room_number) : null;
        }
        // Fallback: direct queries if JOIN returned nulls (e.g. table name differs)
        if (!studentData.hostel_name && studentData.hostel_id) {
          const hRes = await query('SELECT hostel_name FROM hostels WHERE id = $1', [studentData.hostel_id]);
          if (hRes.rows.length > 0) {
            studentData.hostel_name = hRes.rows[0].hostel_name || null;
          }
        }
        if (!studentData.hostel_room_number && studentData.hostel_room_id) {
          const rRes = await query('SELECT room_number FROM hostel_rooms WHERE id = $1', [studentData.hostel_room_id]);
          if (rRes.rows.length > 0) {
            studentData.hostel_room_number = rRes.rows[0].room_number != null ? String(rRes.rows[0].room_number) : null;
          }
        }
        // If we have room but no hostel_name, get it from room's hostel_id
        if (!studentData.hostel_name && studentData.hostel_room_id) {
          const rRes = await query('SELECT hostel_id FROM hostel_rooms WHERE id = $1', [studentData.hostel_room_id]);
          if (rRes.rows.length > 0 && rRes.rows[0].hostel_id) {
            const hRes = await query('SELECT hostel_name FROM hostels WHERE id = $1', [rRes.rows[0].hostel_id]);
            if (hRes.rows.length > 0) {
              const h = hRes.rows[0];
              studentData.hostel_name = h.hostel_name || null;
            }
          }
        }
      } else {
        studentData.hostel_name = null;
        studentData.floor = null;
        studentData.hostel_room_number = null;
      }
    } catch (e) {
      console.error('Error fetching hostel data for student', id, ':', e.message);
      studentData.hostel_name = null;
      studentData.floor = null;
      studentData.hostel_room_number = null;
    }
    // Transport: resolve route and pickup point names for edit form
    try {
      if (studentData.route_id) {
        const routeResult = await query('SELECT route_name, name FROM routes WHERE id = $1', [studentData.route_id]);
        if (routeResult.rows.length > 0) {
          const r = routeResult.rows[0];
          studentData.route_name = r.route_name || r.name || null;
        }
      }
      if (studentData.pickup_point_id) {
        const ppResult = await query('SELECT address, pickup_point, name, location, point_name, point_address FROM pickup_points WHERE id = $1', [studentData.pickup_point_id]);
        if (ppResult.rows.length > 0) {
          const pp = ppResult.rows[0];
          studentData.pickup_point_name = pp.pickup_point || pp.address || pp.name || pp.location || pp.point_name || pp.point_address || null;
        }
      }
    } catch (e) {
      console.error('Error fetching transport names for student', id, ':', e.message);
    }
    // Fallback: if phone/email still empty, fetch from users table (safety for JOIN edge cases)
    if (studentData.user_id && (!studentData.phone || !studentData.email)) {
      try {
        const userRow = await query('SELECT phone, email FROM users WHERE id = $1', [studentData.user_id]);
        if (userRow.rows.length > 0) {
          const u = userRow.rows[0];
          studentData.phone = studentData.phone || u.phone;
          studentData.email = studentData.email || u.email;
        }
      } catch (e) { }
    }
    // Fetch Siblings
    try {
      const sibsRes = await query(
        `SELECT is_in_same_school, name, class_name, section_name, roll_number, admission_number 
         FROM student_siblings WHERE student_id = $1 ORDER BY id ASC`,
        [sid]
      );
      studentData.siblings = sibsRes.rows;
    } catch (e) {
      console.warn('getStudentById: could not fetch siblings:', e.message);
      studentData.siblings = [];
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student fetched successfully',
      data: studentData
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch student'
    });
  }
};

// Get login details (usernames) for a specific student's accounts (student + parent users)
// Note: passwords are stored as hashes and cannot be returned for security reasons.
// Access:
//   - Admin: any student
//   - Student: only own record
//   - Parent: only for their children (via parentUserMatch)
//   - Guardian: only for their wards
const getStudentLoginDetails = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const userId = req.user?.id;
    const isParent =
      req.user?.role_id === ROLES.PARENT ||
      (typeof req.user?.role === 'string' && req.user.role.toLowerCase() === 'parent');

    const stuResult = await query(
      `SELECT
         s.id,
         s.first_name,
         s.last_name,
         s.class_id,
         s.section_id,
         s.user_id,
         c.class_name,
         sec.section_name,
         u.username    AS student_username,
         u.phone       AS student_phone,
         u.email       AS student_email
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       LEFT JOIN users u ON s.user_id = u.id AND u.is_active = true AND u.deleted_at IS NULL
       WHERE s.id = $1 AND s.is_active = true AND s.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (stuResult.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Student not found' });
    }

    const stu = stuResult.rows[0];

    const access = await canAccessStudent(req, id);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }

    let parentUsers = [];
    try {
      const parRes = await query(
        `SELECT DISTINCT u.id, u.username, u.email, u.phone
         FROM guardians g
         INNER JOIN users u ON u.id = g.user_id AND u.is_active = true
         WHERE g.student_id = $1 AND g.is_active = true
           AND u.role_id = $2`,
        [id, ROLES.PARENT]
      );
      parentUsers = parRes.rows;
    } catch (_) {
      parentUsers = [];
    }

    if (parentUsers.length > 0 && isParent && userId) {
      parentUsers = parentUsers.filter((u) => parseInt(u.id, 10) === parseInt(userId, 10));
    } else if (parentUsers.length > 0 && !isParent) {
      const seenId = new Set();
      parentUsers = parentUsers.filter((u) => {
        const k = parseInt(u.id, 10);
        if (seenId.has(k)) return false;
        seenId.add(k);
        return true;
      });
    }

    let guardianLogin = null;
    try {
      const gRes = await query(
        `SELECT u.username, u.email, u.phone
         FROM guardians g
         JOIN users u ON u.id = g.user_id AND u.is_active = true
         WHERE g.student_id = $1 AND g.user_id IS NOT NULL
         LIMIT 1`,
        [id]
      );
      if (gRes.rows.length > 0) {
        const g = gRes.rows[0];
        guardianLogin = {
          userType: 'Guardian',
          username: g.username || null,
          phone: g.phone || null,
          email: g.email || null,
        };
      }
    } catch (e) {
      // ignore
    }

    const loginDetails = {
      student: stu.user_id
        ? {
          userType: 'Student',
          username: stu.student_username || null,
          phone: stu.student_phone || null,
          email: stu.student_email || null,
        }
        : null,
      parents: parentUsers.map((u) => ({
        userType: 'Parent',
        username: u.username || null,
        phone: u.phone || null,
        email: u.email || null,
      })),
      guardian: guardianLogin,
    };

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Login details fetched successfully',
      data: loginDetails,
    });
  } catch (error) {
    console.error('Error fetching student login details:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch login details',
    });
  }
};

// Get current logged-in student (by user_id from JWT)
const getCurrentStudent = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated'
      });
    }

    const baseSelect = `
      s.id, s.admission_number, s.roll_number, s.gr_number, s.first_name, s.last_name,
      s.gender, s.date_of_birth, s.place_of_birth, s.blood_group_id, s.cast_id, s.mother_tongue_id,
      s.nationality, COALESCE(NULLIF(TRIM(s.phone), ''), u.phone) AS phone, COALESCE(NULLIF(TRIM(s.email), ''), u.email) AS email, s.address, s.user_id, s.academic_year_id,
      s.class_id, s.section_id, s.house_id, s.admission_date, s.previous_school,
      s.photo_url, s.is_transport_required, s.route_id, s.pickup_point_id,
      s.is_hostel_required, s.hostel_id, s.hostel_room_id, s.guardian_id, s.is_active, s.created_at,
      s.sibiling_1, s.sibiling_2, s.sibiling_1_class, s.sibiling_2_class,
      s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,
      s.medical_document_path, s.transfer_certificate_path,
      c.class_name, sec.section_name,
      bg.blood_group as blood_group_name,
      cast_t.cast_name,
      mt.language_name as mother_tongue_name,
      ${STUDENT_CONTACT_LATERAL_SELECT},
      COALESCE(s.current_address, addr.current_address, s.address) as current_address,
      COALESCE(s.permanent_address, addr.permanent_address) as permanent_address`;
    const fromAndJoins = `
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN blood_groups bg ON s.blood_group_id = bg.id
      LEFT JOIN casts cast_t ON s.cast_id = cast_t.id
      LEFT JOIN mother_tongues mt ON s.mother_tongue_id = mt.id
      ${STUDENT_CONTACT_LATERAL_JOINS}
      LEFT JOIN LATERAL (
        SELECT current_address, permanent_address 
        FROM addresses 
        WHERE user_id = s.user_id 
        ORDER BY id DESC 
        LIMIT 1
      ) addr ON true`;
    const whereClause = ` WHERE s.user_id = $1 AND s.is_active = true LIMIT 1`;

    let result;
    try {
      result = await query(`
        SELECT ${baseSelect},
          s.religion_id,
          r.religion_name as religion_name
        ${fromAndJoins}
        LEFT JOIN religions r ON s.religion_id = r.id
        ${whereClause}
      `, [userId]);
    } catch (e) {
      const isReligionError = e.message && (e.message.includes('religion_id') || e.message.includes('religions') || e.message.includes('reigion'));
      const isMissingColsError = e.message && (e.message.includes('unique_student_ids') || e.message.includes('pen_number') || e.message.includes('aadhar_no') || e.message.includes('aadhaar_no') || e.message.includes('medical_document_path') || e.message.includes('transfer_certificate_path'));
      const isGrColError = e.message && e.message.includes('gr_number');

      if (isReligionError || isMissingColsError || isGrColError) {
        let safeBaseSelect = baseSelect;
        if (isGrColError) {
          safeBaseSelect = safeBaseSelect.replace('s.roll_number, s.gr_number,', 's.roll_number,');
        }
        if (isMissingColsError) {
          safeBaseSelect = safeBaseSelect.replace('s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,', '');
          safeBaseSelect = safeBaseSelect.replace('s.medical_document_path, s.transfer_certificate_path,', '');
        }
        const relCol = isReligionError ? 's.reigion_id as religion_id' : 's.religion_id';
        const relJoin = isReligionError ? 'LEFT JOIN reigions re ON s.reigion_id = re.id' : 'LEFT JOIN religions r ON s.religion_id = r.id';
        const relName = isReligionError ? 're.reigion_name as religion_name' : 'r.religion_name as religion_name';

        result = await query(`
          SELECT ${safeBaseSelect},
            ${relCol},
            ${relName}
          ${fromAndJoins}
          ${relJoin}
          ${whereClause}
        `, [userId]);
      } else {
        throw e;
      }
    }

    if (result.rows.length === 0) {
      const userRow = await query(
        'SELECT email, phone FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );
      if (userRow.rows.length > 0) {
        const u = userRow.rows[0];
        const userEmail = (u.email || '').toString().trim().toLowerCase();
        const userPhone = (u.phone || '').toString().trim();
        if (userEmail || userPhone) {
          try {
            result = await query(
              `SELECT ${baseSelect}, s.religion_id, r.religion_name as religion_name
               ${fromAndJoins}
               LEFT JOIN religions r ON s.religion_id = r.id
               WHERE s.is_active = true AND (s.user_id IS NULL OR s.user_id != $1)
                 AND (
                   (LOWER(TRIM(COALESCE(s.email, ''))) = $2 AND $2 != '')
                   OR (TRIM(COALESCE(s.phone, '')) = $3 AND $3 != '')
                   OR (LOWER(TRIM(COALESCE(father_u.email, ''))) = $2 AND $2 != '')
                   OR (LOWER(TRIM(COALESCE(mother_u.email, ''))) = $2 AND $2 != '')
                   OR (TRIM(COALESCE(father_u.phone, '')) = $3 AND $3 != '')
                   OR (TRIM(COALESCE(mother_u.phone, '')) = $3 AND $3 != '')
                   OR (LOWER(TRIM(COALESCE(gu_u.email, ''))) = $2 AND $2 != '')
                   OR (TRIM(COALESCE(gu_u.phone, '')) = $3 AND $3 != '')
                 )
               LIMIT 1`,
              [userId, userEmail, userPhone]
            );
          } catch (fallbackErr) {
            const isMissingColsErrorFallback = fallbackErr.message && (fallbackErr.message.includes('unique_student_ids') || fallbackErr.message.includes('pen_number') || fallbackErr.message.includes('aadhar_no') || fallbackErr.message.includes('aadhaar_no') || fallbackErr.message.includes('medical_document_path') || fallbackErr.message.includes('transfer_certificate_path'));
            const isReligErrorFallback = fallbackErr.message && (fallbackErr.message.includes('religion_id') || fallbackErr.message.includes('religions') || fallbackErr.message.includes('reigion'));
            const isGrColErrorFallback = fallbackErr.message && fallbackErr.message.includes('gr_number');

            if (isMissingColsErrorFallback || isReligErrorFallback || isGrColErrorFallback) {
              let safeBaseSelectFallback = baseSelect;
              if (isGrColErrorFallback) {
                safeBaseSelectFallback = safeBaseSelectFallback.replace('s.roll_number, s.gr_number,', 's.roll_number,');
              }
              if (isMissingColsErrorFallback) {
                safeBaseSelectFallback = safeBaseSelectFallback.replace('s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,', '');
                safeBaseSelectFallback = safeBaseSelectFallback.replace('s.medical_document_path, s.transfer_certificate_path,', '');
              }
              const relCol = isReligErrorFallback ? 's.reigion_id as religion_id' : 's.religion_id';
              const relJoin = isReligErrorFallback ? 'LEFT JOIN reigions re ON s.reigion_id = re.id' : 'LEFT JOIN religions r ON s.religion_id = r.id';
              const relName = isReligErrorFallback ? 're.reigion_name as religion_name' : 'r.religion_name as religion_name';

              result = await query(
                `SELECT ${safeBaseSelectFallback}, ${relCol}, ${relName}
                 ${fromAndJoins}
                 ${relJoin}
                 WHERE s.is_active = true AND (s.user_id IS NULL OR s.user_id != $1)
                   AND (
                     (LOWER(TRIM(COALESCE(s.email, ''))) = $2 AND $2 != '')
                     OR (TRIM(COALESCE(s.phone, '')) = $3 AND $3 != '')
                     OR (LOWER(TRIM(COALESCE(father_u.email, ''))) = $2 AND $2 != '')
                     OR (LOWER(TRIM(COALESCE(mother_u.email, ''))) = $2 AND $2 != '')
                     OR (TRIM(COALESCE(father_u.phone, '')) = $3 AND $3 != '')
                     OR (TRIM(COALESCE(mother_u.phone, '')) = $3 AND $3 != '')
                     OR (LOWER(TRIM(COALESCE(gu_u.email, ''))) = $2 AND $2 != '')
                     OR (TRIM(COALESCE(gu_u.phone, '')) = $3 AND $3 != '')
                   )
                 LIMIT 1`,
                [userId, userEmail, userPhone]
              );
            } else {
              throw fallbackErr;
            }
          }
        }
      }
    }
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Student not found for this user'
      });
    }

    const studentData = result.rows[0];
    const studentId = studentData.id;

    try {
      const extra = await query(
        'SELECT bank_name, branch, ifsc, known_allergies, medications, previous_school_address, medical_condition, other_information, vehicle_number FROM students WHERE id = $1',
        [studentId]
      );
      if (extra.rows.length > 0) {
        Object.assign(studentData, extra.rows[0]);
      }
    } catch (e) {
      studentData.bank_name = studentData.bank_name ?? null;
      studentData.branch = studentData.branch ?? null;
      studentData.ifsc = studentData.ifsc ?? null;
      studentData.known_allergies = studentData.known_allergies ?? null;
      studentData.medications = studentData.medications ?? null;
      studentData.previous_school_address = studentData.previous_school_address ?? null;
      studentData.medical_condition = studentData.medical_condition ?? null;
      studentData.other_information = studentData.other_information ?? null;
      studentData.vehicle_number = studentData.vehicle_number ?? null;
    }
    // Fallback: if phone/email still empty, fetch from users table
    if (studentData.user_id && (!studentData.phone || !studentData.email)) {
      try {
        const userRow = await query('SELECT phone, email FROM users WHERE id = $1', [studentData.user_id]);
        if (userRow.rows.length > 0) {
          const u = userRow.rows[0];
          studentData.phone = studentData.phone || u.phone;
          studentData.email = studentData.email || u.email;
        }
      } catch (e) { }
    }
    // Hostel: resolve hostel_name, floor, hostel_room_number from hostels + hostel_rooms
    try {
      if (studentData.hostel_id || studentData.hostel_room_id) {
        const hostelRes = await query(`
          SELECT h.hostel_name as hostel_name, hr.room_number as hostel_room_number
          FROM students s
          LEFT JOIN hostel_rooms hr ON s.hostel_room_id = hr.id
          LEFT JOIN hostels h ON COALESCE(s.hostel_id, hr.hostel_id) = h.id
          WHERE s.id = $1
        `, [studentId]);
        if (hostelRes.rows.length > 0 && hostelRes.rows[0]) {
          const row = hostelRes.rows[0];
          studentData.hostel_name = row.hostel_name || null;
          studentData.floor = null;
          studentData.hostel_room_number = row.hostel_room_number != null ? String(row.hostel_room_number) : null;
        }
        if (!studentData.hostel_name && studentData.hostel_id) {
          const hRes = await query('SELECT hostel_name FROM hostels WHERE id = $1', [studentData.hostel_id]);
          if (hRes.rows.length > 0) { studentData.hostel_name = hRes.rows[0].hostel_name || null; }
        }
        if (!studentData.hostel_room_number && studentData.hostel_room_id) {
          const rRes = await query('SELECT room_number FROM hostel_rooms WHERE id = $1', [studentData.hostel_room_id]);
          if (rRes.rows.length > 0) { studentData.hostel_room_number = rRes.rows[0].room_number != null ? String(rRes.rows[0].room_number) : null; }
        }
        if (!studentData.hostel_name && studentData.hostel_room_id) {
          const rRes = await query('SELECT hostel_id FROM hostel_rooms WHERE id = $1', [studentData.hostel_room_id]);
          if (rRes.rows.length > 0 && rRes.rows[0].hostel_id) {
            const hRes = await query('SELECT hostel_name FROM hostels WHERE id = $1', [rRes.rows[0].hostel_id]);
            if (hRes.rows.length > 0) { studentData.hostel_name = hRes.rows[0].hostel_name || null; }
          }
        }
      } else {
        studentData.hostel_name = null;
        studentData.floor = null;
        studentData.hostel_room_number = null;
      }
    } catch (e) {
      studentData.hostel_name = null;
      studentData.floor = null;
      studentData.hostel_room_number = null;
    }
    // Transport: route_name, pickup_point_name for display
    try {
      if (studentData.route_id) {
        const routeRes = await query('SELECT route_name, name FROM routes WHERE id = $1', [studentData.route_id]);
        if (routeRes.rows.length > 0) { studentData.route_name = routeRes.rows[0].route_name || routeRes.rows[0].name || null; }
      }
      if (studentData.pickup_point_id) {
        const ppRes = await query('SELECT pickup_point_name, name FROM pickup_points WHERE id = $1', [studentData.pickup_point_id]);
        if (ppRes.rows.length > 0) { studentData.pickup_point_name = ppRes.rows[0].pickup_point_name || ppRes.rows[0].name || null; }
      }
    } catch (e) { }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Current student fetched successfully',
      data: studentData
    });
  } catch (error) {
    console.error('Error fetching current student:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch current student'
    });
  }
};

// Get students by class
const getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return res.status(access.status || 403).json({
        status: 'ERROR',
        message: access.message || 'Access denied',
      });
    }

    const result = await query(`
      SELECT
        s.id,
        s.admission_number,
        s.roll_number,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.place_of_birth,
        s.blood_group_id,
        s.religion_id,
        s.cast_id,
        s.mother_tongue_id,
        s.nationality,
        s.phone,
        s.email,
        s.address,
        s.user_id,
        s.academic_year_id,
        s.class_id,
        s.section_id,
        s.house_id,
        s.admission_date,
        s.previous_school,
        s.photo_url,
        s.is_transport_required,
        s.route_id,
        s.pickup_point_id,
        s.is_hostel_required,
        s.hostel_room_id,
        s.guardian_id,
        s.is_active,
        s.created_at,
        c.class_name,
        sec.section_name,
        ${STUDENT_CONTACT_LATERAL_SELECT},
        COALESCE(s.current_address, addr.current_address, s.address) as current_address,
        COALESCE(s.permanent_address, addr.permanent_address) as permanent_address
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      ${STUDENT_CONTACT_LATERAL_JOINS}
      LEFT JOIN LATERAL (
        SELECT current_address, permanent_address 
        FROM addresses 
        WHERE user_id = s.user_id 
        ORDER BY id DESC 
        LIMIT 1
      ) addr ON true
      WHERE s.class_id = $1 AND s.is_active = true
      ORDER BY s.first_name ASC, s.last_name ASC
    `, [classId]);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Students fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching students by class:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch students'
    });
  }
};

// Get attendance for a student (from attendance table)
const getStudentAttendance = async (req, res) => {
  try {
    const studentId = parseId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }

    const result = await query(
      `SELECT id, student_id, class_id, section_id, attendance_date, status, 
              check_in_time, check_out_time, marked_by, remarks
       FROM attendance
       WHERE student_id = $1
       ORDER BY attendance_date DESC`,
      [studentId]
    );

    const normalizeStatus = (s) => {
      const v = (s || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
      if (v === 'half_day' || v === 'halfday' || v === 'half') return 'half_day';
      if (v === 'absent' || v === 'absence' || v === 'a' || v === 'ab') return 'absent';
      if (v === 'present' || v === 'p' || v === 'pres') return 'present';
      if (v === 'late' || v === 'l') return 'late';
      return v;
    };

    let minDate = null;
    let maxDate = null;
    result.rows.forEach((r) => {
      const d = String(r.attendance_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    });
    const holidays = minDate && maxDate ? await listHolidaysInRange(minDate, maxDate) : [];
    const holidayDates = buildHolidayDateSet(holidays, minDate, maxDate);

    const records = result.rows.map((r) => {
      const status = normalizeStatus(r.status);
      const attendanceDate = String(r.attendance_date || '').slice(0, 10);
      const isHoliday = holidayDates.has(attendanceDate);
      return {
        id: r.id,
        studentId: r.student_id,
        classId: r.class_id,
        sectionId: r.section_id,
        attendanceDate: r.attendance_date,
        status: applyHolidayOverride(status, isHoliday),
        checkInTime: r.check_in_time,
        checkOutTime: r.check_out_time,
        markedBy: r.marked_by,
        remark: r.remarks,
      };
    });

    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const halfDay = records.filter((r) => r.status === 'half_day' || r.status === 'halfday').length;
    const late = records.filter((r) => r.status === 'late').length;

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student attendance fetched successfully',
      data: {
        records,
        summary: { present, absent, halfDay, late },
      },
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch student attendance',
    });
  }
};

// Get exam results for a student (from exams & exam_results tables)
// This endpoint is read-only and designed to be schema-tolerant:
// - Uses modified_at (not updated_at) when available
// - Falls back gracefully to empty data if expected columns/tables are missing
const getStudentExamResults = async (req, res) => {
  try {
    const resolveLatestLinkedStudentId = async (studentId) => {
      const sid = parseId(studentId);
      if (!sid) return null;
      const latest = await query(
        `WITH base AS (
           SELECT id, user_id, admission_number, roll_number
           FROM students
           WHERE id = $1
           LIMIT 1
         )
         SELECT s2.id AS student_id
         FROM base b
         INNER JOIN students s2
           ON COALESCE(s2.is_active, true) = true
          AND (
            (b.user_id IS NOT NULL AND s2.user_id = b.user_id)
            OR (COALESCE(NULLIF(TRIM(b.admission_number), ''), '') <> '' AND s2.admission_number = b.admission_number)
            OR (COALESCE(NULLIF(TRIM(b.roll_number), ''), '') <> '' AND s2.roll_number = b.roll_number)
          )
         ORDER BY s2.id DESC
         LIMIT 1`,
        [sid]
      );
      return parseId(latest.rows?.[0]?.student_id) || sid;
    };

    const requestedStudentId = parseId(req.params.studentId);
    if (!requestedStudentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const access = await canAccessStudent(req, requestedStudentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }

    // Parent/guardian mappings can point to an older student row after promotions.
    // Normalize to latest active row of the same user so exam pages stay consistent.
    const studentId = await resolveLatestLinkedStudentId(requestedStudentId);

    const schemaCols = await query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('exam_subjects', 'exam_results', 'subjects')`
    );
    const examSubjectsCols = new Set(
      (schemaCols.rows || [])
        .filter((r) => r.table_name === 'exam_subjects' && ['exam_component'].includes(r.column_name))
        .map((r) => String(r.column_name))
    );
    const examResultsCols = new Set(
      (schemaCols.rows || [])
        .filter((r) => r.table_name === 'exam_results' && ['exam_component'].includes(r.column_name))
        .map((r) => String(r.column_name))
    );
    const subjectsCols = new Set(
      (schemaCols.rows || [])
        .filter((r) => r.table_name === 'subjects' && ['practical_hours'].includes(r.column_name))
        .map((r) => String(r.column_name))
    );

    const hasEsComponent = examSubjectsCols.has('exam_component');
    const hasErComponent = examResultsCols.has('exam_component');
    const hasPracticalHours = subjectsCols.has('practical_hours');

    const rows = await query(
      `SELECT
         es.exam_id,
         e.exam_name,
         e.exam_type,
         es.exam_date,
         es.subject_id,
         s.subject_name,
         s.subject_code,
         COALESCE(es.max_marks, 100) AS max_marks,
         COALESCE(es.passing_marks, 35) AS passing_marks,
         ${hasEsComponent ? 'es.exam_component' : "NULL::text AS exam_component"},
         ${hasPracticalHours ? 'COALESCE(s.practical_hours, 0)' : '0'} AS practical_hours,
         er.marks_obtained,
         COALESCE(er.is_absent, false) AS is_absent
       FROM students st
       INNER JOIN exam_subjects es
         ON es.class_id = st.class_id
        AND es.section_id = st.section_id
       INNER JOIN exams e ON e.id = es.exam_id
       INNER JOIN subjects s ON s.id = es.subject_id
       LEFT JOIN exam_results er
         ON er.exam_id = es.exam_id
        AND er.student_id = st.id
        AND er.subject_id = es.subject_id
        ${hasEsComponent && hasErComponent ? 'AND COALESCE(er.exam_component,\'theory\') = COALESCE(es.exam_component,\'theory\')' : ''}
       WHERE st.id = $1
       ORDER BY es.exam_id DESC, es.exam_date ASC NULLS LAST, s.subject_name ASC`,
      [studentId]
    );

    if (!rows.rows || rows.rows.length === 0) {
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'No exam results found for this student',
        data: { exams: [] },
      });
    }

    // Group results by exam (exam_id) and build a UI-friendly structure
    const examsMap = new Map();
    const gradeScale = await loadActiveGradeScale();

    rows.rows.forEach((r) => {
      const examId = parseId(r.exam_id);
      const key = String(examId);

      if (!examsMap.has(key)) {
        const examName = r.exam_name || 'Exam';
        const examType = r.exam_type || null;
        const examDate = r.exam_date || null;
        const labelParts = [];
        if (examType) labelParts.push(examType);
        if (examName && !labelParts.includes(examName)) labelParts.push(examName);
        const examLabel = labelParts.length > 0 ? labelParts.join(' - ') : examName || 'Exam';

        examsMap.set(key, {
          examId: examId,
          examName,
          examType,
          examDate,
          examLabel,
          subjects: [],
          summary: {
            totalMax: 0,
            totalMin: 0,
            totalObtained: 0,
            percentage: null,
            overallResult: null,
          },
        });
      }

      const exam = examsMap.get(key);
      const maxMarks = Number(r.max_marks || 0);
      const minMarks = Number(r.passing_marks || 0);
      const obtained = r.is_absent ? null : (r.marks_obtained != null ? Number(r.marks_obtained) : null);

      const component = String(r.exam_component || '').toLowerCase();
      let subjectMode = 'Theory';
      if (component.includes('practical')) subjectMode = 'Practical';
      else if (Number(r.practical_hours || 0) > 0) subjectMode = 'Practical';

      let result = 'N/A';
      if (r.is_absent) result = 'Fail';
      else if (obtained != null) result = obtained >= minMarks ? 'Pass' : 'Fail';

      exam.subjects.push({
        subjectId: parseId(r.subject_id),
        subjectName: r.subject_name || 'Subject',
        subjectCode: r.subject_code || null,
        subjectMode,
        maxMarks,
        minMarks,
        marksObtained: obtained,
        isAbsent: !!r.is_absent,
        result,
      });
    });

    // Compute per-exam summary strictly from timetable plan + entered marks.
    examsMap.forEach((exam) => {
      const totalMax = exam.subjects.reduce((sum, s) => sum + Number(s.maxMarks || 0), 0);
      const totalMin = exam.subjects.reduce((sum, s) => sum + Number(s.minMarks || 0), 0);
      const totalObtained = exam.subjects.reduce((sum, s) => sum + (s.isAbsent ? 0 : Number(s.marksObtained || 0)), 0);
      const hasPending = exam.subjects.some((s) => !s.isAbsent && s.marksObtained == null);
      const hasFail = exam.subjects.some((s) => s.result === 'Fail');
      const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : null;
      const overallResult = hasPending ? 'Pending' : (hasFail ? 'Fail' : 'Pass');

      exam.summary = {
        totalMax,
        totalMin,
        totalObtained,
        percentage: percentage != null ? Number(percentage.toFixed(2)) : null,
        overallResult,
        grade: percentage != null ? getGradeFromScale(percentage, gradeScale) : null,
      };
    });

    const exams = Array.from(examsMap.values());

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student exam results fetched successfully',
      data: { exams },
    });
  } catch (error) {
    console.error('Error fetching student exam results:', error);
    // Be defensive: do not break the application if schema is different
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Exam results not available',
      data: { exams: [] },
    });
  }
};

const normalizeAttendanceStatus = (s) => {
  const v = (s || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
  if (v === 'half_day' || v === 'halfday' || v === 'half') return 'half_day';
  if (v === 'absent' || v === 'absence' || v === 'a' || v === 'ab') return 'absent';
  if (v === 'present' || v === 'p' || v === 'pres') return 'present';
  if (v === 'late' || v === 'l') return 'late';
  if (v === 'holiday' || v === 'h') return 'holiday';
  return v || null;
};

const getGradeReport = async (req, res) => {
  try {
    const classId = parseId(req.query.class_id);
    const sectionId = parseId(req.query.section_id);
    const academicYearId = parseId(req.query.academic_year_id);
    const requestedExamId = parseId(req.query.exam_id);

    if (!classId) {
      return res.status(400).json({ status: 'ERROR', message: 'class_id is required' });
    }

    const roleId = Number(req.user?.role_id);
    const roleName = String(req.user?.role_name || '').trim().toLowerCase();
    const isTeacher = roleId === ROLES.TEACHER || roleName === 'teacher';

    let teacherIds = [];
    let teacherStaffIds = [];
    if (isTeacher) {
      const teacherRes = await query(
        `SELECT t.id, t.staff_id
         FROM teachers t
         INNER JOIN staff st ON st.id = t.staff_id
         WHERE st.user_id = $1
           AND st.is_active = true`,
        [req.user?.id]
      );
      teacherIds = (teacherRes.rows || []).map((r) => parseId(r.id)).filter(Boolean);
      teacherStaffIds = (teacherRes.rows || []).map((r) => parseId(r.staff_id)).filter(Boolean);
      if (!teacherIds.length || !teacherStaffIds.length) {
        return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
      }
    } else {
      const access = await canAccessClass(req, classId);
      if (!access.ok) {
        return res.status(access.status || 403).json({
          status: 'ERROR',
          message: access.message || 'Access denied',
        });
      }
    }

    const scopedStudentsWhere = ['s.class_id = $1', 's.is_active = true'];
    const scopedStudentsParams = [classId];

    if (sectionId) {
      scopedStudentsParams.push(sectionId);
      scopedStudentsWhere.push(`s.section_id = $${scopedStudentsParams.length}`);
    }
    if (academicYearId) {
      scopedStudentsParams.push(academicYearId);
      scopedStudentsWhere.push(`s.academic_year_id = $${scopedStudentsParams.length}`);
    }
    if (isTeacher) {
      scopedStudentsParams.push(teacherIds);
      scopedStudentsWhere.push(`(
        EXISTS (
          SELECT 1
          FROM class_schedules cs
          WHERE cs.teacher_id = ANY($${scopedStudentsParams.length}::int[])
            AND cs.class_id = s.class_id
            AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
        )
        OR EXISTS (
          SELECT 1
          FROM teachers t
          WHERE t.id = ANY($${scopedStudentsParams.length}::int[])
            AND t.class_id = s.class_id
        )
      )`);
    }

    const scopedWhereSql = scopedStudentsWhere.join(' AND ');

    const examsRes = await query(
      `WITH scoped_students AS (
         SELECT s.id
         FROM students s
         WHERE ${scopedWhereSql}
       )
       SELECT DISTINCT
         er.exam_id AS exam_id,
         COALESCE(e.exam_name, 'Exam') AS exam_name,
         COALESCE(e.exam_type, '') AS exam_type,
         COALESCE(e.start_date, e.end_date, e.modified_at, e.created_at) AS exam_date
       FROM exam_results er
       INNER JOIN scoped_students ss ON ss.id = er.student_id
       LEFT JOIN exams e ON er.exam_id = e.id
       WHERE er.exam_id IS NOT NULL
       ORDER BY COALESCE(e.start_date, e.end_date, e.modified_at, e.created_at) DESC NULLS LAST, COALESCE(e.exam_name, 'Exam') ASC`,
      scopedStudentsParams
    );

    const availableExams = examsRes.rows.map((row) => ({
      examId: row.exam_id,
      examName: row.exam_name,
      examType: row.exam_type,
      examDate: row.exam_date,
    }));

    const selectedExam = availableExams.find((exam) => Number(exam.examId) === Number(requestedExamId)) || availableExams[0] || null;

    if (!selectedExam) {
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Grade report fetched successfully',
        data: {
          selectedExam: null,
          availableExams: [],
          subjects: [],
          rows: [],
        },
      });
    }

    const reportParams = [...scopedStudentsParams, selectedExam.examId];
    const reportRes = await query(
      `SELECT
         s.id AS student_id,
         s.admission_number,
         s.roll_number,
         s.first_name,
         s.last_name,
         s.photo_url,
         s.gender,
         s.section_id,
         sec.section_name,
         er.id AS exam_result_id,
         er.exam_id,
         er.subject_id,
         er.marks_obtained,
         er.obtained_marks,
         er.marks,
         er.marks_scored,
         er.score,
         er.max_marks,
         er.max_mark,
         er.total_marks,
         er.full_marks,
         er.total,
         er.min_marks,
         er.pass_marks,
         er.min_mark,
         er.min,
         er.result,
         er.result_status,
         er.status,
         er.grade,
         er.is_absent,
         sub.subject_name
       FROM students s
       LEFT JOIN sections sec ON s.section_id = sec.id
       LEFT JOIN exam_results er ON er.student_id = s.id AND er.exam_id = $${reportParams.length}
       LEFT JOIN subjects sub ON er.subject_id = sub.id
       WHERE ${scopedWhereSql}
       ORDER BY s.first_name ASC, s.last_name ASC, sub.subject_name ASC NULLS LAST`,
      reportParams
    );

    const subjectMap = new Map();
    const studentsMap = new Map();

    reportRes.rows.forEach((row) => {
      if (row.subject_id != null && !subjectMap.has(String(row.subject_id))) {
        subjectMap.set(String(row.subject_id), {
          subjectId: row.subject_id,
          subjectName: row.subject_name || `Subject ${row.subject_id}`,
        });
      }

      const studentKey = String(row.student_id);
      if (!studentsMap.has(studentKey)) {
        studentsMap.set(studentKey, {
          studentId: row.student_id,
          admissionNo: row.admission_number || '',
          rollNo: row.roll_number || '',
          studentName: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Student',
          avatar: row.photo_url || '',
          gender: row.gender || '',
          sectionId: row.section_id,
          sectionName: row.section_name || '',
          subjectMarks: {},
        });
      }

      if (row.subject_id == null) return;

      const student = studentsMap.get(studentKey);
      const rawMax = row.max_marks ?? row.max_mark ?? row.total_marks ?? row.full_marks ?? row.total ?? null;
      const rawMin = row.min_marks ?? row.pass_marks ?? row.min_mark ?? row.min ?? null;
      const rawObtained = row.marks_obtained ?? row.obtained_marks ?? row.marks ?? row.marks_scored ?? row.score ?? null;

      const maxMarks = rawMax != null ? Number(rawMax) : null;
      const minMarks = rawMin != null ? Number(rawMin) : null;
      const marksObtained = row.is_absent === true ? 0 : (rawObtained != null ? Number(rawObtained) : null);
      let result = row.result || row.result_status || row.status || null;
      if (!result && maxMarks != null && marksObtained != null) {
        const threshold = minMarks != null && minMarks > 0 ? minMarks : Math.round(maxMarks * 0.35);
        result = marksObtained >= threshold ? 'Pass' : 'Fail';
      }

      student.subjectMarks[String(row.subject_id)] = {
        marksObtained,
        maxMarks,
        minMarks,
        result,
        grade: row.grade || null,
        isAbsent: row.is_absent === true,
      };
    });

    const gradeScale = await loadActiveGradeScale();
    const subjects = Array.from(subjectMap.values());
    const rows = Array.from(studentsMap.values()).map((student) => {
      const subjectEntries = subjects.map((subject) => student.subjectMarks[String(subject.subjectId)]).filter(Boolean);
      const totalObtained = subjectEntries.reduce((sum, entry) => sum + (Number(entry.marksObtained) || 0), 0);
      const totalMax = subjectEntries.reduce((sum, entry) => sum + (Number(entry.maxMarks) || 0), 0);
      const totalMin = subjectEntries.reduce((sum, entry) => sum + (Number(entry.minMarks) || 0), 0);
      const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : null;
      const overallResult = totalMax > 0 ? (totalObtained >= totalMin ? 'Pass' : 'Fail') : null;

      return {
        ...student,
        summary: {
          totalObtained,
          totalMax,
          totalMin,
          percentage,
          overallResult,
          grade: percentage == null ? null : getGradeFromScale(percentage, gradeScale),
        },
      };
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Grade report fetched successfully',
      data: {
        selectedExam,
        availableExams,
        subjects,
        rows,
      },
    });
  } catch (error) {
    console.error('Error fetching grade report:', error);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Grade report not available',
      data: {
        selectedExam: null,
        availableExams: [],
        subjects: [],
        rows: [],
      },
    });
  }
};

const getAttendanceReport = async (req, res) => {
  try {
    const classId = parseId(req.query.class_id);
    const sectionId = parseId(req.query.section_id);
    const academicYearId = parseId(req.query.academic_year_id);
    const month = String(req.query.month || '').trim();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ status: 'ERROR', message: 'month must be in YYYY-MM format' });
    }

    const roleId = Number(req.user?.role_id);
    const roleName = String(req.user?.role_name || '').trim().toLowerCase();
    const isTeacher = roleId === ROLES.TEACHER || roleName === 'teacher';

    // Teachers are scoped to their mapped students via schedules/homeroom mappings.
    let teacherIds = [];
    let teacherStaffIds = [];
    if (isTeacher) {
      const teacherRes = await query(
        `SELECT t.id, t.staff_id
         FROM teachers t
         INNER JOIN staff st ON st.id = t.staff_id
         WHERE st.user_id = $1
           AND st.is_active = true`,
        [req.user?.id]
      );
      teacherIds = (teacherRes.rows || []).map((r) => parseId(r.id)).filter(Boolean);
      teacherStaffIds = (teacherRes.rows || []).map((r) => parseId(r.staff_id)).filter(Boolean);
      if (!teacherIds.length || !teacherStaffIds.length) {
        return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
      }
    } else if (classId) {
      const access = await canAccessClass(req, classId);
      if (!access.ok) {
        return res.status(access.status || 403).json({
          status: 'ERROR',
          message: access.message || 'Access denied',
        });
      }
    }

    const monthParts = month.split('-');
    const monthYear = Number(monthParts[0]);
    const monthNumber = Number(monthParts[1]);
    if (!Number.isInteger(monthYear) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid month' });
    }
    const monthStartDate = new Date(Date.UTC(monthYear, monthNumber - 1, 1));
    const monthEndDate = new Date(Date.UTC(monthYear, monthNumber, 1));
    const monthStartDateStr = `${String(monthYear).padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}-01`;
    const monthEndDateStr = `${String(monthEndDate.getUTCFullYear()).padStart(4, '0')}-${String(
      monthEndDate.getUTCMonth() + 1
    ).padStart(2, '0')}-01`;

    const rosterWhere = ['s.is_active = true'];
    const rosterParams = [];

    if (classId) {
      rosterParams.push(classId);
      rosterWhere.push(`s.class_id = $${rosterParams.length}`);
    }

    if (sectionId) {
      rosterParams.push(sectionId);
      rosterWhere.push(`s.section_id = $${rosterParams.length}`);
    }
    if (academicYearId) {
      rosterParams.push(academicYearId);
      rosterWhere.push(`s.academic_year_id = $${rosterParams.length}`);
    }
    if (isTeacher) {
      rosterParams.push(teacherIds);
      const teacherIdsParamRef = `$${rosterParams.length}`;
      rosterParams.push(teacherStaffIds);
      const staffIdsParamRef = `$${rosterParams.length}`;
      rosterWhere.push(`(
        EXISTS (
          SELECT 1
          FROM class_schedules cs
          WHERE cs.teacher_id = ANY(${teacherIdsParamRef}::int[])
            AND cs.class_id = s.class_id
            AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
        )
        OR EXISTS (
          SELECT 1
          FROM teachers t
          WHERE t.id = ANY(${teacherIdsParamRef}::int[])
            AND t.class_id = s.class_id
        )
        OR EXISTS (
          SELECT 1
          FROM sections sec_map
          WHERE sec_map.id = s.section_id
            AND sec_map.section_teacher_id = ANY(${staffIdsParamRef}::int[])
        )
        OR EXISTS (
          SELECT 1
          FROM classes c_map
          WHERE c_map.id = s.class_id
            AND (
              c_map.class_teacher_id = ANY(${teacherIdsParamRef}::int[])
              OR c_map.class_teacher_id = ANY(${staffIdsParamRef}::int[])
            )
        )
      )`);
    }

    const rosterRes = await query(
      `SELECT
         s.id,
         s.admission_number,
         s.roll_number,
         s.first_name,
         s.last_name,
         s.photo_url,
         s.gender,
         s.section_id,
         sec.section_name
       FROM students s
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE ${rosterWhere.join(' AND ')}
       ORDER BY s.first_name ASC, s.last_name ASC`,
      rosterParams
    );

    const attendanceParams = [...rosterParams, monthStartDateStr, monthEndDateStr];
    const attendanceRes = await query(
      `SELECT
         a.student_id,
         a.attendance_date::date AS attendance_date,
         a.status
       FROM attendance a
       INNER JOIN students s ON s.id = a.student_id
       WHERE ${rosterWhere.join(' AND ')}
         AND a.attendance_date >= $${attendanceParams.length - 1}
         AND a.attendance_date < $${attendanceParams.length}
       ORDER BY a.attendance_date ASC`,
      attendanceParams
    );

    const todayUtc = new Date();
    const todayUtcDateOnly = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()));
    const isCurrentMonth =
      monthYear === todayUtcDateOnly.getUTCFullYear() && monthNumber === todayUtcDateOnly.getUTCMonth() + 1;
    const reportEndDateExclusive =
      isCurrentMonth && todayUtcDateOnly < monthEndDate ? new Date(todayUtcDateOnly.getTime() + (24 * 60 * 60 * 1000)) : monthEndDate;

    const days = [];
    const cursor = new Date(monthStartDate);
    while (cursor < reportEndDateExclusive) {
      days.push({
        day: cursor.getUTCDate(),
        date: cursor.toISOString().slice(0, 10),
        weekdayShort: cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const monthLast = new Date(monthEndDate);
    monthLast.setUTCDate(monthLast.getUTCDate() - 1);
    const monthLastIso = monthLast.toISOString().slice(0, 10);
    const holidays = await listHolidaysInRange(monthStartDate.toISOString().slice(0, 10), monthLastIso);
    const holidayDates = buildHolidayDateSet(
      holidays,
      monthStartDate.toISOString().slice(0, 10),
      monthLastIso
    );

    const attendanceByStudent = new Map();
    attendanceRes.rows.forEach((row) => {
      const studentKey = String(row.student_id);
      if (!attendanceByStudent.has(studentKey)) {
        attendanceByStudent.set(studentKey, {});
      }
      const attendanceDateKey =
        row.attendance_date instanceof Date
          ? `${String(row.attendance_date.getFullYear()).padStart(4, '0')}-${String(
            row.attendance_date.getMonth() + 1
          ).padStart(2, '0')}-${String(row.attendance_date.getDate()).padStart(2, '0')}`
          : String(row.attendance_date || '').slice(0, 10);
      attendanceByStudent.get(studentKey)[attendanceDateKey] = normalizeAttendanceStatus(row.status);
    });

    const rows = rosterRes.rows.map((student) => {
      const daily = { ...(attendanceByStudent.get(String(student.id)) || {}) };
      days.forEach((day) => {
        const existing = daily[day.date];
        const isHoliday = holidayDates.has(day.date);
        if (isHoliday) {
          if (existing && existing !== 'holiday') {
            daily[day.date] = `holiday_${existing}`;
          } else if (!existing) {
            daily[day.date] = 'holiday';
          }
        } else if (!existing) {
          daily[day.date] = 'absent';
        }
      });

      const summary = {
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
        percentage: 0,
      };

      Object.values(daily).forEach((status) => {
        const s = String(status || '');
        if (s.startsWith('holiday_') && s.length > 'holiday_'.length) {
          summary.holiday += 1;
          const rest = s.slice('holiday_'.length);
          if (rest === 'present') summary.present += 1;
          else if (rest === 'late') summary.late += 1;
          else if (rest === 'absent') summary.absent += 1;
          else if (rest === 'half_day') summary.halfDay += 1;
          return;
        }
        if (status === 'present') summary.present += 1;
        else if (status === 'late') summary.late += 1;
        else if (status === 'absent') summary.absent += 1;
        else if (status === 'half_day') summary.halfDay += 1;
        else if (status === 'holiday') summary.holiday += 1;
      });

      const workedDays = summary.present + summary.late + summary.absent + summary.halfDay;
      const effectivePresent = summary.present + summary.late + (summary.halfDay * 0.5);
      summary.percentage = workedDays > 0 ? Number(((effectivePresent / workedDays) * 100).toFixed(2)) : 0;

      return {
        studentId: student.id,
        admissionNo: student.admission_number || '',
        rollNo: student.roll_number || '',
        name: [student.first_name, student.last_name].filter(Boolean).join(' ') || 'Student',
        img: student.photo_url || '',
        gender: student.gender || '',
        sectionId: student.section_id,
        sectionName: student.section_name || '',
        summary,
        daily,
      };
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Attendance report fetched successfully',
      data: {
        month,
        days,
        rows,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch attendance report',
      code: 'ATTENDANCE_REPORT_FAILED',
    });
  }
};

/**
 * GET /students/check-admission-number?admissionNumber=...&excludeId=...
 * Fast duplicate check for forms (UX). Server-side validation on save remains mandatory.
 */
const checkAdmissionNumberUnique = async (req, res) => {
  try {
    const raw = req.query.admissionNumber ?? req.query.admission_number;
    const excludeRaw = req.query.excludeId ?? req.query.exclude_id;
    const trimmed = raw != null ? String(raw).trim() : '';
    if (!trimmed) {
      return res.status(200).json({
        status: 'SUCCESS',
        exists: false,
        checked: false,
      });
    }

    let excludeId = null;
    if (excludeRaw != null && String(excludeRaw).trim() !== '') {
      const n = parseInt(String(excludeRaw), 10);
      if (!Number.isFinite(n) || n < 1) {
        return res.status(400).json({ status: 'ERROR', message: 'Invalid excludeId' });
      }
      excludeId = n;
    }

    const result = await query(
      `SELECT EXISTS (
        SELECT 1 FROM students
        WHERE TRIM(admission_number) = TRIM($1)
          AND is_active = true
          AND ($2::int IS NULL OR id <> $2)
      ) AS exists`,
      [trimmed, excludeId]
    );
    const exists = Boolean(result.rows[0]?.exists);
    res.status(200).json({ status: 'SUCCESS', exists });
  } catch (error) {
    console.error('checkAdmissionNumberUnique:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to check admission number',
    });
  }
};

/** GET /students/search?q= — typeahead (min 2 chars), tenant students only */
const searchStudents = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.status(200).json({ status: 'SUCCESS', data: [] });
    }
    const like = `%${q}%`;
    const result = await query(
      `SELECT s.id,
        NULLIF(TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))), '') AS name,
        s.admission_number AS "admissionNumber",
        COALESCE(c.class_name, '') AS "className",
        -- Check for parents (Father/Mother)
        EXISTS (
          SELECT 1 FROM guardians g 
          WHERE g.student_id = s.id AND g.is_active = true 
            AND LOWER(COALESCE(g.guardian_type::text, '')) IN ('father', 'mother')
        ) AS "hasParents",
        (
          SELECT TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
          FROM guardians g
          JOIN users u ON u.id = g.user_id
          WHERE g.student_id = s.id AND g.is_active = true 
            AND LOWER(COALESCE(g.guardian_type::text, '')) IN ('father', 'mother')
          ORDER BY g.id ASC LIMIT 1
        ) AS "parentName",
        -- Check for generic guardian
        EXISTS (
          SELECT 1 FROM guardians g 
          WHERE g.student_id = s.id AND g.is_active = true 
            AND LOWER(COALESCE(g.guardian_type::text, '')) NOT IN ('father', 'mother')
        ) AS "hasGuardian",
        (
          SELECT TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
          FROM guardians g
          JOIN users u ON u.id = g.user_id
          WHERE g.student_id = s.id AND g.is_active = true 
            AND LOWER(COALESCE(g.guardian_type::text, '')) NOT IN ('father', 'mother')
          ORDER BY g.id ASC LIMIT 1
        ) AS "guardianName"
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.is_active = true
         AND (
           LOWER(TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')))) LIKE LOWER($1)
           OR LOWER(TRIM(COALESCE(s.admission_number, ''))) LIKE LOWER($1)
         )
       ORDER BY s.first_name ASC, s.last_name ASC
       LIMIT 25`,
      [like]
    );
    const rows = (result.rows || []).map((r) => ({
      id: r.id,
      name: r.name || `${r.admissionNumber || ''}`.trim() || `Student #${r.id}`,
      admissionNumber: r.admissionNumber || '',
      className: r.className || '',
      hasParents: Boolean(r.hasParents),
      parentName: r.parentName || '',
      hasGuardian: Boolean(r.hasGuardian),
      guardianName: r.guardianName || '',
    }));
    res.status(200).json({ status: 'SUCCESS', data: rows });
  } catch (error) {
    console.error('searchStudents:', error);
    res.status(500).json({ status: 'ERROR', message: 'Student search failed' });
  }
};

/**
 * Delete a student record (Soft Delete).
 * Sets deleted_at = NOW() and is_active = false for both student and linked user.
 */
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const sid = parseId(id);
    if (!sid) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const result = await executeTransaction(async (client) => {
      // 1. Mark student as deleted
      const stuUpdate = await client.query(
        `UPDATE students 
         SET is_active = false, deleted_at = NOW(), modified_at = NOW() 
         WHERE id = $1 AND deleted_at IS NULL 
         RETURNING id, user_id`,
        [sid]
      );

      if (stuUpdate.rows.length === 0) {
        const err = new Error('Student not found or already deleted');
        err.statusCode = 404;
        throw err;
      }

      const { user_id } = stuUpdate.rows[0];

      // 2. Mark linked user as deleted (if exists)
      if (user_id) {
        await client.query(
          `UPDATE users 
           SET is_active = false, deleted_at = NOW(), modified_at = NOW() 
           WHERE id = $1 AND deleted_at IS NULL`,
          [user_id]
        );
      }

      return sid;
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Student record deleted successfully (soft delete)',
      data: { id: result }
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to delete student';
    res.status(statusCode).json({ status: 'ERROR', message });
  }
};

module.exports = {
  createStudent,
  updateStudent,
  promoteStudents,
  leaveStudents,
  rejoinStudent,
  getStudentPromotions,
  getLeavingStudents,
  getStudentRejoins,
  getAllStudents,
  getTeacherStudents,
  getStudentById,
  getStudentLoginDetails,
  getCurrentStudent,
  getStudentsByClass,
  getStudentAttendance,
  getStudentExamResults,
  getGradeReport,
  getAttendanceReport,
  checkAdmissionNumberUnique,
  searchStudents,
  deleteStudent,
};
