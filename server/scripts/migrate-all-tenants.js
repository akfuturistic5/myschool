/**
 * Orchestrator script: migrates the master database and ALL school databases.
 */
const { execSync } = require('child_process');
const path = require('path');
const { masterQuery } = require('../src/config/database');
require('dotenv').config();

async function main() {
  console.log('🌍 === STARTING UNIFIED MULTI-TENANT MIGRATION ===');

  // 1. Migrate Master Database
  console.log('\n--- [1/2] Migrating Master Database ---');
  try {
    const masterDbName = process.env.MASTER_DB_NAME || 'master_db';
    // Use the master-specific migrations folder
    execSync(`node scripts/run-all-migrations.js --db ${masterDbName} --dir migrations/master`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Master migration failed. Aborting.');
    process.exit(1);
  }

  // 2. Fetch all schools from Master
  console.log('\n--- [2/2] Migrating School Databases ---');
  let schools = [];
  try {
    const res = await masterQuery(
      'SELECT school_name, db_name FROM schools WHERE deleted_at IS NULL ORDER BY id ASC'
    );
    schools = res.rows;
  } catch (err) {
    console.error('❌ Failed to fetch schools from master_db:', err.message);
    process.exit(1);
  }

  console.log(`Found ${schools.length} schools to migrate.`);

  for (const school of schools) {
    const { school_name, db_name } = school;
    console.log(`\n🏢 School: ${school_name} (${db_name})`);
    try {
      execSync(`node scripts/run-all-migrations.js --db ${db_name}`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`❌ Migration failed for school ${school_name}. Continuing to next...`);
    }
  }

  console.log('\n✅ === UNIFIED MIGRATION COMPLETE ===\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
