const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const getAllGroups = async (req, res) => {
  try {
    const { class_id } = req.query;
    let sql = 'SELECT * FROM subject_elective_groups WHERE deleted_at IS NULL';
    const params = [];

    if (class_id) {
      params.push(class_id);
      sql += ` AND class_id = $${params.length}`;
    }

    sql += ' ORDER BY group_name ASC';
    
    const result = await query(sql, params);
    return success(res, 200, 'Elective groups fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching elective groups:', error);
    return errorResponse(res, 500, 'Failed to fetch elective groups');
  }
};

const createGroup = async (req, res) => {
  try {
    const { group_name, description, class_id } = req.body;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    if (!class_id) {
      return errorResponse(res, 400, 'Class ID is required to create an elective group');
    }

    const result = await query(
      `INSERT INTO subject_elective_groups (group_name, description, class_id, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [group_name.trim(), description || null, class_id, userId]
    );

    return success(res, 201, 'Elective group created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating elective group:', error);
    return errorResponse(res, 500, 'Failed to create elective group');
  }
};

const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { group_name, description } = req.body;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const result = await query(
      `UPDATE subject_elective_groups 
       SET group_name = $1, description = $2, updated_at = NOW(), updated_by = $3 
       WHERE id = $4 AND deleted_at IS NULL RETURNING *`,
      [group_name.trim(), description || null, userId, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Elective group not found');
    }

    return success(res, 200, 'Elective group updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating elective group:', error);
    return errorResponse(res, 500, 'Failed to update elective group');
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const used = await query(
      'SELECT id FROM class_subjects WHERE elective_group_id = $1 AND deleted_at IS NULL LIMIT 1',
      [id]
    );

    if (used.rows.length > 0) {
      return errorResponse(res, 409, 'Cannot delete group; it is currently assigned to subjects in the curriculum');
    }

    const result = await query(
      'UPDATE subject_elective_groups SET deleted_at = NOW(), updated_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id',
      [userId, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Elective group not found');
    }

    return success(res, 200, 'Elective group deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting elective group:', error);
    return errorResponse(res, 500, 'Failed to delete elective group');
  }
};

module.exports = {
  getAllGroups,
  createGroup,
  updateGroup,
  deleteGroup,
};
