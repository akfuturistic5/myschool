const { query } = require('../config/database');
const { canAccessClass } = require('../utils/accessControl');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId } = require('../utils/academicYear');

const normalizeBool = (v, fallback = true) => {
  if (v === undefined || v === null) return fallback;
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
};

const normalizeSectionName = (v) => {
  const s = String(v ?? '').trim();
  return s.length > 10 ? s.slice(0, 10) : s;
};

const emptyToNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const normalizeDescription = (v) => {
  const n = emptyToNull(v);
  if (n === null) return null;
  return n.length > 5000 ? n.slice(0, 5000) : n;
};

const parseOptionalInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const ENRICHED_SELECT = `
  s.id,
  s.section_name,
  s.description,
  s.created_at,
  s.updated_at,
  cs.id AS class_section_id,
  cs.class_id,
  cs.academic_year_id,
  cs.max_students,
  COALESCE(cs.is_active, true) AS is_active,
  cs.class_room_id,
  cr.room_number,
  c.class_name,
  c.class_code,
  te.staff_id AS section_teacher_id,
  u_t.first_name AS teacher_first_name,
  u_t.last_name AS teacher_last_name
`;

const buildEnrichedQuery = (extraWhere = '', paramOffset = 1) => {
  const ayParam = `$${paramOffset}`;
  return {
    sql: `
      SELECT ${ENRICHED_SELECT}
      FROM sections s
      LEFT JOIN LATERAL (
        SELECT cs_inner.*
        FROM class_sections cs_inner
        WHERE cs_inner.section_id = s.id
          AND cs_inner.deleted_at IS NULL
          AND (${ayParam}::int IS NULL OR cs_inner.academic_year_id = ${ayParam})
        ORDER BY cs_inner.updated_at DESC NULLS LAST, cs_inner.id DESC
        LIMIT 1
      ) cs ON true
      LEFT JOIN classes c ON c.id = cs.class_id
      LEFT JOIN class_rooms cr ON cr.id = cs.class_room_id
      LEFT JOIN LATERAL (
        SELECT ct.staff_id
        FROM class_teachers ct
        WHERE ct.class_section_id = cs.id
          AND ct.deleted_at IS NULL
        ORDER BY (ct.role = 'primary') DESC, ct.id DESC
        LIMIT 1
      ) te ON true
      LEFT JOIN staff stf ON stf.id = te.staff_id
      LEFT JOIN users u_t ON u_t.id = stf.user_id
      WHERE s.deleted_at IS NULL
      ${extraWhere}
    `,
    ayParam,
  };
};

async function fetchEnrichedSection(sectionId, academicYearId) {
  const { sql } = buildEnrichedQuery('AND s.id = $2', 1);
  const result = await query(`${sql} LIMIT 1`, [academicYearId || null, sectionId]);
  return result.rows[0] || null;
}

async function resolveYearForClass(classId, requestedYearId) {
  const ay = await resolveAcademicYearId(requestedYearId);
  if (ay) return ay;
  const cls = await query(
    'SELECT academic_year_id FROM classes WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [classId]
  );
  return parseOptionalInt(cls.rows[0]?.academic_year_id);
}

async function assertRoomAvailable(academicYearId, classRoomId, excludeClassSectionId) {
  if (!classRoomId || !academicYearId) return null;
  const params = [academicYearId, classRoomId];
  let excludeClause = '';
  if (excludeClassSectionId) {
    params.push(excludeClassSectionId);
    excludeClause = 'AND cs.id != $3';
  }
  const existing = await query(
    `SELECT c.class_name, sec.section_name
     FROM class_sections cs
     JOIN classes c ON c.id = cs.class_id
     JOIN sections sec ON sec.id = cs.section_id
     WHERE cs.academic_year_id = $1 AND cs.class_room_id = $2
       AND cs.deleted_at IS NULL
       ${excludeClause}`,
    params
  );
  if (existing.rows.length) {
    const e = existing.rows[0];
    return `Room is already assigned to Class ${e.class_name} - Section ${e.section_name}`;
  }
  return null;
}

const getAllSections = async (req, res) => {
  try {
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const { sql } = buildEnrichedQuery('', 1);
    const result = await query(`${sql} ORDER BY s.section_name ASC`, [academicYearId || null]);
    return success(res, 200, 'Sections fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return errorResponse(res, 500, 'Failed to fetch sections', error.message);
  }
};

const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const row = await fetchEnrichedSection(id, academicYearId);
    if (!row) return errorResponse(res, 404, 'Section not found');
    return success(res, 200, 'Section fetched successfully', row);
  } catch (error) {
    console.error('Error fetching section:', error);
    return errorResponse(res, 500, 'Failed to fetch section');
  }
};

