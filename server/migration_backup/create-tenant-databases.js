/**
 * Create tenant databases (millat_db, iqra_db) on the same PostgreSQL server.
 *
 * This uses admin-level connection to the default "postgres" database.
 * It is idempotent: it checks for existence before creating each DB.
 *
 * Run with:
 *   NODE_ENV=development node create-tenant-databases.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: 'postgres',
});

async function ensureDatabase(dbName) {
  const checkRes = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (checkRes.rowCount > 0) {
    console.log(`✅ Database "${dbName}" already exists`);
    return;
  }
  console.log(`✨ Creating database "${dbName}"...`);
  // NOTE: identifiers cannot be parameterized; dbName is controlled by our script
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  console.log(`✅ Database "${dbName}" created`);
}

async function main() {
  try {
    console.log('=== Creating tenant databases (if missing) ===');
    await ensureDatabase('millat_db');
    await ensureDatabase('iqra_db');
    console.log('=== Tenant database creation complete ===');
  } catch (err) {
    console.error('❌ Failed to create tenant databases:', err);
    process.exitCode = 1;
  } finally {
    await adminPool.end();
  }
}

main();

