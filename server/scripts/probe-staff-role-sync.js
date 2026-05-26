require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const {
  getDesignationKey,
  designationLoginKind,
  applyStaffLoginRoleSync,
} = require('../src/utils/staffLoginRoleSync');

const pool = new Pool({
  host: process.env.DB_SCHOOL_HOST || 'localhost',
  port: parseInt(process.env.DB_SCHOOL_PORT || '5432', 10),
  user: process.env.DB_SCHOOL_USER || 'postgres',
  password: process.env.DB_SCHOOL_PASS || '',
  database: process.env.DB_SCHOOL_NAME || 'sxis_school_db',
});

async function main() {
  const client = await pool.connect();
  try {
    const mismatches = await client.query(`
      SELECT u.id AS user_id, u.email, u.role_id, ur.role_name,
             s.id AS staff_id, s.designation_id, des.designation_name, dep.department_name
      FROM staff s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN user_roles ur ON ur.id = u.role_id
      LEFT JOIN designations des ON des.id = s.designation_id
      LEFT JOIN departments dep ON dep.id = s.department_id
      WHERE s.deleted_at IS NULL
        AND des.designation_name IS NOT NULL
      ORDER BY s.id DESC
      LIMIT 30
    `);

    console.log('--- Staff role vs designation (latest 30) ---');
    for (const row of mismatches.rows) {
      const key = await getDesignationKey(client, row.designation_id);
      const kind = designationLoginKind(key);
      const expected =
        kind === 'teacher' ? 2 : kind === 'driver' ? 8 : kind === 'other' ? '(varies)' : '?';
      const ok =
        (kind === 'teacher' && row.role_id === 2) ||
        (kind === 'driver' && row.role_id === 8) ||
        (kind === 'other' && row.role_id !== 2);
      console.log({
        staff_id: row.staff_id,
        user_id: row.user_id,
        role_id: row.role_id,
        role_name: row.role_name,
        designation: row.designation_name,
        dept: row.department_name,
        kind,
        expectedTeacher: expected,
        ok,
      });
    }

    const bad = mismatches.rows.filter(async (row) => {
      const key = await getDesignationKey(client, row.designation_id);
      return designationLoginKind(key) === 'teacher' && row.role_id !== 2;
    });
    // sync test on staff 101 if exists
    const testStaff = mismatches.rows.find((r) => r.designation_name === 'Teacher' && r.role_id === 6);
    if (testStaff) {
      console.log('\nTest sync on', testStaff);
      const applied = await applyStaffLoginRoleSync(
        client,
        testStaff.user_id,
        testStaff.designation_id,
        null
      );
      console.log('applied role_id', applied);
    } else {
      const adminWithTeacherDesig = await client.query(`
        SELECT u.id AS user_id, s.id AS staff_id, s.designation_id, des.designation_name, u.role_id
        FROM staff s
        JOIN users u ON u.id = s.user_id
        JOIN designations des ON des.id = s.designation_id
        WHERE u.role_id = 6 AND LOWER(TRIM(des.designation_name)) LIKE '%teacher%'
        LIMIT 1
      `);
      if (adminWithTeacherDesig.rows[0]) {
        const t = adminWithTeacherDesig.rows[0];
        console.log('\nFound admin+teacher desig', t);
        const applied = await applyStaffLoginRoleSync(client, t.user_id, t.designation_id, null);
        console.log('applied', applied);
        await client.query('ROLLBACK');
      } else {
        console.log('\nNo role_id=6 + teacher designation row found');
        // simulate: pick staff 100, set designation to Teacher in memory and test
        const s100 = mismatches.rows.find((r) => r.staff_id === 100);
        if (s100) {
          const teacherDesig = await client.query(
            `SELECT id FROM designations WHERE LOWER(TRIM(designation_name)) = 'teacher' LIMIT 1`
          );
          const tid = teacherDesig.rows[0]?.id;
          console.log('\nSimulate finalize for staff 100 -> Teacher desig id', tid);
          await client.query('BEGIN');
          await client.query(`UPDATE staff SET designation_id = $1, department_id = (SELECT id FROM departments WHERE LOWER(department_name)='academic' LIMIT 1) WHERE id = 100`, [tid]);
          const applied = await applyStaffLoginRoleSync(client, s100.user_id, tid, null);
          const after = await client.query('SELECT role_id FROM users WHERE id = $1', [s100.user_id]);
          console.log('after sync role_id', after.rows[0], 'applied', applied);
          await client.query('ROLLBACK');
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
