/**
 * Maintenance script: provisions missing tenant databases for schools
 * that are registered in master_db but don't physically exist in Postgres.
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createTenantDatabase, getAdminPool } = require('../src/services/tenantProvisioningService');
const { masterQuery } = require('../src/config/database');

async function getExistingDatabases() {
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'database',
    database: 'postgres',
  });
  try {
    const res = await adminPool.query('SELECT datname FROM pg_database');
    return res.rows.map(r => r.datname);
  } finally {
    await adminPool.end();
  }
}

async function main() {
  console.log('🔍 Checking for missing tenant databases...');
  
  const existingDbs = await getExistingDatabases();
  console.log(`Found ${existingDbs.length} existing databases in Postgres.`);

  const schoolsRes = await masterQuery(
    'SELECT id, school_name, db_name FROM schools WHERE deleted_at IS NULL ORDER BY id ASC'
  );
  const schools = schoolsRes.rows;
  console.log(`Found ${schools.length} schools in master registry.`);

  let provisionedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const school of schools) {
    const { school_name, db_name } = school;
    
    if (!db_name) {
      console.warn(`⚠️ School "${school_name}" (ID: ${school.id}) has no db_name assigned. Skipping.`);
      skippedCount++;
      continue;
    }

    if (existingDbs.includes(db_name)) {
      console.log(`✅ Database "${db_name}" for school "${school_name}" already exists.`);
      skippedCount++;
      continue;
    }

    console.log(`🚀 Provisioning missing database "${db_name}" for school "${school_name}"...`);
    try {
      await createTenantDatabase(db_name, school_name);
      console.log(`✨ Successfully provisioned "${db_name}".`);
      provisionedCount++;
    } catch (err) {
      console.error(`❌ Failed to provision "${db_name}":`, err.message);
      errorCount++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total schools checked: ${schools.length}`);
  console.log(`Provisioned:           ${provisionedCount}`);
  console.log(`Already existed:       ${skippedCount}`);
  console.log(`Errors:                ${errorCount}`);
  console.log('---------------\n');

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
