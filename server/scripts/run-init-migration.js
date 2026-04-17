/**
 * Applies 001_init_full_schema.sql: master DDL on master_db, tenant DDL (incl. COPY) on tenant DB.
 * pgAdmin cannot run COPY stdin blocks; use this script or psql.
 *
 * Env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, MASTER_DB_NAME (default master_db),
 * TENANT_INIT_DB_NAME (default DB_NAME or school_db), or MASTER_DATABASE_URL / TENANT_INIT_DATABASE_URL.
 *
 *   npm run db:init
 *   node scripts/run-init-migration.js --verify-only
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { Pool } = require('pg');
const { splitSqlStatements } = require('../src/services/tenantProvisioningService');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'migrations', '001_init_full_schema.sql');
// Must not appear in header comments (file used to mention this text in line 15).
const MARKER = '\n-- ##############################################################################\n-- === TENANT_SCHEMA_BEGIN ===\n';

let sslConfig = { rejectUnauthorized: false };
if (process.env.DATABASE_SSL_MODE === 'require') {
  sslConfig = { rejectUnauthorized: true };
}

function makeLocalPool(database) {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database,
    max: 5,
    ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : false,
  });
}

async function ensureDatabaseExists(adminPool, dbName) {
  const r = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (r.rowCount > 0) return;
  await adminPool.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  console.log(`Created database "${dbName}"`);
}

/** Drop + recreate empty DB (local admin only). Needed after a failed partial tenant import. */
async function resetTenantDatabase(adminPool, dbName) {
  const safe = dbName.replace(/"/g, '""');
  await adminPool.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName]
  );
  await adminPool.query(`DROP DATABASE IF EXISTS "${safe}"`);
  await adminPool.query(`CREATE DATABASE "${safe}"`);
  console.log(`Recreated empty tenant database "${dbName}"`);
}

function splitMigrationFile(text) {
  // Normalize line endings to LF for reliable splitting
  const normalizedText = text.replace(/\r\n/g, '\n');
  
  // Look for the specific banner block regardless of exact surrounding newlines
  const markerPattern = /-- ##############################################################################\n-- === TENANT_SCHEMA_BEGIN ===\n/;
  const match = normalizedText.match(markerPattern);
  
  if (!match) {
    throw new Error(`Migration file missing marker block:\n-- ##############################################################################\n-- === TENANT_SCHEMA_BEGIN ===`);
  }
  
  const idx = match.index;
  const master = normalizedText.slice(0, idx).trim();
  const tenant = normalizedText.slice(idx + match[0].length).trim();
  return { master, tenant };
}

async function runMasterStatements(pool, sql) {
  const stmts = splitSqlStatements(sql);
  let n = 0;
  for (const s of stmts) {
    if (!s || /^\s*\\/.test(s)) continue;
    await pool.query(s);
    n += 1;
  }
  console.log(`Master: executed ${n} statement(s)`);
}

