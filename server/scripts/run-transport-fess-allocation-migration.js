/**
 * Applies 043_transport_fees_and_allocations.sql
 *
 *   npm run db:migrate:transport-fess-allocation
 *   npm run db:migrate:transport-fees-allocation
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const sslConfig =
  process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: true } : { rejectUnauthorized: false };

async function main() {
  const url = (process.env.DATABASE_URL || '').trim();
  const files = [
    '043_transport_fees_and_allocations.sql',
    '044_transport_fee_staff_amount.sql',
    '051_transport_fees_allocations_academic_year.sql',
  ];

  const pool = url
    ? new Pool({ connectionString: url, ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : false })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'schooldb',
        ssl: process.env.DATABASE_SSL_MODE === 'require' ? sslConfig : false,
      });

  try {
    for (const file of files) {
      const sqlPath = path.join(__dirname, '..', 'migrations', file);
      if (!fs.existsSync(sqlPath)) {
        console.warn('Skip (missing):', file);
        continue;
      }
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('Applying', file, '...');
      await pool.query(sql);
    }
    console.log('Done.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
