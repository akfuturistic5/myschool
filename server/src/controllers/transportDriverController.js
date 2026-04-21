const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId } = require('../utils/driverTransportAccess');
const bcrypt = require('bcryptjs');
const { resolveAcademicYearId, toPositiveInt } = require('../utils/academicYear');
const { hasColumn } = require('../utils/schemaInspector');

const TRANSPORT_ROLES = ['driver', 'conductor'];

function normalizeTransportRole(role) {
  const normalized = String(role || 'driver').trim().toLowerCase();
  return TRANSPORT_ROLES.includes(normalized) ? normalized : 'driver';
}

function splitName(fullName = '') {
  const trimmed = String(fullName).trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

async function getRoleIdByName(roleName) {
  const res = await query(
    `SELECT id FROM user_roles WHERE LOWER(role_name) = LOWER($1) AND is_active = true LIMIT 1`,
    [roleName]
  );
  return res.rows[0]?.id || null;
}

async function allocateUniqueUsername(base) {
  const root = String(base || 'transport').slice(0, 45);
  const check = await query(`SELECT 1 FROM users WHERE username = $1 LIMIT 1`, [root]);
  if (check.rows.length === 0) return root;

  for (let i = 1; i < 5000; i += 1) {
    const candidate = `${root}.${i}`.slice(0, 50);
    const exists = await query(`SELECT 1 FROM users WHERE username = $1 LIMIT 1`, [candidate]);
    if (exists.rows.length === 0) return candidate;
  }

  return `${root}.${Date.now()}`.slice(0, 50);
}

async function getOrCreateTransportUser({ name, phone, role }) {
  const normalizedRole = normalizeTransportRole(role);
  const roleId = await getRoleIdByName(normalizedRole);
  if (!roleId) {
    const err = new Error(`Role "${normalizedRole}" is not configured in user_roles`);
    err.code = 'ROLE_NOT_FOUND';
    throw err;
  }

  const byPhone = await query(
    `SELECT id FROM users WHERE phone = $1 AND is_active = true LIMIT 1`,
    [phone]
  );
  if (byPhone.rows.length > 0) {
    return byPhone.rows[0].id;
  }

  const { firstName, lastName } = splitName(name);
  const usernameBase = normalizedRole === 'conductor'
    ? `con.${String(phone).replace(/\D/g, '').slice(-8)}`
    : `drv.${String(phone).replace(/\D/g, '').slice(-8)}`;
  const username = await allocateUniqueUsername(usernameBase || normalizedRole);
  const passwordHash = await bcrypt.hash(String(phone), 12);

  const insert = await query(
    `INSERT INTO users (username, email, phone, password_hash, role_id, first_name, last_name, is_active, created_at, modified_at)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, true, NOW(), NOW())
     RETURNING id`,
    [username, phone, passwordHash, roleId, firstName, lastName]
  );
  return insert.rows[0].id;
}

function mapDriverRow(row) {
  return {
    id: row.id,
    driver_code: row.driver_code ?? `DRV-${String(row.id).padStart(4, '0')}`,
    name: row.driver_name || '',
    phone: row.phone ?? '',
    license_number: row.license_number ?? '',
    role: normalizeTransportRole(row.role),
    academic_year_id: row.academic_year_id ?? null,
    address: row.address ?? '',
    user_id: row.user_id ?? null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    photo_url: row.photo_url || null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.modified_at ?? null
  };
}

const getAllDrivers = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('drivers', 'academic_year_id');
    const hasDeletedAt = await hasColumn('drivers', 'deleted_at');
    const scopedDriverId = await getScopedDriverId(req);
    const activeFilter = hasDeletedAt ? 'deleted_at IS NULL' : '(is_active IS NOT FALSE OR is_active IS NULL)';
    if (scopedDriverId != null) {
      const result = await query(
        `SELECT * FROM drivers WHERE id = $1 AND ${activeFilter}`,
        [scopedDriverId]
      );
      const data = result.rows.map(mapDriverRow);
      return success(res, 200, 'Drivers fetched successfully', data, { totalCount: data.length });
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      academic_year_id,
      role,
      status,
      sortField = 'id',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    const scopedAcademicYearId = hasAcademicYearId ? await resolveAcademicYearId(academic_year_id) : null;
    let whereClause = `WHERE ${activeFilter}`;
    const queryParams = [];

    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (driver_name ILIKE $${queryParams.length} OR license_number ILIKE $${queryParams.length} OR phone ILIKE $${queryParams.length})`;
    }

    if (role && role !== 'all') {
      queryParams.push(normalizeTransportRole(role));
      whereClause += ` AND role = $${queryParams.length}`;
    }
    if (hasAcademicYearId && scopedAcademicYearId) {
      queryParams.push(scopedAcademicYearId);
      whereClause += ` AND academic_year_id = $${queryParams.length}`;
    }

    if (status !== undefined && status !== '') {
      const isActive = status === 'active' || status === 'true' || status === true;
      queryParams.push(isActive);
      whereClause += ` AND is_active = $${queryParams.length}`;
    }

    // Sorting
    const allowedSortFields = ['id', 'driver_name', 'phone', 'license_number', 'role', 'is_active', 'created_at'];
    const finalSortField = allowedSortFields.includes(sortField) ? sortField : 'id';
    const finalSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Count query
    const countResult = await query(
      `SELECT COUNT(*) FROM drivers ${whereClause}`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Data query
    const dataResult = await query(
      `SELECT * FROM drivers 
       ${whereClause} 
       ORDER BY ${finalSortField} ${finalSortOrder} 
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const data = dataResult.rows.map(mapDriverRow);

    return success(res, 200, 'Drivers fetched successfully', data, {
      totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return errorResponse(res, 500, 'Failed to fetch drivers');
  }
};

const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const hasDeletedAt = await hasColumn('drivers', 'deleted_at');
    const activeFilter = hasDeletedAt ? 'deleted_at IS NULL' : '(is_active IS NOT FALSE OR is_active IS NULL)';
    const scopedDriverId = await getScopedDriverId(req);
    if (scopedDriverId != null && String(id) !== String(scopedDriverId)) {
      return errorResponse(res, 403, 'Access denied');
    }
    const result = await query(`SELECT * FROM drivers WHERE id = $1 AND ${activeFilter}`, [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Driver not found');
    }
    return success(res, 200, 'Driver fetched successfully', mapDriverRow(result.rows[0]));
  } catch (error) {
    console.error('Error fetching driver:', error);
    return errorResponse(res, 500, 'Failed to fetch driver');
  }
};

const createDriver = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('drivers', 'academic_year_id');
    const hasDeletedAt = await hasColumn('drivers', 'deleted_at');
    const { name, phone, license_number, address, role, is_active, academic_year_id } = req.body;

    if (!name) {
      return errorResponse(res, 400, 'Driver name is required');
    }

    if (!phone) {
      return errorResponse(res, 400, 'Phone number is required');
    }

    // Check if phone number already exists
    const existingPhone = await query(
      `SELECT id FROM drivers WHERE phone = $1 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '(is_active IS NOT FALSE OR is_active IS NULL)'}`,
      [phone]
    );
    if (existingPhone.rows.length > 0) {
      return errorResponse(res, 400, 'Phone number already in use by another driver');
    }

    const normalizedRole = normalizeTransportRole(role);
    if (normalizedRole === 'driver' && !String(license_number || '').trim()) {
      return errorResponse(res, 400, 'License number is required for driver role');
    }

    const isActiveValue = is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active';
    const userId = await getOrCreateTransportUser({ name, phone, role: normalizedRole });
    const scopedAcademicYearId = hasAcademicYearId
      ? await resolveAcademicYearId(academic_year_id || req.query?.academic_year_id)
      : null;

    const result = hasAcademicYearId
      ? await query(
          `INSERT INTO drivers (driver_name, phone, license_number, role, address, user_id, is_active, academic_year_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [name, phone, license_number || null, normalizedRole, address || '', userId, isActiveValue, scopedAcademicYearId]
        )
      : await query(
          `INSERT INTO drivers (driver_name, phone, license_number, role, address, user_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [name, phone, license_number || null, normalizedRole, address || '', userId, isActiveValue]
        );

    return success(res, 201, 'Driver created successfully', mapDriverRow(result.rows[0]));
  } catch (error) {
    console.error('Error creating driver:', error);
    return errorResponse(res, 500, 'Failed to create driver');
  }
};

