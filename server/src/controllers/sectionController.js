const { query } = require('../config/database');
const { canAccessClass } = require('../utils/accessControl');
const { success, error: errorResponse } = require('../utils/responseHelper');

const normalizeBool = (v, fallback = true) => {
  if (v === undefined || v === null) return fallback;
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
};

/** DB: section_name VARCHAR(10) */
const normalizeSectionName = (v) => {
  const s = String(v ?? '').trim();
  return s.length > 10 ? s.slice(0, 10) : s;
};

const emptyToNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** DB: room_number VARCHAR(20) */
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

const getAllSections = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id, s.section_name, s.class_id, s.section_teacher_id, s.max_students, s.room_number,
        s.description, s.is_active, s.created_at, s.created_by, s.modified_at,
        (SELECT COUNT(*)::int FROM students st WHERE st.section_id = s.id AND st.is_active = true) as no_of_students,
        c.class_name, c.class_code, st.first_name as teacher_first_name, st.last_name as teacher_last_name
      FROM sections s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN staff st ON s.section_teacher_id = st.id
      ORDER BY c.class_name ASC, s.section_name ASC
    `);
    return success(res, 200, 'Sections fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return errorResponse(res, 500, 'Failed to fetch sections');
  }
};

const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        s.id,
        s.section_name,
        s.class_id,
        s.section_teacher_id,
        s.max_students,
        s.room_number,
        s.description,
        s.is_active,
        s.created_at,
        s.created_by,
        s.modified_at,
        (SELECT COUNT(*)::int FROM students st WHERE st.section_id = s.id AND st.is_active = true) as no_of_students,
        c.class_name,
        c.class_code,
        st.first_name as teacher_first_name,
        st.last_name as teacher_last_name
      FROM sections s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN staff st ON s.section_teacher_id = st.id
      WHERE s.id = $1
    `, [id]);

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

    const result = await query(`
      SELECT
        s.id,
        s.section_name,
        s.class_id,
        s.section_teacher_id,
        s.max_students,
        s.room_number,
        s.description,
        s.is_active,
        s.created_at,
        (SELECT COUNT(*)::int FROM students st WHERE st.section_id = s.id AND st.is_active = true) as no_of_students,
        c.class_name,
        c.class_code,
        st.first_name as teacher_first_name,
        st.last_name as teacher_last_name
      FROM sections s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN staff st ON s.section_teacher_id = st.id
      WHERE s.class_id = $1 AND s.is_active = true
      ORDER BY s.section_name ASC
    `, [classId]);

    return success(res, 200, 'Sections fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching sections by class:', error);
    return errorResponse(res, 500, 'Failed to fetch sections');
  }
};

const createSection = async (req, res) => {
  try {
    const {
      section_name, class_id, section_teacher_id, max_students, room_number,
      description, is_active,
    } = req.body;

    const nameNorm = normalizeSectionName(section_name);
    const roomNorm = normalizeRoomNumber(room_number);
    const descNorm = normalizeDescription(description);

    let maxNorm = 30;
    if (max_students !== undefined && max_students !== null) {
      const p = parseOptionalInt(max_students);
      maxNorm = p != null ? p : 30;
    }

    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const createdByArg = Number.isInteger(createdBy) ? createdBy : null;
    const classExists = await query('SELECT id FROM classes WHERE id = $1 LIMIT 1', [class_id]);
    if (!classExists.rows.length) return errorResponse(res, 400, 'Invalid class');

    const result = await query(
      `INSERT INTO sections (
        section_name, class_id, section_teacher_id, max_students, room_number, description, is_active, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        nameNorm,
        class_id,
        section_teacher_id || null,
        maxNorm,
        roomNorm,
        descNorm,
        normalizeBool(is_active, true),
        createdByArg,
      ]
    );
    await query('UPDATE classes SET has_sections = true, modified_at = NOW() WHERE id = $1', [class_id]);
    return success(res, 201, 'Section created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating section:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid class or teacher');
    if (error.code === '23505') return errorResponse(res, 409, 'Section already exists');
    return errorResponse(res, 500, 'Failed to create section');
  }
};

const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const current = await query('SELECT * FROM sections WHERE id = $1', [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Section not found');
    const cur = current.rows[0];
    const sectionTeacherId = Object.prototype.hasOwnProperty.call(payload, 'section_teacher_id')
      ? payload.section_teacher_id
      : cur.section_teacher_id;

    const sectionName = Object.prototype.hasOwnProperty.call(payload, 'section_name')
      ? normalizeSectionName(payload.section_name)
      : cur.section_name;

    let maxStudents = cur.max_students;
    if (Object.prototype.hasOwnProperty.call(payload, 'max_students')) {
      if (payload.max_students === null || payload.max_students === undefined) {
        maxStudents = 30;
      } else {
        const p = parseOptionalInt(payload.max_students);
        maxStudents = p != null ? p : cur.max_students;
      }
    }

    const roomNumber = Object.prototype.hasOwnProperty.call(payload, 'room_number')
      ? normalizeRoomNumber(payload.room_number)
      : cur.room_number;

    const description = Object.prototype.hasOwnProperty.call(payload, 'description')
      ? normalizeDescription(payload.description)
      : cur.description;

    const isActive = Object.prototype.hasOwnProperty.call(payload, 'is_active')
      ? normalizeBool(payload.is_active, cur.is_active)
      : cur.is_active;

    const result = await query(`
      UPDATE sections SET
        section_name = $1,
        section_teacher_id = $2,
        max_students = $3,
        room_number = $4,
        description = $5,
        is_active = $6,
        modified_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      sectionName,
      sectionTeacherId,
      maxStudents,
      roomNumber,
      description,
      isActive,
      id
    ]);
    return success(res, 200, 'Section updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating section:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid teacher reference');
    return errorResponse(res, 500, 'Failed to update section');
  }
};

const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM sections WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return errorResponse(res, 404, 'Section not found');
    return success(res, 200, 'Section deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting section:', error);
    if (error.code === '23503') return errorResponse(res, 409, 'Section is referenced by related records');
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
