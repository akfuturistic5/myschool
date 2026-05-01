const { query } = require('./src/config/database');
async function run() {
  const students = await query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='students' ORDER BY ordinal_position");
  const guardians = await query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='guardians' ORDER BY ordinal_position");
  console.log('Students NOT NULL:', students.rows.filter(r=>r.is_nullable==='NO').map(r=>r.column_name));
  console.log('Guardians NOT NULL:', guardians.rows.filter(r=>r.is_nullable==='NO').map(r=>r.column_name));
  const cons = await query("SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid='students'::regclass AND contype='c'");
  console.log('Students check constraints:');
  cons.rows.forEach(r => console.log(' ', r.conname, ':', r.def));
  process.exit(0);
}
run().catch(e=>{console.error(e);process.exit(1);});
