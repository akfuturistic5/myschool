const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// Use DATABASE_URL in production (Render)
// Fallback to local config only if DATABASE_URL not present
// Cloud DBs (Render, Heroku, etc.) often use self-signed certs.
// DATABASE_SSL_MODE: "require" = strict cert verification; default = allow self-signed
let sslConfig = { rejectUnauthorized: false };
if (process.env.DATABASE_SSL_MODE === 'require') {
  sslConfig = { rejectUnauthorized: true };
}

const tenantContext = new AsyncLocalStorage();

// Primary: when DATABASE_URL set, use its DB name (e.g. myschool_db_6276 on Render); else DB_NAME
function getPrimaryDbName() {
  const url = (process.env.DATABASE_URL || '').toString().trim();
  if (url) {
    try {
      const u = new URL(url);
      const db = (u.pathname || '/').replace(/^\//, '').split('?')[0].trim();
      if (db) return db;
    } catch { /* ignore */ }
  }
  return process.env.DB_NAME || 'schooldb';
}
const primaryDbName = getPrimaryDbName();
const masterDbName = process.env.MASTER_DB_NAME || 'master_db';

// CRITICAL: Application must never use the template DB (e.g. school_template) as primary.
// Template is only for: CREATE DATABASE new_tenant TEMPLATE school_template during provisioning.
const provisioningTemplateDbName = (process.env.PROVISIONING_TEMPLATE_DB_NAME || '').toString().trim();
if (provisioningTemplateDbName && primaryDbName === provisioningTemplateDbName) {
  console.error(
    `[FATAL] DATABASE_URL (or DB_NAME) must point to the main application database (e.g. neondb), not the template database "${provisioningTemplateDbName}". ` +
    `The template must only be used during provisioning. Set DATABASE_URL to .../neondb and PROVISIONING_TEMPLATE_DB_NAME=${provisioningTemplateDbName} separately.`
  );
  process.exit(1);
}

const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '5', 10);
const baseLocalConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'schooluser',
  password: process.env.DB_PASSWORD || '',
  max: POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const tenantPools = new Map();

const CONNECTION_TIMEOUT_MS = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10);

/**
 * School-specific database overrides.
 * PreSkool (1111) uses school_db in master; DATABASE_URL points to Render.
 * Millat/Iqra use Neon. Enables split: PreSkool on Render, others on Neon.
 */
const SCHOOL_DATABASE_URL_MAP = {
  school_db: 'DATABASE_URL',      // PreSkool on Render (master has 1111 → school_db)
  millat_db: 'MILLAT_DATABASE_URL',
  iqra_db: 'IQRA_DATABASE_URL',
};

function createPoolForDb(dbName) {
  const overrideEnv = SCHOOL_DATABASE_URL_MAP[dbName];
  const overrideUrl = overrideEnv && process.env[overrideEnv];
  if (overrideUrl && typeof overrideUrl === 'string' && overrideUrl.trim()) {
    const pool = new Pool({
      connectionString: overrideUrl.trim(),
      ssl: sslConfig,
      max: POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    });
    attachPoolHandlers(pool, dbName);
    return pool;
  }

  // Dynamically created tenant DBs: school_4444 (legacy), anglo_db, aabid_db (school-name based)
  const tenantBaseUrl = (process.env.TENANT_ADMIN_DATABASE_URL || process.env.MILLAT_DATABASE_URL || process.env.DATABASE_URL || '').toString().trim();
  const isDynamicTenant = /^school_[a-zA-Z0-9_]+$/.test(dbName) || /^[a-z0-9_]+_db$/.test(dbName);
  if (tenantBaseUrl && isDynamicTenant) {
    try {
      const u = new URL(tenantBaseUrl);
      u.pathname = `/${dbName}`;
      const pool = new Pool({
        connectionString: u.toString(),
        ssl: sslConfig,
        max: POOL_MAX,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      });
      attachPoolHandlers(pool, dbName);
      return pool;
    } catch { /* fall through */ }
  }

  const hasDatabaseUrl = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim() !== '';
  if (hasDatabaseUrl) {
    try {
      // For the primary DB, use DATABASE_URL as-is (do not override db name).
      // This is important on platforms like Render where the DB name inside
      // DATABASE_URL is an opaque value (e.g. myschool_db_6276).
      if (dbName === primaryDbName) {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL.trim(),
          ssl: sslConfig,
          max: POOL_MAX,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        });
        attachPoolHandlers(pool, dbName);
        return pool;
      }

      // For non-primary DBs (legacy derived DBs), derive connection string
      // by swapping the database name in DATABASE_URL.
      const url = new URL(process.env.DATABASE_URL);
      url.pathname = `/${dbName}`;
      const connectionString = url.toString();
      const pool = new Pool({
        connectionString,
        ssl: sslConfig,
        max: POOL_MAX,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      });
      attachPoolHandlers(pool, dbName);
      return pool;
    } catch (e) {
      console.error('Failed to parse DATABASE_URL for multi-tenant setup:', e);
      process.exit(1);
    }
  }

  const pool = new Pool({
    ...baseLocalConfig,
    database: dbName,
  });
  attachPoolHandlers(pool, dbName);
  return pool;
}

