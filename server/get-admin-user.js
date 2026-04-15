const { query } = require('./src/config/database');
async function run() {
  const r = await query(`
    SELECT u.id, u.username, u.phone, u.email, ur.role_name 
    FROM users u 
    LEFT JOIN user_roles ur ON u.role_id = ur.id 
    WHERE ur.role_name ILIKE '%admin%' OR u.role_id = 1
    LIMIT 5
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  process.exit(0);
}
run();
