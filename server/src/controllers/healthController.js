const { testConnection } = require('../config/database');
const { Pool } = require('pg');

function shouldUseSsl(connectionString) {
  if (process.env.FORCE_DB_SSL === 'true') return true;
  if (!connectionString) return false;
  try {
    const u = new URL(connectionString);
    const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (sslmode === 'require' || sslmode === 'verify-full' || sslmode === 'verify-ca') return true;
  } catch {
    // ignore
  }
  return process.env.NODE_ENV === 'production';
}

function getSslConfig(connectionString) {
  if (!shouldUseSsl(connectionString)) return undefined;
  if (process.env.DATABASE_SSL_MODE === 'require') return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

async function testDbUrl(label, connectionString) {
  const started = Date.now();
  const pool = new Pool({
    connectionString,
    ssl: getSslConfig(connectionString),
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
    application_name: `myschool-health-${label}`,
  });
  try {
    await pool.query('SELECT 1');
    return {
      ok: true,
      ms: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - started,
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

const healthCheck = async (req, res) =>
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });

const databaseTest = async (req, res) => {
  try {
    const ok = await testConnection();
    return res.status(ok ? 200 : 503).json({
      status: ok ? 'SUCCESS' : 'ERROR',
    });
  } catch (error) {
    console.error('Database test error:', error);
    return res.status(500).json({ status: 'ERROR' });
  }
};

/** Tenant DB probes — no internal hostnames or roles exposed to clients. */
const tenantDatabaseTest = async (req, res) => {
  try {
    const results = {};

    if (process.env.DATABASE_URL) {
      results.primary = await testDbUrl('primary', process.env.DATABASE_URL);
    } else {
      results.primary = { ok: false, ms: 0 };
    }

    if (process.env.MASTER_DATABASE_URL) {
      results.master = await testDbUrl('master', process.env.MASTER_DATABASE_URL);
    } else if (process.env.DATABASE_URL) {
      const u = new URL(process.env.DATABASE_URL);
      u.pathname = `/${process.env.MASTER_DB_NAME || 'master_db'}`;
      results.master = await testDbUrl('master-derived', u.toString());
    } else {
      results.master = { ok: false, ms: 0 };
    }

    if (process.env.MILLAT_DATABASE_URL) {
      results.millat = await testDbUrl('millat', process.env.MILLAT_DATABASE_URL);
    } else {
      results.millat = { ok: false, ms: 0 };
    }

    if (process.env.IQRA_DATABASE_URL) {
      results.iqra = await testDbUrl('iqra', process.env.IQRA_DATABASE_URL);
    } else {
      results.iqra = { ok: false, ms: 0 };
    }

    const allOk = Object.values(results).every((r) => r && r.ok === true);
    const publicShape = {};
    for (const [k, v] of Object.entries(results)) {
      publicShape[k] = { ok: !!(v && v.ok), ms: v && typeof v.ms === 'number' ? v.ms : undefined };
    }
    return res.status(allOk ? 200 : 500).json({
      status: allOk ? 'SUCCESS' : 'ERROR',
      data: publicShape,
    });
  } catch (error) {
    console.error('Tenant DB test error:', error);
    return res.status(500).json({ status: 'ERROR' });
  }
};

module.exports = {
  healthCheck,
  databaseTest,
  tenantDatabaseTest,
};
