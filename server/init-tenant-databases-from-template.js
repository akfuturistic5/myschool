
/**
 * Initialize tenant databases (millat_db, iqra_db) from the existing school_db
 * using PostgreSQL TEMPLATE feature.
 *
 * This will:
 * - Terminate any existing connections to the tenant DBs
 * - DROP DATABASE IF EXISTS for each tenant
 * - CREATE DATABASE ... TEMPLATE <source_db> for each tenant
 *
 * WARNING:
 * - This is a destructive operation for millat_db and iqra_db.
 * - Run this only for initial multi-tenant setup, before using tenant DBs.
 *
 * Run with:
 *   NODE_ENV=development node init-tenant-databases-from-template.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const sourceDbName = process.env.DB_NAME || 'school_db';
const tenants = ['millat_db', 'iqra_db'];

const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: 'postgres',
});

async function terminateConnections(dbName) {
  await adminPool.query(
    `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1
      AND pid <> pg_backend_pid()
    `,
    [dbName]
  );
}

async function recreateFromTemplate(targetDb) {
  console.log(`\n=== Recreating database "${targetDb}" from template "${sourceDbName}" ===`);

  // Ensure no active connections block DROP / TEMPLATE usage
  console.log(`Terminating connections to "${targetDb}" (if any)...`);
  await terminateConnections(targetDb);

  await adminPool.query(`DROP DATABASE IF EXISTS "${targetDb}"`);
  console.log(`Dropped database "${targetDb}" (if it existed).`);

  console.log(`Terminating connections to source "${sourceDbName}" so it can be used as TEMPLATE...`);
  await terminateConnections(sourceDbName);

  await adminPool.query(`CREATE DATABASE "${targetDb}" TEMPLATE "${sourceDbName}"`);
  console.log(`Created database "${targetDb}" from template "${sourceDbName}".`);
}

async function main() {
  try {
    console.log('Source (template) database:', sourceDbName);
    for (const tenant of tenants) {
      await recreateFromTemplate(tenant);
    }
    console.log('\n=== Tenant databases initialized from template ===');
  } catch (err) {
    console.error('❌ Failed to initialize tenant databases from template:', err);
    process.exitCode = 1;
  } finally {
    await adminPool.end();
  }
}

main();


