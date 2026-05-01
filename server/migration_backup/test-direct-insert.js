/**
 * Direct DB insert to test student creation - bypasses API
 */
const { query, executeTransaction } = require('./src/config/database');

async function run() {
  const admission_number = 'ADM' + Date.now().toString().slice(-6);
  try {
    await executeTransaction(async (client) => {
      const r = await client.query(`
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
          unique_student_ids, pen_number, aadhar_no,
          created_at, modified_at
        ) VALUES (
          1, $1, '2024-04-01', 'R101',
          'Rahul', 'Sharma', 1, 1, 'male', '2015-05-15',
          1, 1, 1, 1, '9876543210', 'rahul@test.com',
          1, true,
          '123 Test St', '123 Test St', '456 Home Ln',
          'ABC Primary', 'Old School Rd',
          'Riya', 'Rohan', 'Class 2', 'Class 5',
          false, null, null, null,
          false, null, null,
          'State Bank', 'Mumbai', 'SBIN0001234',
          'Dust', 'None', 'Good', 'Test',
          'USID001', 'PEN001', '123456789012',
          NOW(), NOW()
        )
        RETURNING id, admission_number, first_name
      `, [admission_number]);
      const studentId = r.rows[0].id;
      console.log('Student inserted:', r.rows[0]);

      // Parents
      await client.query(`
        INSERT INTO parents (student_id, father_name, father_email, father_phone, father_occupation,
          mother_name, mother_email, mother_phone, mother_occupation, created_at, updated_at)
        VALUES ($1, 'Rajesh Sharma', 'rajesh@ex.com', '9876543211', 'Engineer',
          'Priya Sharma', 'priya@ex.com', '9876543212', 'Teacher', NOW(), NOW())
        RETURNING id
      `, [studentId]);

      const pRes = await client.query('SELECT id FROM parents WHERE student_id = $1 ORDER BY id DESC LIMIT 1', [studentId]);
      const parentId = pRes.rows[0]?.id;

      await client.query('UPDATE students SET parent_id = $1 WHERE id = $2', [parentId, studentId]);

      // Guardians
      await client.query(`
        INSERT INTO guardians (student_id, first_name, last_name, relation, occupation, phone, email, address, is_active, created_at, modified_at)
        VALUES ($1, 'Ramesh', 'Sharma', 'Uncle', 'Business', '9876543213', 'ramesh@ex.com', '100 Guardian Ave', true, NOW(), NOW())
        RETURNING id
      `, [studentId]);

      const gRes = await client.query('SELECT id FROM guardians WHERE student_id = $1 ORDER BY id DESC LIMIT 1', [studentId]);
      await client.query('UPDATE students SET guardian_id = $1 WHERE id = $2', [gRes.rows[0]?.id, studentId]);

      console.log('Parents and guardians linked. Student ID:', studentId);
    });
    console.log('Direct insert SUCCESS');
  } catch (e) {
    console.error('Direct insert FAILED:', e.message);
  }
  process.exit(0);
}
run();
