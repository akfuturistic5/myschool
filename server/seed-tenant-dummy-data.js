/**
 * Seed dummy data for new tenant schools (millat_db, iqra_db).
 *
 * For each tenant DB this creates:
 * - 1 Headmaster (Admin role) user + staff record
 * - 2 Teacher users + staff records
 * - 2 Student users + student records
 * - 2 Parent users + parent records
 * - 2 Guardian users + guardian records
 *
 * All people have:
 * - Unique username, email, and phone within the DB
 * - Password = phone number (hashed with bcrypt)
 *
 * Run with:
 *   NODE_ENV=development node seed-tenant-dummy-data.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const tenants = [
  {
    dbName: 'millat_db',
    prefix: 'millat',
    phoneBase: 8000000000,
  },
  {
    dbName: 'iqra_db',
    prefix: 'iqra',
    phoneBase: 8100000000,
  },
];

function makeTenantPool(dbName) {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });
}

async function loadRoleIds(pool) {
  const res = await pool.query(
    `
    SELECT id, LOWER(role_name) AS role_name
    FROM user_roles
    WHERE LOWER(role_name) IN ('admin', 'teacher', 'student', 'parent', 'guardian')
    `
  );
  const map = {};
  for (const row of res.rows) {
    map[row.role_name] = row.id;
  }
  if (!map.admin || !map.teacher || !map.student || !map.parent || !map.guardian) {
    throw new Error('Required roles (Admin, Teacher, Student, Parent, Guardian) not found in user_roles');
  }
  return {
    Admin: map.admin,
    Teacher: map.teacher,
    Student: map.student,
    Parent: map.parent,
    Guardian: map.guardian,
  };
}

async function getCurrentAcademicYearId(pool) {
  const res = await pool.query(
    `
    SELECT id
    FROM academic_years
    WHERE is_current = true
    ORDER BY id
    LIMIT 1
    `
  );
  if (res.rows.length > 0) return res.rows[0].id;
  const fallback = await pool.query(
    `
    SELECT id
    FROM academic_years
    ORDER BY id
    LIMIT 1
    `
  );
  if (fallback.rows.length === 0) {
    throw new Error('No academic_years rows found to link students');
  }
  return fallback.rows[0].id;
}

async function insertUsers(pool, tenantConfig, roleIds) {
  const { prefix, phoneBase } = tenantConfig;

  const userSpecs = [
    // Headmaster (Admin)
    { key: 'headmaster', role: 'Admin', offset: 1, firstName: 'Head', lastName: 'Master' },
    // Teachers
    { key: 'teacher1', role: 'Teacher', offset: 2, firstName: 'Teacher', lastName: 'One' },
    { key: 'teacher2', role: 'Teacher', offset: 3, firstName: 'Teacher', lastName: 'Two' },
    // Students
    { key: 'student1', role: 'Student', offset: 11, firstName: 'Student', lastName: 'One' },
    { key: 'student2', role: 'Student', offset: 12, firstName: 'Student', lastName: 'Two' },
    // Parents
    { key: 'parent1', role: 'Parent', offset: 21, firstName: 'Parent', lastName: 'One' },
    { key: 'parent2', role: 'Parent', offset: 22, firstName: 'Parent', lastName: 'Two' },
    // Guardians
    { key: 'guardian1', role: 'Guardian', offset: 31, firstName: 'Guardian', lastName: 'One' },
    { key: 'guardian2', role: 'Guardian', offset: 32, firstName: 'Guardian', lastName: 'Two' },
  ];

  const results = {};

  for (const spec of userSpecs) {
    const username = `${prefix}_${spec.key}`;
    const email = `${username}@example.com`;
    const phone = String(phoneBase + spec.offset);
    const rawPassword = phone; // password = phone number
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const res = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, role_id, first_name, last_name, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id
      `,
      [username, email, passwordHash, roleIds[spec.role], spec.firstName, spec.lastName, phone]
    );

    results[spec.key] = {
      userId: res.rows[0].id,
      username,
      email,
      phone,
      rawPassword,
    };
  }

  return results;
}

async function insertStaff(pool, tenantConfig, users) {
  const { prefix } = tenantConfig;
  const staffSpecs = [
    { userKey: 'headmaster', employeeCode: `${prefix.toUpperCase()}-HM-001` },
    { userKey: 'teacher1', employeeCode: `${prefix.toUpperCase()}-T-001` },
    { userKey: 'teacher2', employeeCode: `${prefix.toUpperCase()}-T-002` },
  ];

  const staffIds = {};
  for (const spec of staffSpecs) {
    const u = users[spec.userKey];
    const nameSuffix = spec.userKey === 'headmaster' ? 'Headmaster' : 'Teacher';
    const firstName = nameSuffix;
    const lastName = prefix.charAt(0).toUpperCase() + prefix.slice(1);

    const res = await pool.query(
      `
      INSERT INTO staff (user_id, employee_code, first_name, last_name, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id
      `,
      [u.userId, spec.employeeCode, firstName, lastName]
    );
    staffIds[spec.userKey] = res.rows[0].id;
  }
  return staffIds;
}

async function insertStudents(pool, tenantConfig, users, academicYearId) {
  const { prefix } = tenantConfig;
  const studentSpecs = [
    {
      userKey: 'student1',
      admissionNumber: `${prefix.toUpperCase()}-A-001`,
      uniqueStudentId: '100000000001', // 12 chars
      penNumber: '200000000001',       // 12 chars
      aadharNo: '300000000001',        // 12 chars
    },
    {
      userKey: 'student2',
      admissionNumber: `${prefix.toUpperCase()}-A-002`,
      uniqueStudentId: '100000000002',
      penNumber: '200000000002',
      aadharNo: '300000000002',
    },
  ];

  const resClass = await pool.query('SELECT id, class_name FROM classes ORDER BY id LIMIT 1');
  const resSection = await pool.query('SELECT id, section_name FROM sections ORDER BY id LIMIT 1');

  const classId = resClass.rows[0]?.id || null;
  const sectionId = resSection.rows[0]?.id || null;

  const studentIds = {};
  for (const spec of studentSpecs) {
    const u = users[spec.userKey];
    const firstName = spec.userKey === 'student1' ? 'First' : 'Second';
    const lastName = 'Student';

    const res = await pool.query(
      `
      INSERT INTO students (
        user_id,
        admission_number,
        first_name,
        last_name,
        academic_year_id,
        class_id,
        section_id,
        unique_student_ids,
        pen_number,
        aadhar_no,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
      RETURNING id
      `,
      [
        u.userId,
        spec.admissionNumber,
        firstName,
        lastName,
        academicYearId,
        classId,
        sectionId,
        spec.uniqueStudentId,
        spec.penNumber,
        spec.aadharNo,
      ]
    );

    studentIds[spec.userKey] = res.rows[0].id;
  }

  return studentIds;
}

async function insertParents(pool, tenantConfig, users, studentIds) {
  const parentSpecs = [
    { userKey: 'parent1', studentKey: 'student1' },
    { userKey: 'parent2', studentKey: 'student2' },
  ];

  const parentIds = {};
  for (const spec of parentSpecs) {
    const u = users[spec.userKey];
    const studentId = studentIds[spec.studentKey];

    const res = await pool.query(
      `
      INSERT INTO parents (
        student_id,
        father_name,
        father_email,
        father_phone,
        user_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        studentId,
        'Father ' + spec.studentKey,
        u.email,
        u.phone,
        u.userId,
      ]
    );
    parentIds[spec.userKey] = res.rows[0].id;
  }

  return parentIds;
}

async function insertGuardians(pool, tenantConfig, users, studentIds) {
  const guardianSpecs = [
    { userKey: 'guardian1', studentKey: 'student1' },
    { userKey: 'guardian2', studentKey: 'student2' },
  ];

  const guardianIds = {};
  for (const spec of guardianSpecs) {
    const u = users[spec.userKey];
    const studentId = studentIds[spec.studentKey];

    const res = await pool.query(
      `
      INSERT INTO guardians (
        student_id,
        first_name,
        last_name,
        phone,
        email,
        is_primary_contact,
        is_emergency_contact,
        is_active,
        user_id
      )
      VALUES ($1,$2,$3,$4,$5,true,true,true,$6)
      RETURNING id
      `,
      [
        studentId,
        'Guardian',
        spec.studentKey === 'student1' ? 'One' : 'Two',
        u.phone,
        u.email,
        u.userId,
      ]
    );
    guardianIds[spec.userKey] = res.rows[0].id;
  }

  return guardianIds;
}

async function seedTenant(tenantConfig) {
  const pool = makeTenantPool(tenantConfig.dbName);
  console.log(`\n=== Seeding dummy data for tenant DB "${tenantConfig.dbName}" ===`);

  try {
    const roleIds = await loadRoleIds(pool);
    const academicYearId = await getCurrentAcademicYearId(pool);

    await pool.query('BEGIN');

    const users = await insertUsers(pool, tenantConfig, roleIds);
    const staff = await insertStaff(pool, tenantConfig, users);
    const students = await insertStudents(pool, tenantConfig, users, academicYearId);
    const parents = await insertParents(pool, tenantConfig, users, students);
    const guardians = await insertGuardians(pool, tenantConfig, users, students);

    await pool.query('COMMIT');

    console.log(`✅ Seeded tenant "${tenantConfig.dbName}" successfully.`);
    console.log('   Users created (username -> role):');
    Object.entries(users).forEach(([key, u]) => {
      console.log(`     - ${u.username}`);
    });
    return { users, staff, students, parents, guardians };
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(`❌ Failed to seed tenant "${tenantConfig.dbName}":`, err);
    throw err;
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    for (const tenant of tenants) {
      await seedTenant(tenant);
    }
    console.log('\n=== Tenant dummy data seeding complete ===');
  } catch {
    process.exitCode = 1;
  }
}

main();

