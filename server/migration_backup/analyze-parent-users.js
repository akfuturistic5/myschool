const { query } = require('./src/config/database');

async function run() {
  try {
    const cols = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
    );
    console.log('users columns:', cols.rows.map(r => r.column_name).join(', '));

    const pcols = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='parents' ORDER BY ordinal_position"
    );
    console.log('parents columns:', pcols.rows.map(r => r.column_name).join(', '));

    const roles = await query('SELECT id, role_name FROM user_roles');
    console.log('user_roles:', roles.rows);

    const parentUsers = await query(`
      SELECT u.id, u.username, u.email, u.phone, ur.role_name
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      WHERE LOWER(ur.role_name) = 'parent'
      LIMIT 10
    `);
    console.log('\nParent role users:', JSON.stringify(parentUsers.rows, null, 2));

    const parents = await query(`
      SELECT id, father_name, father_email, father_phone, mother_email, mother_phone, student_id
      FROM parents
      LIMIT 10
    `);
    console.log('\nParents table sample:', JSON.stringify(parents.rows, null, 2));

    if (parentUsers.rows.length > 0 && parents.rows.length > 0) {
      const u = parentUsers.rows[0];
      const match = await query(`
        SELECT p.id, p.father_name, p.father_email, p.father_phone
        FROM parents p
        INNER JOIN students s ON p.student_id = s.id AND s.is_active = true
        WHERE (LOWER(TRIM(p.father_email)) = LOWER($1) AND $1 != '')
           OR (LOWER(TRIM(p.mother_email)) = LOWER($1) AND $1 != '')
           OR (TRIM(p.father_phone) = $2 AND $2 != '')
           OR (TRIM(p.mother_phone) = $2 AND $2 != '')
      `, [u.email || '', u.phone || '']);
      console.log('\nMatch for first parent user (email, phone):', match.rows.length, 'rows');
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
