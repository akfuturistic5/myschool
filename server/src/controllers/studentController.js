const { query, executeTransaction } = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const { ROLES } = require('../config/roles');
const { getParentsForUser } = require('../utils/parentUserMatch');

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

    const student = await executeTransaction(async (client) => {
      const existingStudent = await client.query(
        'SELECT id FROM students WHERE admission_number = $1 AND is_active = true',
        [admission_number]
      );

      if (existingStudent.rows.length > 0) {
        const err = new Error('Student with this admission number already exists');
        err.statusCode = 400;
        throw err;
      }

      let result;
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
            created_at, modified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, NOW(), NOW())
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null, gender || null,
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
          medical_condition || null, other_information || null
        ]);
      } catch (e) {
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
            created_at, modified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, NOW(), NOW())
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null, gender || null,
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
          medical_condition || null, other_information || null
        ]);
      }

      const studentRow = result.rows[0];

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
      }

      if (hasGuardianInfo) {
        const guardianResult = await client.query(`
          INSERT INTO guardians (
            student_id, first_name, last_name, relation, occupation, phone, email, address,
            is_active, created_at, modified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
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

      return studentRow;
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Student created successfully',
      data: student
    });
  } catch (error) {
    console.error('Error creating student:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: process.env.NODE_ENV === 'production' ? 'Invalid request' : error.message });
    }
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create student'
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

    const student = await executeTransaction(async (client) => {
      const existingStudent = await client.query(
        'SELECT id FROM students WHERE admission_number = $1 AND id != $2 AND is_active = true',
        [admission_number, id]
      );

      if (existingStudent.rows.length > 0) {
        const err = new Error('Student with this admission number already exists');
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
            modified_at = NOW()
          WHERE id = $40
          RETURNING *
        `, [
          academic_year_id || null, admission_number, admission_date || null, roll_number || null,
          first_name, last_name, class_id || null, section_id || null, gender || null,
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
          id
        ]);
      } catch (e) {
        // Fallback path: handle legacy schemas that use "reigion_id" instead of "religion_id"
        if (e.message && (e.message.includes('religion_id') || e.message.includes('reigion'))) {
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
              modified_at = NOW()
            WHERE id = $40
            RETURNING *
          `, [
            academic_year_id || null, admission_number, admission_date || null, roll_number || null,
            first_name, last_name, class_id || null, section_id || null, gender || null,
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
              student_id, first_name, last_name, relation, occupation, phone, email, address,
              is_active, created_at, modified_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
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

      return studentRow;
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student updated successfully',
      data: student
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

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const countResult = await query(
      'SELECT COUNT(*)::int as total FROM students'
    );
    const total = countResult.rows[0].total;

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
      LEFT JOIN addresses addr ON s.user_id = addr.user_id
      ORDER BY s.first_name ASC, s.last_name ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
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

// Get student by ID (with blood_group, religion, cast, mother_tongue names from lookup tables)
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const baseSelect = `
      s.id, s.admission_number, s.roll_number, s.first_name, s.last_name,
      s.gender, s.date_of_birth, s.place_of_birth, s.blood_group_id, s.cast_id, s.mother_tongue_id,
      s.nationality, COALESCE(NULLIF(TRIM(s.phone), ''), u.phone) AS phone, COALESCE(NULLIF(TRIM(s.email), ''), u.email) AS email, s.address, s.user_id, s.academic_year_id,
      s.class_id, s.section_id, s.house_id, s.admission_date, s.previous_school,
      s.photo_url, s.is_transport_required, s.route_id, s.pickup_point_id,
      s.is_hostel_required, s.hostel_id, s.hostel_room_id, s.parent_id, s.guardian_id, s.is_active, s.created_at,
      s.sibiling_1, s.sibiling_2, s.sibiling_1_class, s.sibiling_2_class,
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
      LEFT JOIN addresses addr ON s.user_id = addr.user_id`;
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
      `, [id]);
    } catch (e) {
      if (e.message && (e.message.includes('religion_id') || e.message.includes('religions') || e.message.includes('reigion'))) {
        result = await query(`
          SELECT ${baseSelect},
            s.reigion_id as religion_id,
            re.reigion_name as religion_name
          ${fromAndJoins}
          LEFT JOIN reigions re ON s.reigion_id = re.id
          ${whereClause}
        `, [id]);
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
    const studentId = parseInt(id, 10);

    // Ownership check: non-Admin/Teacher can only view own/children/wards
    const userId = req.user?.id;
    const roleId = req.user?.role_id != null ? parseInt(req.user.role_id, 10) : null;
    if (roleId !== ROLES.ADMIN && roleId !== ROLES.TEACHER) {
      if (roleId === ROLES.STUDENT) {
        const studentUserId = studentData.user_id ? parseInt(studentData.user_id, 10) : null;
        if (!userId || parseInt(userId, 10) !== studentUserId) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else if (roleId === ROLES.PARENT) {
        const { studentIds } = await getParentsForUser(userId).catch(() => ({ studentIds: [] }));
        if (!studentIds || !studentIds.includes(studentId)) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else if (roleId === ROLES.GUARDIAN) {
        const gCheck = await query(
          `SELECT 1 FROM guardians g
           INNER JOIN users u ON (LOWER(TRIM(g.email)) = LOWER(TRIM(u.email)) OR (g.phone = u.phone AND g.phone != ''))
           WHERE u.id = $1 AND g.student_id = $2`,
          [userId, studentId]
        );
        if (gCheck.rows.length === 0) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else {
        return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
      }
    }
    try {
      const extra = await query(
        'SELECT bank_name, branch, ifsc, known_allergies, medications, previous_school_address, medical_condition, other_information, vehicle_number FROM students WHERE id = $1',
        [id]
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
        `, [id]);
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
      } catch (e) {}
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
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

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

    // Authorization / ownership check
    const userId = req.user?.id;
    const roleId = req.user?.role_id != null ? parseInt(req.user.role_id, 10) : null;
    const roleName = (req.user?.role_name || '').toString().trim().toLowerCase();
    const isAdmin = roleId === ROLES.ADMIN || roleName === 'admin';
    const isStudent = roleId === ROLES.STUDENT || roleName === 'student';
    const isParent = roleId === ROLES.PARENT || roleName === 'parent';
    const isGuardian = roleId === ROLES.GUARDIAN || roleName === 'guardian';

    if (!isAdmin) {
      if (!userId) {
        return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
      }

      if (isStudent) {
        const studentUserId = stu.user_id ? parseInt(stu.user_id, 10) : null;
        if (!studentUserId || parseInt(userId, 10) !== studentUserId) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else if (isParent) {
        const { studentIds } = await getParentsForUser(userId).catch(() => ({ studentIds: [] }));
        if (!studentIds || !studentIds.includes(id)) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else if (isGuardian) {
        const gCheck = await query(
          `SELECT 1
           FROM guardians g
           INNER JOIN users u
             ON (LOWER(TRIM(g.email)) = LOWER(TRIM(u.email))
                 OR (g.phone = u.phone AND g.phone != ''))
           WHERE u.id = $1 AND g.student_id = $2`,
          [userId, id]
        );
        if (gCheck.rows.length === 0) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else {
        // Other roles (e.g. teacher) are not allowed by default
        return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
      }
    }

    // Collect parent contact info for matching parent user accounts
    const parentContacts = {
      emails: [],
      phones: [],
    };

    if (stu.parent_id) {
      try {
        const pRes = await query(
          `SELECT
             father_email,
             father_phone,
             mother_email,
             mother_phone
           FROM parents
           WHERE id = $1 OR student_id = $2
           LIMIT 1`,
          [stu.parent_id, id]
        );
        if (pRes.rows.length > 0) {
          const p = pRes.rows[0];
          const emails = [
            p.father_email,
            p.mother_email,
          ].filter((e) => e && e.toString().trim() !== '');
          const phones = [
            p.father_phone,
            p.mother_phone,
          ].filter((ph) => ph && ph.toString().trim() !== '');
          parentContacts.emails = Array.from(new Set(emails.map((e) => e.toString().trim().toLowerCase())));
          parentContacts.phones = Array.from(new Set(phones.map((ph) => ph.toString().trim())));
        }
      } catch (e) {
        // If parents table lookup fails, we still return student user if available.
      }
    }

    let parentUsers = [];
    if (parentContacts.emails.length > 0 || parentContacts.phones.length > 0) {
      try {
        const parRes = await query(
          `SELECT id, username, email, phone
           FROM users
           WHERE is_active = true
             AND role_id = $1
             AND (
               (COALESCE(LOWER(TRIM(email)), '') <> '' AND LOWER(TRIM(email)) = ANY($2))
               OR (COALESCE(TRIM(phone), '') <> '' AND TRIM(phone) = ANY($3))
             )`,
          [ROLES.PARENT, parentContacts.emails, parentContacts.phones]
        );
        parentUsers = parRes.rows;
      } catch (e) {
        // If parent users lookup fails, we still return student user if available.
      }
    }

    // If requester is a Parent, show only their own account (not all matched parents)
    if (parentUsers.length > 0) {
      if (isParent && userId) {
        parentUsers = parentUsers.filter((u) => {
          try {
            return parseInt(u.id, 10) === parseInt(userId, 10);
          } catch {
            return false;
          }
        });
      } else {
        // For Admin/Student/Guardian: de-duplicate by contact (email/phone) so that
        // shared phone/email across multiple accounts does not show multiple rows.
        const seen = new Set();
        const deduped = [];
        for (const u of parentUsers) {
          const emailKey = (u.email || '').toString().trim().toLowerCase();
          const phoneKey = (u.phone || '').toString().trim();
          const key = emailKey || phoneKey;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          deduped.push(u);
        }
        parentUsers = deduped;
      }
      // For non-parent roles (Student/Admin/Guardian), show at most one parent account
      if (!isParent && parentUsers.length > 1) {
        parentUsers = [parentUsers[0]];
      }
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
      s.id, s.admission_number, s.roll_number, s.first_name, s.last_name,
      s.gender, s.date_of_birth, s.place_of_birth, s.blood_group_id, s.cast_id, s.mother_tongue_id,
      s.nationality, COALESCE(NULLIF(TRIM(s.phone), ''), u.phone) AS phone, COALESCE(NULLIF(TRIM(s.email), ''), u.email) AS email, s.address, s.user_id, s.academic_year_id,
      s.class_id, s.section_id, s.house_id, s.admission_date, s.previous_school,
      s.photo_url, s.is_transport_required, s.route_id, s.pickup_point_id,
      s.is_hostel_required, s.hostel_id, s.hostel_room_id, s.parent_id, s.guardian_id, s.is_active, s.created_at,
      s.sibiling_1, s.sibiling_2, s.sibiling_1_class, s.sibiling_2_class,
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
      LEFT JOIN addresses addr ON s.user_id = addr.user_id`;
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
      if (e.message && (e.message.includes('religion_id') || e.message.includes('religions') || e.message.includes('reigion'))) {
        result = await query(`
          SELECT ${baseSelect},
            s.reigion_id as religion_id,
            re.reigion_name as religion_name
          ${fromAndJoins}
          LEFT JOIN reigions re ON s.reigion_id = re.id
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
      } catch (e) {}
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
    } catch (e) {}
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
      LEFT JOIN addresses addr ON s.user_id = addr.user_id
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
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || Number.isNaN(studentId)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    // Ownership check: non-Admin/Teacher can only access own/children/wards
    const userId = req.user?.id;
    const roleId = req.user?.role_id != null ? parseInt(req.user.role_id, 10) : null;
    if (roleId !== ROLES.ADMIN && roleId !== ROLES.TEACHER) {
      const studRow = await query('SELECT user_id, guardian_id FROM students WHERE id = $1', [studentId]);
      if (studRow.rows.length === 0) {
        return res.status(404).json({ status: 'ERROR', message: 'Student not found' });
      }
      const studentUserId = studRow.rows[0].user_id ? parseInt(studRow.rows[0].user_id, 10) : null;
      if (roleId === ROLES.STUDENT) {
        if (!userId || parseInt(userId, 10) !== studentUserId) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else if (roleId === ROLES.PARENT) {
        const { studentIds } = await getParentsForUser(userId).catch(() => ({ studentIds: [] }));
        if (!studentIds || !studentIds.includes(studentId)) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else if (roleId === ROLES.GUARDIAN) {
        const gCheck = await query(
          `SELECT 1 FROM guardians g
           INNER JOIN users u ON (LOWER(TRIM(g.email)) = LOWER(TRIM(u.email)) OR (g.phone = u.phone AND g.phone != ''))
           WHERE u.id = $1 AND g.student_id = $2`,
          [userId, studentId]
        );
        if (gCheck.rows.length === 0) {
          return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }
      } else {
        return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
      }
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

module.exports = {
  createStudent,
  updateStudent,
  getAllStudents,
  getStudentById,
  getStudentLoginDetails,
  getCurrentStudent,
  getStudentsByClass,
  getStudentAttendance,
};
