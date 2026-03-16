const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Provisioning creates an empty tenant DB and then imports schema/data
// from a local SQL file (template_schema.sql). This avoids relying on
// CREATE DATABASE ... TEMPLATE behaviour on Neon or external pg_dump/psql
// binaries, and makes provisioning deterministic and version-agnostic.

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
 * Must connect to the main application DB (e.g. neondb), never to the template DB (school_template).
 */
function getAdminPool() {
  if (adminPool) return adminPool;

  const adminUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  if (adminUrl) {
    const templateName = getTemplateDbName();
    try {
      const u = new URL(adminUrl);
      const urlDbName = (u.pathname || '/').replace(/^\//, '').split('?')[0].trim();
      if (urlDbName && templateName && urlDbName === templateName) {
        throw new Error(
          `TENANT_ADMIN_DATABASE_URL/DATABASE_URL must point to the main application database (e.g. neondb), not the template "${templateName}". ` +
          `Set DATABASE_URL to .../neondb. Template is only used during CREATE DATABASE ... TEMPLATE.`
        );
      }
    } catch (e) {
      if (e.message && e.message.includes('main application database')) throw e;
      /* URL parse error: continue and use URL as-is */
    }
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

// Lazy-loaded SQL template for tenant provisioning. Kept in memory after first read.
let cachedTemplateSql = null;
function getTemplateSql() {
  if (cachedTemplateSql) return cachedTemplateSql;
  const templatePath =
    process.env.PROVISIONING_TEMPLATE_SQL_PATH ||
    path.join(__dirname, '../../sql/template_schema.sql');
  let sql;
  try {
    sql = fs.readFileSync(templatePath, 'utf8');
  } catch (e) {
    throw new Error(
      `Template SQL file not found at "${templatePath}". Export schema/data from your template DB (e.g. school_template2) ` +
      'to a plain .sql file and set PROVISIONING_TEMPLATE_SQL_PATH or place it at server/sql/template_schema.sql.'
    );
  }
  if (!sql || !sql.trim()) {
    throw new Error(
      `Template SQL file at "${templatePath}" is empty. Export schema/data from your template DB before creating schools.`
    );
  }
  cachedTemplateSql = sql;
  return cachedTemplateSql;
}

async function createTenantDatabase(dbName) {
  const pool = getAdminPool();
  const checkRes = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (checkRes.rowCount > 0) {
    throw new Error(`Database "${dbName}" already exists`);
  }

  // 1) Create an empty tenant database (no TEMPLATE dependency).
  try {
    await pool.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    throw new Error(`Failed to create tenant database "${dbName}": ${err.message}`);
  }

  // 2) Connect to the new DB and import schema/reference data from template_schema.sql.
  const tenantPool = createPoolForTenantDb(dbName);
  try {
    const templateSql = getTemplateSql();
    await tenantPool.query('BEGIN');
    await tenantPool.query(templateSql);

    const tableCheck = await tenantPool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`
    );
    if (!tableCheck.rows || tableCheck.rows.length === 0) {
      throw new Error(
        'Template import did not create required tables (e.g. users). Ensure template_schema.sql contains full schema.'
      );
    }

    await tenantPool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await tenantPool.query('COMMIT');
  } catch (err) {
    await tenantPool.query('ROLLBACK').catch(() => {});
    // Best-effort cleanup of half-created tenant DB.
    try {
      await pool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
      );
    } catch { /* ignore */ }
    try {
      await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } catch { /* ignore */ }
    throw new Error(
      `Failed to provision tenant database "${dbName}" from template_schema.sql: ${err.message}`
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

