const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId } = require('../utils/driverTransportAccess');
const bcrypt = require('bcryptjs');
const { clearSchemaInspectorCache } = require('../utils/schemaInspector');

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

/** Normalize DB / ISO input to YYYY-MM-DD for PostgreSQL DATE (avoid local TZ shifting calendar dates). */
function toYyyyMmDd(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseRequiredLicenseExpiry(raw) {
  const ymd = toYyyyMmDd(raw);
  if (!ymd) return { ok: false, message: 'Valid license expiry date is required (YYYY-MM-DD)' };
  return { ok: true, value: ymd };
}

function normalizeLicensePhotoUrl(raw, { required } = { required: false }) {
  const s = String(raw ?? '').trim();
  if (!s) {
    if (required) return { ok: false, message: 'License photo is required for driver role' };
    return { ok: true, value: null };
  }
  if (s.length > 500) return { ok: false, message: 'License photo URL is too long' };
  return { ok: true, value: s };
}

function mapStaffTransportRow(row) {
  const role = normalizeTransportRole(row.role);
  return {
    id: row.id,
    staff_id: row.id,
    driver_code: row.driver_code || row.employee_code || `STF-${row.id}`,
    name: (row.driver_name || '').trim() || 'N/A',
    driver_name: (row.driver_name || '').trim() || 'N/A',
    phone: row.phone ?? '',
    license_number: role === 'conductor' ? null : (row.license_number ?? ''),
    license_expiry: role === 'conductor' ? null : toYyyyMmDd(row.license_expiry),
    license_photo_url: role === 'conductor' ? null : (row.license_photo_url || null),
    role,
    user_id: row.user_id ?? null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    photo_url: row.photo_url || null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

const STAFF_TRANSPORT_FROM = `
  FROM staff s
  INNER JOIN users u ON u.id = s.user_id
  INNER JOIN user_roles ur ON ur.id = u.role_id
`;

const STAFF_TRANSPORT_SELECT = `
  SELECT
    s.id,
    s.employee_code AS driver_code,
    s.employee_code,
    TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS driver_name,
    COALESCE(u.phone, '') AS phone,
    COALESCE(s.license_number, '') AS license_number,
    to_char(s.license_expiry, 'YYYY-MM-DD') AS license_expiry,
    s.license_photo_url,
    LOWER(TRIM(ur.role_name)) AS role,
    s.user_id,
    (LOWER(TRIM(COALESCE(s.status, 'active'))) = 'active') AS is_active,
    s.photo_url,
    s.created_at,
    s.updated_at
`;

function buildTransportStaffFilters(queryParams, { role, status, search }) {
  const params = [];
  const conditions = [
    's.deleted_at IS NULL',
    "LOWER(TRIM(ur.role_name)) IN ('driver', 'conductor')",
  ];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      COALESCE(u.first_name, '') ILIKE $${params.length}
      OR COALESCE(u.last_name, '') ILIKE $${params.length}
      OR COALESCE(u.phone, '') ILIKE $${params.length}
      OR COALESCE(s.employee_code, '') ILIKE $${params.length}
      OR COALESCE(s.license_number, '') ILIKE $${params.length}
    )`);
  }

  if (role && role !== 'all') {
    params.push(normalizeTransportRole(role));
    conditions.push(`LOWER(TRIM(ur.role_name)) = $${params.length}`);
  }

  if (status !== undefined && status !== '' && status !== 'all') {
    const normalized = String(status).trim().toLowerCase();
    if (['active', 'true', '1'].includes(normalized)) {
      conditions.push("LOWER(TRIM(COALESCE(s.status, 'active'))) = 'active'");
    } else if (['inactive', 'false', '0'].includes(normalized)) {
      conditions.push("LOWER(TRIM(COALESCE(s.status, 'active'))) <> 'active'");
    }
  }

  return { params, whereClause: `WHERE ${conditions.join(' AND ')}` };
}

function resolveSortColumn(sortField) {
  const map = {
    id: 's.id',
    driver_name: 'driver_name',
    phone: 'u.phone',
    role: 'ur.role_name',
    license_number: 's.license_number',
    license_expiry: 's.license_expiry',
    is_active: 'is_active',
    created_at: 's.created_at',
  };
  return map[sortField] || 's.id';
}

async function getRoleIdByName(roleName) {
  const res = await query(
    `SELECT id FROM user_roles
     WHERE LOWER(TRIM(role_name)) = LOWER($1) AND is_active IS NOT FALSE
     LIMIT 1`,
    [roleName]
  );
  return res.rows[0]?.id || null;
}

async function ensureTransportRolesExist() {
  await query(
    `INSERT INTO user_roles (role_name, description, is_active) VALUES
      ('Driver', 'Staff responsible for vehicle operation and student transport', true),
      ('Conductor', 'Staff assisting with student transport and vehicle supervision', true)
     ON CONFLICT (role_name) DO NOTHING`
  );
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

async function isPhoneUsedByTransportStaff(phone, excludeStaffId = null) {
  const params = [phone];
  let sql = `
    SELECT s.id
    ${STAFF_TRANSPORT_FROM}
    WHERE s.deleted_at IS NULL
      AND u.phone = $1
      AND LOWER(TRIM(ur.role_name)) IN ('driver', 'conductor')
  `;
  if (excludeStaffId != null) {
    params.push(excludeStaffId);
    sql += ` AND s.id <> $${params.length}`;
  }
  sql += ' LIMIT 1';
  const res = await query(sql, params);
  return res.rows.length > 0;
}

async function fetchTransportStaffById(staffId) {
  const res = await query(
    `${STAFF_TRANSPORT_SELECT}
     ${STAFF_TRANSPORT_FROM}
     WHERE s.id = $1 AND s.deleted_at IS NULL
       AND LOWER(TRIM(ur.role_name)) IN ('driver', 'conductor')`,
    [staffId]
  );
  return res.rows[0] || null;
}

const getAllDrivers = async (req, res) => {
  try {
    clearSchemaInspectorCache();

    const scopedStaffId = await getScopedDriverId(req);
    if (scopedStaffId != null) {
      const row = await fetchTransportStaffById(scopedStaffId);
      if (!row) {
        return success(res, 200, 'Transport staff fetched successfully', [], { totalCount: 0 });
      }
      const data = [mapStaffTransportRow(row)];
      return success(res, 200, 'Transport staff fetched successfully', data, {
        totalCount: 1,
        page: 1,
        limit: 1,
        totalPages: 1,
      });
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      role,
      status,
      sortField = 'id',
      sortOrder = 'ASC',
    } = req.query;

    const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageLimit = Math.max(Number.parseInt(limit, 10) || 10, 1);
    const offset = (pageNumber - 1) * pageLimit;

    const { params, whereClause } = buildTransportStaffFilters(req.query, { role, status, search });
    const orderColumn = resolveSortColumn(sortField);
    const orderDir = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const countResult = await query(
      `SELECT COUNT(*) ${STAFF_TRANSPORT_FROM} ${whereClause}`,
      params
    );
    const totalCount = Number.parseInt(countResult.rows[0]?.count || '0', 10);

    const dataResult = await query(
      `${STAFF_TRANSPORT_SELECT}
       ${STAFF_TRANSPORT_FROM}
       ${whereClause}
       ORDER BY ${orderColumn} ${orderDir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageLimit, offset]
    );

    return success(
      res,
      200,
      'Transport staff fetched successfully',
      dataResult.rows.map(mapStaffTransportRow),
      {
        totalCount,
        page: pageNumber,
        limit: pageLimit,
        totalPages: Math.ceil(totalCount / pageLimit) || 0,
      }
    );
  } catch (error) {
    console.error('Error fetching transport staff:', error);
    return errorResponse(res, 500, 'Failed to fetch transport staff');
  }
};

