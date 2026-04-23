const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { canAccessClass } = require('../utils/accessControl');

const parseOptionalInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

// Get all subjects
const getAllSubjects = async (req, res) => {
  try {
    const academicYearId = parseOptionalInt(req.query?.academic_year_id);
    const params = [];
    let whereSql = '';
    if (academicYearId) {
      params.push(academicYearId);
      whereSql = `
        WHERE (
          s.academic_year_id = $1
          OR (s.academic_year_id IS NULL AND c.academic_year_id = $1)
        )
      `;
    }
    const result = await query(`
      SELECT
        s.id,
        s.subject_name,
        s.subject_code,
        s.class_id,
        s.teacher_id,
        s.theory_hours,
        s.practical_hours,
        s.total_marks,
        s.passing_marks,
        s.description,
        s.is_active,
        s.created_at
      FROM subjects s
      LEFT JOIN classes c ON c.id = s.class_id
      ${whereSql}
      ORDER BY s.subject_name ASC
    `, params);
    
    return success(res, 200, 'Subjects fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return errorResponse(res, 500, 'Failed to fetch subjects');
  }
};

// Get subject by ID
const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT
        s.id,
        s.subject_name,
        s.subject_code,
        s.class_id,
        s.teacher_id,
        s.theory_hours,
        s.practical_hours,
        s.total_marks,
        s.passing_marks,
        s.description,
        s.is_active,
        s.created_at
      FROM subjects s
      WHERE s.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Subject not found');
    }
    
    return success(res, 200, 'Subject fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject:', error);
    return errorResponse(res, 500, 'Failed to fetch subject');
  }
};

// Get subjects by class
const getSubjectsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }

    const result = await query(`
      SELECT
        s.id,
        s.subject_name,
        s.subject_code,
        s.class_id,
        s.teacher_id,
        s.theory_hours,
        s.practical_hours,
        s.total_marks,
        s.passing_marks,
        s.description,
        s.is_active,
        s.created_at,
        CASE
          WHEN COALESCE(s.theory_hours, 0) > 0 AND COALESCE(s.practical_hours, 0) > 0 THEN 'Theory & Practical'
          WHEN COALESCE(s.practical_hours, 0) > 0 THEN 'Practical'
          WHEN COALESCE(s.theory_hours, 0) > 0 THEN 'Theory'
          ELSE NULL
        END AS subject_mode
      FROM subjects s
      WHERE s.class_id = $1
        AND (s.is_active IS DISTINCT FROM false)
      ORDER BY s.subject_name ASC, s.id ASC
    `, [classId]);
    
    return success(res, 200, 'Subjects fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching subjects by class:', error);
    return errorResponse(res, 500, 'Failed to fetch subjects');
  }
};

const createSubject = async (req, res) => {
  try {
    const {
      subject_name, subject_code, class_id, teacher_id, theory_hours,
      practical_hours, total_marks, passing_marks, description, is_active
    } = req.body;
    let academicYearId = null;
    if (class_id) {
      const cls = await query('SELECT academic_year_id FROM classes WHERE id = $1 LIMIT 1', [class_id]);
      academicYearId = cls.rows?.[0]?.academic_year_id ?? null;
    }

    const result = await query(
      `INSERT INTO subjects (
        subject_name, subject_code, class_id, teacher_id, theory_hours, practical_hours,
        total_marks, passing_marks, description, is_active, academic_year_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        subject_name.trim(), subject_code || null, class_id || null, teacher_id || null,
        theory_hours || 0, practical_hours || 0, total_marks || 0, passing_marks || 0,
        description || null, is_active !== false, academicYearId
      ]
    );
    return success(res, 201, 'Subject created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating subject:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid class or teacher');
    if (error.code === '23505') return errorResponse(res, 409, 'Subject already exists');
    return errorResponse(res, 500, 'Failed to create subject');
  }
};

// Update subject
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const current = await query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Subject not found');
    const cur = current.rows[0];

    const result = await query(`
      UPDATE subjects
      SET subject_name = $1,
          subject_code = $2,
          class_id = $3,
          teacher_id = $4,
          theory_hours = $5,
          practical_hours = $6,
          total_marks = $7,
          passing_marks = $8,
          description = $9,
          is_active = $10,
          modified_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [
      payload.subject_name ?? cur.subject_name,
      payload.subject_code ?? cur.subject_code,
      payload.class_id ?? cur.class_id,
      payload.teacher_id ?? cur.teacher_id,
      payload.theory_hours ?? cur.theory_hours,
      payload.practical_hours ?? cur.practical_hours,
      payload.total_marks ?? cur.total_marks,
      payload.passing_marks ?? cur.passing_marks,
      payload.description ?? cur.description,
      payload.is_active !== undefined ? payload.is_active : cur.is_active,
      id
    ]);

    return success(res, 200, 'Subject updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    return errorResponse(res, 500, 'Failed to update subject');
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM subjects WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return errorResponse(res, 404, 'Subject not found');
    return success(res, 200, 'Subject deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting subject:', error);
    if (error.code === '23503') return errorResponse(res, 409, 'Subject is referenced by related records');
    return errorResponse(res, 500, 'Failed to delete subject');
  }
};

module.exports = {
  getAllSubjects,
  getSubjectById,
  getSubjectsByClass,
  createSubject,
  updateSubject,
  deleteSubject,
};
