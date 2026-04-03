const { query } = require('../config/database');

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
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Classes fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch classes',
    });
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
      return res.status(404).json({
        status: 'ERROR',
        message: 'Class not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch class',
    });
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

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Classes fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching classes by academic year:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch classes',
    });
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { class_name, no_of_students, is_active } = req.body;

    if (!class_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Class name is required'
      });
    }

    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    } else {
      isActiveBoolean = false;
    }

    const noOfStudents = no_of_students != null ? parseInt(no_of_students, 10) : null;

    const result = await query(`
      UPDATE classes SET
        class_name = $1,
        no_of_students = $2,
        is_active = $3,
        modified_at = NOW()
      WHERE id = $4
      RETURNING id, class_name, class_code, is_active, no_of_students, created_at, modified_at
    `, [class_name, noOfStudents, isActiveBoolean, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Class not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update class',
    });
  }
};

module.exports = {
  getAllClasses,
  getClassById,
  getClassesByAcademicYear,
  updateClass
};
