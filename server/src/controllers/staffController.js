const { query } = require('../config/database');
const { ADMIN_ROLE_IDS } = require('../config/roles');
const { success, error: errorResponse } = require('../utils/responseHelper');

// Get all staff members
const getAllStaff = async (req, res) => {
  try {
    // JOIN with departments and designations tables to get names
    const result = await query(`
      SELECT 
        s.*,
        d.department_name as department_name,
        d.department_name as department,
        des.designation_name as designation_name,
        des.designation_name as designation
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN designations des ON s.designation_id = des.id
      WHERE s.is_active = true
      ORDER BY s.first_name ASC, s.last_name ASC
    `);

    return success(res, 200, 'Staff fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return errorResponse(res, 500, 'Failed to fetch staff');
  }
};

// Get single staff member by ID
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    const roleId = requester?.role_id != null ? parseInt(requester.role_id, 10) : null;
    if (!requester?.id || roleId == null) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    // JOIN with departments and designations tables to get names
    const result = await query(
      `
      SELECT 
        s.*,
        s.user_id,
        d.department_name as department_name,
        d.department_name as department,
        des.designation_name as designation_name,
        des.designation_name as designation
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN designations des ON s.designation_id = des.id
      WHERE s.id = $1 AND s.is_active = true
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Staff not found');
    }

    const row = result.rows[0];
    const isAdmin = roleId != null && ADMIN_ROLE_IDS.includes(roleId);
    const isSelf = String(row.user_id) === String(requester.id);
    if (!isAdmin && !isSelf) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }

    return success(res, 200, 'Staff fetched successfully', row);
  } catch (error) {
    console.error('Error fetching staff by ID:', error);
    return errorResponse(res, 500, 'Failed to fetch staff');
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
};

