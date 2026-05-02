/**
 * Full test: Login -> Create Student (all fields) -> Verify DB storage
 * Run: node test-add-student-full.js
 * Prerequisites: Server running on port 5000
 */
const http = require('http');

const BASE = 'http://localhost:5000/api';

function req(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Add Student Full Test (API + DB) ===\n');

  // 1. Login - try Headmaster / phone as password
  const loginBody = { username: 'Headmaster', password: '9898989898' };
  console.log('1. Logging in...');
  const loginRes = await req('/auth/login', 'POST', loginBody);
  const tokenData = loginRes.data?.data?.token || loginRes.data?.token;
  if (loginRes.status !== 200 || !tokenData) {
    console.log('   Login failed. Status:', loginRes.status);
    console.log('   Response:', JSON.stringify(loginRes.data, null, 2));
    console.log('\n   Please ensure you can login at http://localhost:5173/login');
    console.log('   with Headmaster / 9898989898 (or your admin credentials).');
    console.log('   Then run: node test-add-student-full.js');
    process.exit(1);
  }
  const token = tokenData;
  console.log('   Login OK\n');

  // 2. Create student with ALL fields (2024-25, full details)
  const studentPayload = {
    academic_year_id: 1, // 2024-25
    admission_number: 'ADM' + Date.now().toString().slice(-6),
    admission_date: '2024-04-01',
    roll_number: 'R101',
    status: 'Active',
    first_name: 'Rahul',
    last_name: 'Sharma',
    class_id: 1,
    section_id: 1,
    gender: 'male',
    date_of_birth: '2015-05-15',
    blood_group_id: 1,
    house_id: 1,
    religion_id: 1,
    cast_id: 1,
    phone: '9876543210',
    email: 'rahul.test.' + Date.now() + '@example.com',
    mother_tongue_id: 1,
    current_address: '123 Test Street, Mumbai',
    permanent_address: '456 Home Lane, Pune',
    father_name: 'Rajesh Sharma',
    father_email: 'rajesh.sharma@example.com',
    father_phone: '9876543211',
    father_occupation: 'Engineer',
    mother_name: 'Priya Sharma',
    mother_email: 'priya.sharma@example.com',
    mother_phone: '9876543212',
    mother_occupation: 'Teacher',
    guardian_first_name: 'Ramesh',
    guardian_last_name: 'Sharma',
    guardian_relation: 'Uncle',
    guardian_phone: '9876543213',
    guardian_email: 'ramesh.guardian@example.com',
    guardian_occupation: 'Business',
    guardian_address: '100 Guardian Ave',
    previous_school: 'ABC Primary School',
    previous_school_address: 'Old School Road',
    sibiling_1: 'Riya',
    sibiling_2: 'Rohan',
    sibiling_1_class: 'Class 2',
    sibiling_2_class: 'Class 5',
    is_transport_required: false,
    is_hostel_required: false,
    bank_name: 'State Bank',
    branch: 'Mumbai Central',
    ifsc: 'SBIN0001234',
    known_allergies: ['Dust'],
    medications: ['None'],
    medical_condition: 'Good',
    other_information: 'Test student - full form verification',
    unique_student_ids: 'USID001',
    pen_number: 'PEN001',
    aadhaar_no: '9999' + Date.now().toString().slice(-8),
  };

  console.log('2. Creating student via API...');
  const createRes = await req('/students', 'POST', studentPayload, token);
  if (createRes.status !== 201) {
    console.log('   Create failed. Status:', createRes.status);
    console.log('   Response:', JSON.stringify(createRes.data, null, 2));
    process.exit(1);
  }
  const created = createRes.data?.data;
  const studentId = created?.id;
  if (!studentId) {
    console.log('   No student ID in response');
    process.exit(1);
  }
  console.log('   Student created. ID:', studentId, 'Admission:', created?.admission_number, '\n');

  // 3. Verify in DB
  console.log('3. Verifying DB storage...');
  const { query } = require('./src/config/database');
  const stud = await query(
    `SELECT s.*, p.father_name, p.mother_name, g.first_name as g_first, g.last_name as g_last
     FROM students s
     LEFT JOIN parents p ON s.parent_id = p.id
     LEFT JOIN guardians g ON s.guardian_id = g.id
     WHERE s.id = $1`,
    [studentId]
  );
  if (stud.rows.length === 0) {
    console.log('   ERROR: Student not found in DB');
    process.exit(1);
  }
  const row = stud.rows[0];
  const checks = [
    ['first_name', row.first_name, 'Rahul'],
    ['last_name', row.last_name, 'Sharma'],
    ['admission_number', row.admission_number, studentPayload.admission_number],
    ['class_id', row.class_id, 1],
    ['section_id', row.section_id, 1],
    ['gender', row.gender, 'Male'],
    ['academic_year_id', row.academic_year_id, 1],
    ['current_address', (row.current_address || row.address || '').substring(0, 20), '123 Test Street'],
    ['father_name', row.father_name, 'Rajesh Sharma'],
    ['mother_name', row.mother_name, 'Priya Sharma'],
    ['guardian first', (row.g_first || '') + ' ' + (row.g_last || ''), 'Ramesh Sharma'],
    ['bank_name', row.bank_name, 'State Bank'],
  ];
  let ok = true;
  for (const [label, got, expected] of checks) {
    const pass = String(got || '').includes(String(expected)) || got === expected;
    console.log('   ', pass ? '✓' : '✗', label + ':', got === expected ? 'OK' : `got=${got} expected~${expected}`);
    if (!pass) ok = false;
  }
  console.log('\n=== Test', ok ? 'PASSED' : 'COMPLETED (some checks failed)', '===');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
