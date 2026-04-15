const { query } = require('../config/database');

const DEFAULT_GRADE_SCALE = [
  { id: 1, grade: 'A+', min_percentage: 91, max_percentage: 100, is_active: true },
  { id: 2, grade: 'A', min_percentage: 86, max_percentage: 90.99, is_active: true },
  { id: 3, grade: 'B+', min_percentage: 76, max_percentage: 85.99, is_active: true },
  { id: 4, grade: 'B', min_percentage: 66, max_percentage: 75.99, is_active: true },
  { id: 5, grade: 'C', min_percentage: 50, max_percentage: 65.99, is_active: true },
  { id: 6, grade: 'D', min_percentage: 0, max_percentage: 49.99, is_active: true },
];

function isMissingTableError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('relation') && msg.includes('exam_grade');
}

async function loadActiveGradeScale() {
  try {
    const res = await query(
      `SELECT
         id,
         grad AS grade,
         min_precentage AS min_percentage,
         max_precentage AS max_percentage,
         is_active
       FROM exam_grade
       WHERE is_active = true
       ORDER BY min_precentage DESC, id ASC`
    );
    if (!res.rows.length) return DEFAULT_GRADE_SCALE;
    return res.rows.map((r) => ({
      id: Number(r.id),
      grade: String(r.grade || '').trim(),
      min_percentage: Number(r.min_percentage),
      max_percentage: Number(r.max_percentage),
      is_active: r.is_active !== false,
    }));
  } catch (err) {
    if (isMissingTableError(err)) return DEFAULT_GRADE_SCALE;
    throw err;
  }
}

function getGradeFromScale(percentage, scaleRows = DEFAULT_GRADE_SCALE) {
  const p = Number(percentage);
  if (!Number.isFinite(p)) return null;
  const matched = (scaleRows || []).find(
    (row) => p >= Number(row.min_percentage) && p <= Number(row.max_percentage)
  );
  return matched ? matched.grade : null;
}

module.exports = {
  DEFAULT_GRADE_SCALE,
  loadActiveGradeScale,
  getGradeFromScale,
  isMissingTableError,
};

