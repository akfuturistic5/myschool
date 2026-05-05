const { query } = require('../config/database');
const { ROLES, ADMIN_ROLE_IDS, ADMIN_ROLE_NAMES } = require('../config/roles');
const { getParentsForUser } = require('./parentUserMatch');
const { lateralCurrentEnrollment } = require('./studentEnrollmentSql');

function parseId(value) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getAuthContext(req) {
  const u = req?.user || {};
  const userId = parseId(u.id);
  const roleId = u.role_id != null ? parseId(u.role_id) : null;
  const roleName = (u.role_name || '').toString().trim().toLowerCase();
  return { userId, roleId, roleName, staffId: parseId(u.staff_id) };
}

/** Parent login may use role_id=4 with role_name father/mother; ward resolution must still run. */
function isParentPortalRole(ctx) {
  if (!ctx) return false;
  if (ctx.roleId === ROLES.PARENT) return true;
  const n = String(ctx.roleName || '').toLowerCase();
  return n === 'parent' || n === 'father' || n === 'mother';
}

function isGuardianPortalRole(ctx) {
  if (!ctx) return false;
  if (ctx.roleId === ROLES.GUARDIAN) return true;
  return String(ctx.roleName || '').toLowerCase() === 'guardian';
}

function isParentOrGuardianPortalRole(ctx) {
  return isParentPortalRole(ctx) || isGuardianPortalRole(ctx);
}

function isAdmin(ctx) {
  return (
    (ctx.roleId != null && ADMIN_ROLE_IDS.includes(ctx.roleId)) ||
    (ctx.roleName !== '' && ADMIN_ROLE_NAMES.includes(ctx.roleName))
  );
}

function isTeacherRole(ctx) {
  const roleName = String(ctx?.roleName || '').trim().toLowerCase();
  return (
    ctx?.roleId === ROLES.TEACHER ||
    roleName === 'teacher' ||
    roleName.includes('teacher')
  );
}

async function canAccessStudent(req, studentId) {
  const ctx = getAuthContext(req);
  const sid = parseId(studentId);
  if (!ctx.userId || !sid) return { ok: false, status: 401, message: 'Not authenticated' };

  if (isAdmin(ctx)) return { ok: true };

  // Load student linkage needed for checks.
  const studRes = await query(
    `SELECT s.id, s.user_id, enr.class_id, enr.section_id
     FROM students s
     ${lateralCurrentEnrollment('s.id')}
     WHERE s.id = $1
     LIMIT 1`,
    [sid]
  );
  if (studRes.rows.length === 0) return { ok: false, status: 404, message: 'Student not found' };
  const stud = studRes.rows[0];

  // Student: only self (by students.user_id)
  if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
    const studentUserId = parseId(stud.user_id);
    if (studentUserId && studentUserId === ctx.userId) return { ok: true };
    return { ok: false, status: 403, message: 'Access denied' };
  }

  // Teacher: must be the teacher assigned to this class OR has schedule mapping for class.
  if (isTeacherRole(ctx)) {
    const tRes = await query(
      `SELECT st.id AS staff_id
       FROM staff st
       WHERE st.user_id = $1 AND st.deleted_at IS NULL AND (st.status = 'Active')`,
      [ctx.userId]
    );
    if (tRes.rows.length === 0) return { ok: false, status: 403, message: 'Access denied' };
    const staffIds = tRes.rows.map((row) => parseId(row.staff_id)).filter(Boolean);
    const studentClassId = parseId(stud.class_id);
    const studentSectionId = parseId(stud.section_id);

    if (studentClassId && staffIds.length > 0) {
      const cs = await query(
        `SELECT 1
         FROM class_schedules cs
         WHERE cs.teacher_id = ANY($1::int[])
           AND cs.class_id = $2
           AND ($3::int IS NULL OR EXISTS (
             SELECT 1 FROM class_sections csec
             WHERE csec.id = cs.class_section_id AND csec.section_id = $3
           ) OR $3::int IS NULL)
         LIMIT 1`,
        [staffIds, studentClassId, studentSectionId]
      ).catch(() => ({ rows: [] }));
      if (cs.rows && cs.rows.length > 0) return { ok: true };
    }

    if (studentClassId && staffIds.length > 0) {
      const ct = await query(
        `SELECT 1
         FROM class_teachers ct
         WHERE ct.staff_id = ANY($1::int[])
           AND ct.class_id = $2
           AND ct.deleted_at IS NULL
           AND ($3::int IS NULL OR EXISTS (
             SELECT 1 FROM class_sections csec
             WHERE csec.id = ct.class_section_id AND csec.section_id = $3
           ) OR (ct.class_section_id IS NULL AND $3::int IS NULL))
         LIMIT 1`,
        [staffIds, studentClassId, studentSectionId]
      ).catch(() => ({ rows: [] }));
      if (ct.rows && ct.rows.length > 0) return { ok: true };
    }

    return { ok: false, status: 403, message: 'Access denied' };
  }

  // Parent: only children (resolved via parentUserMatch)
  if (isParentPortalRole(ctx)) {
    const { studentIds } = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
    if (Array.isArray(studentIds) && studentIds.includes(sid)) return { ok: true };
    return { ok: false, status: 403, message: 'Access denied' };
  }

  // Guardian: must have guardian row tied to this user + student
  if (ctx.roleId === ROLES.GUARDIAN || ctx.roleName === 'guardian') {
    const gCheck = await query(
      `SELECT 1
       FROM guardians g
       WHERE g.user_id = $1 AND g.student_id = $2
       LIMIT 1`,
      [ctx.userId, sid]
    );
    if (gCheck.rows.length > 0) return { ok: true };
    return { ok: false, status: 403, message: 'Access denied' };
  }

  return { ok: false, status: 403, message: 'Access denied' };
}

