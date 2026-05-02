/**
 * Bulk Database Provisioner
 * Fetches all school database names from the master registry and creates them if they don't exist.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool, Client } = require('pg');

const sslConfig = process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false;

async function ensureDatabaseExists(dbName) {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres',
    ssl: sslConfig,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount > 0) {
      console.log(`⏩ Database "${dbName}" already exists.`);
    } else {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`✅ Created database: "${dbName}"`);
    }
  } catch (err) {
    console.error(`❌ Error creating "${dbName}":`, err.message);
  } finally {
    await client.end();
  }
}

async function main() {
  const masterPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'master_db',
    ssl: sslConfig,
  });

  try {
    console.log('🔍 Fetching all school registries from Master DB...');
    const res = await masterPool.query('SELECT db_name FROM public.schools');
    const dbs = res.rows.map(r => r.db_name);

    if (dbs.length === 0) {
      console.log('⚠️ No schools found in registry.');
      return;
    }

    console.log(`🚀 Provisioning ${dbs.length} databases...`);
    for (const db of dbs) {
      await ensureDatabaseExists(db);
    }
    console.log('\n✨ All databases provisioned.');
  } catch (err) {
    console.error('💥 Critical Error:', err.message);
    process.exit(1);
  } finally {
    await masterPool.end();
  }
}

main();
