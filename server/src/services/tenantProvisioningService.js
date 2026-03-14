const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Reuse SSL mode rules similar to database.js
let sslConfig = { rejectUnauthorized: false };
if (process.env.DATABASE_SSL_MODE === 'require') {
  sslConfig = { rejectUnauthorized: true };
}

let adminPool = null;

/**
 * Template database name for CREATE DATABASE ... TEMPLATE.
 * Local: DB_NAME=school_db or fallback school_db.
 * Production (Neon): DB_NAME=neondb or derived from DATABASE_URL (e.g. neondb).
 */
function getTemplateDbName() {
  const explicit = (process.env.DB_NAME || '').toString().trim();
  if (explicit) return explicit;
  const url = (process.env.DATABASE_URL || process.env.TENANT_ADMIN_DATABASE_URL || '').toString().trim();
  if (url) {
    try {
      const u = new URL(url);
      const db = (u.pathname || '/').replace(/^\//, '').split('?')[0].trim();
      if (db) return db;
    } catch {
      /* ignore parse errors */
    }
  }
  return 'school_db';
}

/**
 * Admin pool for CREATE DATABASE. Uses TENANT_ADMIN_DATABASE_URL, else DATABASE_URL, else local.
 */
function getAdminPool() {
  if (adminPool) return adminPool;

  const adminUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  if (adminUrl) {
    adminPool = new Pool({
      connectionString: adminUrl,
      ssl: sslConfig,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    return adminPool;
  }

  adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return adminPool;
}

/**
 * Pool for connecting to a specific tenant database (e.g. TRUNCATE, insert headmaster).
 * Production: uses TENANT_ADMIN_DATABASE_URL or DATABASE_URL with swapped db name.
 * Local: uses DB_HOST, DB_PORT, DB_USER, DB_PASSWORD.
 */
function createPoolForTenantDb(dbName) {
  const baseUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  if (baseUrl) {
    try {
      const u = new URL(baseUrl);
      u.pathname = `/${dbName}`;
      return new Pool({
        connectionString: u.toString(),
        ssl: sslConfig,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } catch {
      /* fall through to local config */
    }
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

function generateTenantDbName(instituteNumber) {
  const digits = String(instituteNumber || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  const suffix = digits || 'school';
  let base = `school_${suffix}`;
  if (base.length > 40) {
    base = base.slice(0, 40);
  }
  return base;
}

async function createTenantDatabase(dbName) {
  const pool = getAdminPool();
  const checkRes = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (checkRes.rowCount > 0) {
    throw new Error(`Database "${dbName}" already exists`);
  }

  const sourceDbName = getTemplateDbName();

  try {
    // Clone schema + reference data from source DB
    await pool.query(`CREATE DATABASE "${dbName}" TEMPLATE "${sourceDbName}"`);
  } catch (err) {
    throw new Error(
      `Failed to create tenant database "${dbName}" from template "${sourceDbName}": ${err.message}`
    );
  }

  // Immediately remove all tenant-specific/dynamic data so the new school starts clean.
  // Mirrors reset-tenant-dynamic-data.js behaviour.
  const tenantPool = createPoolForTenantDb(dbName);

  try {
    await tenantPool.query('BEGIN');
    await tenantPool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await tenantPool.query('COMMIT');
  } catch (err) {
    await tenantPool.query('ROLLBACK');
    // Cleanup the half-initialized tenant DB to avoid leaking data
    try {
      await pool.query(
        `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
        `,
        [dbName]
      );
    } catch {
      // ignore terminate errors
    }
    try {
      await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } catch {
      // ignore drop errors; propagate root cause below
    }
    throw new Error(
      `Created tenant database "${dbName}" but failed to reset dynamic data: ${err.message}`
    );
  } finally {
    await tenantPool.end();
  }
}

async function dropTenantDatabaseIfExists(dbName) {
  const pool = getAdminPool();
  try {
    await pool.query(
      `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()
      `,
      [dbName]
    );
  } catch {
  }
  await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
}

async function createHeadmasterUserInTenant(dbName, adminName, adminEmail, adminPassword, instituteNumber) {
  const pool = createPoolForTenantDb(dbName);

  try {
    const roleRes = await pool.query(
      `
      SELECT id
      FROM user_roles
      WHERE LOWER(role_name) = 'admin'
      LIMIT 1
      `
    );
    if (!roleRes.rows || roleRes.rows.length === 0) {
      throw new Error('Admin role not found in user_roles');
    }
    const adminRoleId = roleRes.rows[0].id;

    const trimmedName = String(adminName || '').trim() || 'Headmaster';
    const parts = trimmedName.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    const username = `hm_${String(instituteNumber || '').trim() || dbName}`;
    const email = String(adminEmail || '').trim();
    const passwordHash = await bcrypt.hash(String(adminPassword || ''), 10);

    const userRes = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, role_id, first_name, last_name, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id
      `,
      [username, email, passwordHash, adminRoleId, firstName, lastName]
    );
    const userId = userRes.rows[0].id;

    try {
      const employeeCode = `HM-${String(instituteNumber || '').trim() || dbName}`.toUpperCase();
      await pool.query(
        `
        INSERT INTO staff (user_id, employee_code, first_name, last_name, is_active)
        VALUES ($1, $2, $3, $4, true)
        `,
        [userId, employeeCode, firstName, lastName]
      );
    } catch {
    }

    return { userId, username, email };
  } finally {
    await pool.end();
  }
}

module.exports = {
  generateTenantDbName,
  createTenantDatabase,
  dropTenantDatabaseIfExists,
  createHeadmasterUserInTenant,
  getTemplateDbName,
};

