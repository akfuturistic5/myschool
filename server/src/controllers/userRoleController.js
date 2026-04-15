const { query } = require('../config/database');

// Get all user roles
const getAllUserRoles = async (req, res) => {
  try {
    // Use exact table name: user_roles (plural)
    const result = await query(`
      SELECT *
      FROM user_roles
      WHERE is_active = true
      ORDER BY id ASC
    `);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'User roles fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch user roles',
    });
  }
};

// Get user role by ID
const getUserRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use exact table name: user_roles (plural)
    const result = await query(
      `
      SELECT *
      FROM user_roles
      WHERE id = $1 AND is_active = true
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User role not found',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'User role fetched successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching user role by ID:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch user role',
    });
  }
};

module.exports = {
  getAllUserRoles,
  getUserRoleById,
};