function findPsqlExecutable() {
  const explicit = (process.env.PSQL_PATH || '').trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return 'psql';
  } catch {
    /* ignore */
  }

  if (process.platform === 'win32') {
    for (let v = 18; v >= 12; v -= 1) {
      const p = `C:\\Program Files\\PostgreSQL\\${v}\\bin\\psql.exe`;
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * pg_dump COPY ... FROM stdin blocks are not supported by node-pg simple queries (server
 * parses the semicolon after stdin as end of statement). psql -f runs the file correctly.
 */
function runTenantSqlWithPsql(tenantSql, opts) {
  const psql = findPsqlExecutable();
  if (!psql) {
    throw new Error(
      'PostgreSQL client "psql" not found. The tenant migration uses COPY ... FROM stdin; ' +
        'that only works with psql (not node-pg / pgAdmin).\n' +
        'Fix: install PostgreSQL, add bin to PATH, or set PSQL_PATH to psql.exe, e.g.\n' +
        '  C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
    );
  }

  const tmp = path.join(os.tmpdir(), `myschool-tenant-init-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tmp, tenantSql, 'utf8');
  const env = { ...process.env };
  try {
    if (opts.password != null && opts.password !== '') env.PGPASSWORD = opts.password;
    if (opts.ssl) env.PGSSLMODE = env.PGSSLMODE || 'require';

    if (opts.connectionString) {
      execFileSync(psql, [opts.connectionString, '-v', 'ON_ERROR_STOP=1', '-f', tmp], {
        stdio: 'inherit',
        env,
      });
    } else {
      execFileSync(
        psql,
        [
          '-h',
          opts.host,
          '-p',
          String(opts.port),
          '-U',
          opts.user,
          '-d',
          opts.database,
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          tmp,
        ],
        { stdio: 'inherit', env }
      );
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }

  console.log(`Tenant: applied via "${psql}" (COPY stdin)`);
}

async function main() {
  const verifyOnly = process.argv.includes('--verify-only');
  const resetTenant =
    process.argv.includes('--reset-tenant') ||
    String(process.env.DB_INIT_RESET_TENANT || '').toLowerCase() === 'true';
  const masterDbName = (process.env.MASTER_DB_NAME || 'master_db').trim();
  const tenantDbName = (
    process.env.TENANT_INIT_DATABASE_URL ? '' : process.env.TENANT_INIT_DB_NAME || process.env.DB_NAME || 'school_db'
  ).trim();

  const raw = fs.readFileSync(migrationPath, 'utf8');
  const { master, tenant } = splitMigrationFile(raw);

  const masterUrl = (process.env.MASTER_DATABASE_URL || '').trim();
  const tenantInitUrl = (process.env.TENANT_INIT_DATABASE_URL || '').trim();

  let masterPool;
  if (masterUrl) {
    masterPool = new Pool({ connectionString: masterUrl, ssl: sslConfig, max: 5 });
  } else {
    const admin = makeLocalPool('postgres');
    try {
      await ensureDatabaseExists(admin, masterDbName);
    } finally {
      await admin.end();
    }
    masterPool = makeLocalPool(masterDbName);
  }

  try {
    if (!verifyOnly) {
      await runMasterStatements(masterPool, master);
    }
    for (const t of ['schools', 'super_admin_users', 'tenant_sessions', 'super_admin_audit_log']) {
      const q = await masterPool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [t]
      );
      console.log(`  master.${t}: ${q.rowCount > 0 ? 'OK' : 'MISSING'}`);
    }
  } finally {
    await masterPool.end();
  }

  let tenantPool;
  if (tenantInitUrl) {
    if (resetTenant && !verifyOnly) {
      console.warn(
        '[db:init] --reset-tenant ignored when TENANT_INIT_DATABASE_URL is set (drop DB in host console).'
      );
    }
    tenantPool = new Pool({ connectionString: tenantInitUrl, ssl: sslConfig, max: 5 });
  } else {
    const admin = makeLocalPool('postgres');
    try {
      if (resetTenant && !verifyOnly) {
        await resetTenantDatabase(admin, tenantDbName);
      } else {
        await ensureDatabaseExists(admin, tenantDbName);
      }
    } finally {
      await admin.end();
    }
    tenantPool = makeLocalPool(tenantDbName);
  }

  try {
    if (!verifyOnly) {
      const useSsl = process.env.DATABASE_SSL_MODE === 'require';
      if (tenantInitUrl) {
        runTenantSqlWithPsql(tenant, { connectionString: tenantInitUrl, ssl: useSsl });
      } else {
        runTenantSqlWithPsql(tenant, {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || '',
          database: tenantDbName,
          ssl: useSsl,
        });
      }
    }
    for (const t of ['users', 'students', 'classes', 'attendance', 'fee_collections', 'school_profile']) {
      const q = await tenantPool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [t]
      );
      console.log(`  tenant.${t}: ${q.rowCount > 0 ? 'OK' : 'MISSING'}`);
    }
  } finally {
    await tenantPool.end();
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
