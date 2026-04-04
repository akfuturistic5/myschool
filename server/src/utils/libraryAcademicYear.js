const { query } = require('../config/database');

/**
 * Current academic year (is_current), else latest active by start_date.
 */
async function getDefaultAcademicYearId() {
  const cur = await query(
    `SELECT id FROM academic_years WHERE is_current = true AND COALESCE(is_active, true) = true ORDER BY id LIMIT 1`
  );
  if (cur.rows[0]) return cur.rows[0].id;
  const fb = await query(
    `SELECT id FROM academic_years WHERE COALESCE(is_active, true) = true ORDER BY start_date DESC NULLS LAST, id DESC LIMIT 1`
  );
  return fb.rows[0]?.id ?? null;
}

/**
 * Parse academic_year_id from Express query; if missing/invalid, return default year id.
 */
async function resolveAcademicYearIdFromQuery(req) {
  const raw = req.query?.academic_year_id;
  if (raw != null && String(raw).trim() !== '') {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n)) return n;
  }
  return getDefaultAcademicYearId();
}

module.exports = {
  getDefaultAcademicYearId,
  resolveAcademicYearIdFromQuery,
};
