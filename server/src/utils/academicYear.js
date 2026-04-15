const { query } = require('../config/database');

function toPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function getCurrentAcademicYearId() {
  const r = await query(
    `SELECT id
     FROM academic_years
     WHERE is_current = true AND is_active = true
     ORDER BY id DESC
     LIMIT 1`
  );
  return toPositiveInt(r.rows[0]?.id);
}

async function resolveAcademicYearId(explicitAcademicYearId) {
  const explicit = toPositiveInt(explicitAcademicYearId);
  if (explicit) return explicit;
  return getCurrentAcademicYearId();
}

module.exports = {
  toPositiveInt,
  getCurrentAcademicYearId,
  resolveAcademicYearId,
};

