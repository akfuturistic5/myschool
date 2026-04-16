const { query } = require('../config/database');
const { ROLES } = require('../config/roles');

const PROTECTED_ROLE_IDS = new Set(Object.values(ROLES));

function normalizeRoleName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeDescription(value) {
  return String(value || '').trim();
}

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

// Create user role
const createUserRole = async (req, res) => {
  try {
    const roleName = normalizeRoleName(req.body?.role_name);
    const description = normalizeDescription(req.body?.description);
    const createdBy = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;

    if (!roleName) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role name is required',
      });
    }
    if (roleName.length > 50) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role name must be 50 characters or less',
      });
    }
    if (description.length > 1000) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Description must be 1000 characters or less',
      });
    }

    const duplicate = await query(
      `
      SELECT id
      FROM user_roles
      WHERE LOWER(TRIM(role_name)) = LOWER(TRIM($1))
      LIMIT 1
    `,
      [roleName]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Role name already exists',
      });
    }

    const result = await query(
      `
      INSERT INTO user_roles (role_name, description, is_active, created_by)
      VALUES ($1, NULLIF($2, ''), true, $3)
      RETURNING *
    `,
      [roleName, description, createdBy]
    );

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'User role created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating user role:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create user role',
    });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const roleName = normalizeRoleName(req.body?.role_name);
    const description = normalizeDescription(req.body?.description);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid role id',
      });
    }
    if (!roleName) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role name is required',
      });
    }
    if (roleName.length > 50) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Role name must be 50 characters or less',
      });
    }
    if (description.length > 1000) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Description must be 1000 characters or less',
      });
    }
    if (PROTECTED_ROLE_IDS.has(id)) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Default system roles cannot be modified',
      });
    }

    const duplicate = await query(
      `
      SELECT id
      FROM user_roles
      WHERE id <> $1
        AND LOWER(TRIM(role_name)) = LOWER(TRIM($2))
      LIMIT 1
    `,
      [id, roleName]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Role name already exists',
      });
    }

    const result = await query(
      `
      UPDATE user_roles
      SET role_name = $2,
          description = NULLIF($3, ''),
          modified_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND is_active = true
      RETURNING *
    `,
      [id, roleName, description]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User role not found',
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'User role updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update user role',
    });
  }
};

// Delete user role (soft delete)
const deleteUserRole = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid role id',
      });
    }
    if (PROTECTED_ROLE_IDS.has(id)) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Default system roles cannot be deleted',
      });
    }

    const inUse = await query(
      `
      SELECT 1
      FROM users
      WHERE role_id = $1
      LIMIT 1
    `,
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Role is in use by users and cannot be deleted',
      });
    }

    const result = await query(
      `
      UPDATE user_roles
      SET is_active = false,
          modified_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND is_active = true
      RETURNING id
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User role not found',
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'User role deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user role:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to delete user role',
    });
  }
};

module.exports = {
  getAllUserRoles,
  getUserRoleById,
  createUserRole,
  updateUserRole,
  deleteUserRole,
};
