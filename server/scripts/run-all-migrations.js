const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// CLI Arguments: --db [name] --dir [path]
const args = process.argv.slice(2);
const dbOverride = args.indexOf('--db') !== -1 ? args[args.indexOf('--db') + 1] : null;
const dirOverride = args.indexOf('--dir') !== -1 ? args[args.indexOf('--dir') + 1] : null;

const targetDb = dbOverride || process.env.DB_NAME || 'school_db';
const migrationsDir = dirOverride ? path.resolve(dirOverride) : path.join(__dirname, '../migrations');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'database',
  database: targetDb,
});

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function runMigrations() {
  console.log(`📡 Targeting database: ${targetDb}`);
  await ensureMigrationTable();

  if (!fs.existsSync(migrationsDir)) {
    console.log(`⏭️ Migrations directory not found: ${migrationsDir}. Skipping.`);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Exclude 001 because it is typically run by db:init or provisioning
  // Seeders are usually excluded from auto-migrations
  const toApply = files.filter(f => f !== '001_init_full_schema.sql');

  console.log(`🚀 Found ${toApply.length} potential migrations in ${path.basename(migrationsDir)}.`);

  let appliedCount = 0;
  for (const file of toApply) {
    const check = await pool.query('SELECT 1 FROM migration_history WHERE migration_name = $1', [file]);
    
    if (check.rowCount === 0) {
      console.log(`Applying ${file}...`);
      try {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        await pool.query('INSERT INTO migration_history (migration_name) VALUES ($1)', [file]);
        console.log(`✅ ${file} applied.`);
        appliedCount++;
      } catch (err) {
        console.error(`❌ Failed to apply ${file}:`, err.message);
        process.exit(1);
      }
    }
  }

  if (appliedCount === 0) {
    console.log('🏁 No new migrations to apply.');
  } else {
    console.log(`🏁 Applied ${appliedCount} migrations.`);
  }
}

if (require.main === module) {
  runMigrations().catch(err => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  }).finally(() => pool.end());
}

module.exports = { runMigrations };
