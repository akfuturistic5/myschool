/**
 * Applies 022_teacher_assignments_unique_slot.sql (idempotent CREATE; dedupe + DROP are one-time safe).
 *
 *   npm run db:migrate:teacher-assignments-unique
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const sslConfig =
  process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: true } : { rejectUnauthorized: false };

async function main() {
  const url = (process.env.DATABASE_URL || '').trim();
  const pool = url
    ? new Pool({ connectionString: url, ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : false })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'schooldb',
        ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : false,
      });

  const sqlPath = path.join(__dirname, '..', 'migrations', '022_teacher_assignments_unique_slot.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Applying 022_teacher_assignments_unique_slot.sql ...');
  await pool.query(sql);
  console.log('Done.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
