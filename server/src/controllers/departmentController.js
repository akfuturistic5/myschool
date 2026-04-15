const { query } = require('../config/database');

const MAX_DEPARTMENT_NAME_LEN = 100;

function normalizeBoolean(value, defaultValue = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const s = value.toLowerCase();
    if (s === 'true' || s === '1' || s === 't') return true;
    if (s === 'false' || s === '0' || s === 'f') return false;
  }
  if (value === null || typeof value === 'undefined') return defaultValue;
  return defaultValue;
}

function parsePositiveIntId(raw) {
  const id = parseInt(String(raw), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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
    const id = parsePositiveIntId(req.params.id);
    if (!id) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Invalid department id',
      });
    }

    const { department_name, is_active } = req.body;

    let nameForUpdate = null;
    if (typeof department_name === 'string') {
      const t = department_name.trim().slice(0, MAX_DEPARTMENT_NAME_LEN);
      nameForUpdate = t === '' ? null : t;
    } else if (department_name != null) {
      nameForUpdate = department_name;
    }

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
      [nameForUpdate, normalizedIsActive, id]
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
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'DUPLICATE',
        message: 'A department with this name already exists',
      });
    }
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update department',
    });
  }
};

// Create department (admin)
const createDepartment = async (req, res) => {
  try {
    const rawName = req.body?.department_name ?? req.body?.department ?? req.body?.name;
    const name =
      typeof rawName === 'string'
        ? rawName.trim().slice(0, MAX_DEPARTMENT_NAME_LEN)
        : '';

    if (!name) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Department name is required',
      });
    }

    const isActive = normalizeBoolean(req.body?.is_active, true);
    const createdBy =
      req.user && req.user.id != null ? parsePositiveIntId(req.user.id) : null;

    const result = await query(
      `
      INSERT INTO departments (department_name, is_active, created_by, modified_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `,
      [name, isActive, createdBy]
    );

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Department created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating department:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'DUPLICATE',
        message: 'A department with this name already exists',
      });
    }
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create department',
    });
  }
};

// Delete department (admin) — blocked if staff or designations reference it
const deleteDepartment = async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (!id) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Invalid department id',
      });
    }

    const staffCount = await query(
      `SELECT COUNT(*)::int AS c FROM staff WHERE department_id = $1`,
      [id]
    );
    const desigCount = await query(
      `SELECT COUNT(*)::int AS c FROM designations WHERE department_id = $1`,
      [id]
    );

    const sc = staffCount.rows[0]?.c ?? 0;
    const dc = desigCount.rows[0]?.c ?? 0;
    if (sc > 0 || dc > 0) {
      return res.status(409).json({
        status: 'ERROR',
        code: 'IN_USE',
        message:
          'Cannot delete this department because it is assigned to staff or designations. Reassign or remove those records first.',
      });
    }

    const result = await query(
      `DELETE FROM departments WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Department not found',
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Department deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    if (error.code === '23503') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'IN_USE',
        message:
          'Cannot delete this department because other records still reference it.',
      });
    }
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to delete department',
    });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  createDepartment,
  deleteDepartment,
};
