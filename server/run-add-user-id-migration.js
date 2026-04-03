const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'add_user_id_to_parents_guardians.sql'), 'utf8');
  await query(sql);
  console.log('1. Migration add_user_id_to_parents_guardians applied.');
  await query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))");
  console.log('2. Users id sequence synced.');
  process.exit(0);
}
run().catch(e => {
  console.error(e);
  process.exit(1);
});
