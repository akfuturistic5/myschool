const { executeTransaction } = require('./src/config/database');
const { createStudentUser, createParentUser, createGuardianUser } = require('./src/utils/createPersonUser');

async function run() {
  const admission_number = 'ADM' + Date.now();
  const aadhaar = '8888' + Date.now().toString().slice(-8);
  try {
    await executeTransaction(async (client) => {
      console.log('1. Insert student...');
      const email = 'test.' + admission_number + '@example.com';
      const r = await client.query(`
        INSERT INTO students (academic_year_id, admission_number, first_name, last_name, gender,
          phone, email, unique_student_ids, pen_number, aadhar_no, is_active, created_at, modified_at)
        VALUES (1, $1, 'Test', 'Student', 'male', '9999999999', $2, 'US1', 'P1', $3, true, NOW(), NOW())
        RETURNING id
      `, [admission_number, email, aadhaar]);
      const studentId = r.rows[0].id;
      console.log('   Student id:', studentId);

      console.log('2. Create student user...');
      const userId = await createStudentUser(client, {
        admission_number,
        first_name: 'Test',
        last_name: 'Student',
        phone: '9999999999',
        email: 'test' + admission_number + '@example.com'
      });
      console.log('   User id:', userId);
      if (userId) {
        await client.query('UPDATE students SET user_id = $1 WHERE id = $2', [userId, studentId]);
      }
      console.log('3. Done');
    });
    console.log('SUCCESS');
  } catch (e) {
    console.error('FAILED:', e.message);
    console.error('Code:', e.code, 'Constraint:', e.constraint, 'Detail:', e.detail);
  }
  process.exit(0);
}
run();
