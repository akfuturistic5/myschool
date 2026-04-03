const { query } = require('./src/config/database');
async function run() {
  const g = await query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='guardians' ORDER BY ordinal_position");
  console.log('guardians columns:');
  g.rows.forEach(r => console.log(' ', r.column_name, r.is_nullable === 'NO' ? 'NOT NULL' : ''));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
