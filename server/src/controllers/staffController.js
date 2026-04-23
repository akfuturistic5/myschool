const bcrypt = require('bcryptjs');
const { query, executeTransaction } = require('../config/database');
const { ADMIN_ROLE_IDS, ROLES } = require('../config/roles');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { createAdministrativeStaffUser, isUserEmailTaken } = require('../utils/createPersonUser');
const { deleteFileIfExist } = require('../utils/fileDeleteHelper');

const TEACHER_EMAIL_MAX_LEN = 100;
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeGender = (g) => {
  if (g == null || g === '') return null;
  const v = String(g).trim().toLowerCase();
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'female' || v === 'f') return 'female';
  if (v === 'other' || v === 'o') return 'other';
  return null;
};

const isValidEmail = (email) => {
  const s = (email || '').toString().trim();
  return s.length > 0 && s.length <= TEACHER_EMAIL_MAX_LEN && EMAIL_FORMAT_REGEX.test(s);
};

const normalizePhoneDigits = (phone) => String(phone || '').replace(/\D/g, '');

const isValidPhone = (phone) => {
  const d = normalizePhoneDigits(phone);
  return d.length >= 7 && d.length <= 15;
};

const parsePositiveIntOrNull = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) || n < 1 ? NaN : n;
};

const mapUniqueConstraintToMessage = (constraint) => {
  const c = String(constraint || '').toLowerCase();
  if (c.includes('staff_email')) return 'This email is already assigned to another staff member';
  if (c.includes('users_email')) return 'This email is already registered for another user account';
  if (c.includes('username')) return 'This login name is already in use';
  if (c.includes('employee_code')) return 'This employee code is already in use';
  if (c.includes('phone')) return 'This phone number is already in use';
  if (c.includes('drivers_license')) return 'This driving licence number is already in use';
  return 'This record conflicts with an existing one';
};

/** Matches designations.designation_name for school drivers (HRM ↔ transport `drivers` row). */
const DRIVER_DESIGNATION_KEYS = new Set(['driver', 'drivers']);

async function isDriverDesignationById(client, designationId) {
  if (designationId == null || Number.isNaN(Number(designationId))) return false;
  const r = await client.query(
    `SELECT LOWER(TRIM(designation_name)) AS n FROM designations WHERE id = $1`,
    [designationId]
  );
  const n = r.rows[0]?.n;
  return Boolean(n && DRIVER_DESIGNATION_KEYS.has(n));
}

async function getSupportStaffDepartmentId(client) {
  const r = await client.query(
    `SELECT id FROM departments
     WHERE LOWER(TRIM(department_name)) = 'support staff'
       AND (is_active IS NOT FALSE OR is_active IS NULL)
     ORDER BY id ASC LIMIT 1`
  );
  return r.rows[0]?.id ?? null;
}

async function getRoleIdByName(client, roleName) {
  const role = String(roleName || '').trim().toLowerCase();
  if (!role) return null;
  const r = await client.query(
    `SELECT id FROM user_roles
     WHERE LOWER(TRIM(role_name)) = $1
     LIMIT 1`,
    [role]
  );
  return r.rows[0]?.id ?? null;
}

async function syncStaffUserRole(client, userId, { isDriver }) {
  if (!userId) return;
  const targetRoleName = isDriver ? 'driver' : 'administrative';
  const targetRoleId = await getRoleIdByName(client, targetRoleName);
  if (!targetRoleId) return;
  await client.query(
    `UPDATE users
     SET role_id = $1, modified_at = NOW()
     WHERE id = $2`,
    [targetRoleId, userId]
  );
}

