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
 * Priority: PROVISIONING_TEMPLATE_DB_NAME (production override) → DB_NAME → DATABASE_URL → TENANT_ADMIN_DATABASE_URL → school_db.
 */
function getTemplateDbName() {
  const provisioning = (process.env.PROVISIONING_TEMPLATE_DB_NAME || '').toString().trim();
  if (provisioning) return provisioning;
  const dbName = (process.env.DB_NAME || '').toString().trim();
  if (dbName) return dbName;
  for (const urlVar of ['DATABASE_URL', 'TENANT_ADMIN_DATABASE_URL']) {
    const url = (process.env[urlVar] || '').toString().trim();
    if (!url) continue;
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

/**
 * Slug from school name for use as DB name. "Anglo School" → "anglo_school", "Aabid School" → "aabid_school".
 * PostgreSQL: lowercase, alphanumeric + underscore, max 63 chars.
 */
function slugFromSchoolName(schoolName) {
  const s = String(schoolName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s.slice(0, 56);
}

/**
 * Generate tenant DB name from school name (e.g. anglo_db, aabid_db).
 * Falls back to school_{institute} if slug is empty or collision.
 */
function generateTenantDbName(schoolName, instituteNumber, existingDbNames = []) {
  const institute = String(instituteNumber || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  const fallback = `school_${institute || 'school'}`;

  const slug = slugFromSchoolName(schoolName);
  if (!slug) return fallback;

  let base = `${slug}_db`;
  if (base.length > 63) base = base.slice(0, 63);

  const exists = existingDbNames.some((d) => d.toLowerCase() === base.toLowerCase());
  if (exists) return `${slug}_${institute}_db`.slice(0, 63) || fallback;

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
 * Provisioning dump source: PROVISIONING_SOURCE_DATABASE_URL (Neon direct) or derive from TENANT_ADMIN/DATABASE_URL.
 */
function getDumpSourceUrl(sourceDbName, useAlternate = false) {
  const explicit = (process.env.PROVISIONING_SOURCE_DATABASE_URL || '').toString().trim();
  if (explicit && !useAlternate) return explicit;
  const altDb = (process.env.PROVISIONING_ALTERNATE_SOURCE_DB || 'preskool').toString().trim();
  return getConnectionStringForDb(useAlternate ? altDb : sourceDbName);
}

/**
 * Clone schema using pg_dump (plain format) and psql restore.
 * No parallel jobs; safe for Neon connection limits.
 * Note: --single-transaction removed for pg_dump (dropped in PostgreSQL 18).
 */
async function cloneViaDumpRestore(sourceDbName, targetDbName) {
  const targetUrl = getConnectionStringForDb(targetDbName);
  if (!targetUrl) {
    throw new Error('TENANT_ADMIN_DATABASE_URL or DATABASE_URL required for provisioning target');
  }
  const tryDump = async (useAlternate) => {
    const sourceUrl = getDumpSourceUrl(sourceDbName, useAlternate);
    if (!sourceUrl) throw new Error('PROVISIONING_SOURCE_DATABASE_URL or TENANT_ADMIN_DATABASE_URL required');
    const tmpFile = path.join(os.tmpdir(), `tenant_clone_${targetDbName}_${Date.now()}.sql`);
    await new Promise((resolve, reject) => {
      const pd = spawn(
        'pg_dump',
        ['-d', sourceUrl, '--no-owner', '--no-privileges', '--format=plain', '-f', tmpFile],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let stderr = '';
      pd.stderr?.on('data', (c) => { stderr += c.toString(); });
      pd.on('close', (code) => {
        if (code === 0) resolve(tmpFile);
        else reject(new Error(`pg_dump failed (${code}): ${stderr}`));
      });
    });
    return tmpFile;
  };

  let tmpFile;
  try {
    try {
      tmpFile = await tryDump(false);
    } catch (e) {
      if (/too many connections/i.test(e.message)) {
        tmpFile = await tryDump(true);
      } else {
        throw e;
      }
    }
    await new Promise((resolve, reject) => {
      const psql = spawn('psql', ['-d', targetUrl, '-v', 'ON_ERROR_STOP=1', '-f', tmpFile], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      psql.stderr?.on('data', (c) => { stderr += c.toString(); });
      psql.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`psql restore failed (${code}): ${stderr}`));
      });
    });
  } finally {
    if (tmpFile) try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
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
      try {
        await cloneViaDumpRestore(sourceDbName, dbName);
      } catch (dumpErr) {
        try {
          await pool.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [dbName]
          );
          await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        } catch { /* ignore cleanup errors */ }
        throw new Error(
          `Failed to provision tenant (use PROVISIONING_SOURCE_DATABASE_URL with Neon DIRECT endpoint): ${dumpErr.message}`
        );
      }
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
  const adminUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  if (!adminUrl) {
    const p = getAdminPool();
    try {
      await p.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
      );
    } catch { /* ignore */ }
    await p.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    return;
  }
  const dropPool = new Pool({
    connectionString: adminUrl,
    ssl: sslConfig,
    max: 1,
    idleTimeoutMillis: 5000,
  });
  const client = await dropPool.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );
    await new Promise((r) => setTimeout(r, 500));
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    client.release();
    await dropPool.end();
  }
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

