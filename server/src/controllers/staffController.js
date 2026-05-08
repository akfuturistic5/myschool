const fs = require('fs');
const bcrypt = require('bcryptjs');
const { query, executeTransaction, runWithTenant } = require('../config/database');
const { ADMIN_ROLE_IDS, ROLES } = require('../config/roles');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { createAdministrativeStaffUser, isUserEmailTaken } = require('../utils/createPersonUser');
const { deleteFileIfExist } = require('../utils/fileDeleteHelper');
const { ensureTenantStaffDocDir, resolveStaffDocumentPath, sanitizeTenant } = require('../utils/staffDocumentStorage');
const { ensureTenantStaffProfileDir, resolveStaffProfilePath } = require('../utils/staffProfileStorage');

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
  if (c.includes('license_number')) return 'This driving licence number is already in use';
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
       AND (is_active IS NOT FALSE)
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
     SET role_id = $1, updated_at = NOW()
     WHERE id = $2`,
    [targetRoleId, userId]
  );
}




/** Normalized staff SELECT — sources personal fields from users, payroll from staff_salary_assignments. */
const STAFF_SELECT_NORMALIZED = `
      SELECT
        s.id, s.user_id, s.employee_code, s.marital_status, s.father_name, s.mother_name,
        s.id_number, s.emergency_contact_name, s.emergency_contact_phone,
        s.license_number, s.license_expiry, s.license_photo_url,
        s.license_number AS driver_license_number,
        s.license_expiry AS driver_license_expiry,
        s.designation_id, s.department_id, s.joining_date,
        s.qualification, s.experience_years, s.languages_known,
        s.other_info, s.photo_url, s.status, s.is_active,
        s.resume, s.joining_letter, s.created_at, s.updated_at, s.deleted_at,
        u.first_name, u.last_name, u.email, u.phone, u.gender, u.date_of_birth,
        u.blood_group_id, u.current_address, u.permanent_address,
        u.current_address AS address,
        u.facebook, u.twitter, u.linkedin, u.youtube, u.instagram,
        u.is_active AS user_is_active, u.role_id,
        bg.blood_group_name AS blood_group_label,
        d.department_name, d.department_name AS department,
        des.designation_name, des.designation_name AS designation,
        ur.role_name AS user_role_name,
        sal.basic_salary AS salary, sal.epf_no, sal.pan_number,
        sal.bank_name, sal.account_name, sal.account_no AS account_number,
        sal.branch, sal.ifsc_code AS ifsc, sal.contract_type, sal.shift, sal.work_location
      FROM staff s
      INNER JOIN users u ON u.id = s.user_id
      LEFT JOIN blood_groups bg ON bg.id = u.blood_group_id
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN designations des ON des.id = s.designation_id
      LEFT JOIN user_roles ur ON ur.id = u.role_id
      LEFT JOIN LATERAL (
        SELECT * FROM staff_salary_assignments
        WHERE staff_id = s.id ORDER BY valid_period DESC LIMIT 1
      ) sal ON TRUE
