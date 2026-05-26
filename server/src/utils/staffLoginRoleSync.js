const { ROLES } = require('../config/roles');

/** Matches designations that operate school transport (HRM ↔ drivers). */
const DRIVER_DESIGNATION_KEYS = new Set(['driver', 'drivers']);

const TEACHER_DESIGNATION_KEYS = new Set([
  'teacher',
  'senior teacher',
  'assistant teacher',
  'class teacher',
  'primary teacher',
  'hod',
  'demo teacher',
]);

const LEADERSHIP_DESIGNATION_KEYS = new Set(['principal', 'vice principal']);

/** Academic departments: teaching staff default to Teacher login unless designation says otherwise. */
const ACADEMIC_DEPARTMENT_KEYS = new Set([
  'academic',
  'academics',
  'teaching',
  'primary education',
  'demo academics department',
]);

const NON_TEACHING_DESIGNATION_IN_ACADEMIC = new Set([
  'clerk',
  'librarian',
  'accountant',
  'receptionist',
  'warden',
]);

async function getRoleIdByName(client, roleName) {
  const role = String(roleName || '').trim().toLowerCase();
  if (!role) return null;
  const r = await client.query(
    `SELECT id FROM user_roles
     WHERE LOWER(TRIM(role_name)) = $1
       AND (is_active IS NOT FALSE)
     LIMIT 1`,
    [role]
  );
  return r.rows[0]?.id ?? null;
}

async function getDesignationContext(client, designationId) {
  if (designationId == null || Number.isNaN(Number(designationId))) {
    return { desig_key: null, dept_key: null };
  }
  const r = await client.query(
    `SELECT LOWER(TRIM(d.designation_name)) AS desig_key,
            LOWER(TRIM(dep.department_name)) AS dept_key
     FROM designations d
     LEFT JOIN departments dep ON dep.id = d.department_id
     WHERE d.id = $1`,
    [designationId]
  );
  return r.rows[0] || { desig_key: null, dept_key: null };
}

async function getDesignationKey(client, designationId) {
  const ctx = await getDesignationContext(client, designationId);
  return ctx.desig_key ?? null;
}

function isDriverDesignationKey(key) {
  return Boolean(key && DRIVER_DESIGNATION_KEYS.has(key));
}

function isTeacherDesignationKey(key) {
  if (!key) return false;
  if (LEADERSHIP_DESIGNATION_KEYS.has(key)) return false;
  if (TEACHER_DESIGNATION_KEYS.has(key)) return true;
  if (key.includes('teacher')) return true;
  if (key.includes('administrative') || key.includes('administration')) return false;
  return false;
}

/**
 * Login role implied by designation + department (driver / teacher / other).
 * @returns {'driver'|'teacher'|'other'}
 */
function designationLoginKindFromContext(ctx) {
  const key = ctx?.desig_key;
  const dept = ctx?.dept_key;
  if (isDriverDesignationKey(key)) return 'driver';
  if (isTeacherDesignationKey(key)) return 'teacher';
  if (
    dept &&
    ACADEMIC_DEPARTMENT_KEYS.has(dept) &&
    key &&
    !LEADERSHIP_DESIGNATION_KEYS.has(key) &&
    !NON_TEACHING_DESIGNATION_IN_ACADEMIC.has(key)
  ) {
    return 'teacher';
  }
  return 'other';
}

function designationLoginKind(keyOrCtx) {
  if (keyOrCtx && typeof keyOrCtx === 'object') {
    return designationLoginKindFromContext(keyOrCtx);
  }
  return designationLoginKindFromContext({ desig_key: keyOrCtx, dept_key: null });
}

async function resolveStaffLoginRoleId(client, designationId, explicitRoleId = null) {
  const ctx = await getDesignationContext(client, designationId);
  const kind = designationLoginKindFromContext(ctx);

  if (kind === 'driver') {
    return (await getRoleIdByName(client, 'driver')) ?? ROLES.ADMINISTRATIVE;
  }
  if (kind === 'teacher') {
    return (await getRoleIdByName(client, 'teacher')) ?? ROLES.TEACHER;
  }

  const explicit =
    explicitRoleId != null && explicitRoleId !== '' && Number.isFinite(Number(explicitRoleId))
      ? Number(explicitRoleId)
      : null;
  if (explicit) return explicit;

  return (await getRoleIdByName(client, 'administrative')) ?? ROLES.ADMINISTRATIVE;
}

/**
 * Apply resolved login role — throws if role cannot be applied (no silent skip).
 */