async function resolveTeacherIdForUser(userId) {
  return resolveTeacherStaffIdForUser(userId);
}

/** Staff id for the teacher row linked to this user (class_schedules.teacher_id references staff.id). */
async function resolveTeacherStaffIdForUser(userId) {
  const uid = parseId(userId);
  if (!uid) return null;
  const r = await query(
    `SELECT s.id AS staff_id
     FROM staff s
     WHERE s.user_id = $1 AND s.deleted_at IS NULL
     LIMIT 1`,
    [uid]
  );
  return r.rows.length > 0 ? parseId(r.rows[0].staff_id) : null;
}

async function resolveStudentScopeForUser(userId) {
  const uid = parseId(userId);
  if (!uid) return null;
  const r = await query(
    `SELECT s.id, enr.class_id, enr.section_id
     FROM students s
     ${lateralCurrentEnrollment('s.id')}
     WHERE s.user_id = $1 AND (s.deleted_at IS NULL AND s.status = 'Active')
     ORDER BY s.id ASC
     LIMIT 1`,
    [uid]
  );
  if (r.rows.length === 0) return null;
  return {
    studentId: parseId(r.rows[0].id),
    classId: parseId(r.rows[0].class_id),
    sectionId: parseId(r.rows[0].section_id),
  };
}

async function resolveWardStudentIdsForUser(req) {
  const ctx = getAuthContext(req);
  if (!ctx.userId) return [];

  if (isParentPortalRole(ctx)) {
    const { studentIds } = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
    return Array.isArray(studentIds) ? studentIds.map(parseId).filter(Boolean) : [];
  }

  if (isGuardianPortalRole(ctx)) {
    const g = await query(
      `SELECT g.student_id
       FROM guardians g
       WHERE g.user_id = $1`,
      [ctx.userId]
    );
    return (g.rows || []).map((r) => parseId(r.student_id)).filter(Boolean);
  }

  return [];
}

/**
 * Whether the authenticated user may read data scoped to a given class (roster, teachers, sections, subjects).
 * Admin: always. Teacher: homeroom class or any class_schedules row. Student/parent/guardian: linked to a student in that class.
 */
async function canAccessClass(req, classId) {
  const cid = parseId(classId);
  if (!cid) return { ok: false, status: 400, message: 'Invalid class id' };

  const ctx = getAuthContext(req);
  if (!ctx.userId) return { ok: false, status: 401, message: 'Not authenticated' };

  if (isAdmin(ctx)) return { ok: true };

  if (isTeacherRole(ctx)) {
    const tRes = await query(
      `SELECT st.id AS staff_id
       FROM staff st
       WHERE st.user_id = $1 AND st.deleted_at IS NULL AND (st.status = 'Active')`,
      [ctx.userId]
    );
    if (!tRes.rows.length) return { ok: false, status: 403, message: 'Access denied' };
    const staffIds = tRes.rows.map((r) => parseId(r.staff_id)).filter(Boolean);

    const ct = await query(
      `SELECT 1 FROM class_teachers ct
       WHERE ct.class_id = $1 AND ct.staff_id = ANY($2::int[])
         AND ct.deleted_at IS NULL
       LIMIT 1`,
      [cid, staffIds]
    ).catch(() => ({ rows: [] }));
    if (ct.rows && ct.rows.length > 0) return { ok: true };

    const cs = await query(
      `SELECT 1
       FROM class_schedules cs
       WHERE cs.class_id = $2
         AND cs.teacher_id = ANY($1::int[])
       LIMIT 1`,
      [staffIds, cid]
    ).catch(() => ({ rows: [] }));
    if (cs.rows && cs.rows.length > 0) return { ok: true };

    return { ok: false, status: 403, message: 'Access denied' };
  }

  if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
    const scope = await resolveStudentScopeForUser(ctx.userId);
    if (scope && scope.classId === cid) return { ok: true };
    return { ok: false, status: 403, message: 'Access denied' };
  }

  if (isParentPortalRole(ctx)) {
    const { studentIds } = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
    const ids = Array.isArray(studentIds) ? studentIds.map(parseId).filter(Boolean) : [];
    if (!ids.length) return { ok: false, status: 403, message: 'Access denied' };
    const r = await query(
      `SELECT 1 FROM students st
       ${lateralCurrentEnrollment('st.id')}
       WHERE st.id = ANY($1::int[]) AND enr.class_id = $2 AND (st.status = 'Active')
       LIMIT 1`,
      [ids, cid]
    );
    return r.rows.length ? { ok: true } : { ok: false, status: 403, message: 'Access denied' };
  }

  if (isGuardianPortalRole(ctx)) {
    const wardIds = await resolveWardStudentIdsForUser(req);
    if (!wardIds.length) return { ok: false, status: 403, message: 'Access denied' };
    const r = await query(
      `SELECT 1 FROM students st
       ${lateralCurrentEnrollment('st.id')}
       WHERE st.id = ANY($1::int[]) AND enr.class_id = $2 AND (st.status = 'Active')
       LIMIT 1`,
      [wardIds, cid]
    );
    return r.rows.length ? { ok: true } : { ok: false, status: 403, message: 'Access denied' };
  }

  return { ok: false, status: 403, message: 'Access denied' };
}

module.exports = {
  parseId,
  getAuthContext,
  isAdmin,
  isTeacherRole,
  isParentPortalRole,
  isGuardianPortalRole,
  isParentOrGuardianPortalRole,
  canAccessStudent,
  canAccessClass,
  resolveTeacherIdForUser,
  resolveTeacherStaffIdForUser,
  resolveStudentScopeForUser,
  resolveWardStudentIdsForUser,
};