const updateDriver = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('drivers', 'academic_year_id');
    const hasDeletedAt = await hasColumn('drivers', 'deleted_at');
    const { id } = req.params;
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid driver ID');
    }

    const {
      name,
      phone,
      license_number,
      role,
      academic_year_id,
      address,
      is_active
    } = req.body;

    const normalizedRole = role !== undefined ? normalizeTransportRole(role) : undefined;
    if (normalizedRole === 'driver' && license_number !== undefined && !String(license_number || '').trim()) {
      return errorResponse(res, 400, 'License number is required for driver role');
    }

    // Check for duplicate phone number if provided
    if (phone) {
      const existingPhone = await query(
        `SELECT id FROM drivers WHERE phone = $1 AND id != $2 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '(is_active IS NOT FALSE OR is_active IS NULL)'}`,
        [phone, numericId]
      );
      if (existingPhone.rows.length > 0) {
        return errorResponse(res, 400, 'Phone number already in use by another driver');
      }
    }

    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) {
      updates.push(`driver_name = $${i++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${i++}`);
      values.push(phone || '');
    }
    if (license_number !== undefined) {
      updates.push(`license_number = $${i++}`);
      values.push(license_number || null);
    }
    if (normalizedRole !== undefined) {
      updates.push(`role = $${i++}`);
      values.push(normalizedRole);
    }
    if (hasAcademicYearId && academic_year_id !== undefined) {
      updates.push(`academic_year_id = $${i++}`);
      values.push(toPositiveInt(academic_year_id));
    }
    if (address !== undefined) {
      updates.push(`address = $${i++}`);
      values.push(address || '');
    }
    if (is_active !== undefined) {
      const isActiveValue = is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active';
      updates.push(`is_active = $${i++}`);
      values.push(isActiveValue);
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(numericId);
    const result = await query(`
      UPDATE drivers
      SET ${updates.join(', ')}
      WHERE id = $${i} AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Driver not found');
    }

    const updatedRow = result.rows[0];
    if (updatedRow.user_id) {
      const resolvedRole = normalizedRole || normalizeTransportRole(updatedRow.role);
      const roleId = await getRoleIdByName(resolvedRole);
      const { firstName, lastName } = splitName(name !== undefined ? name : updatedRow.driver_name);
      await query(
        `UPDATE users
         SET phone = COALESCE($1, phone),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             role_id = COALESCE($4, role_id),
             modified_at = NOW()
         WHERE id = $5`,
        [
          phone !== undefined ? phone : null,
          firstName,
          lastName,
          roleId,
          updatedRow.user_id
        ]
      );
    }

    return success(res, 200, 'Driver updated successfully', mapDriverRow(updatedRow));
  } catch (error) {
    console.error('Error updating transport driver:', error);
    return errorResponse(res, 500, error.message || 'Failed to update driver');
  }
};

const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const hasDeletedAt = await hasColumn('drivers', 'deleted_at');
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid driver ID');
    }

    const result = hasDeletedAt
      ? await query(
          'UPDATE drivers SET deleted_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING id',
          [numericId]
        )
      : await query(
          'UPDATE drivers SET is_active = false WHERE id = $1 RETURNING id',
          [numericId]
        );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Driver not found');
    }

    return success(res, 200, 'Driver deleted successfully');
  } catch (error) {
    console.error('Error deleting driver:', error);
    return errorResponse(res, 500, 'Failed to delete driver');
  }
};

module.exports = {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver
};
