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
 * Split pg_dump plain SQL into single statements, respecting dollar-quoting and string literals.
 * Running one statement at a time avoids "syntax error at or near ..." when the full dump
 * is sent as a single query (e.g. escaping/parsing issues with node-pg).
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  const n = sql.length;
  const pushStatement = (s) => {
    const t = s.trim();
    if (t && !t.startsWith('--')) statements.push(t);
  };

  while (i < n) {
    const rest = sql.slice(i);
    if (rest[0] === "'") {
      current += rest[0];
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''";
          i += 2;
        } else if (sql[i] === "'") {
          current += "'";
          i++;
          break;
        } else {
          current += sql[i];
          i++;
        }
      }
      continue;
    }
    if (rest[0] === '"') {
      current += rest[0];
      i++;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          current += '""';
          i += 2;
        } else if (sql[i] === '"') {
          current += '"';
          i++;
          break;
        } else {
          current += sql[i];
          i++;
        }
      }
      continue;
    }
    if (rest[0] === '$') {
      const tagMatch = rest.match(/^\$([a-zA-Z0-9_]*)\$/);
      if (tagMatch) {
        const open = tagMatch[0]; // e.g. $$ or $body$
        current += open;
        i += open.length;
        const closeIdx = sql.indexOf(open, i);
        if (closeIdx === -1) {
          current += sql.slice(i);
          i = n;
        } else {
          current += sql.slice(i, closeIdx + open.length);
          i = closeIdx + open.length;
        }
        continue;
      }
    }
    if (rest.match(/^;\s*\n/) || (rest[0] === ';' && (i + 1 >= n || /[\r\n\s]/.test(sql[i + 1])))) {
      pushStatement(current);
      current = '';
      i++;
      while (i < n && /[\r\n\t ]/.test(sql[i])) i++;
      continue;
    }
    current += sql[i];
    i++;
  }
  if (current.trim()) pushStatement(current);
  return statements;
}

/**
 * Restore dump file using psql (when available). Handles multi-statement dumps and escaping correctly.
 */
function restoreViaPsql(targetUrl, tmpFile) {
  return new Promise((resolve, reject) => {
    const psql = spawn(
      'psql',
      ['-d', targetUrl, '-f', tmpFile, '-v', 'ON_ERROR_STOP=1', '--set', 'ON_ERROR_STOP=on'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    let stdout = '';
    psql.stdout?.on('data', (c) => { stdout += c.toString(); });
    psql.stderr?.on('data', (c) => { stderr += c.toString(); });
    psql.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql restore failed (${code}): ${stderr || stdout}`));
    });
    psql.on('error', (err) => {
      if (err.code === 'ENOENT') reject(new Error('psql not found; install postgresql-client or use Docker image with psql'));
      else reject(err);
    });
  });
}

/**
 * Clone schema using pg_dump (plain format) then restore.
 * Prefers psql for restore (correct handling of all escaping). Falls back to executing
 * statements one-by-one via node-pg to avoid "syntax error at or near ..." when sending
 * the entire dump as a single query.
 */
async function cloneViaDumpRestore(sourceDbName, targetDbName) {
  const RESTORE_TIMEOUT_MS = parseInt(process.env.PROVISIONING_RESTORE_TIMEOUT_MS || '300000', 10); // 5 min default (Neon + statement-by-statement can be slow)
  const DUMP_TIMEOUT_MS = parseInt(process.env.PROVISIONING_DUMP_TIMEOUT_MS || '120000', 10); // 2 min for pg_dump

  const tryDump = async (useAlternate) => {
    const sourceUrl = getDumpSourceUrl(sourceDbName, useAlternate);
    if (!sourceUrl) throw new Error('PROVISIONING_SOURCE_DATABASE_URL or TENANT_ADMIN_DATABASE_URL required');
    const tmpFile = path.join(os.tmpdir(), `tenant_clone_${targetDbName}_${Date.now()}.sql`);
    await Promise.race([
      new Promise((resolve, reject) => {
        const pd = spawn(
          'pg_dump',
          ['-d', sourceUrl, '--no-owner', '--no-privileges', '--format=plain', '--inserts', '-f', tmpFile],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        let stderr = '';
        pd.stderr?.on('data', (c) => { stderr += c.toString(); });
        pd.on('close', (code) => {
          if (code === 0) resolve(tmpFile);
          else reject(new Error(`pg_dump failed (${code}): ${stderr}`));
        });
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('pg_dump timed out. Use PROVISIONING_SOURCE_DATABASE_URL with Neon DIRECT endpoint (no -pooler).')), DUMP_TIMEOUT_MS)
      ),
    ]);
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

    const dumpSql = fs.readFileSync(tmpFile, 'utf8');
    if (!dumpSql || !dumpSql.trim()) {
      throw new Error('pg_dump produced empty output');
    }

    const targetUrl = getConnectionStringForDb(targetDbName);
    const restoreMinutes = Math.round(RESTORE_TIMEOUT_MS / 60000);
    const restoreWithTimeout = (fn) =>
      Promise.race([
        fn(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error(`Restore timed out after ${restoreMinutes} minute(s). Set PROVISIONING_RESTORE_TIMEOUT_MS (e.g. 600000 for 10 min) or use Neon DIRECT endpoint in PROVISIONING_SOURCE_DATABASE_URL.`)), RESTORE_TIMEOUT_MS)
        ),
      ]);

    if (targetUrl) {
      try {
        await restoreWithTimeout(() => restoreViaPsql(targetUrl, tmpFile));
        return;
      } catch (psqlErr) {
        if (psqlErr.message && psqlErr.message.includes('psql not found')) {
          console.warn('psql not found, falling back to statement-by-statement restore');
        } else {
          throw psqlErr;
        }
      }
    }

    const targetPool = createPoolForTenantDb(targetDbName);
    const BATCH_SIZE = 25; // Run multiple statements per round-trip to speed up restore
    try {
      const client = await targetPool.connect();
      try {
        const statements = splitSqlStatements(dumpSql).filter((s) => s.trim());
        for (let i = 0; i < statements.length; i += BATCH_SIZE) {
          const batch = statements.slice(i, i + BATCH_SIZE);
          const batchSql = batch.join(';\n') + (batch.length ? ';' : '');
          try {
            await client.query(batchSql);
          } catch (batchErr) {
            const firstStmt = batch[0] || '';
            throw new Error(`Restore batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${batchErr.message}. First statement (200 chars): ${firstStmt.slice(0, 200)}...`);
          }
        }
      } finally {
        client.release();
      }
    } finally {
      await targetPool.end();
    }
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
    const tableCheck = await tenantPool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`
    );
    if (!tableCheck.rows || tableCheck.rows.length === 0) {
      throw new Error('relation "users" does not exist (schema restore did not create required tables)');
    }
    await tenantPool.query('BEGIN');
    await tenantPool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await tenantPool.query('COMMIT');
  } catch (err) {
    await tenantPool.query('ROLLBACK').catch(() => {});
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

