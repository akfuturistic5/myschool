const { query, executeTransaction } = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const { ROLES } = require('../config/roles');
const { getParentsForUser } = require('../utils/parentUserMatch');
const { canAccessStudent, canAccessClass, parseId } = require('../utils/accessControl');
const {
  createStudentUser,
  createParentIndividualUser,
  createGuardianUser,
  isUserEmailTaken,
} = require('../utils/createPersonUser');

const formatGrNumber = (n) => `GR${String(n).padStart(6, '0')}`;

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
      guardian_email, guardian_occupation, guardian_address,
      // Address, siblings, transport, hostel, bank, medical, other
      current_address, permanent_address, address,
      unique_student_ids, pen_number, aadhaar_no, gr_number,
      previous_school, previous_school_address,
      sibiling_1, sibiling_2, sibiling_1_class, sibiling_2_class,
      is_transport_required, route_id, pickup_point_id, vehicle_number,
      is_hostel_required, hostel_id, hostel_room_id,
      bank_name, branch, ifsc,
      known_allergies, medications, medical_condition, other_information
    } = req.body;

    // Validate required fields
    if (!admission_number || !first_name || !last_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Admission number, first name, and last name are required'
      });
    }

    let grNormCreate = (gr_number != null ? String(gr_number) : '').trim();

    const hasParentInfo = father_name || father_email || father_phone || father_occupation ||
      mother_name || mother_email || mother_phone || mother_occupation;

    const hasGuardianInfo = guardian_first_name || guardian_last_name || guardian_phone ||
      guardian_email || guardian_occupation || guardian_relation;

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
            sibiling_1, sibiling_2, sibiling_1_class, sibiling_2_class,
            is_transport_required, route_id, pickup_point_id, vehicle_number,
            is_hostel_required, hostel_id, hostel_room_id,
            bank_name, branch, ifsc,
            known_allergies, medications, medical_condition, other_information,
            unique_student_ids, pen_number, aadhar_no, gr_number,
            created_at, modified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, NOW(), NOW())
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male','female','other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
          date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
          cast_id || null, phone || null, email || null, mother_tongue_id || null,
          status === 'Active' ? true : false,
          addrVal,
          current_address || addrVal || null,
          permanent_address || null,
          previous_school || null, previous_school_address || null,
          sibiling_1 || null, sibiling_2 || null, sibiling_1_class || null, sibiling_2_class || null,
          is_transport_required === true || is_transport_required === 'true',
          route_id || null, pickup_point_id || null, vehicle_number || null,
          is_hostel_required === true || is_hostel_required === 'true',
          hostel_id || null, hostel_room_id || null,
          bank_name || null, branch || null, ifsc || null,
          knownAllergiesVal, medicationsVal,
          medical_condition || null, other_information || null,
          unique_student_ids || null, pen_number || null, aadhaar_no || null,
          grNormCreate
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
            sibiling_1, sibiling_2, sibiling_1_class, sibiling_2_class,
            is_transport_required, route_id, pickup_point_id, vehicle_number,
            is_hostel_required, hostel_id, hostel_room_id,
            bank_name, branch, ifsc,
            known_allergies, medications, medical_condition, other_information,
            unique_student_ids, pen_number, aadhar_no, gr_number,
            created_at, modified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, NOW(), NOW())
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male','female','other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
          date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
          cast_id || null, phone || null, email || null, mother_tongue_id || null,
          status === 'Active' ? true : false,
          addrVal,
          previous_school || null, previous_school_address || null,
          sibiling_1 || null, sibiling_2 || null, sibiling_1_class || null, sibiling_2_class || null,
          is_transport_required === true || is_transport_required === 'true',
          route_id || null, pickup_point_id || null, vehicle_number || null,
          is_hostel_required === true || is_hostel_required === 'true',
          hostel_id || null, hostel_room_id || null,
          bank_name || null, branch || null, ifsc || null,
          knownAllergiesVal, medicationsVal,
          medical_condition || null, other_information || null,
          unique_student_ids || null, pen_number || null, aadhaar_no || null,
          grNormCreate
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

      if (hasParentInfo) {
        const parentResult = await client.query(`
          INSERT INTO parents (
            student_id, father_name, father_email, father_phone, father_occupation, father_image_url,
            mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING id
        `, [
          studentRow.id, father_name || null, father_email || null, father_phone || null,
          father_occupation || null, father_image_url || null, mother_name || null,
          mother_email || null, mother_phone || null, mother_occupation || null,
          mother_image_url || null
        ]);

        await client.query(`
          UPDATE students SET parent_id = $1, modified_at = NOW() WHERE id = $2
        `, [parentResult.rows[0].id, studentRow.id]);

        studentRow.parent_id = parentResult.rows[0].id;

        const parentRowId = parentResult.rows[0].id;
        let fatherUserId = null;
        let motherUserId = null;
        try {
          if (father_phone || father_email) {
            fatherUserId = await createParentIndividualUser(client, {
              full_name: father_name,
              email: father_email,
              phone: father_phone,
              parent_row_id: parentRowId,
              side: 'father',
            });
            const fMail = (father_email || '').toString().trim();
            if (!fatherUserId && fMail && (await isUserEmailTaken(client, fMail))) {
              creationWarnings.push(buildEmailInUseWarning('father_email', 'Father'));
            }
          }
          if (mother_phone || mother_email) {
            motherUserId = await createParentIndividualUser(client, {
              full_name: mother_name,
              email: mother_email,
              phone: mother_phone,
              parent_row_id: parentRowId,
              side: 'mother',
            });
            const mMail = (mother_email || '').toString().trim();
            if (!motherUserId && mMail && (await isUserEmailTaken(client, mMail))) {
              creationWarnings.push(buildEmailInUseWarning('mother_email', 'Mother'));
            }
          }
        } catch (e) {
          console.warn('createStudent: could not create parent users:', e.message);
        }
        await client.query(
          `UPDATE parents SET
            father_user_id = $1::integer,
            mother_user_id = $2::integer,
            user_id = COALESCE($1::integer, $2::integer),
            updated_at = NOW()
          WHERE id = $3::integer`,
          [fatherUserId, motherUserId, parentRowId]
        );
      }

      if (hasGuardianInfo) {
        const guardianResult = await client.query(`
          INSERT INTO guardians (
            student_id, guardian_type, first_name, last_name, relation, occupation, phone, email, address,
            is_active, created_at, modified_at
          ) VALUES ($1, 'guardian', $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
          RETURNING id
        `, [
          studentRow.id,
          guardian_first_name || 'Guardian',
          guardian_last_name || '',
          guardian_relation || null,
          guardian_occupation || null,
          guardian_phone || '',
          guardian_email || null,
          guardian_address || null
        ]);

        await client.query(`
          UPDATE students SET guardian_id = $1, modified_at = NOW() WHERE id = $2
        `, [guardianResult.rows[0].id, studentRow.id]);

        studentRow.guardian_id = guardianResult.rows[0].id;

        // Create guardian user and link
        const gPhone = (guardian_phone || '').toString().trim();
        const gEmail = (guardian_email || '').toString().trim();
        if (gPhone || gEmail) {
          try {
            const guardianUserId = await createGuardianUser(client, {
              first_name: guardian_first_name || 'Guardian',
              last_name: guardian_last_name || '',
              phone: gPhone || null,
              email: gEmail || null
            });
            if (guardianUserId) {
              await client.query('UPDATE guardians SET user_id = $1, modified_at = NOW() WHERE id = $2', [guardianUserId, guardianResult.rows[0].id]);
            } else if (gEmail && (await isUserEmailTaken(client, gEmail))) {
              creationWarnings.push(buildEmailInUseWarning('guardian_email', 'Guardian'));
            }
          } catch (e) {
            console.warn('createStudent: could not create guardian user:', e.message);
          }
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
      guardian_email, guardian_occupation, guardian_address,
      // Address, siblings, transport, hostel, bank, medical, other
      current_address, permanent_address, address,
      unique_student_ids, pen_number, aadhaar_no, gr_number,
      previous_school, previous_school_address,
      sibiling_1, sibiling_2, sibiling_1_class, sibiling_2_class,
      is_transport_required, route_id, pickup_point_id, vehicle_number,
      is_hostel_required, hostel_id, hostel_room_id,
      bank_name, branch, ifsc,
      known_allergies, medications, medical_condition, other_information
    } = req.body;

    // Validate required fields
    if (!admission_number || !first_name || !last_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Admission number, first name, and last name are required'
      });
    }

    let grNormUpdate = (gr_number != null ? String(gr_number) : '').trim();

    const hasParentInfo = father_name || father_email || father_phone || father_occupation ||
      mother_name || mother_email || mother_phone || mother_occupation;

    const hasGuardianInfo = guardian_first_name || guardian_last_name || guardian_phone ||
      guardian_email || guardian_occupation || guardian_relation;

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

      let result;
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
            sibiling_1 = $24,
            sibiling_2 = $25,
            sibiling_1_class = $26,
            sibiling_2_class = $27,
            is_transport_required = $28,
            route_id = $29,
            pickup_point_id = $30,
            vehicle_number = $31,
            is_hostel_required = $32,
            hostel_id = $33,
            hostel_room_id = $34,
            bank_name = $35,
            branch = $36,
            ifsc = $37,
            known_allergies = $38,
            medications = $39,
            medical_condition = $40,
            other_information = $41,
            unique_student_ids = $42,
            pen_number = $43,
            aadhar_no = $44,
            gr_number = $45,
            modified_at = NOW()
          WHERE id = $46
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male','female','other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
          date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
          cast_id || null, phone || null, email || null, mother_tongue_id || null,
          status === 'Active' ? true : false,
          addrVal,
          current_address || addrVal || null,
          permanent_address || null,
          previous_school || null, previous_school_address || null,
          sibiling_1 || null, sibiling_2 || null, sibiling_1_class || null, sibiling_2_class || null,
          is_transport_required === true || is_transport_required === 'true',
          route_id || null, pickup_point_id || null, vehicle_number || null,
          is_hostel_required === true || is_hostel_required === 'true',
          hostel_id || null, hostel_room_id || null,
          bank_name || null, branch || null, ifsc || null,
          knownAllergiesVal, medicationsVal,
          medical_condition || null, other_information || null,
          unique_student_ids || null, pen_number || null, aadhaar_no || null,
          grNormUpdate,
          id
        ]);
      } catch (e) {
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
                sibiling_1 = $22,
                sibiling_2 = $23,
                sibiling_1_class = $24,
                sibiling_2_class = $25,
                is_transport_required = $26,
                route_id = $27,
                pickup_point_id = $28,
                vehicle_number = $29,
                is_hostel_required = $30,
                hostel_id = $31,
                hostel_room_id = $32,
                bank_name = $33,
                branch = $34,
                ifsc = $35,
                known_allergies = $36,
                medications = $37,
                medical_condition = $38,
                other_information = $39,
                unique_student_ids = $40,
                pen_number = $41,
                aadhar_no = $42,
                gr_number = $43,
                modified_at = NOW()
              WHERE id = $44
              RETURNING *
            `, [
              academic_year_id || null, admission_number, admission_date || null, roll_number || null,
              first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male','female','other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
              date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
              cast_id || null, phone || null, email || null, mother_tongue_id || null,
              status === 'Active' ? true : false,
              addrVal,
              previous_school || null, previous_school_address || null,
              sibiling_1 || null, sibiling_2 || null, sibiling_1_class || null, sibiling_2_class || null,
              is_transport_required === true || is_transport_required === 'true',
              route_id || null, pickup_point_id || null, vehicle_number || null,
              is_hostel_required === true || is_hostel_required === 'true',
              hostel_id || null, hostel_room_id || null,
              bank_name || null, branch || null, ifsc || null,
              knownAllergiesVal, medicationsVal,
              medical_condition || null, other_information || null,
              unique_student_ids || null, pen_number || null, aadhaar_no || null,
              grNormUpdate,
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
              reigion_id = $13,
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
              sibiling_1 = $24,
              sibiling_2 = $25,
              sibiling_1_class = $26,
              sibiling_2_class = $27,
              is_transport_required = $28,
              route_id = $29,
              pickup_point_id = $30,
              vehicle_number = $31,
              is_hostel_required = $32,
              hostel_id = $33,
              hostel_room_id = $34,
              bank_name = $35,
              branch = $36,
              ifsc = $37,
              known_allergies = $38,
              medications = $39,
              medical_condition = $40,
              other_information = $41,
              unique_student_ids = $42,
              pen_number = $43,
              aadhar_no = $44,
              gr_number = $45,
              modified_at = NOW()
            WHERE id = $46
            RETURNING *
          `, [
            academic_year_id || null, admission_number, admission_date || null, roll_number || null,
            first_name, last_name, class_id || null, section_id || null,
          (gender && typeof gender === 'string' && ['male','female','other'].includes(gender.trim().toLowerCase()) ? gender.trim().toLowerCase() : null),
            date_of_birth || null, blood_group_id || null, house_id || null, religion_id || null,
            cast_id || null, phone || null, email || null, mother_tongue_id || null,
            status === 'Active' ? true : false,
            addrVal,
            current_address || addrVal || null,
            permanent_address || null,
            previous_school || null, previous_school_address || null,
            sibiling_1 || null, sibiling_2 || null, sibiling_1_class || null, sibiling_2_class || null,
            is_transport_required === true || is_transport_required === 'true',
            route_id || null, pickup_point_id || null, vehicle_number || null,
            is_hostel_required === true || is_hostel_required === 'true',
            hostel_id || null, hostel_room_id || null,
            bank_name || null, branch || null, ifsc || null,
            knownAllergiesVal, medicationsVal,
            medical_condition || null, other_information || null,
            unique_student_ids || null, pen_number || null, aadhaar_no || null,
            grNormUpdate,
            id
          ]);
        } else {
          throw e;
        }
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

      if (hasParentInfo) {
        const existingParent = await client.query(
          'SELECT id FROM parents WHERE student_id = $1',
          [studentRow.id]
        );

        if (existingParent.rows.length > 0) {
          await client.query(`
            UPDATE parents SET
              father_name = $1,
              father_email = $2,
              father_phone = $3,
              father_occupation = $4,
              father_image_url = $5,
              mother_name = $6,
              mother_email = $7,
              mother_phone = $8,
              mother_occupation = $9,
              mother_image_url = $10,
              updated_at = NOW()
            WHERE student_id = $11
          `, [
            father_name || null, father_email || null, father_phone || null,
            father_occupation || null, father_image_url || null, mother_name || null,
            mother_email || null, mother_phone || null, mother_occupation || null,
            mother_image_url || null, studentRow.id
          ]);

          if (!studentRow.parent_id) {
            await client.query(`
              UPDATE students SET parent_id = $1, modified_at = NOW() WHERE id = $2
            `, [existingParent.rows[0].id, studentRow.id]);
            studentRow.parent_id = existingParent.rows[0].id;
          }
        } else {
          const parentResult = await client.query(`
            INSERT INTO parents (
              student_id, father_name, father_email, father_phone, father_occupation, father_image_url,
              mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            RETURNING id
          `, [
            studentRow.id, father_name || null, father_email || null, father_phone || null,
            father_occupation || null, father_image_url || null, mother_name || null,
            mother_email || null, mother_phone || null, mother_occupation || null,
            mother_image_url || null
          ]);

          await client.query(`
            UPDATE students SET parent_id = $1, modified_at = NOW() WHERE id = $2
          `, [parentResult.rows[0].id, studentRow.id]);

          studentRow.parent_id = parentResult.rows[0].id;
        }

        const pRowRes = await client.query(
          'SELECT id, father_user_id, mother_user_id FROM parents WHERE student_id = $1 LIMIT 1',
          [studentRow.id]
        );
        if (pRowRes.rows.length > 0) {
          const pRow = pRowRes.rows[0];
          let newFatherUserId = null;
          let newMotherUserId = null;
          try {
            if ((father_phone || father_email) && !pRow.father_user_id) {
              newFatherUserId = await createParentIndividualUser(client, {
                full_name: father_name,
                email: father_email,
                phone: father_phone,
                parent_row_id: pRow.id,
                side: 'father',
              });
              const fMailUp = (father_email || '').toString().trim();
              if (!newFatherUserId && fMailUp && (await isUserEmailTaken(client, fMailUp))) {
                updateWarnings.push(buildEmailInUseWarning('father_email', 'Father'));
              }
            }
            if ((mother_phone || mother_email) && !pRow.mother_user_id) {
              newMotherUserId = await createParentIndividualUser(client, {
                full_name: mother_name,
                email: mother_email,
                phone: mother_phone,
                parent_row_id: pRow.id,
                side: 'mother',
              });
              const mMailUp = (mother_email || '').toString().trim();
              if (!newMotherUserId && mMailUp && (await isUserEmailTaken(client, mMailUp))) {
                updateWarnings.push(buildEmailInUseWarning('mother_email', 'Mother'));
              }
            }
          } catch (e) {
            console.warn('updateStudent: could not create parent users:', e.message);
          }
          await client.query(
            `UPDATE parents SET
              father_user_id = COALESCE($1::integer, father_user_id),
              mother_user_id = COALESCE($2::integer, mother_user_id),
              user_id = COALESCE(user_id, father_user_id, mother_user_id),
              updated_at = NOW()
            WHERE id = $3`,
            [newFatherUserId, newMotherUserId, pRow.id]
          );
        }
      }

      if (hasGuardianInfo) {
        const existingGuardian = await client.query(
          'SELECT id FROM guardians WHERE student_id = $1',
          [studentRow.id]
        );

        if (existingGuardian.rows.length > 0) {
          await client.query(`
            UPDATE guardians SET
              first_name = $1,
              last_name = $2,
              relation = $3,
              occupation = $4,
              phone = $5,
              email = $6,
              address = $7,
              guardian_type = COALESCE(guardian_type, 'guardian'),
              modified_at = NOW()
            WHERE student_id = $8
          `, [
            guardian_first_name || 'Guardian',
            guardian_last_name || '',
            guardian_relation || null,
            guardian_occupation || null,
            guardian_phone || '',
            guardian_email || null,
            guardian_address || null,
            studentRow.id
          ]);
          studentRow.guardian_id = existingGuardian.rows[0].id;
        } else {
          const guardianResult = await client.query(`
            INSERT INTO guardians (
              student_id, guardian_type, first_name, last_name, relation, occupation, phone, email, address,
              is_active, created_at, modified_at
            ) VALUES ($1, 'guardian', $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
            RETURNING id
          `, [
            studentRow.id,
            guardian_first_name || 'Guardian',
            guardian_last_name || '',
            guardian_relation || null,
            guardian_occupation || null,
            guardian_phone || '',
            guardian_email || null,
            guardian_address || null
          ]);

          await client.query(`
            UPDATE students SET guardian_id = $1, modified_at = NOW() WHERE id = $2
          `, [guardianResult.rows[0].id, studentRow.id]);

          studentRow.guardian_id = guardianResult.rows[0].id;
        }
      }

      const gUserSync = await client.query(
        'SELECT id, user_id, phone, email, first_name, last_name FROM guardians WHERE student_id = $1 LIMIT 1',
        [studentRow.id]
      );
      if (gUserSync.rows.length > 0 && !gUserSync.rows[0].user_id) {
        const gr = gUserSync.rows[0];
        const gPhoneUp = (guardian_phone || gr.phone || '').toString().trim();
        const gEmailUp = (guardian_email || gr.email || '').toString().trim();
        if (gPhoneUp || gEmailUp) {
          try {
            const guardianUserId = await createGuardianUser(client, {
              first_name: guardian_first_name || gr.first_name || 'Guardian',
              last_name: guardian_last_name || gr.last_name || '',
              phone: gPhoneUp || null,
              email: gEmailUp || null,
            });
            if (guardianUserId) {
              await client.query('UPDATE guardians SET user_id = $1, modified_at = NOW() WHERE id = $2', [
                guardianUserId,
                gr.id,
              ]);
            } else if (gEmailUp && (await isUserEmailTaken(client, gEmailUp))) {
              updateWarnings.push(buildEmailInUseWarning('guardian_email', 'Guardian'));
            }
          } catch (e) {
            console.warn('updateStudent: could not create guardian user:', e.message);
          }
        }
      }

      // Sync current & permanent address into addresses table so that
      // Student Details and Edit Student form stay consistent with the DB.
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
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update student'
    });
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

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasAcademicYearFilter = academicYearId != null && !Number.isNaN(academicYearId);

    const countWhere = hasAcademicYearFilter ? ' WHERE academic_year_id = $1' : '';
    const countParams = hasAcademicYearFilter ? [academicYearId] : [];
    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM students${countWhere}`,
      countParams
    );
    const total = countResult.rows[0].total;

    const whereClause = hasAcademicYearFilter ? ' WHERE s.academic_year_id = $1' : '';
    const orderLimitOffset = hasAcademicYearFilter
      ? ' ORDER BY s.first_name ASC, s.last_name ASC LIMIT $2 OFFSET $3'
      : ' ORDER BY s.first_name ASC, s.last_name ASC LIMIT $1 OFFSET $2';
    const selectParams = hasAcademicYearFilter
      ? [academicYearId, limit, offset]
      : [limit, offset];

    const result = await query(`
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
        s.parent_id,
        s.guardian_id,
        s.is_active,
        s.created_at,
        c.class_name,
        sec.section_name,
        p.father_name,
        p.father_email,
        p.father_phone,
        p.father_occupation,
        p.mother_name,
        p.mother_email,
        p.mother_phone,
        p.mother_occupation,
        g.first_name as guardian_first_name,
        g.last_name as guardian_last_name,
        g.phone as guardian_phone,
        g.email as guardian_email,
        g.occupation as guardian_occupation,
        g.relation as guardian_relation,
        COALESCE(s.current_address, addr.current_address, s.address) as current_address,
        COALESCE(s.permanent_address, addr.permanent_address) as permanent_address
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN guardians g ON s.guardian_id = g.id
      LEFT JOIN LATERAL (
        SELECT current_address, permanent_address 
        FROM addresses 
        WHERE user_id = s.user_id 
        ORDER BY id DESC 
        LIMIT 1
      ) addr ON true
      ${whereClause}
      ${orderLimitOffset}
    `, selectParams);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Students fetched successfully',
      data: result.rows,
      count: result.rows.length,
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
      `SELECT t.id 
       FROM teachers t 
       INNER JOIN staff st ON t.staff_id = st.id 
       WHERE st.user_id = $1 AND st.is_active = true`,
      [userId]
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied. User is not an active teacher.' });
    }
    const teacherId = teacherCheck.rows[0].id;

    const academicYearClause = hasAcademicYearFilter ? ' AND s.academic_year_id = $2' : '';
    const params = hasAcademicYearFilter ? [teacherId, academicYearId] : [teacherId];
    // Get the students
    const result = await query(
      `SELECT
        s.id, s.admission_number, s.roll_number, s.first_name, s.last_name, s.gender,
        s.date_of_birth, s.phone, s.email, s.class_id, s.section_id, s.photo_url,
        c.class_name, sec.section_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE s.is_active = true AND (
         EXISTS (
           SELECT 1 FROM class_schedules cs
           WHERE cs.teacher_id = $1
             AND cs.class_id = s.class_id
             AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
         )
         OR EXISTS (
           SELECT 1 FROM teachers t
            WHERE t.id = $1 AND t.class_id = s.class_id
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
      s.photo_url, s.is_transport_required, s.route_id, s.pickup_point_id,
      s.is_hostel_required, s.hostel_id, s.hostel_room_id, s.parent_id, s.guardian_id, s.is_active, s.created_at,
      s.sibiling_1, s.sibiling_2, s.sibiling_1_class, s.sibiling_2_class,
      s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,
      c.class_name, sec.section_name,
      bg.blood_group as blood_group_name,
      cast_t.cast_name,
      mt.language_name as mother_tongue_name,
      p.father_name, p.father_email, p.father_phone, p.father_occupation,
      p.mother_name, p.mother_email, p.mother_phone, p.mother_occupation,
      g.first_name as guardian_first_name, g.last_name as guardian_last_name,
      g.phone as guardian_phone, g.email as guardian_email, g.occupation as guardian_occupation, g.relation as guardian_relation, g.address as guardian_address,
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
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN guardians g ON s.guardian_id = g.id
      LEFT JOIN LATERAL (
        SELECT current_address, permanent_address 
        FROM addresses 
        WHERE user_id = s.user_id 
        ORDER BY id DESC 
        LIMIT 1
      ) addr ON true`;
    const whereClause = ` WHERE s.id = $1`;

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
      const isMissingColsError = e.message && (e.message.includes('unique_student_ids') || e.message.includes('pen_number') || e.message.includes('aadhar_no') || e.message.includes('aadhaar_no'));
      const isGrColError = e.message && e.message.includes('gr_number');

      if (isReligionError || isMissingColsError || isGrColError) {
        let safeBaseSelect = baseSelect;
        if (isGrColError) {
          safeBaseSelect = safeBaseSelect.replace('s.roll_number, s.gr_number,', 's.roll_number,');
        }
        if (isMissingColsError) {
          safeBaseSelect = safeBaseSelect.replace('s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,', '');
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
         s.parent_id,
         s.user_id,
         c.class_name,
         sec.section_name,
         u.username    AS student_username,
         u.phone       AS student_phone,
         u.email       AS student_email
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       LEFT JOIN users u ON s.user_id = u.id AND u.is_active = true
       WHERE s.id = $1 AND s.is_active = true
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
    if (stu.parent_id) {
      const loadParentsByContact = async (p) => {
        const emails = [p.father_email, p.mother_email]
          .filter((e) => e && e.toString().trim() !== '')
          .map((e) => e.toString().trim().toLowerCase());
        const phones = [p.father_phone, p.mother_phone]
          .filter((ph) => ph && ph.toString().trim() !== '')
          .map((ph) => ph.toString().trim());
        const uEmails = Array.from(new Set(emails));
        const uPhones = Array.from(new Set(phones));
        if (uEmails.length === 0 && uPhones.length === 0) return [];
        const parRes = await query(
          `SELECT id, username, email, phone
           FROM users
           WHERE is_active = true
             AND role_id = $1
             AND (
               (COALESCE(LOWER(TRIM(email)), '') <> '' AND LOWER(TRIM(email)) = ANY($2))
               OR (COALESCE(TRIM(phone), '') <> '' AND TRIM(phone) = ANY($3))
             )`,
          [ROLES.PARENT, uEmails, uPhones]
        );
        return parRes.rows;
      };

      try {
        const pRes = await query(
          `SELECT father_user_id, mother_user_id, user_id,
                  father_email, father_phone, mother_email, mother_phone
           FROM parents
           WHERE id = $1 OR student_id = $2
           LIMIT 1`,
          [stu.parent_id, id]
        );
        if (pRes.rows.length > 0) {
          const p = pRes.rows[0];
          const idSet = new Set();
          for (const uid of [p.father_user_id, p.mother_user_id, p.user_id]) {
            if (uid != null && uid !== '') idSet.add(parseInt(uid, 10));
          }
          if (idSet.size > 0) {
            const parRes = await query(
              `SELECT id, username, email, phone
               FROM users
               WHERE is_active = true AND role_id = $1 AND id = ANY($2::int[])`,
              [ROLES.PARENT, [...idSet]]
            );
            parentUsers = parRes.rows;
          }
          if (parentUsers.length === 0) {
            parentUsers = await loadParentsByContact(p);
          }
        }
      } catch (e) {
        try {
          const pRes = await query(
            `SELECT father_email, father_phone, mother_email, mother_phone
             FROM parents WHERE id = $1 OR student_id = $2 LIMIT 1`,
            [stu.parent_id, id]
          );
          if (pRes.rows.length > 0) {
            parentUsers = await loadParentsByContact(pRes.rows[0]);
          }
        } catch (_) {
          // ignore
        }
      }
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
      s.is_hostel_required, s.hostel_id, s.hostel_room_id, s.parent_id, s.guardian_id, s.is_active, s.created_at,
      s.sibiling_1, s.sibiling_2, s.sibiling_1_class, s.sibiling_2_class,
      s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,
      c.class_name, sec.section_name,
      bg.blood_group as blood_group_name,
      cast_t.cast_name,
      mt.language_name as mother_tongue_name,
      p.father_name, p.father_email, p.father_phone, p.father_occupation,
      p.mother_name, p.mother_email, p.mother_phone, p.mother_occupation,
      g.first_name as guardian_first_name, g.last_name as guardian_last_name,
      g.phone as guardian_phone, g.email as guardian_email, g.occupation as guardian_occupation, g.relation as guardian_relation, g.address as guardian_address,
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
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN guardians g ON s.guardian_id = g.id
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
      const isMissingColsError = e.message && (e.message.includes('unique_student_ids') || e.message.includes('pen_number') || e.message.includes('aadhar_no') || e.message.includes('aadhaar_no'));
      const isGrColError = e.message && e.message.includes('gr_number');

      if (isReligionError || isMissingColsError || isGrColError) {
        let safeBaseSelect = baseSelect;
        if (isGrColError) {
          safeBaseSelect = safeBaseSelect.replace('s.roll_number, s.gr_number,', 's.roll_number,');
        }
        if (isMissingColsError) {
          safeBaseSelect = safeBaseSelect.replace('s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,', '');
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
                   OR (LOWER(TRIM(COALESCE(p.father_email, ''))) = $2 AND $2 != '')
                   OR (LOWER(TRIM(COALESCE(p.mother_email, ''))) = $2 AND $2 != '')
                   OR (TRIM(COALESCE(p.father_phone, '')) = $3 AND $3 != '')
                   OR (TRIM(COALESCE(p.mother_phone, '')) = $3 AND $3 != '')
                 )
               LIMIT 1`,
              [userId, userEmail, userPhone]
            );
          } catch (fallbackErr) {
            const isMissingColsErrorFallback = fallbackErr.message && (fallbackErr.message.includes('unique_student_ids') || fallbackErr.message.includes('pen_number') || fallbackErr.message.includes('aadhar_no') || fallbackErr.message.includes('aadhaar_no'));
            const isReligErrorFallback = fallbackErr.message && (fallbackErr.message.includes('religion_id') || fallbackErr.message.includes('religions') || fallbackErr.message.includes('reigion'));
            const isGrColErrorFallback = fallbackErr.message && fallbackErr.message.includes('gr_number');

            if (isMissingColsErrorFallback || isReligErrorFallback || isGrColErrorFallback) {
              let safeBaseSelectFallback = baseSelect;
              if (isGrColErrorFallback) {
                safeBaseSelectFallback = safeBaseSelectFallback.replace('s.roll_number, s.gr_number,', 's.roll_number,');
              }
              if (isMissingColsErrorFallback) {
                safeBaseSelectFallback = safeBaseSelectFallback.replace('s.unique_student_ids, s.pen_number, s.aadhar_no as aadhaar_no,', '');
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
                     OR (LOWER(TRIM(COALESCE(p.father_email, ''))) = $2 AND $2 != '')
                     OR (LOWER(TRIM(COALESCE(p.mother_email, ''))) = $2 AND $2 != '')
                     OR (TRIM(COALESCE(p.father_phone, '')) = $3 AND $3 != '')
                     OR (TRIM(COALESCE(p.mother_phone, '')) = $3 AND $3 != '')
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
        s.parent_id,
        s.guardian_id,
        s.is_active,
        s.created_at,
        c.class_name,
        sec.section_name,
        p.father_name,
        p.father_email,
        p.father_phone,
        p.father_occupation,
        p.mother_name,
        p.mother_email,
        p.mother_phone,
        p.mother_occupation,
        g.first_name as guardian_first_name,
        g.last_name as guardian_last_name,
        g.phone as guardian_phone,
        g.email as guardian_email,
        g.occupation as guardian_occupation,
        g.relation as guardian_relation,
        COALESCE(s.current_address, addr.current_address, s.address) as current_address,
        COALESCE(s.permanent_address, addr.permanent_address) as permanent_address
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN guardians g ON s.guardian_id = g.id
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

    const records = result.rows.map((r) => {
      const status = normalizeStatus(r.status);
      return {
        id: r.id,
        studentId: r.student_id,
        classId: r.class_id,
        sectionId: r.section_id,
        attendanceDate: r.attendance_date,
        status,
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
    const studentId = parseId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }

    let rows = [];
    try {
      // Primary path: exam_results joined with exams and subjects, ordered by exam date / modified_at
      const result = await query(
        `SELECT 
           er.*,
           e.exam_name,
           e.exam_type,
           e.exam_date,
           e.total_marks AS exam_total_marks,
           e.passing_marks AS exam_passing_marks,
           s.subject_name
         FROM exam_results er
         LEFT JOIN exams e ON er.exam_id = e.id
         LEFT JOIN subjects s ON er.subject_id = s.id
         WHERE er.student_id = $1
         ORDER BY 
           COALESCE(e.exam_date, er.modified_at, er.created_at, NOW()) DESC,
           er.exam_id NULLS LAST,
           s.subject_name NULLS LAST`,
        [studentId]
      );
      rows = result.rows;
    } catch (primaryErr) {
      // Fallback: be tolerant to missing columns/tables – never break the app
      console.warn('Primary exam results query failed, falling back to simpler query:', primaryErr.message);
      try {
        const fallback = await query(
          `SELECT 
             er.*,
             e.exam_name,
             e.exam_type,
             e.total_marks AS exam_total_marks,
             e.passing_marks AS exam_passing_marks
           FROM exam_results er
           LEFT JOIN exams e ON er.exam_id = e.id
           WHERE er.student_id = $1
           ORDER BY COALESCE(er.modified_at, er.created_at, NOW()) DESC, er.exam_id NULLS LAST`,
          [studentId]
        );
        rows = fallback.rows;
      } catch (fallbackErr) {
        console.warn('Fallback exam results query failed, returning empty data:', fallbackErr.message);
        rows = [];
      }
    }

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'No exam results found for this student',
        data: { exams: [] },
      });
    }

    // Batch fetch subject names (JOIN may not resolve if subject_id is null or column name differs)
    let subjectMap = {};
    const subjectIds = [...new Set(rows.map((r) => r.subject_id ?? r.subject ?? r.subjectid).filter((id) => id != null && !Number.isNaN(Number(id))))];
    if (subjectIds.length > 0) {
      try {
        const subjRes = await query('SELECT id, subject_name FROM subjects WHERE id = ANY($1)', [subjectIds]);
        subjRes.rows.forEach((s) => {
          subjectMap[s.id] = s;
          subjectMap[Number(s.id)] = s;
          subjectMap[String(s.id)] = s;
        });
      } catch (e) {
        console.warn('Subject names lookup for exam results failed:', e.message);
      }
    }

    // Group results by exam (exam_id) and build a UI-friendly structure
    const examsMap = new Map();

    const normalizeResult = (val) => {
      const s = (val || '').toString().trim().toLowerCase();
      if (!s) return null;
      if (['pass', 'p', 'passed'].includes(s)) return 'Pass';
      if (['fail', 'f', 'failed'].includes(s)) return 'Fail';
      return val;
    };

    rows.forEach((r) => {
      const examId = r.exam_id || r.examid || r.exam || null;
      const key = examId != null ? String(examId) : `unknown-${r.id}`;
      const examTotalMarks = r.exam_total_marks != null ? Number(r.exam_total_marks) : null;
      const examPassingMarks = r.exam_passing_marks != null ? Number(r.exam_passing_marks) : null;

      if (!examsMap.has(key)) {
        const examName = r.exam_name || r.examname || r.name || 'Exam';
        const examType = r.exam_type || r.type || null;
        const examDate = r.exam_date || r.date || r.exam_date_time || null;
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
          examTotalMarks,
          examPassingMarks,
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
      const rawMax = r.max_marks ?? r.max_mark ?? r.total_marks ?? r.full_marks ?? r.total ?? null;
      const rawMin = r.min_marks ?? r.pass_marks ?? r.min_mark ?? r.min ?? null;
      const rawObtained = r.marks_obtained ?? r.obtained_marks ?? r.marks ?? r.marks_scored ?? r.score ?? null;

      let maxMarks = rawMax != null ? Number(rawMax) : null;
      let minMarks = rawMin != null ? Number(rawMin) : null;
      const obtained = rawObtained != null ? Number(rawObtained) : null;

      const rawResult = r.result || r.result_status || r.status || null;
      let result = normalizeResult(rawResult);

      if (!result) {
        if (maxMarks != null && maxMarks > 0 && obtained != null) {
          const threshold = minMarks != null && minMarks > 0 ? minMarks : Math.round(maxMarks * 0.35);
          result = obtained >= threshold ? 'Pass' : 'Fail';
        } else {
          result = null;
        }
      }

      const subjId = r.subject_id ?? r.subject ?? r.subjectid;
      const subj = subjId != null ? (subjectMap[subjId] ?? subjectMap[Number(subjId)] ?? subjectMap[String(subjId)]) : null;
      const subjectName = r.subject_name || (typeof r.subject === 'string' ? r.subject : null) || subj?.subject_name || null;

      exam.subjects.push({
        subjectId: subjId ?? null,
        subjectName: subjectName || 'Subject',
        maxMarks,
        minMarks,
        marksObtained: obtained,
        result,
      });
    });

    // Compute per-exam summary and fill per-subject max/min from exams table when missing
    examsMap.forEach((exam) => {
      const examTotalMarks = exam.examTotalMarks;
      const examPassingMarks = exam.examPassingMarks;
      const totalObtained = exam.subjects.reduce((sum, s) => sum + (Number(s.marksObtained) || 0), 0);

      let totalMax = examTotalMarks != null && examTotalMarks > 0 ? examTotalMarks : 0;
      let totalMin = examPassingMarks != null && examPassingMarks > 0 ? examPassingMarks : 0;

      if (totalMax === 0) {
        exam.subjects.forEach((s) => {
          if (s.maxMarks != null) totalMax += Number(s.maxMarks || 0);
        });
      }
      if (totalMin === 0) {
        exam.subjects.forEach((s) => {
          if (s.minMarks != null) totalMin += Number(s.minMarks || 0);
        });
      }

      const numSubjects = exam.subjects.length || 1;
      const perSubjectMax = examTotalMarks != null && examTotalMarks > 0 ? examTotalMarks / numSubjects : null;
      const perSubjectMin = examPassingMarks != null && examPassingMarks > 0 ? examPassingMarks / numSubjects : null;

      exam.subjects.forEach((s) => {
        if (s.maxMarks == null && perSubjectMax != null) {
          s.maxMarks = Math.round(perSubjectMax * 100) / 100;
        }
        if (s.minMarks == null && perSubjectMin != null) {
          s.minMarks = Math.round(perSubjectMin * 100) / 100;
        }
        if (s.result == null && s.maxMarks != null && s.maxMarks > 0 && s.marksObtained != null) {
          const threshold = s.minMarks != null && s.minMarks > 0 ? s.minMarks : Math.round(s.maxMarks * 0.35);
          s.result = s.marksObtained >= threshold ? 'Pass' : 'Fail';
        }
      });

      const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : null;
      const overallResult =
        totalMax > 0
          ? (totalObtained >= totalMin ? 'Pass' : 'Fail')
          : null;

      exam.summary = {
        totalMax,
        totalMin,
        totalObtained,
        percentage: percentage != null ? Number(percentage.toFixed(2)) : null,
        overallResult,
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

const getSummaryGrade = (percentage) => {
  const p = Number(percentage);
  if (!Number.isFinite(p)) return null;
  if (p >= 90) return 'O';
  if (p >= 80) return 'A+';
  if (p >= 70) return 'A';
  if (p >= 60) return 'B+';
  if (p >= 50) return 'B';
  if (p >= 35) return 'C';
  return 'F';
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

    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return res.status(access.status || 403).json({
        status: 'ERROR',
        message: access.message || 'Access denied',
      });
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
          grade: getSummaryGrade(percentage),
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

    if (!classId) {
      return res.status(400).json({ status: 'ERROR', message: 'class_id is required' });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ status: 'ERROR', message: 'month must be in YYYY-MM format' });
    }

    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return res.status(access.status || 403).json({
        status: 'ERROR',
        message: access.message || 'Access denied',
      });
    }

    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    if (Number.isNaN(monthStart.getTime())) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid month' });
    }
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

    const rosterWhere = ['s.class_id = $1', 's.is_active = true'];
    const rosterParams = [classId];

    if (sectionId) {
      rosterParams.push(sectionId);
      rosterWhere.push(`s.section_id = $${rosterParams.length}`);
    }
    if (academicYearId) {
      rosterParams.push(academicYearId);
      rosterWhere.push(`s.academic_year_id = $${rosterParams.length}`);
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

    const attendanceParams = [...rosterParams, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)];
    const attendanceRes = await query(
      `SELECT
         a.student_id,
         a.attendance_date,
         a.status
       FROM attendance a
       INNER JOIN students s ON s.id = a.student_id
       WHERE ${rosterWhere.join(' AND ')}
         AND a.attendance_date >= $${attendanceParams.length - 1}
         AND a.attendance_date < $${attendanceParams.length}
       ORDER BY a.attendance_date ASC`,
      attendanceParams
    );

    const days = [];
    const cursor = new Date(monthStart);
    while (cursor < monthEnd) {
      days.push({
        day: cursor.getUTCDate(),
        date: cursor.toISOString().slice(0, 10),
        weekdayShort: cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const attendanceByStudent = new Map();
    attendanceRes.rows.forEach((row) => {
      const studentKey = String(row.student_id);
      if (!attendanceByStudent.has(studentKey)) {
        attendanceByStudent.set(studentKey, {});
      }
      attendanceByStudent.get(studentKey)[String(row.attendance_date).slice(0, 10)] = normalizeAttendanceStatus(row.status);
    });

    const rows = rosterRes.rows.map((student) => {
      const daily = attendanceByStudent.get(String(student.id)) || {};
      const summary = {
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
        percentage: 0,
      };

      Object.values(daily).forEach((status) => {
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
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Attendance report not available',
      data: {
        month: null,
        days: [],
        rows: [],
      },
    });
  }
};

module.exports = {
  createStudent,
  updateStudent,
  promoteStudents,
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
};
