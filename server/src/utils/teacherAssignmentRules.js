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

  const assignedRes = await query(
    `SELECT ct.class_section_id
     FROM class_teachers ct
     WHERE ct.class_id = $1
       AND ct.academic_year_id = $2
       AND ct.class_section_id IS NOT NULL
       AND ct.deleted_at IS NULL`,
    [classId, academicYearId]
  );

  return {
    ok: true,
    data: {
      classId: row.id,
      className: row.class_name,
      activeSectionCount,
      assignmentRequiresSection,
      assignedClassSectionIds: assignedRes.rows.map((r) => r.class_section_id),
    },
  };
}

/**
 * Ensures no active class-teacher row exists for the same class/section/year (any role).
 * @param {number|null} excludeAssignmentId - current row id when updating
 */
async function assertClassTeacherSlotAvailable(classId, classSectionId, academicYearId, excludeAssignmentId = null) {
  const params = [classId, academicYearId];
  const sectionClause =
    classSectionId == null
      ? 'AND ct.class_section_id IS NULL'
      : (() => {
          params.push(classSectionId);
          return `AND ct.class_section_id = $${params.length}`;
        })();

  let excludeClause = '';
  if (excludeAssignmentId != null) {
    const excludeId = parseInt(String(excludeAssignmentId), 10);
    if (Number.isFinite(excludeId) && excludeId > 0) {
      params.push(excludeId);
      excludeClause = ` AND ct.id <> $${params.length}`;
    }
  }

  const existing = await query(
    `SELECT ct.id
     FROM class_teachers ct
     WHERE ct.class_id = $1
       AND ct.academic_year_id = $2
       AND ct.deleted_at IS NULL
       ${sectionClause}
       ${excludeClause}
     LIMIT 1`,
    params
  );

  if (existing.rows.length) {
    return {
      ok: false,
      status: 409,
      message: classSectionId
        ? 'This section already has a class teacher assigned'
        : 'This class already has a class teacher assigned',
    };
  }

  return { ok: true };
}

/**
 * Ensures no active subject-teacher row exists for the same class/section/subject/year.
 * @param {number|null} excludeAssignmentId - current row id when updating
 */
async function assertSubjectTeacherSlotAvailable(
  classId,
  classSectionId,
  classSubjectId,
  academicYearId,
  excludeAssignmentId = null
) {
  const params = [classId, classSubjectId, academicYearId];
  const sectionClause =
    classSectionId == null
      ? 'AND ta.class_section_id IS NULL'
      : (() => {
          params.push(classSectionId);
          return `AND ta.class_section_id = $${params.length}`;
        })();

  let excludeClause = '';
  if (excludeAssignmentId != null) {
    const excludeId = parseInt(String(excludeAssignmentId), 10);
    if (Number.isFinite(excludeId) && excludeId > 0) {
      params.push(excludeId);
      excludeClause = ` AND ta.id <> $${params.length}`;
    }
  }

  const existing = await query(
    `SELECT ta.id
     FROM subject_teacher_assignments ta
     WHERE ta.class_id = $1
       AND ta.class_subject_id = $2
       AND ta.academic_year_id = $3
       AND ta.deleted_at IS NULL
       ${sectionClause}
       ${excludeClause}
     LIMIT 1`,
    params
  );

  if (existing.rows.length) {
    return {
      ok: false,
      status: 409,
      message: 'This subject is already assigned for the selected class and section',
    };
  }

  return { ok: true };
}

module.exports = {
  resolveSectionForAssignment,
  getClassAssignmentMeta,
  assertClassTeacherSlotAvailable,
  assertSubjectTeacherSlotAvailable,
};
