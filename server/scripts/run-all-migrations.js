const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'database',
  database: process.env.DB_NAME || 'school_db',
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
  await ensureMigrationTable();

  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Exclude 001 because it is typically run by db:init or provisioning
  const seeders = ['005_seed_realistic_academic_dummy_data.sql', '006_reseed_multi_academic_year_dummy_data.sql'];
  const toApply = files.filter(f => f !== '001_init_full_schema.sql' && !seeders.includes(f));

  console.log(`🚀 Found ${toApply.length} potential migrations.`);

  for (const file of toApply) {
    const check = await pool.query('SELECT 1 FROM migration_history WHERE migration_name = $1', [file]);
    
    if (check.rowCount === 0) {
      console.log(`Applying ${file}...`);
      try {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        await pool.query('INSERT INTO migration_history (migration_name) VALUES ($1)', [file]);
        console.log(`✅ ${file} applied.`);
      } catch (err) {
        console.error(`❌ Failed to apply ${file}:`, err.message);
        // Optionally break on error to prevent inconsistent state
        process.exit(1);
      }
    } else {
      // console.log(`⏭️ ${file} already applied.`);
    }
  }

  console.log('🏁 All migrations up to date.');
}

runMigrations().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
}).finally(() => pool.end());
