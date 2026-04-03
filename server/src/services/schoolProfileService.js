const { query } = require('../config/database');

/**
 * Ensure per-tenant school_profile table exists and has one row.
 * This is idempotent and safe to call before reads/writes.
 */
async function ensureSchoolProfile(defaultSchoolName = null) {
  await query(`
    CREATE TABLE IF NOT EXISTS school_profile (
      id SERIAL PRIMARY KEY,
      school_name VARCHAR(255) NOT NULL,
      logo_url TEXT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existing = await query('SELECT id FROM school_profile ORDER BY id ASC LIMIT 1');
  if (existing.rows && existing.rows.length > 0) {
    return;
  }

  const name = String(defaultSchoolName || '').trim() || 'School';
  await query(
    'INSERT INTO school_profile (school_name, logo_url) VALUES ($1, NULL)',
    [name]
  );
}

async function getSchoolProfile(defaultSchoolName = null) {
  await ensureSchoolProfile(defaultSchoolName);
  const result = await query(
    `SELECT id, school_name, logo_url, created_at, updated_at
     FROM school_profile
     ORDER BY id ASC
     LIMIT 1`
  );
  const row = result.rows[0] || null;
  if (!row) return null;
  const logo = String(row.logo_url || '');
  const legacyPrefix = '/uploads/school-logos/';
  if (logo.startsWith(legacyPrefix)) {
    const parts = logo.slice(legacyPrefix.length).split('/').filter(Boolean);
    if (parts.length >= 2) {
      const tenant = parts[0].replace(/[^a-zA-Z0-9_-]/g, '');
      const file = parts[parts.length - 1].replace(/[^a-zA-Z0-9._-]/g, '');
      if (tenant && file) {
        const normalized = `/api/school/profile/logo/${tenant}/${file}`;
        row.logo_url = normalized;
        // Best-effort migration for legacy stored path format.
        try {
          await query(
            'UPDATE school_profile SET logo_url = $1, updated_at = NOW() WHERE id = $2',
            [normalized, row.id]
          );
        } catch {
          // Ignore migration failure and continue serving normalized path.
        }
      }
    }
  }
  return row;
}

module.exports = {
  ensureSchoolProfile,
  getSchoolProfile,
};