`;

async function fetchStaffRowById(staffId) {
  const result = await query(
    `${STAFF_SELECT_NORMALIZED} WHERE s.id = $1`,
    [staffId]
  );
  return result.rows[0] || null;
}



/**
 * Backfill legacy teacher-linked staff rows that were created without department/designation.
 * Applies only when missing values exist, and only for role=teacher users.
 */
async function backfillLegacyTeacherStaffAssignments() {
  const teacherDesignationResult = await query(
    `SELECT id
     FROM designations
     WHERE LOWER(TRIM(designation_name)) IN ('class teacher', 'primary teacher', 'teacher')
     ORDER BY CASE
       WHEN LOWER(TRIM(designation_name)) = 'class teacher' THEN 1
       WHEN LOWER(TRIM(designation_name)) = 'primary teacher' THEN 2
       WHEN LOWER(TRIM(designation_name)) = 'teacher' THEN 3
       ELSE 99
     END, id ASC
     LIMIT 1`
  );
  const teacherDepartmentResult = await query(
    `SELECT id
     FROM departments
     WHERE LOWER(TRIM(department_name)) IN ('primary education', 'academics', 'academic', 'teaching')
     ORDER BY CASE
       WHEN LOWER(TRIM(department_name)) = 'primary education' THEN 1
       WHEN LOWER(TRIM(department_name)) = 'academics' THEN 2
       WHEN LOWER(TRIM(department_name)) = 'academic' THEN 3
       WHEN LOWER(TRIM(department_name)) = 'teaching' THEN 4
       ELSE 99
     END, id ASC
     LIMIT 1`
  );

  const teacherDesignationId = teacherDesignationResult.rows[0]?.id ?? null;
  const teacherDepartmentId = teacherDepartmentResult.rows[0]?.id ?? null;

  if (!teacherDesignationId && !teacherDepartmentId) return;

  await query(
    `UPDATE staff s
       SET designation_id = COALESCE(s.designation_id, $1::int),
           department_id = COALESCE(s.department_id, $2::int),
           updated_at = NOW()
      FROM users u
      LEFT JOIN user_roles ur ON ur.id = u.role_id
     WHERE s.user_id = u.id
       AND s.status = \'Active\'
       AND LOWER(TRIM(COALESCE(ur.role_name, ''))) = 'teacher'
       AND (
         (s.designation_id IS NULL AND $1::int IS NOT NULL) OR
         (s.department_id IS NULL AND $2::int IS NOT NULL)
       )`,
    [teacherDesignationId, teacherDepartmentId]
  );
}

// Get all staff members
const getAllStaff = async (req, res) => {
  try {
    await backfillLegacyTeacherStaffAssignments();
    const result = await query(`
      ${STAFF_SELECT_NORMALIZED}
      WHERE s.deleted_at IS NULL AND s.status = 'Active' AND u.role_id != 2
      ORDER BY u.first_name ASC NULLS LAST, u.last_name ASC NULLS LAST, s.id ASC
    `);

    return success(res, 200, 'Staff fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching staff:', error?.message || error);
    return errorResponse(res, 500, 'Failed to fetch staff', error.message);
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

    const result = await query(
      `${STAFF_SELECT_NORMALIZED} WHERE s.id = $1`,
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
      first_name, last_name, email, phone, password,
      gender, date_of_birth, blood_group_id,
      designation_id, department_id, joining_date,
      salary, qualification, experience_years,
      address, current_address, permanent_address,
      emergency_contact_name, emergency_contact_phone,
      marital_status, father_name, mother_name, id_number,
      languages_known, other_info, photo_url, is_active,
      license_number, license_expiry,
      epf_no, pan_number, bank_name, account_name, account_number,
      branch, ifsc, contract_type, shift, work_location,
      facebook, twitter, linkedin, youtube, instagram,
      resume, joining_letter,
    } = body;

    const fn = (first_name || '').toString().trim();
    const ln = (last_name || '').toString().trim();
    const em = (email || '').toString().trim();
    const ph = (phone || '').toString().trim();

    if (!fn || !ln) return errorResponse(res, 400, 'First name and last name are required', 'VALIDATION_ERROR');
    if (!isValidEmail(em)) return errorResponse(res, 400, 'Valid email is required', 'VALIDATION_ERROR');
    if (!isValidPhone(ph)) return errorResponse(res, 400, 'Phone must contain 7–15 digits', 'VALIDATION_ERROR');

    const pwdIn = password != null ? String(password).trim() : '';
    if (pwdIn && pwdIn.length < 6) return errorResponse(res, 400, 'Password must be at least 6 characters', 'VALIDATION_ERROR');

    const desigParsed = parsePositiveIntOrNull(designation_id);
    const deptParsed = parsePositiveIntOrNull(department_id);
    const bgParsed = parsePositiveIntOrNull(blood_group_id);
    if (designation_id != null && designation_id !== '' && Number.isNaN(desigParsed)) return errorResponse(res, 400, 'Invalid designation', 'VALIDATION_ERROR');
    if (department_id != null && department_id !== '' && Number.isNaN(deptParsed)) return errorResponse(res, 400, 'Invalid department', 'VALIDATION_ERROR');
    if (blood_group_id != null && blood_group_id !== '' && Number.isNaN(bgParsed)) return errorResponse(res, 400, 'Invalid blood group', 'VALIDATION_ERROR');

    let statusValue = 'Active';
    if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'Inactive') statusValue = 'Inactive';

    const genderNorm = normalizeGender(gender);
    const joinD = parseDateOrNull(joining_date);
    const expYears = experience_years != null && experience_years !== '' ? parseInt(experience_years, 10) : null;
    const salaryNum = salary != null && salary !== '' ? parseFloat(salary) : null;
    const currAddr = (current_address || address || '').toString().trim() || null;
    const permAddr = (permanent_address || '').toString().trim() || null;
    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const languagesArr = Array.isArray(languages_known)
      ? languages_known
      : (typeof languages_known === 'string' ? languages_known.split(',').map((s) => s.trim()).filter(Boolean) : null);

    const customCode = (clientEmployeeCode || '').toString().trim().slice(0, 20);
    let employeeCode = customCode || `TMP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);

    const row = await executeTransaction(async (client) => {
      const emailTaken = await isUserEmailTaken(client, em);
      if (emailTaken) {
        const err = new Error('Email is already registered'); err.staffInputError = { status: 409, code: 'EMAIL_IN_USE' }; throw err;
      }

      if (deptParsed) {
        const dOk = await client.query('SELECT 1 FROM departments WHERE id = $1 LIMIT 1', [deptParsed]);
        if (!dOk.rows.length) { const err = new Error('Invalid department'); err.staffInputError = { status: 400, code: 'INVALID_DEPARTMENT' }; throw err; }
      }
      if (desigParsed) {
        const gOk = await client.query('SELECT 1 FROM designations WHERE id = $1 LIMIT 1', [desigParsed]);
        if (!gOk.rows.length) { const err = new Error('Invalid designation'); err.staffInputError = { status: 400, code: 'INVALID_DESIGNATION' }; throw err; }
      }

      let deptForInsert = deptParsed && !Number.isNaN(deptParsed) ? deptParsed : null;
      const isDriverRole = desigParsed && !Number.isNaN(desigParsed) && (await isDriverDesignationById(client, desigParsed));
      if (isDriverRole) {
        const supId = await getSupportStaffDepartmentId(client);
        if (supId) deptForInsert = supId;
        const licTrim = (license_number || '').toString().trim();
        if (!licTrim) { const err = new Error('Driving licence number is required for driver designation'); err.staffInputError = { status: 400, code: 'LICENSE_REQUIRED' }; throw err; }
      }

      let resolvedStaffRoleId = ROLES.ADMINISTRATIVE;
      if (isDriverRole) {
        const drRole = await client.query(`SELECT id FROM user_roles WHERE LOWER(TRIM(role_name)) = 'driver' LIMIT 1`);
        if (!drRole.rows[0]) { const err = new Error('Driver role is not configured in user_roles.'); err.staffInputError = { status: 500, code: 'DRIVER_ROLE_MISSING' }; throw err; }
        resolvedStaffRoleId = drRole.rows[0].id;
      }

      // 1. Create users row first
      const userId = await createAdministrativeStaffUser(client, {
        email: em, phone: ph, first_name: fn, last_name: ln,
        gender: genderNorm, date_of_birth: date_of_birth || null,
        blood_group_id: bgParsed && !Number.isNaN(bgParsed) ? bgParsed : null,
        current_address: currAddr, permanent_address: permAddr,
        facebook: facebook || null, twitter: twitter || null,
        linkedin: linkedin || null, youtube: youtube || null, instagram: instagram || null,
        password: pwdIn || undefined, roleId: resolvedStaffRoleId,
      });
      if (!userId) { const err = new Error('Failed to create login account for staff'); err.statusCode = 500; throw err; }

      // 2. Insert staff (employment fields only)
      const staffIns = await client.query(
        `INSERT INTO staff (
          user_id, employee_code, marital_status, father_name, mother_name, id_number,
          emergency_contact_name, emergency_contact_phone,
          license_number, license_expiry,
          resume, joining_letter,
          designation_id, department_id, joining_date, qualification, experience_years,
          languages_known, other_info, photo_url, status, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
        ) RETURNING id`,
        [
          userId, employeeCode,
          marital_status || null, father_name || null, mother_name || null, id_number || null,
          emergency_contact_name || null, emergency_contact_phone || null,
          isDriverRole ? (license_number || '').toString().trim() || null : null,
          isDriverRole ? parseDateOrNull(license_expiry) : null,
          resume || null, joining_letter || null,
          desigParsed && !Number.isNaN(desigParsed) ? desigParsed : null,
          deptForInsert, joinD,
          qualification || null,
          expYears != null && !Number.isNaN(expYears) ? expYears : null,
          languagesArr, other_info || null,
          (photo_url || '').toString().trim().slice(0, 500) || null,
          statusValue,
          createdBy && !Number.isNaN(createdBy) ? createdBy : null,
        ]
      );
      const staffId = staffIns.rows[0].id;
      if (!customCode) {
        await client.query(`UPDATE staff SET employee_code = $1 WHERE id = $2`, [`STF${staffId}`.slice(0, 20), staffId]);
        employeeCode = `STF${staffId}`.slice(0, 20);
      }

      // 3. Insert salary assignment if payroll fields provided
      if (salaryNum != null || epf_no || pan_number || bank_name || account_name || account_number || branch || ifsc || contract_type || shift || work_location) {
        const panVal = (pan_number || '').toString().trim().toUpperCase().slice(0, 10) || null;
        await client.query(
          `INSERT INTO staff_salary_assignments (
            staff_id, basic_salary, epf_no, pan_number, bank_name, account_name, account_no,
            branch, ifsc_code, contract_type, shift, work_location, valid_period, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, daterange(CURRENT_DATE, NULL, '[)'), NOW(), NOW())`,
          [
            staffId, salaryNum ?? 0, epf_no || null, panVal,
            bank_name || null, account_name || null, account_number || null,
            branch || null, ifsc || null, contract_type || null, shift || null, work_location || null,
          ]
        );
      }

      await syncStaffUserRole(client, userId, { isDriver: Boolean(isDriverRole) });



      return staffId;
    });

    const full = await fetchStaffRowById(row);
    return success(res, 201, 'Staff created successfully', full);
  } catch (error) {
    if (error.staffInputError) return errorResponse(res, error.staffInputError.status, error.message, error.staffInputError.code);
    console.error('Error creating staff:', error);
    if (error.code === '23505') return errorResponse(res, 409, mapUniqueConstraintToMessage(error.constraint), 'CONFLICT');
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid reference data', 'FK_VIOLATION');
    return errorResponse(res, 500, `Failed to create staff: ${error.message}`, 'INTERNAL_ERROR');
  }
};



