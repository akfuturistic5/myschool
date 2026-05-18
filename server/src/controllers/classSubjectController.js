const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { canAccessClass } = require('../utils/accessControl');

/**
 * Class Subject Controller (Curriculum)
 * Handles mapping master subjects to classes per academic year.
 */

const getAllClassSubjects = async (req, res) => {
  try {
    const { class_id, academic_year_id } = req.query;
    
    const params = [];
    let sql = `
      SELECT
        cs.id,
        cs.class_id,
        cs.subject_id,
        cs.academic_year_id,
        cs.is_elective,
        cs.elective_group_id,
        eg.group_name as elective_group_name,
        s.subject_name,
        s.subject_code,
        s.subject_type,
        s.subject_type as subject_mode,
        c.class_name,
        c.class_code
      FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      JOIN classes c ON cs.class_id = c.id
      LEFT JOIN subject_elective_groups eg ON cs.elective_group_id = eg.id
      WHERE cs.deleted_at IS NULL
    `;

    if (class_id) {
      params.push(class_id);
      sql += ` AND cs.class_id = $${params.length}`;
    }
    if (academic_year_id) {
      params.push(academic_year_id);
      sql += ` AND cs.academic_year_id = $${params.length}`;
    }

    sql += ` ORDER BY c.class_name, cs.elective_group_id NULLS FIRST, s.subject_name ASC`;

    const result = await query(sql, params);
    return success(res, 200, 'Class subjects fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    return errorResponse(res, 500, 'Failed to fetch class subjects');
  }
};

const getSubjectsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academic_year_id } = req.query;

    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }

    const params = [classId];
    let sql = `
      SELECT
        s.id as master_subject_id,
        s.subject_name,
        s.subject_code,
        s.subject_type,
        s.subject_type as subject_mode,
        cs.id,
        cs.class_id,
        cs.subject_id,
        cs.academic_year_id,
        cs.is_elective,
        cs.elective_group_id,
        eg.group_name as elective_group_name,
        s.description
      FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      LEFT JOIN subject_elective_groups eg ON cs.elective_group_id = eg.id
      WHERE cs.class_id = $1 AND cs.deleted_at IS NULL
    `;

    if (academic_year_id) {
      params.push(academic_year_id);
      sql += ` AND cs.academic_year_id = $${params.length}`;
    }

    sql += ` ORDER BY cs.elective_group_id NULLS FIRST, s.subject_name ASC`;

    const result = await query(sql, params);
    return success(res, 200, 'Class subjects fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    return errorResponse(res, 500, 'Failed to fetch class subjects');
  }
};

const assignSubjectToClass = async (req, res) => {
  try {
    const { class_id, subject_id, academic_year_id, is_elective, elective_group_id } = req.body;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    // Check if assignment already exists
    const existing = await query(
      'SELECT id FROM class_subjects WHERE class_id = $1 AND subject_id = $2 AND academic_year_id = $3 AND deleted_at IS NULL',
      [class_id, subject_id, academic_year_id]
    );

    if (existing.rows.length > 0) {
      return errorResponse(res, 409, 'This subject is already assigned to this class for the selected academic year');
    }

    // Check if group limit is exceeded (scoped per class and academic year)
    if (is_elective && elective_group_id) {
      const groupRes = await query('SELECT max_subjects FROM subject_elective_groups WHERE id = $1', [elective_group_id]);
      const maxSubjects = groupRes.rows[0]?.max_subjects || 0;
      
      if (maxSubjects > 0) {
        const countRes = await query(
          'SELECT COUNT(id) FROM class_subjects WHERE elective_group_id = $1 AND class_id = $2 AND academic_year_id = $3 AND deleted_at IS NULL', 
          [elective_group_id, class_id, academic_year_id]
        );
        if (Number(countRes.rows[0].count) >= maxSubjects) {
          return errorResponse(res, 400, `This elective group has reached its maximum capacity of ${maxSubjects} subjects.`);
        }
      }
    }

    const result = await query(
      `INSERT INTO class_subjects (class_id, subject_id, academic_year_id, is_elective, elective_group_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [class_id, subject_id, academic_year_id, !!is_elective, elective_group_id || null, userId]
    );

    return success(res, 201, 'Subject assigned to class successfully', result.rows[0]);
  } catch (error) {
    console.error('Error assigning subject to class:', error);
    return errorResponse(res, 500, 'Failed to assign subject to class');
  }
};

const updateClassSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_elective, elective_group_id } = req.body;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    // Fetch class_id and academic_year_id of this class subject to scope the check
    const subjectInfoRes = await query(
      'SELECT class_id, academic_year_id FROM class_subjects WHERE id = $1',
      [id]
    );
    if (subjectInfoRes.rows.length === 0) {
      return errorResponse(res, 404, 'Class subject assignment not found');
    }
    const { class_id, academic_year_id } = subjectInfoRes.rows[0];

    // Check if group limit is exceeded (scoped per class and academic year)
    if (is_elective && elective_group_id) {
      const groupRes = await query('SELECT max_subjects FROM subject_elective_groups WHERE id = $1', [elective_group_id]);
      const maxSubjects = groupRes.rows[0]?.max_subjects || 0;
      
      if (maxSubjects > 0) {
        const countRes = await query(
          'SELECT COUNT(id) FROM class_subjects WHERE elective_group_id = $1 AND class_id = $2 AND academic_year_id = $3 AND deleted_at IS NULL AND id != $4', 
          [elective_group_id, class_id, academic_year_id, id]
        );
        if (Number(countRes.rows[0].count) >= maxSubjects) {
          return errorResponse(res, 400, `This elective group has reached its maximum capacity of ${maxSubjects} subjects.`);
        }
      }
    }

    const result = await query(
      `UPDATE class_subjects 
       SET is_elective = $1, elective_group_id = $2, updated_at = NOW(), updated_by = $3 
       WHERE id = $4 AND deleted_at IS NULL RETURNING *`,
      [!!is_elective, elective_group_id || null, userId, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Class subject assignment not found');
    }

    return success(res, 200, 'Assignment updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating class subject:', error);
    return errorResponse(res, 500, 'Failed to update assignment');
  }
};

const removeClassSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const result = await query(
      'UPDATE class_subjects SET deleted_at = NOW(), updated_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id',
      [userId, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Assignment not found');
    }

    return success(res, 200, 'Subject removed from class successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error removing class subject:', error);
    if (error.code === '23503') {
      return errorResponse(res, 409, 'Cannot remove subject; it is currently assigned to a teacher or scheduled in the timetable');
    }
    return errorResponse(res, 500, 'Failed to remove subject from class');
  }
};

module.exports = {
  getAllClassSubjects,
  getSubjectsByClass,
  assignSubjectToClass,
  updateClassSubject,
  removeClassSubject,
};
