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

async function run() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const seeders = ['005_seed_realistic_academic_dummy_data.sql', '006_reseed_multi_academic_year_dummy_data.sql'];
  const toMark = files.filter(f => f !== '001_init_full_schema.sql' && !seeders.includes(f));

  console.log(`Marking ${toMark.length} files as applied...`);

  for (const file of toMark) {
    await pool.query('INSERT INTO migration_history (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING', [file]);
  }

  console.log('Done.');
}

run().catch(console.error).finally(() => pool.end());
