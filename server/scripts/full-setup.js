const { execSync } = require('child_process');

function run(cmd) {
  console.log(`\n🏃 Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error(`\n❌ Failed: ${cmd}`);
    process.exit(1);
  }
}

console.log('🏁 Starting Full Database Setup...');

// 1. Initialize Master DB and Schools Registry
run('node init-master-database.js');

// 2. Initialize School DB (No Reset!)
run('npm run db:init');

// 3. Run all migrations (Updates schema to latest state)
run('npm run db:migrate');

// 4. Seed the legacy data
run('npm run db:seed');

// 5. Unified Guardian Migration (Processes seeded data and drops legacy columns)
run('npm run db:migrate:unify');

console.log('\n✨ Database setup, migration, and seeding completed successfully!');
