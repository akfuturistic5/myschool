/**
 * Applies migrations/002_create_student_promotions.sql on the tenant (school) database.
 *
 * Uses the same connection rules as the API:
 *   - DATABASE_URL if set
 *   - else DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *
 *   npm run db:migrate:student-promotions
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { splitSqlStatements } = require('../src/services/tenantProvisioningService');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'migrations', '002_create_student_promotions.sql');

/** True if anything remains after stripping SQL line/block comments (splitter may yield comment-only chunks). */
function hasExecutableSql(stmt) {
  if (!stmt || !String(stmt).trim()) return false;
  const noLine = String(stmt).replace(/--[^\n]*/g, '\n');
  const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.trim().length > 0;
}

let sslConfig = { rejectUnauthorized: false };
if (process.env.DATABASE_SSL_MODE === 'require') {
  sslConfig = { rejectUnauthorized: true };
}

function makePool() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (url) {
    return new Pool({
      connectionString: url,
      max: 5,
      ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : undefined,
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'schooldb',
    max: 5,
    ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : false,
  });
}

async function main() {
  if (!fs.existsSync(migrationPath)) {
    console.error('Missing migration file:', migrationPath);
    process.exit(1);
  }

  const sqlText = fs.readFileSync(migrationPath, 'utf8');
  const statements = splitSqlStatements(sqlText);
  const pool = makePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let n = 0;
    for (const stmt of statements) {
      if (!hasExecutableSql(stmt)) continue;
      await client.query(stmt);
      n += 1;
    }
    await client.query('COMMIT');
    console.log(`Applied 002_create_student_promotions: ${n} statement(s).`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