async function applyStaffLoginRoleSync(client, userId, designationId, explicitRoleId = null) {
  if (!userId) {
    const err = new Error('Staff account has no linked user for login role sync');
    err.staffInputError = { status: 500, code: 'USER_LINK_MISSING' };
    throw err;
  }

  const targetRoleId = await resolveStaffLoginRoleId(client, designationId, explicitRoleId);
  if (targetRoleId == null || !Number.isFinite(Number(targetRoleId))) {
    const err = new Error('Could not resolve login role for this designation');
    err.staffInputError = { status: 500, code: 'ROLE_RESOLVE_FAILED' };
    throw err;
  }

  const rOk = await client.query(
    `SELECT id FROM user_roles WHERE id = $1 AND (is_active IS NOT FALSE) LIMIT 1`,
    [targetRoleId]
  );
  if (!rOk.rows.length) {
    const err = new Error(
      `Login role id ${targetRoleId} is missing or inactive in user_roles. Configure Teacher/Administrative/Driver roles.`
    );
    err.staffInputError = { status: 500, code: 'ROLE_NOT_CONFIGURED' };
    throw err;
  }

  const upd = await client.query(
    `UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2 RETURNING role_id`,
    [targetRoleId, userId]
  );
  if (!upd.rows.length) {
    const err = new Error('Failed to update user login role');
    err.staffInputError = { status: 500, code: 'ROLE_UPDATE_FAILED' };
    throw err;
  }
  return upd.rows[0].role_id;
}

function isTeachingDesignationSql(keysParamIndex) {
  return `(
    LOWER(TRIM(des.designation_name)) = ANY($${keysParamIndex}::text[])
    OR (
      LOWER(TRIM(des.designation_name)) LIKE '%teacher%'
      AND LOWER(TRIM(des.designation_name)) NOT LIKE '%administrative%'
    )
  )
  AND LOWER(TRIM(des.designation_name)) NOT IN ('principal', 'vice principal')`;
}

async function repairTeacherStaffLoginRoleMismatches(client) {
  const teacherRoleId = (await getRoleIdByName(client, 'teacher')) ?? ROLES.TEACHER;
  const keys = [...TEACHER_DESIGNATION_KEYS];
  await client.query(
    `UPDATE users u
        SET role_id = $1, updated_at = NOW()
       FROM staff s
       JOIN designations des ON des.id = s.designation_id
      WHERE s.user_id = u.id
        AND s.deleted_at IS NULL
        AND u.role_id IS DISTINCT FROM $1
        AND ${isTeachingDesignationSql(2)}`,
    [teacherRoleId, keys]
  );
}

async function repairNonTeachingStaffLoginRoleMismatches(client) {
  const teacherRoleId = (await getRoleIdByName(client, 'teacher')) ?? ROLES.TEACHER;
  const adminRoleId = (await getRoleIdByName(client, 'administrative')) ?? ROLES.ADMINISTRATIVE;
  const keys = [...TEACHER_DESIGNATION_KEYS];
  await client.query(
    `UPDATE users u
        SET role_id = $1, updated_at = NOW()
       FROM staff s
       JOIN designations des ON des.id = s.designation_id
      WHERE s.user_id = u.id
        AND s.deleted_at IS NULL
        AND u.role_id = $2
        AND NOT ${isTeachingDesignationSql(3)}`,
    [adminRoleId, teacherRoleId, keys]
  );
}

async function repairStaffLoginRoleMismatches(client) {
  await repairTeacherStaffLoginRoleMismatches(client);
  await repairNonTeachingStaffLoginRoleMismatches(client);
}

/**
 * After employment fields change: designation drives Teacher/Driver login;
 * for other designations the form's login role is used when provided.
 */
async function syncStaffLoginRoleAfterEmploymentChange(
  client,
  userId,
  designationId,
  { roleIdFromForm, employmentFieldsTouched }
) {
  if (!userId) return null;
  if (!employmentFieldsTouched) return null;
  if (designationId == null || Number.isNaN(Number(designationId))) return null;

  const ctx = await getDesignationContext(client, designationId);
  const kind = designationLoginKindFromContext(ctx);

  let explicit = null;
  if (kind === 'other') {
    const parsed =
      roleIdFromForm != null && roleIdFromForm !== '' && Number.isFinite(Number(roleIdFromForm))
        ? Number(roleIdFromForm)
        : null;
    if (parsed) explicit = parsed;
  }

  return applyStaffLoginRoleSync(client, userId, designationId, explicit);
}

/** @deprecated Use syncStaffLoginRoleAfterEmploymentChange */
async function finalizeStaffUserLoginRole(
  client,
  userId,
  designationId,
  { role_id, roleIdParsed, designationTouched, roleTouched }
) {
  const employmentFieldsTouched = Boolean(designationTouched || roleTouched);
  return syncStaffLoginRoleAfterEmploymentChange(client, userId, designationId, {
    roleIdFromForm: roleIdParsed,
    employmentFieldsTouched,
  });
}

module.exports = {
  DRIVER_DESIGNATION_KEYS,
  TEACHER_DESIGNATION_KEYS,
  getDesignationContext,
  getDesignationKey,
  isDriverDesignationKey,
  isTeacherDesignationKey,
  designationLoginKind,
  designationLoginKindFromContext,
  resolveStaffLoginRoleId,
  applyStaffLoginRoleSync,
  repairTeacherStaffLoginRoleMismatches,
  repairNonTeachingStaffLoginRoleMismatches,
  repairStaffLoginRoleMismatches,
  syncStaffLoginRoleAfterEmploymentChange,
  finalizeStaffUserLoginRole,
};
