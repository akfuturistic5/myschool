const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const MAX_NAME_LEN = 100;
const MAX_DESC_LEN = 5000;

function parsePositiveIntId(raw) {
  const id = parseInt(String(raw), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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

function normalizeDescription(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().slice(0, MAX_DESC_LEN);
  return t === '' ? null : t;
}

/** @returns {number|null|undefined} undefined = omit (keep existing on update); null = clear */
function parseSalaryField(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

function assertSalaryOrder(min, max) {
  if (min != null && max != null && min > max) {
    const err = new Error('SALARY_RANGE');
    err.code = 'SALARY_RANGE';
    throw err;
  }
}

async function assertDepartmentExists(departmentId) {
  if (departmentId == null) return;
  const r = await query(`SELECT 1 FROM departments WHERE id = $1 LIMIT 1`, [departmentId]);
  if (r.rows.length === 0) {
    const err = new Error('INVALID_DEPARTMENT');
    err.code = 'INVALID_DEPARTMENT';
    throw err;
  }
}

// Get all designations
const getAllDesignations = async (req, res) => {
  try {
    const result = await query(`
      SELECT *
      FROM designations
      ORDER BY id ASC
    `);

    return success(res, 200, 'Designations fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching designations:', error);
    return errorResponse(res, 500, 'Failed to fetch designations');
  }
};

// Get designation by ID
const getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT *
      FROM designations
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Designation not found');
    }

    return success(res, 200, 'Designation fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching designation by ID:', error);
    return errorResponse(res, 500, 'Failed to fetch designation');
  }
};

