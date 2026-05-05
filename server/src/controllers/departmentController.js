const { query } = require('../config/database');

const MAX_DEPARTMENT_NAME_LEN = 100;
const MAX_DEPARTMENT_CODE_LEN = 10;

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

function normalizeDepartmentCode(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, MAX_DEPARTMENT_CODE_LEN);
  return t === '' ? null : t;
}

async function assertValidHeadOfDepartment(staffId) {
  if (staffId == null) return;
  const r = await query(`SELECT id FROM staff WHERE id = $1`, [staffId]);
  if (r.rows.length === 0) {
    const err = new Error('INVALID_HOD');
    err.code = 'INVALID_HOD';
    throw err;
  }
}

// Get all departments
const getAllDepartments = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        d.*,
        TRIM(
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))
        ) AS head_of_department_name
      FROM departments d
      LEFT JOIN staff h ON h.id = d.head_of_department
      LEFT JOIN users u ON u.id = h.user_id
      ORDER BY d.id ASC
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
    const result = await query(
      `
      SELECT
        d.*,
        TRIM(
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))
        ) AS head_of_department_name
      FROM departments d
      LEFT JOIN staff h ON h.id = d.head_of_department
      LEFT JOIN users u ON u.id = h.user_id
      WHERE d.id = $1
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

    const existing = await query(`SELECT * FROM departments WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Department not found',
      });
    }
    const row = existing.rows[0];
    const body = req.body;

    let nameForUpdate = row.department_name;
    if (typeof body.department_name === 'string') {
      const t = body.department_name.trim().slice(0, MAX_DEPARTMENT_NAME_LEN);
      nameForUpdate = t === '' ? null : t;
      if (nameForUpdate == null) {
        return res.status(400).json({
          status: 'ERROR',
          code: 'VALIDATION_ERROR',
          message: 'Department name cannot be empty',
        });
      }
    }

    let codeForUpdate = row.department_code;
    if (Object.prototype.hasOwnProperty.call(body, 'department_code')) {
      codeForUpdate = normalizeDepartmentCode(body.department_code);
    }

    let hodForUpdate = row.head_of_department;
    if (Object.prototype.hasOwnProperty.call(body, 'head_of_department')) {
      const v = body.head_of_department;
      hodForUpdate = v == null ? null : parsePositiveIntId(v);
      if (v != null && hodForUpdate == null) {
        return res.status(400).json({
          status: 'ERROR',
          code: 'VALIDATION_ERROR',
          message: 'Invalid head of department staff id',
        });
      }
    }

    let normalizedIsActive = row.is_active;
    if (typeof body.is_active === 'boolean') {
      normalizedIsActive = body.is_active;
    } else if (typeof body.is_active === 'number') {
      normalizedIsActive = body.is_active === 1;
    } else if (typeof body.is_active === 'string') {
      normalizedIsActive = body.is_active.toLowerCase() === 'true' || body.is_active === '1';
    }

    try {
      await assertValidHeadOfDepartment(hodForUpdate);
    } catch (e) {
      if (e.code === 'INVALID_HOD') {
        return res.status(400).json({
          status: 'ERROR',
          code: 'VALIDATION_ERROR',
          message: 'Head of department must be an existing staff member',
        });
      }
      throw e;
    }

    const updatedBy =
      req.user && req.user.id != null ? parsePositiveIntId(req.user.id) : null;

    const result = await query(
      `
      UPDATE departments
      SET
        department_name = $1,
        department_code = $2,
        head_of_department = $3,
        is_active = $4,
        updated_at = NOW(),
        updated_by = $5
      WHERE id = $6
      RETURNING *
    `,
      [nameForUpdate, codeForUpdate, hodForUpdate, normalizedIsActive, updatedBy, id]
    );

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
        message: 'A department with this name or code already exists',
      });
    }
    if (error.code === '42703') {
      return res.status(500).json({
        status: 'ERROR',
        message:
          'Database schema is missing updated_at/updated_by on departments. Run migration 056_departments_updated_at_columns.sql.',
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
    const name = String(req.body.department_name).trim().slice(0, MAX_DEPARTMENT_NAME_LEN);

    const isActive = normalizeBoolean(req.body?.is_active, true);
    const departmentCode = normalizeDepartmentCode(req.body?.department_code);
    const hodRaw = req.body?.head_of_department;
    const headOfDepartment = hodRaw == null ? null : parsePositiveIntId(hodRaw);
    if (hodRaw != null && headOfDepartment == null) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Invalid head of department staff id',
      });
    }

    try {
      await assertValidHeadOfDepartment(headOfDepartment);
    } catch (e) {
      if (e.code === 'INVALID_HOD') {
        return res.status(400).json({
          status: 'ERROR',
          code: 'VALIDATION_ERROR',
          message: 'Head of department must be an existing staff member',
        });
      }
      throw e;
    }

    const userId =
      req.user && req.user.id != null ? parsePositiveIntId(req.user.id) : null;

    const result = await query(
      `
      INSERT INTO departments (
        department_name,
        department_code,
        head_of_department,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [name, departmentCode, headOfDepartment, isActive, userId, userId]
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
        message: 'A department with this name or code already exists',
      });
    }
    if (error.code === '42703') {
      return res.status(500).json({
        status: 'ERROR',
        message:
          'Database schema is missing columns on departments. Run migrations (updated_at/updated_by or department_code/head_of_department).',
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
    res.status(500).json({
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
