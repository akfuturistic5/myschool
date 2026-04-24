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

// 2. Initialize School DB and Base Schema (001)
run('npm run db:init');

// 3. Run all subsequent migrations (002+)
run('npm run db:migrate');

console.log('\n✨ Database setup completed successfully!');
