const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const args = process.argv.slice(2);
const dbOverride = args.indexOf('--db') !== -1 ? args[args.indexOf('--db') + 1] : null;
const dirOverride = args.indexOf('--dir') !== -1 ? args[args.indexOf('--dir') + 1] : null;
const targetDb = dbOverride || process.env.DB_NAME || 'school_db';
const seedsDir = dirOverride ? path.resolve(__dirname, '..', dirOverride) : path.join(__dirname, '../seeds');

async function runSeeds() {
  console.log(`🌱 Seeding database: ${targetDb}`);

  if (!fs.existsSync(seedsDir)) {
    console.log(`⏭️ Seeds directory not found: ${seedsDir}. Skipping.`);
    return;
  }

  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('🏁 No seed files found.');
    return;
  }

  console.log(`🚀 Found ${files.length} seed files.`);

  // Use psql for robust SQL execution (handles COPY, \., etc.)
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'postgres';
  const pass = process.env.DB_PASSWORD || 'database';

  for (const file of files) {
    console.log(`Applying seed ${file}...`);
    try {
      const filePath = path.join(seedsDir, file);
      
      // Set PGPASSWORD so psql doesn't prompt for password
      process.env.PGPASSWORD = pass;
      
      // Execute psql command
      const cmd = `psql -h ${host} -U ${user} -d ${targetDb} -f "${filePath}"`;
      execSync(cmd, { stdio: 'inherit' });
      
      console.log(`✅ ${file} applied.`);
    } catch (err) {
      console.error(`❌ Failed to apply ${file}`);
    }
  }

  console.log(`🏁 Seeding complete for ${targetDb}.`);
}

if (require.main === module) {
  runSeeds().catch(err => {
    console.error('Fatal seeding error:', err);
    process.exit(1);
  });
}

module.exports = { runSeeds };
