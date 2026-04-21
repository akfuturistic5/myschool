const { Pool } = require('pg');
const { from: copyFrom } = require('pg-copy-streams');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pipeline, finished } = require('stream/promises');
const { Readable } = require('stream');
require('dotenv').config();

/** Application root (the `server` folder that contains `sql/`). */
const SERVER_APP_ROOT = path.resolve(__dirname, '../..');

// Default: create empty DB + import template_schema.sql (batched queries for fewer round-trips).
// Optional fast path (production): PROVISIONING_USE_DB_TEMPLATE_CLONE=true + PROVISIONING_TEMPLATE_DB_NAME
// uses CREATE DATABASE ... TEMPLATE on Neon when a dedicated template DB is maintained.

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
/** DB name from TENANT_ADMIN_DATABASE_URL / DATABASE_URL (for clone safety checks). */
function getAdminUrlDatabaseName() {
  const adminUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  if (!adminUrl) return '';
  try {
    const u = new URL(adminUrl);
    return (u.pathname || '/').replace(/^\//, '').split('?')[0].trim();
  } catch {
    return '';
  }
}

/**
 * When true, new tenants are created with CREATE DATABASE ... TEMPLATE (fast on Neon).
 * Requires PROVISIONING_TEMPLATE_DB_NAME pointing to a dedicated DB (e.g. school_template), not the app DB.
 */
function shouldUseTemplateDbClone() {
  if (String(process.env.PROVISIONING_USE_DB_TEMPLATE_CLONE || '').toLowerCase() !== 'true') {
    return false;
  }
  const tpl = (process.env.PROVISIONING_TEMPLATE_DB_NAME || '').toString().trim();
  if (!tpl) {
    console.warn(
      '[provisioning] PROVISIONING_USE_DB_TEMPLATE_CLONE=true needs PROVISIONING_TEMPLATE_DB_NAME (e.g. school_template); using SQL file import instead.'
    );
    return false;
  }
  const adminDb = getAdminUrlDatabaseName();
  if (adminDb && tpl.toLowerCase() === adminDb.toLowerCase()) {
    console.warn(
      `[provisioning] Template DB "${tpl}" cannot match the admin connection database; using SQL file import instead.`
    );
    return false;
  }
  return true;
}

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

  // Use a DB the app user can already access (same as master registry). Connecting only to
  // `postgres` breaks common local setups where the app role has CONNECT on school/master DBs but not on postgres.
  const localAdminDb =
    (process.env.PROVISIONING_ADMIN_DATABASE_NAME || '').toString().trim() ||
    (process.env.MASTER_DB_NAME || 'master_db').toString().trim() ||
    (process.env.DB_NAME || '').toString().trim() ||
    'postgres';

  adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: localAdminDb,
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
  const attachTenantPoolHandlers = (pool) => {
    pool.on('error', (err) => {
      // Avoid crashing the process when Neon or admin commands terminate
      // tenant connections (e.g. error code 57P01).
      console.error(`Unexpected tenant database error for "${dbName}":`, err);
    });
    return pool;
  };

  const baseUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  if (baseUrl) {
    try {
      const u = new URL(baseUrl);
      u.pathname = `/${dbName}`;
      return attachTenantPoolHandlers(new Pool({
        connectionString: u.toString(),
        ssl: sslConfig,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }));
    } catch {
      /* fall through to local config */
    }
  }
  return attachTenantPoolHandlers(new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  }));
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
 * Must be unique vs existingDbNames (include soft-deleted schools — db_name stays unique in master).
 */
