const { query } = require('../config/database');
const { ROLES, ADMIN_ROLE_IDS, ADMIN_ROLE_NAMES } = require('../config/roles');
const { getParentsForUser } = require('./parentUserMatch');

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

function isAdmin(ctx) {
  return (
    (ctx.roleId != null && ADMIN_ROLE_IDS.includes(ctx.roleId)) ||
    (ctx.roleName !== '' && ADMIN_ROLE_NAMES.includes(ctx.roleName))
  );
}

async function canAccessStudent(req, studentId) {
  const ctx = getAuthContext(req);
  const sid = parseId(studentId);
  if (!ctx.userId || !sid) return { ok: false, status: 401, message: 'Not authenticated' };

  if (isAdmin(ctx)) return { ok: true };

  // Load student linkage needed for checks.
  const studRes = await query(
    `SELECT id, user_id, class_id, section_id
     FROM students
     WHERE id = $1 AND is_active = true
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
  if (ctx.roleId === ROLES.TEACHER || ctx.roleName === 'teacher') {
    // A single user can sometimes have multiple teacher rows; allow access if any active mapping matches.
    const tRes = await query(
      `SELECT t.id, t.class_id
       FROM teachers t
       INNER JOIN staff st ON t.staff_id = st.id
       WHERE st.user_id = $1 AND st.is_active = true`,
      [ctx.userId]
    );
    if (tRes.rows.length === 0) return { ok: false, status: 403, message: 'Access denied' };
    const studentClassId = parseId(stud.class_id);
    const teacherIds = tRes.rows.map((row) => parseId(row.id)).filter(Boolean);
    const teacherClassIds = tRes.rows.map((row) => parseId(row.class_id)).filter(Boolean);

    if (studentClassId && teacherClassIds.includes(studentClassId)) return { ok: true };

    // Fallback: teacher has any class_schedule entry for the student's class (optionally section).
    const cs = await query(
      `SELECT 1
       FROM class_schedules cs
       WHERE cs.teacher_id = ANY($1::int[])
         AND cs.class_id = $2
         AND ($3::int IS NULL OR cs.section_id = $3 OR cs.section_id IS NULL)
       LIMIT 1`,
      [teacherIds, studentClassId, parseId(stud.section_id)]
    ).catch(() => ({ rows: [] }));
    if (cs.rows && cs.rows.length > 0) return { ok: true };

    return { ok: false, status: 403, message: 'Access denied' };
  }

  // Parent: only children (resolved via parentUserMatch)
  if (ctx.roleId === ROLES.PARENT || ctx.roleName === 'parent') {
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
  const uid = parseId(userId);
  if (!uid) return null;
  const r = await query(
    `SELECT t.id
     FROM teachers t
     INNER JOIN staff st ON t.staff_id = st.id
     WHERE st.user_id = $1
     LIMIT 1`,
    [uid]
  );
  return r.rows.length > 0 ? parseId(r.rows[0].id) : null;
}

async function resolveStudentScopeForUser(userId) {
  const uid = parseId(userId);
  if (!uid) return null;
  const r = await query(
    `SELECT id, class_id, section_id
     FROM students
     WHERE user_id = $1 AND is_active = true
     ORDER BY id ASC
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

  if (ctx.roleId === ROLES.PARENT || ctx.roleName === 'parent') {
    const { studentIds } = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
    return Array.isArray(studentIds) ? studentIds.map(parseId).filter(Boolean) : [];
  }

  if (ctx.roleId === ROLES.GUARDIAN || ctx.roleName === 'guardian') {
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

  if (ctx.roleId === ROLES.TEACHER || ctx.roleName === 'teacher') {
    const tRes = await query(
      `SELECT t.id, t.class_id
       FROM teachers t
       INNER JOIN staff st ON t.staff_id = st.id
       WHERE st.user_id = $1
       LIMIT 1`,
      [ctx.userId]
    );
    if (!tRes.rows.length) return { ok: false, status: 403, message: 'Access denied' };
    const teacher = tRes.rows[0];
    const teacherClassId = parseId(teacher.class_id);
    if (teacherClassId && teacherClassId === cid) return { ok: true };

    const cs = await query(
      `SELECT 1
       FROM class_schedules cs
       WHERE cs.teacher_id = $1 AND cs.class_id = $2
       LIMIT 1`,
      [teacher.id, cid]
    ).catch(() => ({ rows: [] }));
    if (cs.rows && cs.rows.length > 0) return { ok: true };

    return { ok: false, status: 403, message: 'Access denied' };
  }

  if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
    const scope = await resolveStudentScopeForUser(ctx.userId);
    if (scope && scope.classId === cid) return { ok: true };
    return { ok: false, status: 403, message: 'Access denied' };
  }

  if (ctx.roleId === ROLES.PARENT || ctx.roleName === 'parent') {
    const { studentIds } = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
    const ids = Array.isArray(studentIds) ? studentIds.map(parseId).filter(Boolean) : [];
    if (!ids.length) return { ok: false, status: 403, message: 'Access denied' };
    const r = await query(
      `SELECT 1 FROM students
       WHERE id = ANY($1::int[]) AND class_id = $2 AND is_active = true
       LIMIT 1`,
      [ids, cid]
    );
    return r.rows.length ? { ok: true } : { ok: false, status: 403, message: 'Access denied' };
  }

  if (ctx.roleId === ROLES.GUARDIAN || ctx.roleName === 'guardian') {
    const wardIds = await resolveWardStudentIdsForUser(req);
    if (!wardIds.length) return { ok: false, status: 403, message: 'Access denied' };
    const r = await query(
      `SELECT 1 FROM students
       WHERE id = ANY($1::int[]) AND class_id = $2 AND is_active = true
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
  canAccessStudent,
  canAccessClass,
  resolveTeacherIdForUser,
  resolveStudentScopeForUser,
  resolveWardStudentIdsForUser,
};

