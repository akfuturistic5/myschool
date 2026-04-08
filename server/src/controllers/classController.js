const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const normalizeBool = (v, fallback = true) => {
  if (v === undefined || v === null) return fallback;
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
};

const getAllClasses = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.id,
        c.class_name,
        c.class_code,
        c.academic_year_id,
        c.class_teacher_id,
        c.max_students,
        c.class_fee,
        c.description,
        c.is_active,
        c.created_at,
        c.no_of_students,
        ay.year_name as academic_year_name,
        s.first_name as teacher_first_name,
        s.last_name as teacher_last_name
      FROM classes c
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN staff s ON c.class_teacher_id = s.id
      ORDER BY c.class_name ASC
    `);
    
    return success(res, 200, 'Classes fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return errorResponse(res, 500, 'Failed to fetch classes');
  }
};

const getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        c.id,
        c.class_name,
        c.class_code,
        c.academic_year_id,
        c.class_teacher_id,
        c.max_students,
        c.class_fee,
        c.description,
        c.is_active,
        c.created_at,
        c.no_of_students,
        ay.year_name as academic_year_name,
        s.first_name as teacher_first_name,
        s.last_name as teacher_last_name
      FROM classes c
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN staff s ON c.class_teacher_id = s.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Class not found');
    }

    return success(res, 200, 'Class fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching class:', error);
    return errorResponse(res, 500, 'Failed to fetch class');
  }
};

const getClassesByAcademicYear = async (req, res) => {
  try {
    const { academicYearId } = req.params;
    const result = await query(`
      SELECT
        c.id,
        c.class_name,
        c.class_code,
        c.academic_year_id,
        c.class_teacher_id,
        c.max_students,
        c.class_fee,
        c.description,
        c.is_active,
        c.created_at,
        c.no_of_students,
        ay.year_name as academic_year_name,
        s.first_name as teacher_first_name,
        s.last_name as teacher_last_name
      FROM classes c
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN staff s ON c.class_teacher_id = s.id
      WHERE c.academic_year_id = $1
      ORDER BY c.class_name ASC
    `, [academicYearId]);

    return success(res, 200, 'Classes fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching classes by academic year:', error);
    return errorResponse(res, 500, 'Failed to fetch classes');
  }
};

const createClass = async (req, res) => {
  try {
    const {
      class_name,
      class_code,
      academic_year_id,
      class_teacher_id,
      max_students,
      class_fee,
      description,
      is_active,
      no_of_students,
    } = req.body;

    const result = await query(
      `INSERT INTO classes (
        class_name, class_code, academic_year_id, class_teacher_id, max_students, class_fee, description, is_active, no_of_students
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        class_name.trim(),
        class_code || null,
        academic_year_id,
        class_teacher_id || null,
        max_students || null,
        class_fee || null,
        description || null,
        normalizeBool(is_active, true),
        no_of_students != null ? parseInt(no_of_students, 10) : null,
      ]
    );
    return success(res, 201, 'Class created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating class:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid academic year or teacher');
    if (error.code === '23505') return errorResponse(res, 409, 'Class already exists');
    return errorResponse(res, 500, 'Failed to create class');
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const current = await query('SELECT * FROM classes WHERE id = $1', [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Class not found');
    const cur = current.rows[0];

    const result = await query(`
      UPDATE classes SET
        class_name = $1,
        class_code = $2,
        academic_year_id = $3,
        class_teacher_id = $4,
        max_students = $5,
        class_fee = $6,
        description = $7,
        no_of_students = $8,
        is_active = $9,
        modified_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      payload.class_name ?? cur.class_name,
      payload.class_code ?? cur.class_code,
      payload.academic_year_id ?? cur.academic_year_id,
      payload.class_teacher_id ?? cur.class_teacher_id,
      payload.max_students ?? cur.max_students,
      payload.class_fee ?? cur.class_fee,
      payload.description ?? cur.description,
      payload.no_of_students ?? cur.no_of_students,
      normalizeBool(payload.is_active, cur.is_active),
      id
    ]);
    return success(res, 200, 'Class updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating class:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid academic year or teacher');
    return errorResponse(res, 500, 'Failed to update class');
  }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM classes WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return errorResponse(res, 404, 'Class not found');
    return success(res, 200, 'Class deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting class:', error);
    if (error.code === '23503') return errorResponse(res, 409, 'Class is referenced by related records');
    return errorResponse(res, 500, 'Failed to delete class');
  }
};

module.exports = {
  getAllClasses,
  getClassById,
  getClassesByAcademicYear,
  createClass,
  updateClass,
  deleteClass,
};
