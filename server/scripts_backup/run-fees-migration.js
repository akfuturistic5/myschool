/**
 * Applies 010_fees_module_enterprise.sql (idempotent setup of enterprise fees).
 *
 *   npm run db:migrate:fees
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
    '010_fees_module_enterprise.sql',
    '011_add_status_to_fees_types.sql',
    '012_add_code_to_fees_types.sql',
    '013_add_fine_details_to_fees_master.sql',
    '014_fix_fees_assign_unique_constraint.sql'
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
    for (const name of files) {
      const sqlPath = path.join(__dirname, '..', 'migrations', name);
      if (!fs.existsSync(sqlPath)) {
        console.warn('Skip (missing):', name);
        continue;
      }
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('Applying', name, '...');
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
