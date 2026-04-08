const { query } = require('../config/database');
const { canAccessClass } = require('../utils/accessControl');
const { success, error: errorResponse } = require('../utils/responseHelper');

const normalizeBool = (v, fallback = true) => {
  if (v === undefined || v === null) return fallback;
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
};

const getAllSections = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id, s.section_name, s.class_id, s.section_teacher_id, s.max_students, s.room_number,
        s.description, s.is_active, s.created_at, s.no_of_students,
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
        s.no_of_students,
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
        s.no_of_students,
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
      description, is_active, no_of_students
    } = req.body;
    const result = await query(
      `INSERT INTO sections (
        section_name, class_id, section_teacher_id, max_students, room_number, description, is_active, no_of_students
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        section_name.trim(), class_id, section_teacher_id || null, max_students || null,
        room_number || null, description || null, normalizeBool(is_active, true),
        no_of_students != null ? parseInt(no_of_students, 10) : null
      ]
    );
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
    const result = await query(`
      UPDATE sections SET
        section_name = $1,
        section_teacher_id = $2,
        max_students = $3,
        room_number = $4,
        description = $5,
        no_of_students = $6,
        is_active = $7,
        modified_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      payload.section_name ?? cur.section_name,
      payload.section_teacher_id ?? cur.section_teacher_id,
      payload.max_students ?? cur.max_students,
      payload.room_number ?? cur.room_number,
      payload.description ?? cur.description,
      payload.no_of_students ?? cur.no_of_students,
      normalizeBool(payload.is_active, cur.is_active),
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