async function upsertDriverForStaff(client, payload) {
  const {
    staffId,
    driverName,
    employeeCode,
    phone,
    email,
    licenseNumber,
    licenseExpiry,
    address,
    emergencyContactPhone,
    joiningDate,
    salary,
    isActive,
    createdBy,
  } = payload;

  const lic = (licenseNumber || '').toString().trim().slice(0, 50);
  if (!lic) {
    const err = new Error('Driving licence number is required for driver designation');
    err.staffInputError = { status: 400, code: 'LICENSE_REQUIRED' };
    throw err;
  }

  const existing = await client.query('SELECT id FROM drivers WHERE staff_id = $1', [staffId]);
  const params = [
    driverName,
    employeeCode,
    phone,
    email,
    lic,
    licenseExpiry || null,
    address || null,
    emergencyContactPhone || null,
    joiningDate || null,
    salary != null && !Number.isNaN(salary) ? salary : null,
    isActive !== false,
    staffId,
  ];

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE drivers SET
        driver_name = $1,
        employee_code = $2,
        phone = $3,
        email = $4,
        license_number = $5,
        license_expiry = $6,
        address = $7,
        emergency_contact = $8,
        joining_date = $9,
        salary = $10,
        is_active = $11,
        modified_at = NOW()
      WHERE staff_id = $12`,
      params
    );
  } else {
    await client.query(
      `INSERT INTO drivers (
        driver_name, employee_code, phone, email, license_number, license_expiry,
        address, emergency_contact, joining_date, salary, is_active, staff_id,
        created_at, created_by, modified_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        NOW(), $13, NOW()
      )`,
      [...params.slice(0, 12), createdBy && !Number.isNaN(createdBy) ? createdBy : null]
    );
  }
}

async function unlinkDriverStaff(client, staffId) {
  await client.query(
    `UPDATE drivers SET staff_id = NULL, modified_at = NOW() WHERE staff_id = $1`,
    [staffId]
  );
}

/** Base staff list/detail query (works when drivers.staff_id does not exist yet). */
const STAFF_SELECT_BASE = `
      SELECT
        s.*,
        s.user_id,
        bg.blood_group AS blood_group_label,
        d.department_name AS department_name,
        d.department_name AS department,
        des.designation_name AS designation_name,
        des.designation_name AS designation,
        NULL::character varying(50) AS driver_license_number,
        NULL::date AS driver_license_expiry,
        u.role_id AS user_role_id,
        ur_u.role_name AS user_role_name
      FROM staff s
      LEFT JOIN blood_groups bg ON s.blood_group_id = bg.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN designations des ON s.designation_id = des.id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN user_roles ur_u ON ur_u.id = u.role_id
`;

/** After migrations/012_driver_designation_and_drivers_staff_id.sql — join driver licence onto staff. */
const STAFF_SELECT_WITH_DRIVERS = `
      SELECT
        s.*,
        s.user_id,
        bg.blood_group AS blood_group_label,
        d.department_name AS department_name,
        d.department_name AS department,
        des.designation_name AS designation_name,
        des.designation_name AS designation,
        dr.license_number AS driver_license_number,
        dr.license_expiry AS driver_license_expiry,
        u.role_id AS user_role_id,
        ur_u.role_name AS user_role_name
      FROM staff s
      LEFT JOIN blood_groups bg ON s.blood_group_id = bg.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN designations des ON s.designation_id = des.id
      LEFT JOIN drivers dr ON dr.staff_id = s.id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN user_roles ur_u ON ur_u.id = u.role_id
`;

/** Same as WITH_DRIVERS but older DBs may have staff_id without license_expiry column. */
const STAFF_SELECT_WITH_DRIVERS_NO_LICENSE_EXPIRY = `
      SELECT
        s.*,
        s.user_id,
        bg.blood_group AS blood_group_label,
        d.department_name AS department_name,
        d.department_name AS department,
        des.designation_name AS designation_name,
        des.designation_name AS designation,
        dr.license_number AS driver_license_number,
        NULL::date AS driver_license_expiry,
        u.role_id AS user_role_id,
        ur_u.role_name AS user_role_name
      FROM staff s
      LEFT JOIN blood_groups bg ON s.blood_group_id = bg.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN designations des ON s.designation_id = des.id
      LEFT JOIN drivers dr ON dr.staff_id = s.id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN user_roles ur_u ON ur_u.id = u.role_id
`;

let cachedStaffSelectSql = null;

/** Pick query shape once per process: drivers.staff_id is required for the driver JOIN. */
async function getStaffSelectSql() {
  if (cachedStaffSelectSql !== null) {
    return cachedStaffSelectSql;
  }
  try {
    const r = await query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'drivers'
         AND column_name IN ('staff_id', 'license_expiry')`
    );
    const driverCols = new Set((r.rows || []).map((row) => row.column_name));
    const hasStaffId = driverCols.has('staff_id');
    const hasLicenseExpiry = driverCols.has('license_expiry');
    if (hasStaffId && hasLicenseExpiry) {
      cachedStaffSelectSql = STAFF_SELECT_WITH_DRIVERS;
    } else if (hasStaffId) {
      cachedStaffSelectSql = STAFF_SELECT_WITH_DRIVERS_NO_LICENSE_EXPIRY;
    } else {
      cachedStaffSelectSql = STAFF_SELECT_BASE;
    }
  } catch {
    cachedStaffSelectSql = STAFF_SELECT_BASE;
  }
  return cachedStaffSelectSql;
}

