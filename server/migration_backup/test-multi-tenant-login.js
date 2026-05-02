/**
 * Quick multi-tenant smoke tests:
 * - Login with institute 1111 (existing school_db headmaster)
 * - Login with institute 2222 (millat_db headmaster)
 * - Login with institute 3333 (iqra_db headmaster)
 *
 * For each login:
 * - Assert SUCCESS response
 * - Call /auth/me with returned token
 * - Call /students and log count
 */

require('dotenv').config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

async function login(instituteNumber, username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ instituteNumber, username, password }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from login (${res.status}): ${text}`);
  }
  return { statusCode: res.status, body: data };
}

async function getMe(token) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from /auth/me (${res.status}): ${text}`);
  }
  return { statusCode: res.status, body: data };
}

async function getStudents(token) {
  const res = await fetch(`${BASE_URL}/students`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from /students (${res.status}): ${text}`);
  }
  return { statusCode: res.status, body: data };
}

async function runScenario(label, { instituteNumber, username, password }) {
  console.log(`\n=== Scenario: ${label} (institute ${instituteNumber}) ===`);
  const loginRes = await login(instituteNumber, username, password);
  console.log('Login HTTP status:', loginRes.statusCode);
  console.log('Login body status:', loginRes.body.status);
  if (loginRes.statusCode !== 200 || loginRes.body.status !== 'SUCCESS') {
    console.error('Login failed response:', JSON.stringify(loginRes.body, null, 2));
    throw new Error(`Login failed for ${label}`);
  }
  const token = loginRes.body.data?.token || loginRes.body.token;
  if (!token) throw new Error(`No token returned for ${label}`);

  const meRes = await getMe(token);
  console.log('/auth/me HTTP status:', meRes.statusCode);
  if (meRes.statusCode !== 200 || meRes.body.status !== 'SUCCESS') {
    console.error('/auth/me failed:', JSON.stringify(meRes.body, null, 2));
    throw new Error(`/auth/me failed for ${label}`);
  }
  const user = meRes.body.data || meRes.body.user || {};
  console.log('User id:', user.id, 'username:', user.username);
  console.log('School (from token):', user.school_name || '(unknown)');

  const studentsRes = await getStudents(token);
  console.log('/students HTTP status:', studentsRes.statusCode);
  if (studentsRes.statusCode === 200 && studentsRes.body && Array.isArray(studentsRes.body.data)) {
    console.log('Students count:', studentsRes.body.data.length);
  } else {
    console.log('Students response summary:', JSON.stringify(studentsRes.body).slice(0, 200));
  }
}

async function main() {
  try {
    await runScenario('Existing School (school_db)', {
      instituteNumber: '1111',
      username: 'Headmaster',
      password: '9898989898',
    });

    await runScenario('Millat (millat_db)', {
      instituteNumber: '2222',
      username: 'millat_headmaster',
      password: '8000000001',
    });

    await runScenario('Iqra (iqra_db)', {
      instituteNumber: '3333',
      username: 'iqra_headmaster',
      password: '8100000001',
    });

    console.log('\n=== Multi-tenant login smoke tests completed successfully ===');
  } catch (err) {
    console.error('\n❌ Multi-tenant login smoke tests failed:', err);
    process.exitCode = 1;
  }
}

main();

