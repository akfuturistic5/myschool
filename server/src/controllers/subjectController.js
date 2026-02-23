const { query } = require('../config/database');

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
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Subjects fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch subjects',
    });
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
      return res.status(404).json({
        status: 'ERROR',
        message: 'Subject not found'
      });
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Subject fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch subject',
    });
  }
};

// Get subjects by class
const getSubjectsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    
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
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Subjects fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching subjects by class:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch subjects',
    });
  }
};

// Update subject (name + status)
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_name, is_active } = req.body;

    console.log('=== UPDATE SUBJECT REQUEST ===');
    console.log('Params:', { id });
    console.log('Body:', { subject_name, is_active, is_active_type: typeof is_active });

    // Validate required fields
    if (!subject_name || !subject_name.trim()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Subject name is required'
      });
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
      return res.status(404).json({
        status: 'ERROR',
        message: 'Subject not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Subject updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update subject' : `Failed to update subject: ${error.message || 'Unknown error'}`,
    });
  }
};

module.exports = {
  getAllSubjects,
  getSubjectById,
  getSubjectsByClass,
  updateSubject
};
