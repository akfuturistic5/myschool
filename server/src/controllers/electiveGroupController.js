const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { canAccessClass, parseId } = require('../utils/accessControl');

async function getGroupClassId(groupId) {
  const res = await query(
    'SELECT class_id FROM subject_elective_groups WHERE id = $1 AND deleted_at IS NULL',
    [groupId]
  );
  return res.rows[0]?.class_id ?? null;
}

const getAllGroups = async (req, res) => {
  try {
    const { class_id } = req.query;

    if (!class_id) {
      return errorResponse(res, 400, 'class_id is required to fetch elective groups');
    }

    const access = await canAccessClass(req, class_id);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }

    const result = await query(
      `SELECT * FROM subject_elective_groups
       WHERE deleted_at IS NULL AND class_id = $1
       ORDER BY group_name ASC`,
      [class_id]
    );
    return success(res, 200, 'Elective groups fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching elective groups:', error);
    return errorResponse(res, 500, 'Failed to fetch elective groups');
  }
};

const createGroup = async (req, res) => {
  try {
    const { group_name, description, class_id, max_subjects, selectable_subjects } = req.body;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    if (!class_id) {
      return errorResponse(res, 400, 'Class ID is required to create an elective group');
    }

    const access = await canAccessClass(req, class_id);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }

    const result = await query(
      `INSERT INTO subject_elective_groups (group_name, description, class_id, max_subjects, selectable_subjects, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        group_name.trim(), 
        description || null, 
        class_id, 
        parseInt(max_subjects, 10) || 0, 
        parseInt(selectable_subjects, 10) || 0, 
        userId
      ]
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
    const groupId = parseId(id);
    if (!groupId) {
      return errorResponse(res, 400, 'Invalid elective group id');
    }

    const groupClassId = await getGroupClassId(groupId);
    if (!groupClassId) {
      return errorResponse(res, 404, 'Elective group not found');
    }

    const access = await canAccessClass(req, groupClassId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }

    const { group_name, description, max_subjects, selectable_subjects } = req.body;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const result = await query(
      `UPDATE subject_elective_groups 
       SET group_name = $1, 
           description = $2, 
           max_subjects = $3, 
           selectable_subjects = $4, 
           updated_at = NOW(), 
           updated_by = $5 
       WHERE id = $6 AND deleted_at IS NULL RETURNING *`,
      [
        group_name.trim(), 
        description || null, 
        parseInt(max_subjects, 10) || 0, 
        parseInt(selectable_subjects, 10) || 0, 
        userId, 
        id
      ]
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
    const groupId = parseId(id);
    if (!groupId) {
      return errorResponse(res, 400, 'Invalid elective group id');
    }

    const groupClassId = await getGroupClassId(groupId);
    if (!groupClassId) {
      return errorResponse(res, 404, 'Elective group not found');
    }

    const access = await canAccessClass(req, groupClassId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }

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
