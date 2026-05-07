const { query } = require('../config/database');

/**
 * Resolves the class_section_id instance for an assignment.
 * @param {number} classId
 * @param {number|string|null} sectionIdRaw - This is now expected to be class_sections.id
 * @param {number} academicYearId
 * @returns {Promise<{ ok: true, classSectionId: number|null, requiresSection: boolean } | { ok: false, status: number, message: string }>}
 */
async function resolveSectionForAssignment(classId, sectionIdRaw, academicYearId) {
  const classRes = await query(
    `SELECT id FROM classes WHERE id = $1 AND deleted_at IS NULL`,
    [classId]
  );
  if (!classRes.rows.length) {
    return { ok: false, status: 404, message: 'Class not found' };
  }

  // Check if there are ANY sections defined for this class in this academic year
  const cntRes = await query(
    `SELECT COUNT(*)::int AS n FROM class_sections WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL`,
    [classId, academicYearId]
  );
  const sectionCount = cntRes.rows[0]?.n ?? 0;

  const requiresSection = sectionCount > 0;

  if (!requiresSection) {
    if (sectionIdRaw != null && sectionIdRaw !== '' && sectionIdRaw !== 0) {
      return {
        ok: false,
        status: 400,
        message: 'sectionId must be null for a class that has no sections in this academic year',
      };
    }
    return { ok: true, classSectionId: null, requiresSection: false };
  }

  if (sectionIdRaw == null || sectionIdRaw === '' || sectionIdRaw == 0) {
    return { ok: false, status: 400, message: 'sectionId is required for this class' };
  }

  const csid = parseInt(String(sectionIdRaw).trim(), 10);
  if (!Number.isFinite(csid) || csid < 1) {
    return { ok: false, status: 400, message: 'Invalid sectionId' };
  }

  const sec = await query(
    `SELECT id FROM class_sections WHERE id = $1 AND class_id = $2 AND academic_year_id = $3 AND deleted_at IS NULL`,
    [csid, classId, academicYearId]
  );
  if (!sec.rows.length) {
    return { ok: false, status: 400, message: 'Section instance does not belong to this class/year or is deleted' };
  }

  return { ok: true, classSectionId: csid, requiresSection: true };
}

/**
 * For GET meta (UI): same rule inputs without persisting.
 */
async function getClassAssignmentMeta(classId, academicYearId) {
  const classRes = await query(
    `SELECT id, class_name FROM classes WHERE id = $1 AND deleted_at IS NULL`,
    [classId]
  );
  if (!classRes.rows.length) {
    return { ok: false, status: 404, message: 'Class not found' };
  }
  const row = classRes.rows[0];

  const cntRes = await query(
    `SELECT COUNT(*)::int AS n FROM class_sections WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL`,
    [classId, academicYearId]
  );
  const activeSectionCount = cntRes.rows[0]?.n ?? 0;
  const assignmentRequiresSection = activeSectionCount > 0;

  return {
    ok: true,
    data: {
      classId: row.id,
      className: row.class_name,
      activeSectionCount,
      assignmentRequiresSection,
    },
  };
}

module.exports = {
  resolveSectionForAssignment,
  getClassAssignmentMeta,
};