function generateTenantDbName(schoolName, instituteNumber, existingDbNames = []) {
  const institute = String(instituteNumber || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  const fallback = `school_${institute || 'school'}`;

  const slug = slugFromSchoolName(schoolName);
  const taken = new Set(
    (existingDbNames || []).map((d) => String(d || '').trim().toLowerCase()).filter(Boolean)
  );

  const tryName = (raw) => {
    const n = String(raw || '').trim().slice(0, 63);
    return n && !taken.has(n.toLowerCase()) ? n : null;
  };

  if (slug) {
    let candidate = tryName(`${slug}_db`);
    if (candidate) return candidate;

    if (institute) {
      candidate = tryName(`${slug}_${institute}_db`);
      if (candidate) return candidate;
    }
  }

  let candidate = tryName(fallback);
  if (candidate) return candidate;

  const baseForSuffix = slug && institute ? `${slug}_${institute}` : slug || `school_${institute || 't'}`;
  for (let n = 2; n < 10000; n += 1) {
    candidate = tryName(`${baseForSuffix}_${n}_db`);
    if (candidate) return candidate;
  }

  return tryName(`t_${Date.now()}_db`) || `t_${Date.now()}`.slice(0, 63);
}

/**
 * Ensures required default rows exist in public.user_roles for a newly provisioned tenant.
 * Template schema is schema-only (no data), so user_roles is empty and Headmaster creation would fail.
 * We insert the 'admin' role (and other roles the app expects) if missing. Safe to run idempotently.
 */
async function ensureTenantDefaultRoles(pool) {
  await pool.query(`
    INSERT INTO public.user_roles (role_name, description, is_active)
    SELECT 'admin', 'Administrator', true
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE LOWER(role_name) = 'admin');
  `);
  await pool.query(`
    INSERT INTO public.user_roles (role_name, description, is_active)
    SELECT 'teacher', 'Teacher', true
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE LOWER(role_name) = 'teacher');
  `);
  await pool.query(`
    INSERT INTO public.user_roles (role_name, description, is_active)
    SELECT 'student', 'Student', true
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE LOWER(role_name) = 'student');
  `);
}

// Lazy-loaded SQL template for tenant provisioning. Kept in memory after first read.
let cachedTemplateSql = null;
const DISALLOWED_SQL_PATTERNS = [
  // Block server-side shell via COPY only when PROGRAM is the PostgreSQL clause (not e.g. "Program" in COPY data).
  /\bCOPY\b[\s\S]*?\bFROM\s+PROGRAM\b/i,
  /\bCOPY\b[\s\S]*?\bTO\s+PROGRAM\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bCREATE\s+ROLE\b/i,
  /\bALTER\s+ROLE\b/i,
  /\bDROP\s+ROLE\b/i,
  /\bCREATE\s+DATABASE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bDO\s+\$\$/i,
];

/**
 * Split dump SQL into statements for sequential pool.query().
 * Naive split on ";\n" breaks:
 * 1) PL/pgSQL / function bodies ($$ ... $$) — semicolons inside are not terminators.
 * 2) COPY ... FROM stdin — data lines until "\." must stay one statement with the COPY line.
 */
function splitSqlStatements(sqlText) {
  const statements = [];
  const len = sqlText.length;
  let i = 0;
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  let dollarTag = null;
  let inLineComment = false;
  let inBlockComment = false;
  let inCopyStdin = false;

  const pushRange = (endExclusive) => {
    const s = sqlText.slice(start, endExclusive).trim();
    if (s) statements.push(s);
    start = endExclusive;
  };

  while (i < len) {
    const c = sqlText[i];
    const c2 = i + 1 < len ? sqlText[i + 1] : '';

    if (inCopyStdin) {
      if (c === '\\' && c2 === '.') {
        const atLineStart = i === 0 || sqlText[i - 1] === '\n' || sqlText[i - 1] === '\r';
        if (atLineStart) {
          let j = i + 2;
          while (j < len && sqlText[j] !== '\n' && sqlText[j] !== '\r') j += 1;
          if (j < len && sqlText[j] === '\r') j += 1;
          if (j < len && sqlText[j] === '\n') j += 1;
          i = j;
          pushRange(i);
          inCopyStdin = false;
          continue;
        }
      }
      i += 1;
      continue;
    }

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && c2 === '/') {
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }

    if (dollarTag !== null) {
      if (sqlText.startsWith(dollarTag, i)) {
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i += 1;
      continue;
    }

    if (inSingle) {
      if (c === "'" && c2 === "'") {
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      i += 1;
      continue;
    }
    if (inDouble) {
      if (c === '"' && c2 === '"') {
        i += 2;
        continue;
      }
      if (c === '"') inDouble = false;
      i += 1;
      continue;
    }

    if (c === '-' && c2 === '-') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (c === '/' && c2 === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (c === "'") {
      inSingle = true;
      i += 1;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      i += 1;
      continue;
    }

    if (c === '$') {
      const rest = sqlText.slice(i);
      const m = rest.match(/^\$([a-zA-Z_0-9]*)\$/);
      if (m) {
        dollarTag = m[0];
        i += dollarTag.length;
        continue;
      }
    }

    if (c === ';') {
      const after = sqlText.slice(i + 1);
      const atStmtBoundary = after.length === 0 || /^\s/.test(after);
      if (atStmtBoundary) {
        const stmtSoFar = sqlText.slice(start, i + 1);
        if (/COPY[\s\S]+FROM\s+stdin\s*;/i.test(stmtSoFar)) {
          inCopyStdin = true;
          i += 1;
          continue;
        }
        i += 1;
        while (i < len && /\s/.test(sqlText[i])) i += 1;
        pushRange(i);
        continue;
      }
    }

    i += 1;
  }

  const tail = sqlText.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function validateTemplateSql(sqlText) {
  for (const pattern of DISALLOWED_SQL_PATTERNS) {
    if (pattern.test(sqlText)) {
      throw new Error(`Template SQL contains disallowed statement pattern: ${pattern}`);
    }
  }
}

// Same template string is reused for every school; splitting is CPU-heavy on a 7k+ line dump.
let cachedTemplateSqlRef = null;
let cachedSplitStatements = null;

function getSplitTemplateStatements(sqlText) {
  if (cachedTemplateSqlRef === sqlText && cachedSplitStatements) {
    return cachedSplitStatements;
  }
  cachedTemplateSqlRef = sqlText;
  cachedSplitStatements = splitSqlStatements(sqlText);
  return cachedSplitStatements;
}

/**
 * pg_dump uses "COPY ... FROM stdin;" plus text rows and "\\." — that is valid in psql but
 * not when sent through node-pg's query(): the semicolon ends the command and data rows are
 * parsed as SQL ("syntax error at or near ..."). Split header vs data and stream via COPY protocol.
 */
function parseCopyStdinBlock(stmt) {
  const normalized = String(stmt || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trimEnd();
  const lines = normalized.split('\n');
  let dotIdx = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^[ \t]*\\\.\s*$/.test(lines[i])) {
      dotIdx = i;
      break;
    }
  }
  if (dotIdx < 0) {
    throw new Error(
      'Malformed COPY ... FROM stdin block: missing pg_dump terminator line (\\.).'
    );
  }
  const beforeDot = lines.slice(0, dotIdx).join('\n');
  const headerMatch = beforeDot.match(/^([\s\S]*?\bFROM\s+stdin\s*;)/i);
  if (!headerMatch) {
    throw new Error('Malformed COPY ... FROM stdin block: missing "FROM stdin;".');
  }
  const preamble = headerMatch[1];
  let header = extractCopyCommandSql(preamble);
  if (header.endsWith(';')) {
    header = header.slice(0, -1).trimEnd();
  }
  let data = beforeDot.slice(headerMatch[0].length);
  if (data.startsWith('\n')) data = data.slice(1);
  return { header, data };
}

/**
 * pg-copy-streams sends the SQL as the COPY statement only. Leading pg_dump "--" comments
 * must not be bundled with COPY or the server can mis-handle the copy stream (e.g. missing columns).
 */
function extractCopyCommandSql(preamble) {
  const lines = String(preamble || '').split('\n');
  const buf = [];
  let seenCopy = false;
  for (const line of lines) {
    if (/^\s*COPY\b/i.test(line)) seenCopy = true;
    if (seenCopy) {
      buf.push(line);
      if (/FROM\s+stdin\s*;\s*$/i.test(line)) break;
    }
  }
  if (!buf.length) {
    throw new Error('COPY ... FROM stdin; line not found in pg_dump block');
  }
  return buf.join('\n').trim();
}

async function executeCopyStdinStatement(pool, stmt) {
  const { header, data } = parseCopyStdinBlock(stmt);
  const client = await pool.connect();
  try {
    const stream = client.query(copyFrom(header));
    if (data && data.length > 0) {
      const readable = Readable.from([Buffer.from(data, 'utf8')]);
      await pipeline(readable, stream);
    } else {
      stream.end();
      await finished(stream);
    }
  } finally {
    client.release();
  }
}

/**
 * Run template SQL with fewer round-trips to the DB (critical on Neon / remote Postgres).
 * Batches small statements into one query (PostgreSQL simple-query multi-statement).
 * Large COPY / data blocks are always sent alone. Semantics and transaction unchanged.
 *
 * Escape hatch: PROVISIONING_SQL_BATCH_SIZE=1 restores one-statement-per-query behaviour.
 */
async function executeTemplateStatements(pool, sqlText) {
  const statements = getSplitTemplateStatements(sqlText);
  const batchSize = Math.max(
    1,
    parseInt(process.env.PROVISIONING_SQL_BATCH_SIZE || '96', 10) || 96
  );
  const largeStmtChars = Math.max(
    65536,
    parseInt(process.env.PROVISIONING_SQL_LARGE_STMT_CHARS || String(384 * 1024), 10) || 393216
  );
  const maxBatchChars = Math.max(
    largeStmtChars,
    parseInt(process.env.PROVISIONING_SQL_BATCH_MAX_CHARS || String(900 * 1024), 10) || 921600
  );

  let batch = [];
  let batchChars = 0;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    const text = batch.join('\n');
    batch = [];
    batchChars = 0;
    await pool.query(text);
  };

  for (const stmt of statements) {
    if (!stmt) continue;

    // COPY ... FROM stdin must be the only command in a simple query; never batch with other statements.
    const isCopyStdin = /\bCOPY\b[\s\S]*\bFROM\s+stdin\s*;/i.test(stmt);

    if (isCopyStdin) {
      await flushBatch();
      await executeCopyStdinStatement(pool, stmt);
      continue;
    }

    if (stmt.length >= largeStmtChars) {
      await flushBatch();
      await pool.query(stmt);
      continue;
    }

    if (batch.length > 0 && batchChars + stmt.length > maxBatchChars) {
      await flushBatch();
    }

    batch.push(stmt);
    batchChars += stmt.length;

    if (batch.length >= batchSize) {
      await flushBatch();
    }
  }

  await flushBatch();
}

function resolveProvisioningTemplatePath() {
  const configured = (process.env.PROVISIONING_TEMPLATE_SQL_PATH || '').toString().trim();
  const resolved = path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(SERVER_APP_ROOT, configured || 'sql/template_schema.sql');
  const rel = path.relative(SERVER_APP_ROOT, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Provisioning template path must be inside the server application directory');
  }
  return resolved;
}

function getTemplateSql() {
  if (cachedTemplateSql) return cachedTemplateSql;
  const templatePath = resolveProvisioningTemplatePath();
  let sql;
  try {
    sql = fs.readFileSync(templatePath, 'utf8');
  } catch (e) {
    console.error('[provisioning] template read failed:', e.message);
    throw new Error(
      'Template SQL file could not be read. Set PROVISIONING_TEMPLATE_SQL_PATH or place template at server/sql/template_schema.sql'
    );
  }
  if (!sql || !sql.trim()) {
    throw new Error('Template SQL file is empty');
  }

  // Git stores LF; Windows checkouts often use CRLF. Hash must match logical content, not raw bytes,
  // or production (Linux) and local (CRLF) disagree and PROVISIONING_TEMPLATE_SQL_SHA256 always fails.
  sql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const expectedSha = (process.env.PROVISIONING_TEMPLATE_SQL_SHA256 || '').toString().trim().toLowerCase();
  const requireChecksum = String(process.env.PROVISIONING_REQUIRE_TEMPLATE_CHECKSUM || '').toLowerCase() === 'true';
  const actualSha = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');

  if (expectedSha) {
    if (actualSha !== expectedSha) {
      console.error(
        '[provisioning] template SQL SHA256 mismatch (expected env vs normalized file). ' +
          `actual=${actualSha} — run: npm run provisioning:template-hash — then set PROVISIONING_TEMPLATE_SQL_SHA256 on the host.`
      );
      throw new Error(
        'Template SQL integrity check failed: PROVISIONING_TEMPLATE_SQL_SHA256 does not match template (or template was edited). ' +
          `Update the env var to ${actualSha} after verifying the file, or remove PROVISIONING_TEMPLATE_SQL_SHA256 to skip check (not recommended).`
      );
    }
  } else if (requireChecksum) {
    throw new Error('PROVISIONING_TEMPLATE_SQL_SHA256 is required when PROVISIONING_REQUIRE_TEMPLATE_CHECKSUM=true');
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[provisioning] Set PROVISIONING_TEMPLATE_SQL_SHA256 in production for template integrity verification');
  }

  validateTemplateSql(sql);
  cachedTemplateSql = sql;
  return cachedTemplateSql;
}

async function createTenantDatabase(dbName, schoolName = null) {
  const pool = getAdminPool();
  const checkRes = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  const dbAlreadyExists = checkRes.rowCount > 0;
  const useTemplateClone = shouldUseTemplateDbClone();
  const templateDbName = (process.env.PROVISIONING_TEMPLATE_DB_NAME || '').toString().trim();

  if (dbAlreadyExists) {
    // If the database already exists, we treat this as an idempotent
    // provisioning call and simply reuse the existing DB instead of
    // failing the whole Create School flow.
    console.warn(
      `createTenantDatabase: database "${dbName}" already exists, reusing existing database and re-running template import.`
    );
  } else if (useTemplateClone && templateDbName) {
    try {
      await pool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [templateDbName]
      );
      await new Promise((r) => setTimeout(r, 400));
      await pool.query(`CREATE DATABASE "${dbName}" TEMPLATE "${templateDbName}"`);
    } catch (err) {
      throw new Error(
        `Failed to create tenant database "${dbName}" from template "${templateDbName}": ${err.message}. ` +
          'Ensure the template DB exists and is not in use, or set PROVISIONING_USE_DB_TEMPLATE_CLONE=false to use SQL import.'
      );
    }
  } else {
    try {
      await pool.query(`CREATE DATABASE "${dbName}"`);
    } catch (err) {
      throw new Error(`Failed to create tenant database "${dbName}": ${err.message}`);
    }
  }

  // Import from SQL file when we did not clone, or when reusing an existing DB (re-sync schema).
  const usedSqlFileImport = dbAlreadyExists || !useTemplateClone;

  const tenantPool = createPoolForTenantDb(dbName);
  try {
    await tenantPool.query('BEGIN');
    if (usedSqlFileImport) {
      const templateSql = getTemplateSql();
      await executeTemplateStatements(tenantPool, templateSql);
    } else {
      getTemplateSql();
    }

    await ensureTenantDefaultRoles(tenantPool);

    const tableCheck = await tenantPool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`
    );
    if (!tableCheck.rows || tableCheck.rows.length === 0) {
      throw new Error(
        'Template import did not create required tables (e.g. users). Ensure template_schema.sql contains full schema.'
      );
    }

    await tenantPool.query('TRUNCATE TABLE public.users RESTART IDENTITY CASCADE');
    await tenantPool.query(`
      CREATE TABLE IF NOT EXISTS public.school_profile (
        id SERIAL PRIMARY KEY,
        school_name VARCHAR(255) NOT NULL,
        logo_url TEXT NULL,
        phone VARCHAR(30) NULL,
        email VARCHAR(255) NULL,
        fax VARCHAR(30) NULL,
        address TEXT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await tenantPool.query('TRUNCATE TABLE public.school_profile RESTART IDENTITY');
    await tenantPool.query(
      'INSERT INTO public.school_profile (school_name, logo_url) VALUES ($1, NULL)',
      [String(schoolName || '').trim() || 'School']
    );
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
      FROM public.user_roles
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
      INSERT INTO public.users (username, email, password_hash, role_id, first_name, last_name, is_active)
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
        INSERT INTO public.staff (user_id, employee_code, first_name, last_name, is_active)
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
  splitSqlStatements,
  executeTemplateStatements,
};