const updateStaff = async (req, res) => {
  try {
    const staffIdNum = parseInt(req.params.id, 10);
    if (!staffIdNum || Number.isNaN(staffIdNum)) return errorResponse(res, 400, 'Invalid staff ID', 'VALIDATION_ERROR');

    const existing = await query('SELECT s.*, u.id AS uid FROM staff s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1', [staffIdNum]);
    if (existing.rows.length === 0) return errorResponse(res, 404, 'Staff not found');
    const prev = existing.rows[0];
    const userId = prev.uid;

    const body = req.body || {};
    const {
      employee_code, first_name, last_name, email, phone, password,
      gender, date_of_birth, blood_group_id,
      designation_id, department_id, joining_date,
      salary, qualification, experience_years,
      address, current_address, permanent_address,
      emergency_contact_name, emergency_contact_phone,
      marital_status, father_name, mother_name, id_number,
      languages_known, other_info, photo_url, is_active,
      license_number, license_expiry,
      epf_no, pan_number, bank_name, account_name, account_number,
      branch, ifsc, contract_type, shift, work_location,
      facebook, twitter, linkedin, youtube, instagram,
      resume, joining_letter,
    } = body;

    if (email !== undefined && email !== null && String(email).trim() !== '') {
      if (!isValidEmail(String(email).trim())) return errorResponse(res, 400, 'Invalid email format', 'VALIDATION_ERROR');
    }
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      if (!isValidPhone(String(phone).trim())) return errorResponse(res, 400, 'Invalid phone number', 'VALIDATION_ERROR');
    }
    const pwdIn = password != null ? String(password).trim() : '';
    if (pwdIn && pwdIn.length < 6) return errorResponse(res, 400, 'Password must be at least 6 characters', 'VALIDATION_ERROR');

    const desigParsed = designation_id !== undefined ? parsePositiveIntOrNull(designation_id) : undefined;
    const deptParsed = department_id !== undefined ? parsePositiveIntOrNull(department_id) : undefined;
    const bgParsed = blood_group_id !== undefined ? parsePositiveIntOrNull(blood_group_id) : undefined;

    await executeTransaction(async (client) => {
      if (email !== undefined && email !== null) {
        const eTrim = String(email).trim();
        const dup = await client.query(
          `SELECT id FROM users WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1)) AND id IS DISTINCT FROM $2 LIMIT 1`,
          [eTrim, userId || 0]
        );
        if (dup.rows.length > 0) { const err = new Error('Email is already registered to another account'); err.staffInputError = { status: 409, code: 'EMAIL_IN_USE' }; throw err; }
      }

      // ── Block A: Update users (personal / login fields) ──
      if (userId) {
        const uUp = []; const uPa = []; let ui = 1;
        const uadd = (col, val) => { if (val !== undefined) { uUp.push(`${col} = $${ui}`); uPa.push(val); ui++; } };
        uadd('first_name', first_name !== undefined ? (first_name || '').toString().trim() || null : undefined);
        uadd('last_name', last_name !== undefined ? (last_name || '').toString().trim() || null : undefined);
        uadd('email', email !== undefined ? (email || '').toString().trim() || null : undefined);
        uadd('phone', phone !== undefined ? (phone || '').toString().trim() || null : undefined);
        if (gender !== undefined) uadd('gender', normalizeGender(gender));
        if (date_of_birth !== undefined) uadd('date_of_birth', parseDateOrNull(date_of_birth));
        if (blood_group_id !== undefined) uadd('blood_group_id', bgParsed && !Number.isNaN(bgParsed) ? bgParsed : null);
        uadd('current_address', current_address !== undefined ? ((current_address || address || '').toString().trim() || null) : (address !== undefined ? ((address || '').toString().trim() || null) : undefined));
        if (permanent_address !== undefined) uadd('permanent_address', (permanent_address || '').toString().trim() || null);
        if (facebook !== undefined) uadd('facebook', facebook || null);
        if (twitter !== undefined) uadd('twitter', twitter || null);
        if (linkedin !== undefined) uadd('linkedin', linkedin || null);
        if (youtube !== undefined) uadd('youtube', youtube || null);
        if (instagram !== undefined) uadd('instagram', instagram || null);

        let nextStatus = prev.status || 'Active';
        if (is_active !== undefined) {
          nextStatus = (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'Inactive') ? 'Inactive' : 'Active';
          uadd('is_active', nextStatus === 'Active');
        }

        uUp.push('updated_at = NOW()');
        if (uUp.length > 1) {
          uPa.push(userId);
          await client.query(`UPDATE users SET ${uUp.join(', ')} WHERE id = $${ui}`, uPa);
        }

        if (pwdIn) {
          const passwordHash = await bcrypt.hash(pwdIn, 12);
          await client.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, userId]);
        }
      }

      // ── Block B: Update staff (employment fields — NOT is_active, it's generated) ──
      {
        const sUp = []; const sPa = []; let si = 1;
        const sadd = (col, val) => { if (val !== undefined) { sUp.push(`${col} = $${si}`); sPa.push(val); si++; } };
        if (employee_code !== undefined) { const code = (employee_code || '').toString().trim().slice(0, 20); if (code) sadd('employee_code', code); }
        if (designation_id !== undefined) sadd('designation_id', desigParsed && !Number.isNaN(desigParsed) ? desigParsed : null);
        if (department_id !== undefined) sadd('department_id', deptParsed && !Number.isNaN(deptParsed) ? deptParsed : null);
        if (joining_date !== undefined) sadd('joining_date', parseDateOrNull(joining_date));
        if (qualification !== undefined) sadd('qualification', qualification || null);
        if (experience_years !== undefined) { const ey = experience_years != null && experience_years !== '' ? parseInt(experience_years, 10) : null; sadd('experience_years', ey != null && !Number.isNaN(ey) ? ey : null); }
        if (emergency_contact_name !== undefined) sadd('emergency_contact_name', emergency_contact_name || null);
        if (emergency_contact_phone !== undefined) sadd('emergency_contact_phone', emergency_contact_phone || null);
        if (marital_status !== undefined) sadd('marital_status', marital_status || null);
        if (father_name !== undefined) sadd('father_name', father_name || null);
        if (mother_name !== undefined) sadd('mother_name', mother_name || null);
        if (id_number !== undefined) sadd('id_number', id_number || null);
        if (other_info !== undefined) sadd('other_info', other_info || null);
        if (languages_known !== undefined) {
          const la = Array.isArray(languages_known) ? languages_known : (typeof languages_known === 'string' ? languages_known.split(',').map((s) => s.trim()).filter(Boolean) : null);
          sadd('languages_known', la);
        }
        if (photo_url !== undefined) sadd('photo_url', (photo_url || '').toString().trim().slice(0, 500) || null);
        if (license_number !== undefined) sadd('license_number', (license_number || '').toString().trim() || null);
        if (license_expiry !== undefined) sadd('license_expiry', parseDateOrNull(license_expiry));
        if (resume !== undefined) sadd('resume', (resume || '').toString().trim() || null);
        if (joining_letter !== undefined) sadd('joining_letter', (joining_letter || '').toString().trim() || null);
        if (is_active !== undefined) {
          const nextStatus = (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'Inactive') ? 'Inactive' : 'Active';
          sadd('status', nextStatus);
        }
        sUp.push('updated_at = NOW()');
        if (sUp.length > 1) {
          sPa.push(staffIdNum);
          await client.query(`UPDATE staff SET ${sUp.join(', ')} WHERE id = $${si}`, sPa);
          if (photo_url !== undefined && prev.photo_url && prev.photo_url !== photo_url) await deleteFileIfExist(prev.photo_url);
        }
      }

      // ── Block C: Upsert staff_salary_assignments ──
      if (salary !== undefined || epf_no !== undefined || pan_number !== undefined || bank_name !== undefined ||
          account_name !== undefined || account_number !== undefined || branch !== undefined || ifsc !== undefined ||
          contract_type !== undefined || shift !== undefined || work_location !== undefined) {
        const salaryNum = salary != null && salary !== '' ? parseFloat(salary) : null;
        const panVal = (pan_number || '').toString().trim().toUpperCase().slice(0, 10) || null;
        const existing_sal = await client.query(
          `SELECT id FROM staff_salary_assignments WHERE staff_id = $1 AND valid_period @> CURRENT_DATE LIMIT 1`,
          [staffIdNum]
        );
        if (existing_sal.rows.length > 0) {
          const salId = existing_sal.rows[0].id;
          const salUp = []; const salPa = []; let sali = 1;
          const saladd = (col, val) => { if (val !== undefined) { salUp.push(`${col} = $${sali}`); salPa.push(val); sali++; } };
          if (salary !== undefined) saladd('basic_salary', salaryNum != null && !Number.isNaN(salaryNum) ? salaryNum : null);
          if (epf_no !== undefined) saladd('epf_no', epf_no || null);
          if (pan_number !== undefined) saladd('pan_number', panVal);
          if (bank_name !== undefined) saladd('bank_name', bank_name || null);
          if (account_name !== undefined) saladd('account_name', account_name || null);
          if (account_number !== undefined) saladd('account_no', account_number || null);
          if (branch !== undefined) saladd('branch', branch || null);
          if (ifsc !== undefined) saladd('ifsc_code', ifsc || null);
          if (contract_type !== undefined) saladd('contract_type', contract_type || null);
          if (shift !== undefined) saladd('shift', shift || null);
          if (work_location !== undefined) saladd('work_location', work_location || null);
          salUp.push('updated_at = NOW()');
          if (salUp.length > 1) { salPa.push(salId); await client.query(`UPDATE staff_salary_assignments SET ${salUp.join(', ')} WHERE id = $${sali}`, salPa); }
        } else {
          await client.query(
            `INSERT INTO staff_salary_assignments (staff_id, basic_salary, epf_no, pan_number, bank_name, account_name, account_no, branch, ifsc_code, contract_type, shift, work_location, valid_period, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, daterange(CURRENT_DATE, NULL, '[)'), NOW(), NOW())`,
            [staffIdNum, salaryNum ?? 0, epf_no || null, panVal, bank_name || null, account_name || null, account_number || null, branch || null, ifsc || null, contract_type || null, shift || null, work_location || null]
          );
        }
      }

      // ── Driver sync ──
      const staffNow = await client.query(
        `SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.current_address,
                LOWER(TRIM(des.designation_name)) AS desig_key
         FROM staff s
         LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN designations des ON des.id = s.designation_id
         WHERE s.id = $1`,
        [staffIdNum]
      );
      const cur = staffNow.rows[0];
      const isDrv = cur?.desig_key && DRIVER_DESIGNATION_KEYS.has(cur.desig_key);
      if (cur?.user_id) await syncStaffUserRole(client, cur.user_id, { isDriver: Boolean(isDrv) });

      if (isDrv) {
        const supId = await getSupportStaffDepartmentId(client);
        if (supId && cur.department_id !== supId) {
          await client.query(`UPDATE staff SET department_id = $1, updated_at = NOW() WHERE id = $2`, [supId, staffIdNum]);
        }
      }
    });

    const full = await fetchStaffRowById(staffIdNum);
    return success(res, 200, 'Staff updated successfully', full);
  } catch (error) {
    if (error.staffInputError) return errorResponse(res, error.staffInputError.status, error.message, error.staffInputError.code);
    console.error('Error updating staff:', error);
    if (error.code === '23505') return errorResponse(res, 409, mapUniqueConstraintToMessage(error.constraint), 'CONFLICT');
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid reference data', 'FK_VIOLATION');
    return errorResponse(res, 500, `Failed to update staff: ${error.message}`, 'INTERNAL_ERROR');
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staffIdNum = parseInt(req.params.id, 10);
    if (!staffIdNum || Number.isNaN(staffIdNum)) return errorResponse(res, 400, 'Invalid staff ID', 'VALIDATION_ERROR');

    const staffRow = await query('SELECT user_id, status, deleted_at FROM staff WHERE id = $1', [staffIdNum]);
    if (!staffRow.rows.length) return errorResponse(res, 404, 'Staff not found');
    if (staffRow.rows[0].deleted_at) return errorResponse(res, 404, 'Staff not found or already deactivated');

    const uid = staffRow.rows[0].user_id;

    await query(
      `UPDATE staff SET status = 'Inactive', deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [staffIdNum]
    );

    if (uid) {
      await query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [uid]);
    }

    return success(res, 200, 'Staff deactivated successfully', { id: staffIdNum });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return errorResponse(res, 500, 'Failed to deactivate staff', 'INTERNAL_ERROR');
  }
};

function unlinkStaffDocStored(relPath) {
  const abs = resolveStaffDocumentPath(relPath);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.error('unlinkStaffDocStored:', e);
  }
}

function unlinkMulterTemp(file) {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch (e) {
    console.error('unlinkMulterTemp:', e);
  }
}

const uploadStaffDocuments = async (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    if (!staffId || Number.isNaN(staffId)) {
      return errorResponse(res, 400, 'Invalid staff ID', 'VALIDATION_ERROR');
    }

    const resumeArr = req.files?.resume;
    const letterArr = req.files?.joining_letter;
    const resumeFile = Array.isArray(resumeArr) && resumeArr[0] ? resumeArr[0] : null;
    const letterFile = Array.isArray(letterArr) && letterArr[0] ? letterArr[0] : null;

    if (!resumeFile && !letterFile) {
      return errorResponse(res, 400, 'No files uploaded. Use multipart fields resume and/or joining_letter.', 'VALIDATION_ERROR');
    }

    const dbName = req.tenant?.db_name;
    if (!dbName || !String(dbName).trim()) {
      if (resumeFile) unlinkMulterTemp(resumeFile);
      if (letterFile) unlinkMulterTemp(letterFile);
      return errorResponse(res, 500, 'Tenant context missing', 'CONFIG_ERROR');
    }

    return await runWithTenant(dbName, async () => {
      const tenant = sanitizeTenant(req.tenant?.db_name || dbName || 'default_tenant') || 'default_tenant';

      const prev = await query('SELECT resume, joining_letter FROM staff WHERE id = $1', [staffId]);
      if (!prev.rows.length) {
        if (resumeFile) unlinkMulterTemp(resumeFile);
        if (letterFile) unlinkMulterTemp(letterFile);
        return errorResponse(res, 404, 'Staff not found', 'NOT_FOUND');
      }

      const oldResume = prev.rows[0].resume;
      const oldLetter = prev.rows[0].joining_letter;

      const newResumeRel = resumeFile ? `${tenant}/${resumeFile.filename}` : null;
      const newLetterRel = letterFile ? `${tenant}/${letterFile.filename}` : null;

      const upd = await query(
        `UPDATE staff SET
          resume = COALESCE($1, resume),
          joining_letter = COALESCE($2, joining_letter),
          updated_at = NOW()
        WHERE id = $3`,
        [newResumeRel, newLetterRel, staffId]
      );

      if (upd.rowCount < 1) {
        if (resumeFile) unlinkMulterTemp(resumeFile);
        if (letterFile) unlinkMulterTemp(letterFile);
        return errorResponse(res, 404, 'Staff not found or could not update', 'NOT_FOUND');
      }

      if (resumeFile && oldResume && oldResume !== newResumeRel) unlinkStaffDocStored(oldResume);
      if (letterFile && oldLetter && oldLetter !== newLetterRel) unlinkStaffDocStored(oldLetter);

      const refreshed = await query(
        `SELECT resume, joining_letter, updated_at FROM staff WHERE id = $1`,
        [staffId]
      );
      return success(res, 200, 'Documents uploaded successfully', refreshed.rows[0] || {});
    });
  } catch (error) {
    console.error('uploadStaffDocuments:', error);
    return errorResponse(res, 500, 'Failed to upload documents', 'INTERNAL_ERROR');
  }
};

const getStaffDocument = async (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    const docTypeRaw = String(req.params.docType || '').toLowerCase();
    if (!staffId || Number.isNaN(staffId)) {
      return errorResponse(res, 400, 'Invalid staff ID', 'VALIDATION_ERROR');
    }
    const column = docTypeRaw === 'joining-letter' ? 'joining_letter' : docTypeRaw === 'resume' ? 'resume' : null;
    if (!column) {
      return errorResponse(res, 400, 'Invalid document type', 'VALIDATION_ERROR');
    }

    const requester = req.user;
    const roleId = requester?.role_id != null ? parseInt(requester.role_id, 10) : null;
    if (!requester?.id || roleId == null) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    const dbName = req.tenant?.db_name;
    if (!dbName || !String(dbName).trim()) {
      return errorResponse(res, 500, 'Tenant context missing', 'CONFIG_ERROR');
    }

    return await runWithTenant(dbName, async () => {
      const result = await query(
        `SELECT s.${column} AS doc_path, s.user_id, s.id AS staff_id
         FROM staff s
         WHERE s.id = $1`,
        [staffId]
      );

      if (!result.rows.length) {
        return errorResponse(res, 404, 'Staff not found');
      }

      const row = result.rows[0];
      const isAdmin = roleId != null && ADMIN_ROLE_IDS.includes(roleId);
      const isSelf = String(row.user_id) === String(requester.id);
      const staffIdMatch = requester.staff_id != null && String(row.staff_id) === String(requester.staff_id);
      if (!isAdmin && !isSelf && !staffIdMatch) {
        return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
      }

      const rel = row.doc_path;
      const abs = resolveStaffDocumentPath(rel);
      if (!abs || !fs.existsSync(abs)) {
        return errorResponse(res, 404, 'Document not found or file missing');
      }

      const downloadName = column === 'joining_letter' ? 'joining-letter.pdf' : 'resume.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
      return res.sendFile(abs);
    });
  } catch (error) {
    console.error('getStaffDocument:', error);
    return errorResponse(res, 500, 'Failed to load document', 'INTERNAL_ERROR');
  }
};


const uploadStaffPhoto = async (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    if (!staffId || Number.isNaN(staffId)) return errorResponse(res, 400, 'Invalid staff ID');

    if (!req.file) return errorResponse(res, 400, 'No image file uploaded');

    const tenant = sanitizeTenant(req.tenant?.db_name || 'default_tenant') || 'default_tenant';
    const relativePath = `${tenant}/${req.file.filename}`;

    const existing = await query('SELECT photo_url FROM staff WHERE id = $1', [staffId]);
    if (existing.rows.length === 0) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return errorResponse(res, 404, 'Staff not found');
    }

    await query('UPDATE staff SET photo_url = $1, updated_at = NOW() WHERE id = $2', [relativePath, staffId]);

    const oldPath = resolveStaffProfilePath(existing.rows[0].photo_url);
    if (oldPath && fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) { console.warn('Failed to delete old staff photo:', e.message); }
    }

    return success(res, 200, 'Profile photo uploaded successfully', { photo_url: relativePath });
  } catch (err) {
    console.error('Error uploading staff photo:', err);
    return errorResponse(res, 500, 'Failed to upload photo');
  }
};

const getStaffPhoto = async (req, res) => {
  try {
    const { id, filename } = req.params;
    const staffId = parseInt(id, 10);
    if (!staffId || Number.isNaN(staffId)) return errorResponse(res, 400, 'Invalid staff ID');

    const requester = req.user;
    const roleId = requester?.role_id != null ? parseInt(requester.role_id, 10) : null;
    if (!requester?.id || roleId == null) return errorResponse(res, 401, 'Not authenticated');

    const staffRes = await query('SELECT user_id, photo_url FROM staff WHERE id = $1', [staffId]);
    if (staffRes.rows.length === 0) return errorResponse(res, 404, 'Staff not found');

    const row = staffRes.rows[0];
    const isAdmin = roleId != null && ADMIN_ROLE_IDS.includes(roleId);
    const isSelf = String(row.user_id) === String(requester.id);

    if (!isAdmin && !isSelf) return errorResponse(res, 403, 'Access denied');

    const tenant = sanitizeTenant(req.tenant?.db_name || 'default_tenant') || 'default_tenant';
    const fullPath = resolveStaffProfilePath(`${tenant}/${filename}`);

    if (!fullPath || !fs.existsSync(fullPath)) return errorResponse(res, 404, 'Photo not found');

    res.setHeader('Content-Type', 'image/jpeg'); // Basic assumption, browser handles most images
    return res.sendFile(fullPath);
  } catch (err) {
    console.error('Error serving staff photo:', err);
    return errorResponse(res, 500, 'Failed to retrieve photo');
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  uploadStaffDocuments,
  getStaffDocument,
  uploadStaffPhoto,
  getStaffPhoto,
};
