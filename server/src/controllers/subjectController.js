const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

/**
 * Master Subject Controller
 * Handles only global subject definitions (Name, Code, Description, Type)
 */

// Get all master subjects
const getAllSubjects = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        subject_name,
        subject_code,
        subject_type,
        subject_type as subject_mode,
        description,
        is_active,
        created_at
      FROM subjects
      WHERE deleted_at IS NULL
      ORDER BY subject_name ASC
    `);
    
    return success(res, 200, 'Subjects fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return errorResponse(res, 500, 'Failed to fetch subjects', error.message);
  }
};

// Get subject by ID
const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT
        id,
        subject_name,
        subject_code,
        subject_type,
        subject_type as subject_mode,
        description,
        is_active,
        created_at
      FROM subjects
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Subject not found');
    }
    
    return success(res, 200, 'Subject fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject:', error);
    return errorResponse(res, 500, 'Failed to fetch subject', error.message);
  }
};

// Create new master subject
const createSubject = async (req, res) => {
  try {
    const {
      subject_name, subject_code, subject_type, description, is_active
    } = req.body;

    if (!subject_name || subject_name.trim() === '') {
      return errorResponse(res, 400, 'Subject name is required');
    }

    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const result = await query(
      `INSERT INTO subjects (
        subject_name, subject_code, subject_type, description, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        subject_name.trim(), 
        subject_code ? subject_code.trim().toUpperCase() : null,
        subject_type || 'Theory',
        description || null, 
        is_active !== false,
        userId
      ]
    );
    return success(res, 201, 'Subject created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating subject:', error);
    if (error.code === '23505') return errorResponse(res, 409, 'Subject with this code already exists');
    return errorResponse(res, 500, 'Failed to create subject');
  }
};

// Update master subject
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_name, subject_code, subject_type, description, is_active } = req.body;
    
    const current = await query('SELECT * FROM subjects WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Subject not found');
    
    const cur = current.rows[0];
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const result = await query(`
      UPDATE subjects
      SET subject_name = $1,
          subject_code = $2,
          subject_type = $3,
          description = $4,
          is_active = $5,
          updated_at = NOW(),
          updated_by = $6
      WHERE id = $7
      RETURNING *
    `, [
      subject_name !== undefined ? subject_name.trim() : cur.subject_name,
      subject_code !== undefined ? (subject_code ? subject_code.trim().toUpperCase() : null) : cur.subject_code,
      subject_type !== undefined ? subject_type : cur.subject_type,
      description !== undefined ? description : cur.description,
      is_active !== undefined ? !!is_active : cur.is_active,
      userId,
      id
    ]);

    return success(res, 200, 'Subject updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    if (error.code === '23505') return errorResponse(res, 409, 'Subject with this code already exists');
    return errorResponse(res, 500, 'Failed to update subject');
  }
};

// Soft delete master subject
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const result = await query(
      'UPDATE subjects SET deleted_at = NOW(), updated_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id', 
      [userId, id]
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Subject not found');
    }
    return success(res, 200, 'Subject deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting subject:', error);
    if (error.code === '23503') return errorResponse(res, 409, 'Subject is referenced by curriculum records and cannot be deleted');
    return errorResponse(res, 500, 'Failed to delete subject');
  }
};

module.exports = {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