const createSection = async (req, res) => {
  try {
    const {
      section_name,
      description,
      class_id,
      academic_year_id,
      max_students,
      class_room_id,
      is_active,
    } = req.body;

    const nameNorm = normalizeSectionName(section_name);
    if (!nameNorm) return errorResponse(res, 400, 'section_name is required');

    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const createdByArg = Number.isInteger(createdBy) ? createdBy : null;
    const descNorm = description !== undefined ? normalizeDescription(description) : null;

    const secRow = await query(
      `INSERT INTO sections (section_name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [nameNorm, descNorm, createdByArg]
    );
    const sectionId = secRow.rows[0].id;

    const classId = parseOptionalInt(class_id);
    if (classId) {
      const access = await canAccessClass(req, classId);
      if (!access.ok) {
        return errorResponse(res, access.status || 403, access.message || 'Access denied');
      }

      const yearId = await resolveYearForClass(classId, academic_year_id);
      if (!yearId) {
        return errorResponse(res, 400, 'Academic year is required to assign section to a class');
      }

      const roomId = parseOptionalInt(class_room_id);
      const roomConflict = await assertRoomAvailable(yearId, roomId, null);
      if (roomConflict) return errorResponse(res, 400, roomConflict);

      const maxVal = parseOptionalInt(max_students) ?? 30;
      const activeVal = normalizeBool(is_active, true);

      await query(
        `INSERT INTO class_sections (
           class_id, section_id, academic_year_id, max_students, class_room_id, is_active, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [classId, sectionId, yearId, maxVal, roomId, activeVal, createdByArg]
      );
    }

    const academicYearId = await resolveAcademicYearId(academic_year_id);
    const enriched = await fetchEnrichedSection(sectionId, academicYearId);
    return success(res, 201, 'Section created successfully', enriched);
  } catch (error) {
    console.error('Error creating section:', error);
    if (error.code === '23505') return errorResponse(res, 409, 'Section already exists');
    return errorResponse(res, 500, 'Failed to create section', error.message);
  }
};

const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      section_name,
      description,
      class_id,
      academic_year_id,
      max_students,
      class_room_id,
      is_active,
    } = req.body;

    const current = await query(
      'SELECT id, section_name, description FROM sections WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!current.rows.length) return errorResponse(res, 404, 'Section not found');
    const cur = current.rows[0];

    const sectionName =
      section_name !== undefined ? normalizeSectionName(section_name) : cur.section_name;
    if (!sectionName) return errorResponse(res, 400, 'section_name cannot be empty');

    const descNorm =
      description !== undefined ? normalizeDescription(description) : cur.description;

    const updatedBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    await query(
      `UPDATE sections SET
         section_name = $1,
         description = $2,
         updated_by = $3,
         updated_at = NOW()
       WHERE id = $4 AND deleted_at IS NULL`,
      [sectionName, descNorm, Number.isInteger(updatedBy) ? updatedBy : null, id]
    );

    const academicYearId = await resolveAcademicYearId(academic_year_id);
    const existingAssignment = await query(
      `SELECT id, class_id, academic_year_id, max_students, class_room_id, is_active
       FROM class_sections
       WHERE section_id = $1 AND deleted_at IS NULL
         AND ($2::int IS NULL OR academic_year_id = $2)
       ORDER BY updated_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [id, academicYearId || null]
    );

    const classId = parseOptionalInt(class_id);
    const hasAssignmentPayload =
      classId ||
      max_students !== undefined ||
      class_room_id !== undefined ||
      is_active !== undefined;

    if (hasAssignmentPayload) {
      const targetClassId = classId || existingAssignment.rows[0]?.class_id;
      if (!targetClassId) {
        return errorResponse(
          res,
          400,
          'class_id is required to set class section details (max students, room, status)'
        );
      }

      const access = await canAccessClass(req, targetClassId);
      if (!access.ok) {
        return errorResponse(res, access.status || 403, access.message || 'Access denied');
      }

      const yearId =
        (await resolveYearForClass(targetClassId, academic_year_id)) ||
        existingAssignment.rows[0]?.academic_year_id;
      if (!yearId) {
        return errorResponse(res, 400, 'Academic year is required for class section assignment');
      }

      const roomId =
        class_room_id !== undefined
          ? parseOptionalInt(class_room_id)
          : existingAssignment.rows[0]?.class_room_id ?? null;

      const assignmentId = existingAssignment.rows[0]?.id;
      const roomConflict = await assertRoomAvailable(yearId, roomId, assignmentId);
      if (roomConflict) return errorResponse(res, 400, roomConflict);

      const maxVal =
        max_students !== undefined
          ? parseOptionalInt(max_students) ?? existingAssignment.rows[0]?.max_students ?? 30
          : existingAssignment.rows[0]?.max_students ?? 30;

      const activeVal =
        is_active !== undefined
          ? normalizeBool(is_active, true)
          : existingAssignment.rows[0]?.is_active ?? true;

      if (assignmentId) {
        await query(
          `UPDATE class_sections SET
             class_id = $1,
             max_students = $2,
             class_room_id = $3,
             is_active = $4,
             updated_by = $5,
             updated_at = NOW()
           WHERE id = $6`,
          [
            targetClassId,
            maxVal,
            roomId,
            activeVal,
            Number.isInteger(updatedBy) ? updatedBy : null,
            assignmentId,
          ]
        );
      } else {
        await query(
          `INSERT INTO class_sections (
             class_id, section_id, academic_year_id, max_students, class_room_id, is_active, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            targetClassId,
            id,
            yearId,
            maxVal,
            roomId,
            activeVal,
            Number.isInteger(updatedBy) ? updatedBy : null,
          ]
        );
      }
    }

    const enriched = await fetchEnrichedSection(id, academicYearId);
    return success(res, 200, 'Section updated successfully', enriched);
  } catch (error) {
    console.error('Error updating section:', error);
    if (error.code === '23505') return errorResponse(res, 409, 'Section name already exists');
    return errorResponse(res, 500, 'Failed to update section');
  }
};

const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const result = await query(
      `UPDATE sections SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, Number.isInteger(updatedBy) ? updatedBy : null]
    );
    if (!result.rows.length) return errorResponse(res, 404, 'Section not found');
    return success(res, 200, 'Section deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting section:', error);
    if (error.code === '23503') return errorResponse(res, 409, 'Section is referenced by related classes');
    return errorResponse(res, 500, 'Failed to delete section');
  }
};

module.exports = {
  getAllSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
};
