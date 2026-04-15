const { query } = require('./src/config/database');
async function run() {
  const u = await query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  const p = await query("SELECT column_name FROM information_schema.columns WHERE table_name='parents' ORDER BY ordinal_position");
  const g = await query("SELECT column_name FROM information_schema.columns WHERE table_name='guardians' ORDER BY ordinal_position");
  console.log('users:', u.rows.map(r => r.column_name).join(', '));
  const usersNullable = await query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='users'");
  console.log('users NOT NULL:', usersNullable.rows.filter(r=>r.is_nullable==='NO').map(r=>r.column_name));
  console.log('parents:', p.rows.map(r => r.column_name).join(', '));
  console.log('guardians:', g.rows.map(r => r.column_name).join(', '));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
