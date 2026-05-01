/**
 * Orchestrator script: seeds ALL school databases.
 */
const { execSync } = require('child_process');
const { masterQuery } = require('../src/config/database');
require('dotenv').config();

async function main() {
  console.log('🌱 === STARTING UNIFIED MULTI-TENANT SEEDING ===');

  // 1. Seed Master Database
  console.log('\n--- [1/2] Seeding Master Database ---');
  try {
    const masterDbName = process.env.MASTER_DB_NAME || 'master_db';
    execSync(`node scripts/run-all-seeds.js --db ${masterDbName} --dir seeds/master`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Master seeding failed. Continuing to tenants...');
  }

  // 2. Seed Tenant Databases
  console.log('\n--- [2/2] Seeding School Databases ---');
  try {
    const res = await masterQuery(
      'SELECT school_name, db_name FROM schools WHERE deleted_at IS NULL ORDER BY id ASC'
    );
    schools = res.rows;
  } catch (err) {
    console.error('❌ Failed to fetch schools from master_db:', err.message);
    process.exit(1);
  }

  console.log(`Found ${schools.length} schools to seed.`);

  for (const school of schools) {
    const { school_name, db_name } = school;
    console.log(`\n🏢 School: ${school_name} (${db_name})`);
    try {
      execSync(`node scripts/run-all-seeds.js --db ${db_name}`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`❌ Seeding failed for school ${school_name}.`);
    }
  }

  console.log('\n✅ === UNIFIED SEEDING COMPLETE ===\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
