const { query } = require('./src/config/database');
async function run() {
  const c = await query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint WHERE conrelid = 'users'::regclass
  `);
  console.log('users constraints:');
  c.rows.forEach(r => console.log(' ', r.conname, ':', r.def));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
