require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getDbConfig() {
  // Allow DATABASE_URL to fully drive connection (production-like).
  const url = (process.env.DATABASE_URL || '').trim();
  if (url) return { connectionString: url };

  // Local dev: use DB_* with safe defaults that match server/.env.example.
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'school_db',
  };
}

async function run() {
  const pool = new Pool(getDbConfig());
  try {
    const seedFiles = [
      '005_seed_realistic_academic_dummy_data.sql',
      '006_reseed_multi_academic_year_dummy_data.sql',
    ];

    for (const f of seedFiles) {
      const p = path.join(__dirname, '..', 'migrations', f);
      console.log(`Seeding ${f}...`);
      const sql = fs.readFileSync(p, 'utf8');
      await pool.query(sql);
    }

    console.log('✅ Academic seed complete.');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  // Keep message readable; pg error details can be huge.
  console.error('❌ Academic seed failed:', err && err.message ? err.message : err);
  process.exit(1);
});

