const { query } = require('../config/database');

// Get all departments
const getAllDepartments = async (req, res) => {
  try {
    // Use exact table name: departments (plural)
    const result = await query(`
      SELECT *
      FROM departments
      ORDER BY id ASC
    `);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Departments fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch departments',
    });
  }
};

// Get department by ID
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use exact table name: departments (plural)
    const result = await query(
      `
      SELECT *
      FROM departments
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Department not found',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Department fetched successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching department by ID:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch department',
    });
  }
};

// Update department
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_name, is_active } = req.body;

    // Normalize is_active to boolean
    let normalizedIsActive;
    if (typeof is_active === 'boolean') {
      normalizedIsActive = is_active;
    } else if (typeof is_active === 'number') {
      normalizedIsActive = is_active === 1;
    } else if (typeof is_active === 'string') {
      normalizedIsActive = is_active.toLowerCase() === 'true' || is_active === '1';
    } else if (is_active === null || typeof is_active === 'undefined') {
      normalizedIsActive = null;
    } else {
      normalizedIsActive = true;
    }

    const result = await query(
      `
      UPDATE departments
      SET
        department_name = COALESCE($1, department_name),
        is_active = COALESCE($2, is_active),
        modified_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
      [department_name ?? null, normalizedIsActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Department not found',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Department updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update department',
    });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
};