const createDesignation = async (req, res) => {
  try {
    const {
      designation_name: nameRaw,
      department_id: deptRaw,
      salary_range_min: minRaw,
      salary_range_max: maxRaw,
      description: descRaw,
      is_active: activeRaw,
    } = req.body;

    const name = String(nameRaw).trim().slice(0, MAX_NAME_LEN);
    if (!name) {
      return errorResponse(res, 400, 'Designation name is required', 'VALIDATION_ERROR');
    }

    const departmentId = deptRaw == null ? null : parsePositiveIntId(deptRaw);
    if (deptRaw != null && departmentId == null) {
      return errorResponse(res, 400, 'Invalid department', 'VALIDATION_ERROR');
    }

    const salaryMin = parseSalaryField(minRaw);
    const salaryMax = parseSalaryField(maxRaw);
    if (Number.isNaN(salaryMin) || Number.isNaN(salaryMax)) {
      return errorResponse(res, 400, 'Invalid salary range value', 'VALIDATION_ERROR');
    }
    try {
      assertSalaryOrder(salaryMin ?? null, salaryMax ?? null);
    } catch (e) {
      if (e.code === 'SALARY_RANGE') {
        return errorResponse(
          res,
          400,
          'salary_range_min must be less than or equal to salary_range_max',
          'VALIDATION_ERROR'
        );
      }
      throw e;
    }

    const description = normalizeDescription(descRaw);
    const isActive = normalizeBoolean(activeRaw, true);
    const userId = req.user && req.user.id != null ? parsePositiveIntId(req.user.id) : null;

    try {
      await assertDepartmentExists(departmentId);
    } catch (e) {
      if (e.code === 'INVALID_DEPARTMENT') {
        return errorResponse(res, 400, 'Department does not exist', 'VALIDATION_ERROR');
      }
      throw e;
    }

    const result = await query(
      `
      INSERT INTO designations (
        designation_name,
        department_id,
        salary_range_min,
        salary_range_max,
        description,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [name, departmentId, salaryMin ?? null, salaryMax ?? null, description, isActive, userId, userId]
    );

    return success(res, 201, 'Designation created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating designation:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'A designation with this name already exists', 'DUPLICATE');
    }
    if (error.code === '42703') {
      return errorResponse(
        res,
        500,
        'Database schema is missing columns on designations. Run migration 057_designations_updated_at_columns.sql.',
        'SCHEMA_ERROR'
      );
    }
    return errorResponse(res, 500, 'Failed to create designation');
  }
};

// Update designation
const updateDesignation = async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (!id) {
      return errorResponse(res, 400, 'Invalid designation id', 'VALIDATION_ERROR');
    }

    const existing = await query(`SELECT * FROM designations WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Designation not found');
    }
    const row = existing.rows[0];
    const body = req.body;

    let newName = row.designation_name;
    if (typeof body.designation_name === 'string') {
      const t = body.designation_name.trim().slice(0, MAX_NAME_LEN);
      newName = t === '' ? null : t;
    } else if (typeof body.designation === 'string') {
      const t = body.designation.trim().slice(0, MAX_NAME_LEN);
      newName = t === '' ? null : t;
    } else if (typeof body.name === 'string') {
      const t = body.name.trim().slice(0, MAX_NAME_LEN);
      newName = t === '' ? null : t;
    }
    if (newName == null) {
      return errorResponse(res, 400, 'Designation name is required', 'VALIDATION_ERROR');
    }

    let departmentId = row.department_id;
    if (Object.prototype.hasOwnProperty.call(body, 'department_id')) {
      const v = body.department_id;
      departmentId = v == null ? null : parsePositiveIntId(v);
      if (v != null && departmentId == null) {
        return errorResponse(res, 400, 'Invalid department', 'VALIDATION_ERROR');
      }
    }

    let salaryMin = row.salary_range_min != null ? Number(row.salary_range_min) : null;
    let salaryMax = row.salary_range_max != null ? Number(row.salary_range_max) : null;
    if (Object.prototype.hasOwnProperty.call(body, 'salary_range_min')) {
      const p = parseSalaryField(body.salary_range_min);
      if (Number.isNaN(p)) {
        return errorResponse(res, 400, 'Invalid salary range value', 'VALIDATION_ERROR');
      }
      salaryMin = p === undefined ? salaryMin : p;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'salary_range_max')) {
      const p = parseSalaryField(body.salary_range_max);
      if (Number.isNaN(p)) {
        return errorResponse(res, 400, 'Invalid salary range value', 'VALIDATION_ERROR');
      }
      salaryMax = p === undefined ? salaryMax : p;
    }

    try {
      assertSalaryOrder(salaryMin, salaryMax);
    } catch (e) {
      if (e.code === 'SALARY_RANGE') {
        return errorResponse(
          res,
          400,
          'salary_range_min must be less than or equal to salary_range_max',
          'VALIDATION_ERROR'
        );
      }
      throw e;
    }

    let description = row.description;
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      description = normalizeDescription(body.description);
    }

    let isActiveBoolean = row.is_active;
    if (typeof body.is_active === 'boolean') {
      isActiveBoolean = body.is_active;
    } else if (typeof body.is_active === 'number') {
      isActiveBoolean = body.is_active === 1;
    } else if (typeof body.is_active === 'string') {
      const s = body.is_active.toLowerCase();
      isActiveBoolean = s === 'true' || s === '1' || s === 't';
    }

    try {
      await assertDepartmentExists(departmentId);
    } catch (e) {
      if (e.code === 'INVALID_DEPARTMENT') {
        return errorResponse(res, 400, 'Department does not exist', 'VALIDATION_ERROR');
      }
      throw e;
    }

    const updatedBy = req.user && req.user.id != null ? parsePositiveIntId(req.user.id) : null;

    const result = await query(
      `
      UPDATE designations
      SET designation_name = $1,
          department_id = $2,
          salary_range_min = $3,
          salary_range_max = $4,
          description = $5,
          is_active = $6,
          updated_at = NOW(),
          updated_by = $7
      WHERE id = $8
      RETURNING *
    `,
      [newName, departmentId, salaryMin, salaryMax, description, isActiveBoolean, updatedBy, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Designation not found');
    }

    return success(res, 200, 'Designation updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating designation:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'A designation with this name already exists', 'DUPLICATE');
    }
    if (error.code === '42703') {
      return errorResponse(
        res,
        500,
        'Database schema is missing updated_at/updated_by on designations. Run migration 057_designations_updated_at_columns.sql.',
        'SCHEMA_ERROR'
      );
    }
    return errorResponse(res, 500, 'Failed to update designation');
  }
};

module.exports = {
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
};
