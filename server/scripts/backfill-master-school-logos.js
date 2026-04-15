/**
 * One-time / maintenance: set master_db.schools.logo when NULL using the same
 * defaults the SPA used before logos were stored in the database.
 *
 *   node scripts/backfill-master-school-logos.js
 */

const { Pool } = require('pg');
require('dotenv').config();

function defaultLogoForSchoolName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('millat')) return 'assets/img/icons/millat-logo.png';
  if (n.includes('iqra')) return 'assets/img/icons/iqra-logo.bmp';
  return 'assets/img/logo-small.svg';
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'master_db',
  });
  try {
    const res = await pool.query(
      `SELECT id, school_name, logo FROM schools WHERE deleted_at IS NULL ORDER BY id ASC`
    );
    let updated = 0;
    for (const row of res.rows || []) {
      if (row.logo != null && String(row.logo).trim() !== '') continue;
      const url = defaultLogoForSchoolName(row.school_name);
      await pool.query(`UPDATE schools SET logo = $1 WHERE id = $2`, [url, row.id]);
      console.log(`Updated school id=${row.id} (${row.school_name}) logo -> ${url}`);
      updated += 1;
    }
    console.log(`Done. Rows updated: ${updated}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
