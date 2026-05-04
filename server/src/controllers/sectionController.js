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

const normalizeRoomNumber = (v) => {
  const n = emptyToNull(v);
  if (n === null) return null;
  return n.length > 20 ? n.slice(0, 20) : n;
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

const baseSectionSelect = `
  cs.id,
  sec.id AS section_master_id,
  sec.section_name,
  cs.class_id,
  cs.academic_year_id,
  te.staff_id AS section_teacher_id,
  cs.max_students,
  cs.room_number,
  sec.description,
  cs.is_active,
  cs.created_at,
  cs.created_by,
  cs.updated_at AS updated_at,
  (SELECT COUNT(*)::int
   FROM students st
   LEFT JOIN LATERAL (
     SELECT l.to_class_id, l.to_section_id, l.to_academic_year_id
     FROM student_lifecycle_ledger l
     WHERE l.student_id = st.id
     ORDER BY l.event_date DESC NULLS LAST, l.id DESC
     LIMIT 1
   ) le ON true
   WHERE st.deleted_at IS NULL AND st.status = \'Active\'
     AND le.to_class_id = cs.class_id
     AND le.to_section_id = sec.id
     AND le.to_academic_year_id = cs.academic_year_id
  ) AS no_of_students,
  c.class_name,
  c.class_code,
  u_t.first_name AS teacher_first_name,
  u_t.last_name AS teacher_last_name
`;

const fromClassSectionsJoin = `
  FROM class_sections cs
  INNER JOIN sections sec ON sec.id = cs.section_id
  INNER JOIN classes c ON c.id = cs.class_id
  LEFT JOIN LATERAL (
    SELECT staff_id
    FROM class_teachers ct
    WHERE ct.class_section_id = cs.id
      AND ct.academic_year_id = cs.academic_year_id
      AND ct.deleted_at IS NULL
    ORDER BY (ct.role = 'primary') DESC, ct.id DESC
    LIMIT 1
  ) te ON true
  LEFT JOIN staff stf ON stf.id = te.staff_id
  LEFT JOIN users u_t ON u_t.id = stf.user_id
`;

const getAllSections = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, section_name, created_at, updated_at
       FROM sections
       WHERE deleted_at IS NULL
       ORDER BY section_name ASC`
    );
    return success(res, 200, 'Sections fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return errorResponse(res, 500, 'Failed to fetch sections', error.message);
  }
};

const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id, section_name, is_active, created_at, updated_at
       FROM sections
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Section not found');
    }

    return success(res, 200, 'Section fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching section:', error);
    return errorResponse(res, 500, 'Failed to fetch section');
  }
};

const getSectionsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const params = [classId];
    let where = 'WHERE cs.class_id = $1 AND cs.deleted_at IS NULL';
    if (academicYearId) {
      params.push(academicYearId);
      where += ' AND cs.academic_year_id = $2';
    }
    if (!academicYearId) {
      where += ' AND cs.is_active = true';
    }
    const result = await query(
      `SELECT ${baseSectionSelect} ${fromClassSectionsJoin}
       ${where}
       ORDER BY sec.section_name ASC`,
      params
    );
    return success(res, 200, 'Sections fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching sections by class:', error);
    return errorResponse(res, 500, 'Failed to fetch sections');
  }
};

const createSection = async (req, res) => {
  try {
    const { section_name, is_active } = req.body;

    const nameNorm = normalizeSectionName(section_name);
    if (!nameNorm) return errorResponse(res, 400, 'section_name is required');

    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const createdByArg = Number.isInteger(createdBy) ? createdBy : null;

    const secRow = await query(
      `INSERT INTO sections (section_name, created_by) VALUES ($1, $2) RETURNING *`,
      [nameNorm, createdByArg]
    );

    return success(res, 201, 'Section created successfully', secRow.rows[0]);
  } catch (error) {
    console.error('Error creating section:', error);
    if (error.code === '23505') return errorResponse(res, 409, 'Section already exists');
    return errorResponse(res, 500, 'Failed to create section', error.message);
  }
};

const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { section_name, is_active } = req.body;
    
    const current = await query(`SELECT * FROM sections WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Section not found');
    const cur = current.rows[0];

    const sectionName = section_name !== undefined ? normalizeSectionName(section_name) : cur.section_name;
    const isActive = is_active !== undefined ? normalizeBool(is_active, cur.is_active) : cur.is_active;

    const result = await query(
      `UPDATE sections SET
         section_name = $1,
         is_active = $2,
         updated_by = $3,
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        sectionName,
        isActive,
        req.user?.id != null ? parseInt(req.user.id, 10) : null,
        id,
      ]
    );
    return success(res, 200, 'Section updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating section:', error);
    if (error.code === '23505') return errorResponse(res, 409, 'Section name already exists');
    return errorResponse(res, 500, 'Failed to update section');
  }
};

const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    // Note: If a section is referenced by class_sections, deleting it might fail due to foreign keys,
    // or we can soft-delete. Let's soft-delete it.
    const result = await query(
      `UPDATE sections SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, req.user?.id != null ? parseInt(req.user.id, 10) : null]
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
  getSectionsByClass,
  createSection,
  updateSection,
  deleteSection,
};