const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const scopedStaffId = await getScopedDriverId(req);
    if (scopedStaffId != null && String(id) !== String(scopedStaffId)) {
      return errorResponse(res, 403, 'Access denied');
    }

    const row = await fetchTransportStaffById(id);
    if (!row) {
      return errorResponse(res, 404, 'Transport staff member not found');
    }

    return success(res, 200, 'Transport staff fetched successfully', mapStaffTransportRow(row));
  } catch (error) {
    console.error('Error fetching transport staff:', error);
    return errorResponse(res, 500, 'Failed to fetch transport staff');
  }
};

const createDriver = async (req, res) => {
  try {
    await ensureTransportRolesExist();

    const { name, phone, license_number, license_expiry, license_photo_url, role, is_active } = req.body;

    if (!String(name || '').trim()) {
      return errorResponse(res, 400, 'Name is required');
    }

    const phoneDigits = String(phone || '').replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return errorResponse(res, 400, 'Phone number must be exactly 10 digits');
    }

    const normalizedRole = normalizeTransportRole(role);
    if (normalizedRole === 'driver' && !String(license_number || '').trim()) {
      return errorResponse(res, 400, 'License number is required for driver role');
    }

    let licExp = null;
    let licPhoto = null;
    if (normalizedRole === 'driver') {
      const exp = parseRequiredLicenseExpiry(license_expiry);
      if (!exp.ok) return errorResponse(res, 400, exp.message);
      licExp = exp.value;
      const photo = normalizeLicensePhotoUrl(license_photo_url, { required: true });
      if (!photo.ok) return errorResponse(res, 400, photo.message);
      licPhoto = photo.value;
    }

    if (await isPhoneUsedByTransportStaff(phoneDigits)) {
      return errorResponse(res, 400, 'Phone number already in use by another transport staff member');
    }

    const roleId = await getRoleIdByName(normalizedRole);
    if (!roleId) {
      return errorResponse(res, 500, `Role "${normalizedRole}" is not configured. Run tenant migrations.`);
    }

    const { firstName, lastName } = splitName(name);
    const isActiveValue =
      is_active === true ||
      is_active === 1 ||
      is_active === 'true' ||
      is_active === '1' ||
      is_active === 'Active';
    const statusValue = isActiveValue ? 'Active' : 'Inactive';

    const staffRow = await executeTransaction(async (client) => {
      const usernameBase =
        normalizedRole === 'conductor'
          ? `con.${phoneDigits.slice(-8)}`
          : `drv.${phoneDigits.slice(-8)}`;
      const username = await allocateUniqueUsername(usernameBase || normalizedRole);
      const passwordHash = await bcrypt.hash(phoneDigits, 12);
      const placeholderEmail = `transport.${phoneDigits}@school.local`;

      const userRes = await client.query(
        `INSERT INTO users (
          username, email, phone, password_hash, role_id,
          first_name, last_name, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id`,
        [
          username,
          placeholderEmail,
          phoneDigits,
          passwordHash,
          roleId,
          firstName,
          lastName || '',
          isActiveValue,
        ]
      );
      const userId = userRes.rows[0].id;
      const tempCode = `TMP${Date.now().toString(36)}`.slice(0, 20);

      const staffRes = await client.query(
        `INSERT INTO staff (
          user_id, employee_code, license_number, license_expiry, license_photo_url, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id`,
        [
          userId,
          tempCode,
          normalizedRole === 'driver' ? String(license_number).trim() : null,
          licExp,
          licPhoto,
          statusValue,
        ]
      );
      const staffId = staffRes.rows[0].id;
      const employeeCode = `TRP${String(staffId).padStart(4, '0')}`.slice(0, 20);
      await client.query(`UPDATE staff SET employee_code = $1 WHERE id = $2`, [employeeCode, staffId]);

      return staffId;
    });

    const created = await fetchTransportStaffById(staffRow);
    return success(res, 201, 'Transport staff created successfully', mapStaffTransportRow(created));
  } catch (error) {
    console.error('Error creating transport staff:', error);
    if (error?.code === '23505') {
      return errorResponse(res, 400, 'Phone number or username already exists');
    }
    return errorResponse(res, 500, error.message || 'Failed to create transport staff');
  }
};

