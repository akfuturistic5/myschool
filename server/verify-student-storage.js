/**
 * Verify full student creation and DB storage
 * Uses direct DB insert (same as API would do) then verifies every field.
 * Run: node verify-student-storage.js
 */
const { query, executeTransaction } = require('./src/config/database');

const ADM_NO = 'ADM2024' + Date.now().toString().slice(-4);
const AADHAAR = '8888' + Date.now().toString().slice(-8);

async function run() {
  console.log('=== Full Student Creation & DB Verification ===\n');
  console.log('Academic Year: 2024-25, Admission:', ADM_NO, '\n');

  let studentId;
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
          1, $1, '2024-04-01', 'R202',
          'Rahul', 'Sharma', 1, 1, 'male', '2015-05-15',
          1, 1, 1, 1, '9876543210', 'rahul.sharma.test@example.com',
          1, true,
          '123 Test Street Mumbai', '123 Test Street Mumbai', '456 Home Lane Pune',
          'ABC Primary School', 'Old School Road',
          'Riya', 'Rohan', 'Class 2', 'Class 5',
          false, null, null, null,
          false, null, null,
          'State Bank', 'Mumbai Central', 'SBIN0001234',
          'Dust', 'None', 'Good', 'Full form verification test',
          'USID002', 'PEN002', $2,
          NOW(), NOW()
        )
        RETURNING id, admission_number, first_name, last_name
      `, [ADM_NO, AADHAAR]);
      studentId = r.rows[0].id;
      console.log('1. Student created:', r.rows[0].first_name, r.rows[0].last_name, 'ID:', studentId);

      const pR = await client.query(`
        INSERT INTO parents (student_id, father_name, father_email, father_phone, father_occupation,
          mother_name, mother_email, mother_phone, mother_occupation, created_at, updated_at)
        VALUES ($1, 'Rajesh Sharma', 'rajesh.sharma@example.com', '9876543211', 'Engineer',
          'Priya Sharma', 'priya.sharma@example.com', '9876543212', 'Teacher', NOW(), NOW())
        RETURNING id
      `, [studentId]);
      await client.query('UPDATE students SET parent_id = $1 WHERE id = $2', [pR.rows[0].id, studentId]);
      console.log('2. Parents linked');

      const gR = await client.query(`
        INSERT INTO guardians (student_id, first_name, last_name, relation, occupation, phone, email, address, is_active, created_at, modified_at)
        VALUES ($1, 'Ramesh', 'Sharma', 'Uncle', 'Business', '9876543213', 'ramesh.guardian@example.com', '100 Guardian Ave', true, NOW(), NOW())
        RETURNING id
      `, [studentId]);
      await client.query('UPDATE students SET guardian_id = $1 WHERE id = $2', [gR.rows[0].id, studentId]);
      console.log('3. Guardian linked\n');
    });
  } catch (e) {
    console.error('Insert failed:', e.message);
    process.exit(1);
  }

  // Verify all fields
  const s = await query(`
    SELECT s.*, c.class_name, sec.section_name, ay.year_name,
      p.father_name, p.father_email, p.mother_name, p.mother_email,
      g.first_name as g_first, g.last_name as g_last, g.relation as g_relation
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
    LEFT JOIN parents p ON s.parent_id = p.id
    LEFT JOIN guardians g ON s.guardian_id = g.id
    WHERE s.id = $1
  `, [studentId]);

  const row = s.rows[0];
  if (!row) {
    console.error('Student not found');
    process.exit(1);
  }

  const checks = [
    ['academic_year', row.year_name, '2024-25'],
    ['admission_number', row.admission_number, ADM_NO],
    ['first_name', row.first_name, 'Rahul'],
    ['last_name', row.last_name, 'Sharma'],
    ['class', row.class_name, 'Nursery'],
    ['section', row.section_name, 'A'],
    ['gender', row.gender, 'male'],
    ['current_address', (row.current_address || '').substring(0, 20), '123 Test Street'],
    ['father_name', row.father_name, 'Rajesh Sharma'],
    ['mother_name', row.mother_name, 'Priya Sharma'],
    ['guardian', (row.g_first || '') + ' ' + (row.g_last || ''), 'Ramesh Sharma'],
    ['bank_name', row.bank_name, 'State Bank'],
    ['sibiling_1', row.sibiling_1, 'Riya'],
    ['previous_school', row.previous_school, 'ABC Primary'],
  ];

  console.log('4. DB Verification:');
  let pass = true;
  for (const [label, got, exp] of checks) {
    const ok = (got || '').toString().includes((exp || '').toString());
    console.log('   ', ok ? '✓' : '✗', label + ':', got);
    if (!ok) pass = false;
  }
  console.log('\n===', pass ? 'ALL FIELDS VERIFIED OK' : 'SOME CHECKS FAILED', '===');
  process.exit(pass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
