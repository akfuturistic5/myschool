const { query } = require('../config/database');

/**
 * @returns {Promise<{ ok: true, sectionId: number|null, requiresSection: boolean } | { ok: false, status: number, message: string }>}
 */
async function resolveSectionForAssignment(classId, sectionIdRaw) {
  const classRes = await query(
    `SELECT id, has_sections FROM classes WHERE id = $1`,
    [classId]
  );
  if (!classRes.rows.length) {
    return { ok: false, status: 404, message: 'Class not found' };
  }

  const hasSectionsFlag = classRes.rows[0].has_sections !== false;

  const cntRes = await query(
    `SELECT COUNT(*)::int AS n FROM sections WHERE class_id = $1 AND COALESCE(is_active, true)`,
    [classId]
  );
  const sectionCount = cntRes.rows[0]?.n ?? 0;

  const requiresSection = hasSectionsFlag && sectionCount > 0;

  if (!requiresSection) {
    if (sectionIdRaw != null && sectionIdRaw !== '') {
      return {
        ok: false,
        status: 400,
        message: 'sectionId must be null for a class that does not use sections (or has no sections)',
      };
    }
    return { ok: true, sectionId: null, requiresSection: false };
  }

  if (sectionIdRaw == null || sectionIdRaw === '') {
    return { ok: false, status: 400, message: 'sectionId is required for this class' };
  }

  const sid = parseInt(String(sectionIdRaw).trim(), 10);
  if (!Number.isFinite(sid) || sid < 1) {
    return { ok: false, status: 400, message: 'Invalid sectionId' };
  }

  const sec = await query(
    `SELECT id FROM sections WHERE id = $1 AND class_id = $2 AND COALESCE(is_active, true)`,
    [sid, classId]
  );
  if (!sec.rows.length) {
    return { ok: false, status: 400, message: 'Section does not belong to this class or is inactive' };
  }

  return { ok: true, sectionId: sid, requiresSection: true };
}

/**
 * For GET meta (UI): same rule inputs without persisting.
 */
async function getClassAssignmentMeta(classId) {
  const classRes = await query(
    `SELECT id, class_name, has_sections FROM classes WHERE id = $1`,
    [classId]
  );
  if (!classRes.rows.length) {
    return { ok: false, status: 404, message: 'Class not found' };
  }
  const row = classRes.rows[0];
  const cntRes = await query(
    `SELECT COUNT(*)::int AS n FROM sections WHERE class_id = $1 AND COALESCE(is_active, true)`,
    [classId]
  );
  const activeSectionCount = cntRes.rows[0]?.n ?? 0;
  const hasSectionsFlag = row.has_sections !== false;
  const assignmentRequiresSection = hasSectionsFlag && activeSectionCount > 0;

  return {
    ok: true,
    data: {
      classId: row.id,
      className: row.class_name,
      hasSections: hasSectionsFlag,
      activeSectionCount,
      assignmentRequiresSection,
    },
  };
}

module.exports = {
  resolveSectionForAssignment,
  getClassAssignmentMeta,
};
