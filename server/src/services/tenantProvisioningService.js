const { Pool } = require('pg');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
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
 * Must be a DB with NO active connections (PostgreSQL requirement).
 *
 * PROVISIONING_TEMPLATE_DB_NAME: Use this for provisioning only. Never used by app = no connections.
 * Local: DB_NAME or school_db. Production: use a dedicated template DB (e.g. school_template).
 */
function getTemplateDbName() {
  const provisioning = (process.env.PROVISIONING_TEMPLATE_DB_NAME || '').toString().trim();
  if (provisioning) return provisioning;
  const explicit = (process.env.DB_NAME || '').toString().trim();
  if (explicit) return explicit;
  const url = (process.env.DATABASE_URL || process.env.TENANT_ADMIN_DATABASE_URL || '').toString().trim();
  if (url) {
    try {
      const u = new URL(url);
      const db = (u.pathname || '/').replace(/^\//, '').split('?')[0].trim();
      if (db) return db;
    } catch {
      /* ignore */
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

/**
 * Get connection string for a database on Neon/same host.
 */
function getConnectionStringForDb(dbName) {
  const baseUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  if (!baseUrl) return null;
  try {
    const u = new URL(baseUrl);
    u.pathname = `/${dbName}`;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Get pg_dump source URL. Use PROVISIONING_SOURCE_DATABASE_URL (Neon direct) to avoid
 * "too many connections" on pooler. Else derive from TENANT_ADMIN.
 */
function getDumpSourceUrl(sourceDbName) {
  const explicit = (process.env.PROVISIONING_SOURCE_DATABASE_URL || '').toString().trim();
  if (explicit) return explicit;
  return getConnectionStringForDb(sourceDbName);
}

/**
 * Clone database using pg_dump + pg_restore. Works when TEMPLATE fails (Neon keeps connections).
 * Use PROVISIONING_SOURCE_DATABASE_URL with Neon direct endpoint to avoid pooler connection limits.
 */
async function cloneViaDumpRestore(sourceDbName, targetDbName) {
  const sourceUrl = getDumpSourceUrl(sourceDbName);
  const targetUrl = getConnectionStringForDb(targetDbName);
  if (!sourceUrl || !targetUrl) {
    throw new Error('PROVISIONING_SOURCE_DATABASE_URL or TENANT_ADMIN_DATABASE_URL required for pg_dump');
  }
  const tmpFile = path.join(os.tmpdir(), `tenant_clone_${targetDbName}_${Date.now()}.dump`);
  try {
    await new Promise((resolve, reject) => {
      const pd = spawn('pg_dump', [sourceUrl, '-Fc', '-f', tmpFile], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      pd.stderr?.on('data', (c) => { stderr += c.toString(); });
      pd.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump failed (${code}): ${stderr}`));
      });
    });
    await new Promise((resolve, reject) => {
      const pr = spawn('pg_restore', ['-d', targetUrl, '--no-owner', '--no-acl', '-Fc', tmpFile], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      pr.stderr?.on('data', (c) => { stderr += c.toString(); });
      pr.on('close', (code) => {
        if (code === 0 || code === 1) resolve();
        else reject(new Error(`pg_restore failed (${code}): ${stderr}`));
      });
    });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

async function createTenantDatabase(dbName) {
  const pool = getAdminPool();
  const checkRes = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (checkRes.rowCount > 0) {
    throw new Error(`Database "${dbName}" already exists`);
  }

  const sourceDbName = getTemplateDbName();

  let created = false;
  try {
    await pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [sourceDbName]
    );
  } catch { /* ignore */ }

  try {
    await pool.query(`CREATE DATABASE "${dbName}" TEMPLATE "${sourceDbName}"`);
    created = true;
  } catch (err) {
    const isAccessError = err.message && /is being accessed by other users/i.test(err.message);
    if (isAccessError) {
      await pool.query(`CREATE DATABASE "${dbName}"`);
      created = true;
      await cloneViaDumpRestore(sourceDbName, dbName);
    } else {
      throw new Error(
        `Failed to create tenant database "${dbName}" from template "${sourceDbName}": ${err.message}`
      );
    }
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

