/**
 * Reset dynamic (person-related) data in tenant databases.
 *
 * This script assumes tenant databases (millat_db, iqra_db) were cloned
 * from the main school_db and share the same schema.
 *
 * It will:
 * - TRUNCATE TABLE users RESTART IDENTITY CASCADE
 *   which cascades to students, parents, guardians, staff, and all
 *   dependent tables that reference these person entities.
 *
 * Static/config tables like user_roles, classes, sections, blood_groups, etc.
 * are preserved so new schools keep the same configuration.
 *
 * Run with:
 *   NODE_ENV=development node reset-tenant-dynamic-data.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const tenants = ['millat_db', 'iqra_db'];

function makeTenantPool(dbName) {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });
}

async function resetTenant(dbName) {
  const pool = makeTenantPool(dbName);
  console.log(`\n=== Resetting dynamic data in tenant DB "${dbName}" ===`);
  try {
    await pool.query('BEGIN');
    // Central truncate: users and all dependent rows
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await pool.query('COMMIT');
    console.log(`✅ Dynamic user/person data reset in "${dbName}" (users + all dependent tables).`);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(`❌ Failed to reset dynamic data in "${dbName}":`, err);
    throw err;
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    for (const dbName of tenants) {
      await resetTenant(dbName);
    }
    console.log('\n=== Tenant dynamic data reset complete ===');
  } catch {
    process.exitCode = 1;
  }
}

main();

