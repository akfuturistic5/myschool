/**
 * Adds medical_document_path + transfer_certificate_path on students.
 * From server/: node scripts/run-student-documents-migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

function poolFromEnv() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'school_db',
  });
}

async function run() {
  const pool = poolFromEnv();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS medical_document_path VARCHAR(512)`
    );
    await client.query(
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS transfer_certificate_path VARCHAR(512)`
    );
    await client.query('COMMIT');
    console.log('Student documents columns OK.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
