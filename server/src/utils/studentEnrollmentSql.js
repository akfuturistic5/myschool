/**
 * Reusable SQL fragments for "current" student enrollment from student_lifecycle_ledger.
 * Canonical model: class/section/year come from ledger rows, not students.*.
 */

/**
 * LATERAL subquery returning the latest ledger row for a student.
 * Aliases: lifecycle_id, class_id, section_id, academic_year_id (from to_* fields).
 *
 * @param {string} studentIdSql - SQL expression for student id, e.g. 's.id' or '$1'
 * @param {{ academicYearIdParam: string | null }} [opts]
 *   When academicYearIdParam is set (e.g. '$2'), filters WHERE to_academic_year_id = that param.
 */
function lateralCurrentEnrollment(studentIdSql, opts = {}) {
  const ay = opts.academicYearIdParam;
  const ayClause =
    ay != null && ay !== ''
      ? `AND l.to_academic_year_id = ${ay}`
      : '';
  return `
LEFT JOIN LATERAL (
  SELECT
    l.id AS lifecycle_id,
    l.to_class_id AS class_id,
    l.to_section_id AS section_id,
    l.to_academic_year_id AS academic_year_id
  FROM student_lifecycle_ledger l
  WHERE l.student_id = ${studentIdSql}
    ${ayClause}
  ORDER BY l.event_date DESC NULLS LAST, l.id DESC
  LIMIT 1
) enr ON true`;
}

/**
 * Scalar subquery: latest class_id for a student (no join alias). For use in WHERE/COUNT.
 */
function subqueryLatestClassId(studentIdSql, opts = {}) {
  const ay = opts.academicYearIdParam;
  const ayClause =
    ay != null && ay !== '' ? `AND l.to_academic_year_id = ${ay}` : '';
  return `(
  SELECT l.to_class_id
  FROM student_lifecycle_ledger l
  WHERE l.student_id = ${studentIdSql}
    ${ayClause}
  ORDER BY l.event_date DESC NULLS LAST, l.id DESC
  LIMIT 1
)`;
}

/**
 * Enrollment join for class/year-scoped reports (attendance, grade report, etc.).
 * When academicYearId is set, lateral picks the ledger row for that year.
 */
function buildEnrollmentJoin(studentIdSql, params, academicYearId) {
  const n = Number(academicYearId);
  const ayId = Number.isFinite(n) && n > 0 ? n : null;
  if (ayId != null) {
    params.push(ayId);
    return lateralCurrentEnrollment(studentIdSql, { academicYearIdParam: `$${params.length}` });
  }
  return lateralCurrentEnrollment(studentIdSql);
}

module.exports = {
  lateralCurrentEnrollment,
  subqueryLatestClassId,
  buildEnrollmentJoin,
};
