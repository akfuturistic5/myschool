const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const normalizeBool = (v, fallback = true) => {
  if (v === undefined || v === null) return fallback;
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
};

/** Empty or whitespace-only string -> null (DB stores NULL for optional text fields). */
const emptyToNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const normalizeClassCode = (v) => {
  const n = emptyToNull(v);
  if (n === null) return null;
  return n.length > 10 ? n.slice(0, 10) : n;
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

const parseOptionalFee = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
};

const pickPayload = (payload, key, current) =>
  Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : current;

const getAllClasses = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.id,
        c.class_name,
        c.class_code,
        c.class_teacher_id,
        c.max_students,
        c.class_fee,
        c.description,
        c.is_active,
        c.has_sections,
        c.created_at,
        (SELECT COUNT(*)::int FROM students s WHERE s.class_id = c.id AND s.is_active = true) as no_of_students,
        (SELECT COUNT(DISTINCT subject_id)::int FROM teacher_assignments ta WHERE ta.class_id = c.id) as no_of_subjects,
        s.first_name as teacher_first_name,
        s.last_name as teacher_last_name
      FROM classes c
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
        c.class_teacher_id,
        c.max_students,
        c.class_fee,
        c.description,
        c.is_active,
        c.has_sections,
        c.created_at,
        (SELECT COUNT(*)::int FROM students s WHERE s.class_id = c.id AND s.is_active = true) as no_of_students,
        (SELECT COUNT(DISTINCT subject_id)::int FROM teacher_assignments ta WHERE ta.class_id = c.id) as no_of_subjects,
        s.first_name as teacher_first_name,
        s.last_name as teacher_last_name
      FROM classes c
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

const createClass = async (req, res) => {
  try {
    const {
      class_name,
      class_code,
      class_teacher_id,
      max_students,
      class_fee,
      description,
      is_active,
      has_sections,
    } = req.body;

    const codeNorm = normalizeClassCode(class_code);
    const descNorm = normalizeDescription(description);
    const feeNorm = parseOptionalFee(class_fee);
    let maxNorm;
    if (max_students === undefined) maxNorm = 30;
    else if (max_students === null) maxNorm = null;
    else maxNorm = parseOptionalInt(max_students);
    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const createdByArg = Number.isInteger(createdBy) ? createdBy : null;

    const result = await query(
      `INSERT INTO classes (
        class_name, class_code, class_teacher_id, max_students, class_fee, description, is_active, has_sections, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        String(class_name).trim(),
        codeNorm,
        class_teacher_id || null,
        maxNorm,
        feeNorm,
        descNorm,
        normalizeBool(is_active, true),
        normalizeBool(has_sections, true),
        createdByArg,
      ]
    );
    return success(res, 201, 'Class created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating class:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid teacher');
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

    const classTeacherId = pickPayload(payload, 'class_teacher_id', cur.class_teacher_id);
    const className = pickPayload(payload, 'class_name', cur.class_name);

    let classCode = cur.class_code;
    if (Object.prototype.hasOwnProperty.call(payload, 'class_code')) {
      classCode = normalizeClassCode(payload.class_code);
    }

    let description = cur.description;
    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      description = normalizeDescription(payload.description);
    }

    let maxStudents = cur.max_students;
    if (Object.prototype.hasOwnProperty.call(payload, 'max_students')) {
      maxStudents =
        payload.max_students === null ? null : parseOptionalInt(payload.max_students);
    }

    let classFee = cur.class_fee;
    if (Object.prototype.hasOwnProperty.call(payload, 'class_fee')) {
      classFee = payload.class_fee === null ? null : parseOptionalFee(payload.class_fee);
    }

    const nameFinal = typeof className === 'string' ? className.trim() : className;
    if (!nameFinal) return errorResponse(res, 400, 'class_name cannot be empty');

    let hasSections = cur.has_sections;
    if (Object.prototype.hasOwnProperty.call(payload, 'has_sections')) {
      hasSections = normalizeBool(payload.has_sections, cur.has_sections);
    }

    const result = await query(`
      UPDATE classes SET
        class_name = $1,
        class_code = $2,
        class_teacher_id = $3,
        max_students = $4,
        class_fee = $5,
        description = $6,
        is_active = $7,
        has_sections = $8,
        modified_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [
      nameFinal,
      classCode,
      classTeacherId,
      maxStudents,
      classFee,
      description,
      Object.prototype.hasOwnProperty.call(payload, 'is_active')
        ? normalizeBool(payload.is_active, cur.is_active)
        : normalizeBool(cur.is_active, true),
      hasSections,
      id
    ]);
    return success(res, 200, 'Class updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating class:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid teacher');
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
  createClass,
  updateClass,
  deleteClass,
};
