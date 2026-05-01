/**
 * Applies migrations/037_hostel_academic_year_and_crud_fields.sql (idempotent).
 *
 *   npm run db:migrate:hostel
 *
 * From repo root:
 *   node server/scripts/run-hostel-migration.js
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

  const sqlPath = path.join(__dirname, '..', 'migrations', '037_hostel_academic_year_and_crud_fields.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Missing migration file: ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Applying 037_hostel_academic_year_and_crud_fields.sql ...');
  await pool.query(sql);
  console.log('Done.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
