/**
 * Initialize master_db and schools registry.
 *
 * Creates:
 * - Database: master_db (if not exists)
 * - Table: schools (if not exists)
 * - Seeds 3 school records:
 *   1 | Existing School | 1111 | school_db
 *   2 | Millat          | 2222 | millat_db
 *   3 | Iqra            | 3333 | iqra_db
 *
 * Run with:
 *   NODE_ENV=development node init-master-database.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: 'postgres',
});

async function ensureMasterDb() {
  const dbName = 'master_db';
  const existsRes = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (existsRes.rowCount === 0) {
    console.log('✨ Creating database "master_db"...');
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    console.log('✅ Database "master_db" created.');
  } else {
    console.log('✅ Database "master_db" already exists.');
  }
}

function makeMasterPool() {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'master_db',
  });
}

async function ensureSchoolsTable() {
  const masterPool = makeMasterPool();
  try {
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        school_name VARCHAR(255) NOT NULL,
        institute_number VARCHAR(50) NOT NULL UNIQUE,
        db_name VARCHAR(100) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        type VARCHAR(512) NULL,
        logo TEXT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Backward-compatible: add status column if it was missing on older installations
    await masterPool.query(`
      ALTER TABLE schools
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
    `);

    await masterPool.query(`
      ALTER TABLE schools
      ADD COLUMN IF NOT EXISTS type VARCHAR(512) NULL;
    `);

    await masterPool.query(`
      ALTER TABLE schools
      ADD COLUMN IF NOT EXISTS logo TEXT NULL;
    `);

    // Upsert three schools
    await masterPool.query(
      `
      INSERT INTO schools (id, school_name, institute_number, db_name, type, logo)
      VALUES
        (1, 'Existing School', '1111', 'school_db', NULL, 'assets/img/logo-small.svg'),
        (2, 'Millat',         '2222', 'millat_db', 'High school and junior college', 'assets/img/icons/millat-logo.png'),
        (3, 'Iqra',           '3333', 'iqra_db', 'College arts and science', 'assets/img/icons/iqra-logo.bmp')
      ON CONFLICT (institute_number) DO UPDATE
        SET school_name = EXCLUDED.school_name,
            db_name = EXCLUDED.db_name,
            type = COALESCE(EXCLUDED.type, schools.type),
            logo = COALESCE(EXCLUDED.logo, schools.logo)
      `
    );

    // Ensure the sequence is aligned with the current max(id) to avoid PK conflicts
    await masterPool.query(
      `
      SELECT setval(
        pg_get_serial_sequence('schools', 'id'),
        COALESCE((SELECT MAX(id) FROM schools), 1),
        true
      );
      `
    );

    console.log('✅ schools table ensured and seeded in master_db.');
  } finally {
    await masterPool.end();
  }
}

async function ensureSuperAdminUsersTable() {
  const masterPool = makeMasterPool();
  try {
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS super_admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(150) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ super_admin_users table ensured in master_db.');
  } finally {
    await masterPool.end();
  }
}

async function ensureTenantSessionsTable() {
  const masterPool = makeMasterPool();
  try {
    // Opaque session store used for tenant binding + logout invalidation.
    // We store a hash of the session token to avoid storing raw bearer tokens in DB.
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS tenant_sessions (
        id SERIAL PRIMARY KEY,
        session_hash VARCHAR(128) NOT NULL UNIQUE,
        school_id INT NOT NULL,
        institute_number VARCHAR(50) NOT NULL,
        db_name VARCHAR(100) NOT NULL,
        tenant_user_id INT NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        revoked_at TIMESTAMP WITHOUT TIME ZONE NULL,
        user_agent TEXT NULL,
        ip_address VARCHAR(100) NULL
      );
    `);
    await masterPool.query(`CREATE INDEX IF NOT EXISTS idx_tenant_sessions_school ON tenant_sessions(school_id);`);
    await masterPool.query(`CREATE INDEX IF NOT EXISTS idx_tenant_sessions_expires ON tenant_sessions(expires_at);`);
    console.log('✅ tenant_sessions table ensured in master_db.');
  } finally {
    await masterPool.end();
  }
}

async function main() {
  try {
    await ensureMasterDb();
    await ensureSchoolsTable();
    await ensureSuperAdminUsersTable();
    await ensureTenantSessionsTable();
    console.log('=== master_db initialization complete ===');
  } catch (err) {
    console.error('❌ Failed to initialize master_db:', err);
    process.exitCode = 1;
  } finally {
    await adminPool.end();
  }
}

main();