const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number.parseInt(id, 10);

    if (Number.isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid staff ID');
    }

    const existing = await fetchTransportStaffById(numericId);
    if (!existing) {
      return errorResponse(res, 404, 'Transport staff member not found');
    }

    const { name, phone, license_number, license_expiry, license_photo_url, role, is_active } = req.body;
    const normalizedRole =
      role !== undefined ? normalizeTransportRole(role) : normalizeTransportRole(existing.role);

    if (normalizedRole === 'driver' && license_number !== undefined && !String(license_number || '').trim()) {
      return errorResponse(res, 400, 'License number is required for driver role');
    }

    /** Resolved license fields after this update */
    let nextLic = null;
    let nextExp = null;
    let nextPhoto = null;

    if (normalizedRole === 'conductor') {
      nextLic = null;
      nextExp = null;
      nextPhoto = null;
    } else {
      nextLic =
        license_number !== undefined
          ? String(license_number).trim() || null
          : String(existing.license_number || '').trim() || null;
      if (!nextLic) {
        return errorResponse(res, 400, 'License number is required for driver role');
      }

      const expSource = license_expiry !== undefined ? license_expiry : existing.license_expiry;
      const exp = parseRequiredLicenseExpiry(expSource);
      if (!exp.ok) return errorResponse(res, 400, exp.message);
      nextExp = exp.value;

      const photoSource =
        license_photo_url !== undefined ? license_photo_url : existing.license_photo_url;
      const photo = normalizeLicensePhotoUrl(photoSource, { required: true });
      if (!photo.ok) return errorResponse(res, 400, photo.message);
      nextPhoto = photo.value;
    }
    let phoneDigits;
    if (phone !== undefined) {
      phoneDigits = String(phone).replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        return errorResponse(res, 400, 'Phone number must be exactly 10 digits');
      }
      if (await isPhoneUsedByTransportStaff(phoneDigits, numericId)) {
        return errorResponse(res, 400, 'Phone number already in use by another transport staff member');
      }
    }

    const roleId =
      role !== undefined ? await getRoleIdByName(normalizedRole) : null;
    if (role !== undefined && !roleId) {
      return errorResponse(res, 500, `Role "${normalizedRole}" is not configured`);
    }

    await executeTransaction(async (client) => {
      if (name !== undefined || phone !== undefined || role !== undefined) {
        const resolvedName = name !== undefined ? name : existing.driver_name;
        const { firstName, lastName } = splitName(resolvedName);
        await client.query(
          `UPDATE users
           SET first_name = COALESCE($1, first_name),
               last_name = COALESCE($2, last_name),
               phone = COALESCE($3, phone),
               role_id = COALESCE($4, role_id),
               updated_at = NOW()
           WHERE id = $5`,
          [
            firstName,
            lastName,
            phone !== undefined ? phoneDigits : null,
            roleId,
            existing.user_id,
          ]
        );
      }

      const staffUpdates = [];
      const staffValues = [];
      let i = 1;

      const licenseDirty =
        license_number !== undefined ||
        license_expiry !== undefined ||
        license_photo_url !== undefined ||
        role !== undefined;

      if (licenseDirty) {
        staffUpdates.push(`license_number = $${i++}`);
        staffValues.push(nextLic);
        staffUpdates.push(`license_expiry = $${i++}`);
        staffValues.push(nextExp);
        staffUpdates.push(`license_photo_url = $${i++}`);
        staffValues.push(nextPhoto);
      }

      if (is_active !== undefined) {
        const isActiveValue =
          is_active === true ||
          is_active === 1 ||
          is_active === 'true' ||
          is_active === '1' ||
          is_active === 'Active';
        staffUpdates.push(`status = $${i++}`);
        staffValues.push(isActiveValue ? 'Active' : 'Inactive');
        await client.query(
          `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
          [isActiveValue, existing.user_id]
        );
      }

      if (staffUpdates.length > 0) {
        staffValues.push(numericId);
        await client.query(
          `UPDATE staff SET ${staffUpdates.join(', ')}, updated_at = NOW()
           WHERE id = $${i} AND deleted_at IS NULL`,
          staffValues
        );
      }
    });

    const updated = await fetchTransportStaffById(numericId);
    return success(res, 200, 'Transport staff updated successfully', mapStaffTransportRow(updated));
  } catch (error) {
    console.error('Error updating transport staff:', error);
    return errorResponse(res, 500, error.message || 'Failed to update transport staff');
  }
};

const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number.parseInt(id, 10);

    if (Number.isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid staff ID');
    }

    const existing = await fetchTransportStaffById(numericId);
    if (!existing) {
      return errorResponse(res, 404, 'Transport staff member not found');
    }

    await executeTransaction(async (client) => {
      await client.query(
        `UPDATE staff SET deleted_at = NOW(), status = 'Inactive', updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL`,
        [numericId]
      );
      if (existing.user_id) {
        await client.query(
          `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
          [existing.user_id]
        );
      }
    });

    return success(res, 200, 'Transport staff deleted successfully');
  } catch (error) {
    console.error('Error deleting transport staff:', error);
    return errorResponse(res, 500, 'Failed to delete transport staff');
  }
};

module.exports = {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
};