function attachPoolHandlers(pool, dbName) {
  pool.on('connect', () => {
    if (process.env.NODE_ENV !== 'development') return;
    // Optionally log per-DB connection in development
  });

  pool.on('error', (err) => {
    // Never crash the whole server due to a single pool error.
    // For example, Neon or administrative commands can terminate connections
    // (error code 57P01: terminating connection due to administrator command).
    // Log the error and let pg/pool recreate connections on the next query.
    console.error(`Unexpected database error in pool for "${dbName}":`, err);

    // If needed we could add targeted recovery per error code here, but we
    // intentionally avoid process.exit(...) to keep the API online.
  });
}

// Primary school DB (existing single-tenant DB)
const primaryPool = createPoolForDb(primaryDbName);
tenantPools.set(primaryDbName, primaryPool);

// Master DB for school registry (created separately)
const masterPool = (() => {
  const masterUrl = (process.env.MASTER_DATABASE_URL || '').toString().trim();
  if (masterUrl) {
    const pool = new Pool({
      connectionString: masterUrl,
      ssl: sslConfig,
      max: POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    });
    attachPoolHandlers(pool, masterDbName);
    return pool;
  }
  return createPoolForDb(masterDbName);
})();

function getCurrentTenantDbName() {
  const store = tenantContext.getStore();
  if (store && store.dbName) {
    return store.dbName;
  }
  return primaryDbName;
}

function getTenantPool(dbName) {
  const key = dbName || primaryDbName;
  if (provisioningTemplateDbName && key === provisioningTemplateDbName) {
    throw new Error(
      `Cannot use template database "${key}" as a tenant. No school in master_db.schools should have db_name = PROVISIONING_TEMPLATE_DB_NAME. ` +
      `Template is only used during CREATE DATABASE ... TEMPLATE.`
    );
  }
  if (!tenantPools.has(key)) {
    tenantPools.set(key, createPoolForDb(key));
  }
  return tenantPools.get(key);
}

function getCurrentPool() {
  const dbName = getCurrentTenantDbName();
  return getTenantPool(dbName);
}

const runWithTenant = (dbName, fn) => {
  const effectiveDb = dbName || primaryDbName;
  return tenantContext.run({ dbName: effectiveDb }, fn);
};

const testConnection = async () => {
  try {
    await primaryPool.query('SELECT NOW()');
    console.log(`✅ Primary database connection successful (${primaryDbName})`);
    // Master DB might not exist in very early setups, so treat failure separately
    try {
      await masterPool.query('SELECT NOW()');
      console.log(`✅ Master database connection successful (${masterDbName})`);
    } catch (e) {
      console.warn(`⚠️  Master database "${masterDbName}" not reachable yet. Run init-master-database if needed.`);
    }
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const getClient = async () => {
  const pool = getCurrentPool();
  return await pool.connect();
};

const query = async (text, params) => {
  const pool = getCurrentPool();
  return await pool.query(text, params);
};

const masterQuery = async (text, params) => {
  return await masterPool.query(text, params);
};

const executeTransaction = async (callback) => {
  const pool = getCurrentPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const closePool = async () => {
  await Promise.all(
    Array.from(tenantPools.values()).map((p) => p.end())
  );
  await masterPool.end();
};

module.exports = {
  // For backwards compatibility: primary pool reference
  pool: primaryPool,
  testConnection,
  getClient,
  query,
  masterQuery,
  executeTransaction,
  closePool,
  runWithTenant,
  getCurrentTenantDbName,
};

