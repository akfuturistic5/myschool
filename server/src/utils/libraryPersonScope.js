const { query } = require('../config/database');
const { ROLES } = require('../config/roles');
const { hasColumn } = require('./schemaInspector');

let studentsActiveWhereSql = null;

/**
 * Active-row filter for students (status and/or is_active per tenant schema).
 */
async function getStudentsActiveWhereSql() {
  if (studentsActiveWhereSql) return studentsActiveWhereSql;

  const hasIsActive = await hasColumn('students', 'is_active');
  const hasStatus = await hasColumn('students', 'status');
  const hasDeletedAt = await hasColumn('students', 'deleted_at');

  const parts = [];
  if (hasIsActive) {
    parts.push('COALESCE(is_active, true) = true');
  } else if (hasStatus) {
    parts.push(`COALESCE(status, 'Active') = 'Active'`);
  }
  if (hasDeletedAt) {
    parts.push('deleted_at IS NULL');
  }

  studentsActiveWhereSql = parts.length ? parts.join(' AND ') : 'TRUE';
  return studentsActiveWhereSql;
}

/**
 * Resolve library list/get scope for the authenticated user.
 * Students are restricted to their own record only (restrict_to_self).
 */
async function getLibraryPersonScope(req) {
  const roleId = req.user?.role_id;
  if (roleId !== ROLES.STUDENT) {
    return { student_id: null, restrict_to_self: false };
  }

  const activeWhere = await getStudentsActiveWhereSql();
  const r = await query(
    `SELECT id FROM students WHERE user_id = $1 AND ${activeWhere}`,
    [req.user.id]
  );

  return {
    student_id: r.rows[0]?.id ?? null,
    restrict_to_self: true,
  };
}

module.exports = {
  getLibraryPersonScope,
  getStudentsActiveWhereSql,
};