async function fetchStaffRowById(staffId) {
  const staffSelect = await getStaffSelectSql();
  const result = await query(
    `${staffSelect}
      WHERE s.id = $1`,
    [staffId]
  );
  return result.rows[0] || null;
}

// Get all staff members
const getAllStaff = async (req, res) => {
  try {
    const staffSelect = await getStaffSelectSql();
    const result = await query(`
      ${staffSelect}
      WHERE s.is_active = true
      ORDER BY s.first_name ASC, s.last_name ASC
    `);

    return success(res, 200, 'Staff fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching staff:', error?.message || error);
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

    const staffSelect = await getStaffSelectSql();
    const result = await query(
      `${staffSelect}
      WHERE s.id = $1 AND s.is_active = true`,
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
    console.error('Error fetching staff by ID:', error?.message || error);
    return errorResponse(res, 500, 'Failed to fetch staff');
  }
};

const parseDateOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : s.slice(0, 10);
};

const createStaff = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      employee_code: clientEmployeeCode,
      first_name,
      last_name,
      email,
      phone,
      password,
      gender,
      date_of_birth,
      blood_group_id,
      designation_id,
      department_id,
      joining_date,
      salary,
      qualification,
      experience_years,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      photo_url,
      is_active,
      license_number,
      license_expiry,
    } = body;

    const fn = (first_name || '').toString().trim();
    const ln = (last_name || '').toString().trim();
    const em = (email || '').toString().trim();
    const ph = (phone || '').toString().trim();

    if (!fn || !ln) {
      return errorResponse(res, 400, 'First name and last name are required', 'VALIDATION_ERROR');
    }
    if (!isValidEmail(em)) {
      return errorResponse(res, 400, 'Valid email is required', 'VALIDATION_ERROR');
    }
    if (!isValidPhone(ph)) {
      return errorResponse(res, 400, 'Phone must contain 7–15 digits', 'VALIDATION_ERROR');
    }

    const pwdIn = password != null ? String(password).trim() : '';
    if (pwdIn && pwdIn.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters', 'VALIDATION_ERROR');
    }

    const desigParsed = parsePositiveIntOrNull(designation_id);
    const deptParsed = parsePositiveIntOrNull(department_id);
    const bgParsed = parsePositiveIntOrNull(blood_group_id);
    if (designation_id != null && designation_id !== '' && Number.isNaN(desigParsed)) {
      return errorResponse(res, 400, 'Invalid designation', 'VALIDATION_ERROR');
    }
    if (department_id != null && department_id !== '' && Number.isNaN(deptParsed)) {
      return errorResponse(res, 400, 'Invalid department', 'VALIDATION_ERROR');
    }
    if (blood_group_id != null && blood_group_id !== '' && Number.isNaN(bgParsed)) {
      return errorResponse(res, 400, 'Invalid blood group', 'VALIDATION_ERROR');
    }

    let isActiveBoolean = true;
    if (is_active === false || is_active === 'false' || is_active === 0) isActiveBoolean = false;

    const genderNorm = normalizeGender(gender);
    const dob = parseDateOrNull(date_of_birth);
    const joinD = parseDateOrNull(joining_date);
    const expYears = experience_years != null && experience_years !== '' ? parseInt(experience_years, 10) : null;
    const salaryNum = salary != null && salary !== '' ? parseFloat(salary) : null;
    const addr = (address || '').toString().trim() || null;
    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    const customCode = (clientEmployeeCode || '').toString().trim().slice(0, 20);
    let employeeCode = customCode;
    if (!employeeCode) {
      employeeCode = `TMP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
    }

    const row = await executeTransaction(async (client) => {
      const emailTaken = await isUserEmailTaken(client, em);
      if (emailTaken) {
        const err = new Error('Email is already registered');
        err.staffInputError = { status: 409, code: 'EMAIL_IN_USE' };
        throw err;
      }

      if (deptParsed) {
        const dOk = await client.query('SELECT 1 FROM departments WHERE id = $1 LIMIT 1', [deptParsed]);
        if (!dOk.rows.length) {
          const err = new Error('Invalid department');
          err.staffInputError = { status: 400, code: 'INVALID_DEPARTMENT' };
          throw err;
        }
      }
      if (desigParsed) {
        const gOk = await client.query('SELECT 1 FROM designations WHERE id = $1 LIMIT 1', [desigParsed]);
        if (!gOk.rows.length) {
          const err = new Error('Invalid designation');
          err.staffInputError = { status: 400, code: 'INVALID_DESIGNATION' };
          throw err;
        }
      }
      if (bgParsed) {
        const bOk = await client.query('SELECT 1 FROM blood_groups WHERE id = $1 LIMIT 1', [bgParsed]);
        if (!bOk.rows.length) {
          const err = new Error('Invalid blood group');
          err.staffInputError = { status: 400, code: 'INVALID_BLOOD_GROUP' };
          throw err;
        }
      }

      let deptForInsert = deptParsed && !Number.isNaN(deptParsed) ? deptParsed : null;
      const isDriverRole =
        desigParsed && !Number.isNaN(desigParsed) && (await isDriverDesignationById(client, desigParsed));
      if (isDriverRole) {
        const supId = await getSupportStaffDepartmentId(client);
        if (supId) deptForInsert = supId;
        const licTrim = (license_number || '').toString().trim();
        if (!licTrim) {
          const err = new Error('Driving licence number is required for driver designation');
          err.staffInputError = { status: 400, code: 'LICENSE_REQUIRED' };
          throw err;
        }
      }

      const staffIns = await client.query(
        `INSERT INTO staff (
          user_id, employee_code, first_name, last_name, gender, date_of_birth, blood_group_id,
          phone, email, address, emergency_contact_name, emergency_contact_phone,
          designation_id, department_id, joining_date, salary, qualification, experience_years,
          photo_url, is_active, created_by, created_at, modified_at
        ) VALUES (
          NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
        ) RETURNING id`,
        [
          employeeCode,
          fn,
          ln,
          genderNorm,
          dob,
          bgParsed && !Number.isNaN(bgParsed) ? bgParsed : null,
          ph,
          em,
          addr,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          desigParsed && !Number.isNaN(desigParsed) ? desigParsed : null,
          deptForInsert,
          joinD,
          salaryNum != null && !Number.isNaN(salaryNum) ? salaryNum : null,
          qualification || null,
          expYears != null && !Number.isNaN(expYears) ? expYears : null,
          (photo_url || '').toString().trim().slice(0, 500) || null,
          isActiveBoolean,
          createdBy && !Number.isNaN(createdBy) ? createdBy : null,
        ]
      );
      const staffId = staffIns.rows[0].id;
      if (!customCode) {
        const finalCode = (`STF${staffId}`).slice(0, 20);
        await client.query(`UPDATE staff SET employee_code = $1 WHERE id = $2`, [finalCode, staffId]);
      }

      let resolvedStaffRoleId = ROLES.ADMINISTRATIVE;
      if (isDriverRole) {
        const drRole = await client.query(
          `SELECT id FROM user_roles WHERE LOWER(TRIM(role_name)) = 'driver' LIMIT 1`
        );
        if (!drRole.rows[0]) {
          const err = new Error('Driver role is not configured in user_roles. Run migration 013_user_role_driver.sql.');
          err.staffInputError = { status: 500, code: 'DRIVER_ROLE_MISSING' };
          throw err;
        }
        resolvedStaffRoleId = drRole.rows[0].id;
      }

      const userId = await createAdministrativeStaffUser(client, {
        email: em,
        phone: ph,
        first_name: fn,
        last_name: ln,
        password: pwdIn || undefined,
        roleId: resolvedStaffRoleId,
      });
      if (!userId) {
        const err = new Error('Failed to create login account for staff');
        err.statusCode = 500;
        throw err;
      }
      await client.query(`UPDATE staff SET user_id = $1, modified_at = NOW() WHERE id = $2`, [userId, staffId]);
      await syncStaffUserRole(client, userId, { isDriver: Boolean(isDriverRole) });

      if (isDriverRole) {
        const ecRow = await client.query('SELECT employee_code FROM staff WHERE id = $1', [staffId]);
        const empCodeFinal = ecRow.rows[0]?.employee_code || employeeCode;
        const licExpiry = parseDateOrNull(license_expiry);
        await upsertDriverForStaff(client, {
          staffId,
          driverName: `${fn} ${ln}`.trim(),
          employeeCode: empCodeFinal,
          phone: ph,
          email: em,
          licenseNumber: license_number,
          licenseExpiry: licExpiry,
          address: addr,
          emergencyContactPhone: emergency_contact_phone || null,
          joiningDate: joinD,
          salary: salaryNum != null && !Number.isNaN(salaryNum) ? salaryNum : null,
          isActive: isActiveBoolean,
          createdBy,
        });
      }

      return staffId;
    });

    const full = await fetchStaffRowById(row);
    return success(res, 201, 'Staff created successfully', full);
  } catch (error) {
    if (error.staffInputError) {
      return errorResponse(res, error.staffInputError.status, error.message, error.staffInputError.code);
    }
    console.error('Error creating staff:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, mapUniqueConstraintToMessage(error.constraint), 'CONFLICT');
    }
    if (error.code === '23503') {
      return errorResponse(res, 400, 'Invalid reference data', 'FK_VIOLATION');
    }
    return errorResponse(res, 500, 'Failed to create staff', 'INTERNAL_ERROR');
  }
};

const updateStaff = async (req, res) => {
  try {
    const staffIdNum = parseInt(req.params.id, 10);
    if (!staffIdNum || Number.isNaN(staffIdNum)) {
      return errorResponse(res, 400, 'Invalid staff ID', 'VALIDATION_ERROR');
    }

    const existing = await query('SELECT * FROM staff WHERE id = $1', [staffIdNum]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Staff not found');
    }
    const prev = existing.rows[0];

    const body = req.body || {};
    const {
      employee_code,
      first_name,
      last_name,
      email,
      phone,
      password,
      gender,
      date_of_birth,
      blood_group_id,
      designation_id,
      department_id,
      joining_date,
      salary,
      qualification,
      experience_years,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      photo_url,
      is_active,
      license_number,
      license_expiry,
    } = body;

    if (email !== undefined && email !== null && String(email).trim() !== '') {
      const eTrim = String(email).trim();
      if (!isValidEmail(eTrim)) {
        return errorResponse(res, 400, 'Invalid email format', 'VALIDATION_ERROR');
      }
    }
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      const pTrim = String(phone).trim();
      if (!isValidPhone(pTrim)) {
        return errorResponse(res, 400, 'Invalid phone number', 'VALIDATION_ERROR');
      }
    }

    const pwdIn = password != null ? String(password).trim() : '';
    if (pwdIn && pwdIn.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters', 'VALIDATION_ERROR');
    }

    const desigParsed = designation_id !== undefined ? parsePositiveIntOrNull(designation_id) : undefined;
    const deptParsed = department_id !== undefined ? parsePositiveIntOrNull(department_id) : undefined;
    const bgParsed = blood_group_id !== undefined ? parsePositiveIntOrNull(blood_group_id) : undefined;
    if (designation_id !== undefined && designation_id !== null && designation_id !== '' && Number.isNaN(desigParsed)) {
      return errorResponse(res, 400, 'Invalid designation', 'VALIDATION_ERROR');
    }
    if (department_id !== undefined && department_id !== null && department_id !== '' && Number.isNaN(deptParsed)) {
      return errorResponse(res, 400, 'Invalid department', 'VALIDATION_ERROR');
    }
    if (blood_group_id !== undefined && blood_group_id !== null && blood_group_id !== '' && Number.isNaN(bgParsed)) {
      return errorResponse(res, 400, 'Invalid blood group', 'VALIDATION_ERROR');
    }

    await executeTransaction(async (client) => {
      if (email !== undefined && email !== null) {
        const eTrim = String(email).trim();
        const dup = await client.query(
          `SELECT id FROM users WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1))
           AND id IS DISTINCT FROM $2 LIMIT 1`,
          [eTrim, prev.user_id || 0]
        );
        if (dup.rows.length > 0) {
          const err = new Error('Email is already registered to another account');
          err.staffInputError = { status: 409, code: 'EMAIL_IN_USE' };
          throw err;
        }
      }

      if (deptParsed) {
        const dOk = await client.query('SELECT 1 FROM departments WHERE id = $1 LIMIT 1', [deptParsed]);
        if (!dOk.rows.length) {
          const err = new Error('Invalid department');
          err.staffInputError = { status: 400, code: 'INVALID_DEPARTMENT' };
          throw err;
        }
      }
      if (desigParsed) {
        const gOk = await client.query('SELECT 1 FROM designations WHERE id = $1 LIMIT 1', [desigParsed]);
        if (!gOk.rows.length) {
          const err = new Error('Invalid designation');
          err.staffInputError = { status: 400, code: 'INVALID_DESIGNATION' };
          throw err;
        }
      }
      if (bgParsed) {
        const bOk = await client.query('SELECT 1 FROM blood_groups WHERE id = $1 LIMIT 1', [bgParsed]);
        if (!bOk.rows.length) {
          const err = new Error('Invalid blood group');
          err.staffInputError = { status: 400, code: 'INVALID_BLOOD_GROUP' };
          throw err;
        }
      }

      const staffUpdates = [];
      const staffParams = [];
      let idx = 1;
      const add = (col, val) => {
        if (val !== undefined) {
          staffUpdates.push(`${col} = $${idx}`);
          staffParams.push(val);
          idx += 1;
        }
      };

      if (employee_code !== undefined) {
        const code = (employee_code || '').toString().trim().slice(0, 20);
        if (code) add('employee_code', code);
      }
      add('first_name', first_name !== undefined ? (first_name || '').toString().trim() : undefined);
      add('last_name', last_name !== undefined ? (last_name || '').toString().trim() : undefined);
      add('email', email !== undefined ? (email || '').toString().trim() : undefined);
      add('phone', phone !== undefined ? (phone || '').toString().trim() : undefined);
      if (gender !== undefined) {
        const gn = normalizeGender(gender);
        add('gender', gn);
      }
      if (date_of_birth !== undefined) add('date_of_birth', parseDateOrNull(date_of_birth));
      if (blood_group_id !== undefined) {
        add('blood_group_id', bgParsed && !Number.isNaN(bgParsed) ? bgParsed : null);
      }
      if (designation_id !== undefined) {
        add('designation_id', desigParsed && !Number.isNaN(desigParsed) ? desigParsed : null);
      }
      if (department_id !== undefined) {
        add('department_id', deptParsed && !Number.isNaN(deptParsed) ? deptParsed : null);
      }
      if (joining_date !== undefined) add('joining_date', parseDateOrNull(joining_date));
      if (salary !== undefined) {
        const salaryNum = salary != null && salary !== '' ? parseFloat(salary) : null;
        add('salary', salaryNum != null && !Number.isNaN(salaryNum) ? salaryNum : null);
      }
      add('qualification', qualification !== undefined ? qualification : undefined);
      if (experience_years !== undefined) {
        const ey = experience_years != null && experience_years !== '' ? parseInt(experience_years, 10) : null;
        add('experience_years', ey != null && !Number.isNaN(ey) ? ey : null);
      }
      add('address', address !== undefined ? ((address || '').toString().trim() || null) : undefined);
      add('emergency_contact_name', emergency_contact_name !== undefined ? emergency_contact_name : undefined);
      add('emergency_contact_phone', emergency_contact_phone !== undefined ? emergency_contact_phone : undefined);
      if (photo_url !== undefined) {
        add('photo_url', (photo_url || '').toString().trim().slice(0, 500) || null);
      }
      let nextIsActive = prev.is_active;
      if (is_active !== undefined) {
        const active = !(is_active === false || is_active === 'false' || is_active === 0);
        nextIsActive = active;
        add('is_active', active);
      }
      staffUpdates.push('modified_at = NOW()');

      if (staffUpdates.length >= 1) {
        staffParams.push(staffIdNum);
        await client.query(`UPDATE staff SET ${staffUpdates.join(', ')} WHERE id = $${idx}`, staffParams);

        if (photo_url !== undefined && prev.photo_url && prev.photo_url !== photo_url) {
          await deleteFileIfExist(prev.photo_url);
        }
      }

      if (is_active !== undefined && prev.user_id && nextIsActive === false) {
        await client.query('UPDATE users SET is_active = false, modified_at = NOW() WHERE id = $1', [prev.user_id]);
      }
      if (is_active !== undefined && prev.user_id && nextIsActive === true) {
        await client.query('UPDATE users SET is_active = true, modified_at = NOW() WHERE id = $1', [prev.user_id]);
      }

      if (prev.user_id && (first_name !== undefined || last_name !== undefined || email !== undefined || phone !== undefined)) {
        const uUp = [];
        const uPa = [];
        let ui = 1;
        const uadd = (col, val) => {
          if (val !== undefined) {
            uUp.push(`${col} = $${ui}`);
            uPa.push(val);
            ui += 1;
          }
        };
        uadd('first_name', first_name !== undefined ? (first_name || '').toString().trim() : undefined);
        uadd('last_name', last_name !== undefined ? (last_name || '').toString().trim() : undefined);
        uadd('email', email !== undefined ? (email || '').toString().trim() : undefined);
        uadd('phone', phone !== undefined ? (phone || '').toString().trim() : undefined);
        uUp.push('modified_at = NOW()');
        if (uUp.length > 1) {
          uPa.push(prev.user_id);
          await client.query(`UPDATE users SET ${uUp.join(', ')} WHERE id = $${ui}`, uPa);
        }
      }

      if (pwdIn && prev.user_id) {
        const passwordHash = await bcrypt.hash(pwdIn, 12);
        await client.query(
          `UPDATE users SET password_hash = $1, modified_at = NOW() WHERE id = $2`,
          [passwordHash, prev.user_id]
        );
      }

      const staffNow = await client.query(
        `SELECT s.*, LOWER(TRIM(des.designation_name)) AS desig_key
         FROM staff s
         LEFT JOIN designations des ON des.id = s.designation_id
         WHERE s.id = $1`,
        [staffIdNum]
      );
      const cur = staffNow.rows[0];
      const isDrv = cur?.desig_key && DRIVER_DESIGNATION_KEYS.has(cur.desig_key);
      if (cur?.user_id) {
        await syncStaffUserRole(client, cur.user_id, { isDriver: Boolean(isDrv) });
      }

      if (isDrv) {
        const supId = await getSupportStaffDepartmentId(client);
        if (supId && cur.department_id !== supId) {
          await client.query(`UPDATE staff SET department_id = $1, modified_at = NOW() WHERE id = $2`, [
            supId,
            staffIdNum,
          ]);
        }

        const existingDrv = await client.query(
          'SELECT license_number, license_expiry FROM drivers WHERE staff_id = $1',
          [staffIdNum]
        );
        let effectiveLic;
        if (license_number !== undefined) {
          effectiveLic = (license_number || '').toString().trim() || null;
        } else {
          effectiveLic = existingDrv.rows[0]?.license_number || null;
        }
        if (!effectiveLic) {
          const err = new Error(
            'Driving licence number is required for driver designation (add licence or keep existing)'
          );
          err.staffInputError = { status: 400, code: 'LICENSE_REQUIRED' };
          throw err;
        }

        let licExp = null;
        if (license_expiry !== undefined) {
          licExp = parseDateOrNull(license_expiry);
        } else {
          licExp = existingDrv.rows[0]?.license_expiry || null;
        }

        const fn = (cur.first_name || '').toString().trim();
        const ln = (cur.last_name || '').toString().trim();
        const ec = (cur.employee_code || '').toString().trim();
        const nextActive = !(cur.is_active === false || cur.is_active === 'f');
        const salNum = cur.salary != null && cur.salary !== '' ? parseFloat(String(cur.salary), 10) : null;

        await upsertDriverForStaff(client, {
          staffId: staffIdNum,
          driverName: `${fn} ${ln}`.trim(),
          employeeCode: ec,
          phone: (cur.phone || '').toString().trim(),
          email: (cur.email || '').toString().trim(),
          licenseNumber: effectiveLic,
          licenseExpiry: licExp,
          address: cur.address || null,
          emergencyContactPhone: cur.emergency_contact_phone || null,
          joiningDate: cur.joining_date || null,
          salary: salNum != null && !Number.isNaN(salNum) ? salNum : null,
          isActive: nextActive,
          createdBy: cur.created_by,
        });
      } else {
        await unlinkDriverStaff(client, staffIdNum);
      }

      if (prev.user_id) {
        const dRole = await client.query(
          `SELECT id FROM user_roles WHERE LOWER(TRIM(role_name)) = 'driver' LIMIT 1`
        );
        const driverRid = dRole.rows[0]?.id;
        if (driverRid) {
          const uCur = await client.query('SELECT role_id FROM users WHERE id = $1', [prev.user_id]);
          const currentRid = uCur.rows[0]?.role_id;
          if (isDrv) {
            if (Number(currentRid) !== Number(driverRid)) {
              await client.query(`UPDATE users SET role_id = $1, modified_at = NOW() WHERE id = $2`, [
                driverRid,
                prev.user_id,
              ]);
            }
          } else if (currentRid != null && Number(currentRid) === Number(driverRid)) {
            await client.query(`UPDATE users SET role_id = $1, modified_at = NOW() WHERE id = $2`, [
              ROLES.ADMINISTRATIVE,
              prev.user_id,
            ]);
          }
        }
      }
    });

    const full = await fetchStaffRowById(staffIdNum);
    return success(res, 200, 'Staff updated successfully', full);
  } catch (error) {
    if (error.staffInputError) {
      return errorResponse(res, error.staffInputError.status, error.message, error.staffInputError.code);
    }
    console.error('Error updating staff:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, mapUniqueConstraintToMessage(error.constraint), 'CONFLICT');
    }
    if (error.code === '23503') {
      return errorResponse(res, 400, 'Invalid reference data', 'FK_VIOLATION');
    }
    return errorResponse(res, 500, 'Failed to update staff', 'INTERNAL_ERROR');
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staffIdNum = parseInt(req.params.id, 10);
    if (!staffIdNum || Number.isNaN(staffIdNum)) {
      return errorResponse(res, 400, 'Invalid staff ID', 'VALIDATION_ERROR');
    }

    const tCheck = await query('SELECT id FROM teachers WHERE staff_id = $1 LIMIT 1', [staffIdNum]);
    if (tCheck.rows.length > 0) {
      return errorResponse(
        res,
        409,
        'This staff member is linked to a teaching profile. Deactivate or remove them from the Teachers module instead.',
        'TEACHER_LINKED'
      );
    }

    const result = await query(
      `UPDATE staff SET is_active = false, modified_at = NOW() WHERE id = $1 AND is_active = true RETURNING id`,
      [staffIdNum]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Staff not found or already inactive');
    }

    await query(
      `UPDATE drivers SET is_active = false, modified_at = NOW() WHERE staff_id = $1`,
      [staffIdNum]
    );

    const staffRow = await query('SELECT user_id FROM staff WHERE id = $1', [staffIdNum]);
    const uid = staffRow.rows[0]?.user_id;
    if (uid) {
      await query('UPDATE users SET is_active = false, modified_at = NOW() WHERE id = $1', [uid]);
    }

    return success(res, 200, 'Staff deactivated successfully', { id: staffIdNum });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return errorResponse(res, 500, 'Failed to deactivate staff', 'INTERNAL_ERROR');
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
};
