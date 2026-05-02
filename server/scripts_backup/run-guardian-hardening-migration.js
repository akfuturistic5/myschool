/**
 * Applies migrations/009_guardian_registry_hardening.sql on the tenant DB.
 *
 * Usage:
 *   node scripts/run-guardian-hardening-migration.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'migrations', '009_guardian_registry_hardening.sql');

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
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Missing migration file: ${migrationPath}`);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const pool = makePool();
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Applied 009_guardian_registry_hardening.sql successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Guardian hardening migration failed:', e.message);
  process.exit(1);
});

