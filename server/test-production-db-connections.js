/**
 * Production DB connectivity check for multi-tenant setup.
 *
 * It tests:
 * - Primary DB connection (school_db via DATABASE_URL or DB_* env)
 * - master_db connection (MASTER_DATABASE_URL if set; else DATABASE_URL derived db_name=master_db)
 * - Millat DB override (MILLAT_DATABASE_URL) if set
 * - Iqra DB override (IQRA_DATABASE_URL) if set
 *
 * Run in production environment (Render shell / server):
 *   node test-production-db-connections.js
 */

require('dotenv').config();

const { Pool } = require('pg');

function shouldUseSsl(connectionString) {
  if (process.env.FORCE_DB_SSL === 'true') return true;
  if (!connectionString) return false;
  try {
    const u = new URL(connectionString);
    const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (sslmode === 'require' || sslmode === 'verify-full' || sslmode === 'verify-ca') return true;
  } catch {
    // ignore parse errors; fall back below
  }
  return process.env.NODE_ENV === 'production';
}

function getSslConfig(connectionString) {
  if (!shouldUseSsl(connectionString)) return undefined;
  // Neon typically needs sslmode=require; rejectUnauthorized=false works for most managed DBs.
  // If you want strict verification, set DATABASE_SSL_MODE=require.
  if (process.env.DATABASE_SSL_MODE === 'require') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function makePoolFromUrl(url, label) {
  return new Pool({
    connectionString: url,
    ssl: getSslConfig(url),
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '20000', 10),
    application_name: `myschool-conncheck-${label}`,
  });
}

function deriveDbUrl(dbName) {
  if (!process.env.DATABASE_URL) return null;
  const u = new URL(process.env.DATABASE_URL);
  u.pathname = `/${dbName}`;
  return u.toString();
}

async function testOne(label, pool) {
  const started = Date.now();
  try {
    const r = await pool.query('SELECT current_database() AS db, current_user AS usr, NOW() AS now');
    const ms = Date.now() - started;
    console.log(`✅ ${label}: OK (${ms}ms) -> db=${r.rows[0].db} user=${r.rows[0].usr}`);
    return true;
  } catch (e) {
    const ms = Date.now() - started;
    console.error(`❌ ${label}: FAILED (${ms}ms) -> ${e.message}`);
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  console.log('=== Production DB Connection Check ===');

  const tests = [];

  // Primary DB
  if (process.env.DATABASE_URL) {
    tests.push(
      testOne('Primary (DATABASE_URL)', makePoolFromUrl(process.env.DATABASE_URL, 'primary'))
    );
  } else {
    // Fallback for environments using DB_* instead of DATABASE_URL
    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
    if (DB_HOST && DB_PORT && DB_NAME && DB_USER) {
      const pool = new Pool({
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        ssl: undefined, // local DB_* usually does not use SSL; use FORCE_DB_SSL=true to override
        max: 2,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 5000,
        application_name: 'myschool-conncheck-primary',
      });
      tests.push(testOne('Primary (DB_*)', pool));
    } else {
      console.warn('⚠️  Skipping Primary check: DATABASE_URL and DB_* are not set');
    }
  }

  // master_db (MASTER_DATABASE_URL or derived from DATABASE_URL)
  if (process.env.MASTER_DATABASE_URL) {
    tests.push(testOne('Master (MASTER_DATABASE_URL)', makePoolFromUrl(process.env.MASTER_DATABASE_URL, 'master')));
  } else {
    const masterUrl = deriveDbUrl(process.env.MASTER_DB_NAME || 'master_db');
    if (masterUrl) {
      tests.push(testOne('Master (derived master_db)', makePoolFromUrl(masterUrl, 'master')));
    } else {
      console.warn('⚠️  Skipping Master check: MASTER_DATABASE_URL and DATABASE_URL not set');
    }
  }

  // Millat override
  if (process.env.MILLAT_DATABASE_URL) {
    tests.push(testOne('Millat (MILLAT_DATABASE_URL)', makePoolFromUrl(process.env.MILLAT_DATABASE_URL, 'millat')));
  } else {
    console.warn('⚠️  MILLAT_DATABASE_URL not set (Millat will use default routing)');
  }

  // Iqra override
  if (process.env.IQRA_DATABASE_URL) {
    tests.push(testOne('Iqra (IQRA_DATABASE_URL)', makePoolFromUrl(process.env.IQRA_DATABASE_URL, 'iqra')));
  } else {
    console.warn('⚠️  IQRA_DATABASE_URL not set (Iqra will use default routing)');
  }

  const results = await Promise.all(tests);
  const ok = results.every(Boolean);
  console.log(`\n=== Result: ${ok ? 'ALL OK' : 'SOME FAILED'} ===`);
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => {
  console.error('❌ Unexpected failure:', e);
  process.exit(1);
});

