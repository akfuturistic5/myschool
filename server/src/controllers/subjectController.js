const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { canAccessClass } = require('../utils/accessControl');

// Get all subjects
const getAllSubjects = async (req, res) => {
  try {
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
      ORDER BY s.subject_name ASC
    `);
    
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
        s.created_at
      FROM subjects s
      WHERE s.class_id = $1
      ORDER BY s.subject_name ASC
    `, [classId]);
    
    return success(res, 200, 'Subjects fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching subjects by class:', error);
    return errorResponse(res, 500, 'Failed to fetch subjects');
  }
};

// Update subject (name + status)
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_name, is_active } = req.body;

    // Validate required fields
    if (!subject_name || !subject_name.trim()) {
      return errorResponse(res, 400, 'Subject name is required');
    }

    // Convert is_active to boolean
    let isActiveBoolean = true; // default keep active
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    const result = await query(`
      UPDATE subjects
      SET subject_name = $1,
          is_active = $2,
          modified_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [subject_name.trim(), isActiveBoolean, id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Subject not found');
    }

    return success(res, 200, 'Subject updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    return errorResponse(res, 500, 'Failed to update subject');
  }
};

module.exports = {
  getAllSubjects,
  getSubjectById,
  getSubjectsByClass,
  updateSubject
};
