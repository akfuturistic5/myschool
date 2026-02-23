const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Use DATABASE_URL in production (Render)
// Fallback to local config only if DATABASE_URL not present
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'schooldb',
      user: process.env.DB_USER || 'schooluser',
      password: process.env.DB_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'development') return;
  // Log only once per pool init to reduce terminal noise
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(1);
});

const testConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const getClient = async () => {
  return await pool.connect();
};

const query = async (text, params) => {
  return await pool.query(text, params);
};

const executeTransaction = async (callback) => {
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
  await pool.end();
};

module.exports = {
  pool,
  testConnection,
  getClient,
  query,
  executeTransaction,
  closePool,
};
