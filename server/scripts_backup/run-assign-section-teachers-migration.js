/**
 * Applies migrations/010_assign_section_teachers_round_robin.sql
 * Fills NULL section_teacher_id using active teachers (round-robin).
 *
 * Usage:
 *   node server/scripts/run-assign-section-teachers-migration.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'migrations', '010_assign_section_teachers_round_robin.sql');

let sslConfig = { rejectUnauthorized: false };
if (process.env.DATABASE_SSL_MODE === 'require') {
  sslConfig = { rejectUnauthorized: true };
}

function makePool() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (url) {
    return new Pool({
      connectionString: url,
      max: 3,
      ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : undefined,
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'schooldb',
    max: 3,
    ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : false,
  });
}

async function main() {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const pool = makePool();
  try {
    const r = await pool.query(sql);
    console.log('OK: assign section teachers migration applied.');
    console.log('Rows updated:', r.rowCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
