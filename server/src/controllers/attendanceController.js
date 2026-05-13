const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { ROLES } = require('../config/roles');
const { resolveAcademicYearId } = require('../utils/academicYear');
const { buildSummaryFromRows } = require('../utils/attendanceMetrics');
const { toYmd } = require('../utils/dateOnly');
const { hasTable, hasColumn } = require('../utils/schemaInspector');
const { lateralCurrentEnrollment } = require('../utils/studentEnrollmentSql');
const {
  listHolidaysInRange,
  getHolidayForDate,
  buildHolidayDateSet,
  applyHolidayOverride,
} = require('../utils/holidayUtils');

const WRITE_ALLOWED_BY_ENTITY = {
  // Student attendance is teacher-owned: headmaster/administrative can view reports only.
  student: [ROLES.TEACHER],
  staff: [ROLES.ADMIN, ROLES.ADMINISTRATIVE],
};

const TABLE_BY_ENTITY = {
  student: 'student_attendance',
  staff: 'staff_attendance',
};

/** Roster-only status: weekly Sunday vs configured holiday (not stored as weekly_holiday in DB). */
const rosterHolidayMarkingStatus = (activeHoliday) => {
  if (!activeHoliday) return null;
  return String(activeHoliday.holiday_type || '').toLowerCase() === 'weekly' ? 'weekly_holiday' : 'holiday';
};

const normalizeStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'halfday') return 'half_day';
  return normalized;
};

const canWriteEntity = (user, entityType) => {
  const roleId = Number(user?.user_role_id ?? user?.role_id);
  const allowed = WRITE_ALLOWED_BY_ENTITY[entityType] || [];
  return allowed.includes(roleId);
};

const appendStaffOrgFilters = ({ params, where, departmentId, designationId }) => {
  let nextWhere = where;
  if (departmentId) {
    params.push(Number(departmentId));
    const depRef = `$${params.length}`;
    nextWhere += ` AND (
      st.department_id = ${depRef}
      OR (
        st.department_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM designations des_link
          WHERE des_link.id = st.designation_id
            AND des_link.department_id = ${depRef}
        )
      )
      OR EXISTS (
        SELECT 1
        FROM departments d_staff
        JOIN departments d_sel ON d_sel.id = ${depRef}
        WHERE d_staff.id = st.department_id
          AND LOWER(TRIM(COALESCE(d_staff.department_name, ''))) = LOWER(TRIM(COALESCE(d_sel.department_name, '')))
      )
      OR (
        st.department_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM designations des_link
          JOIN departments d_staff ON d_staff.id = des_link.department_id
          JOIN departments d_sel ON d_sel.id = ${depRef}
          WHERE des_link.id = st.designation_id
            AND LOWER(TRIM(COALESCE(d_staff.department_name, ''))) = LOWER(TRIM(COALESCE(d_sel.department_name, '')))
        )
      )
    )`;
  }
  if (designationId) {
    params.push(Number(designationId));
    const desRef = `$${params.length}`;
    nextWhere += ` AND (
      st.designation_id = ${desRef}
      OR EXISTS (
        SELECT 1
        FROM designations z_staff
        JOIN designations z_sel ON z_sel.id = ${desRef}
        WHERE z_staff.id = st.designation_id
          AND LOWER(TRIM(COALESCE(z_staff.designation_name, ''))) = LOWER(TRIM(COALESCE(z_sel.designation_name, '')))
      )
    )`;
  }
  return nextWhere;
};

const toNullableTime = (value) => {
  if (value == null || value === '') return null;
  return String(value).trim();
};

let staffAttendanceRemarkColumnPromise = null;
let staffAttendanceColumnsPromise = null;
let staffAttendanceStatusMapPromise = null;
let staffAttendanceLeaveRequiredSetPromise = null;
let studentAttendanceModelPromise = null;
let studentAttendanceStatusMapPromise = null;

const resolveStudentAttendanceModel = async () => {
  if (!studentAttendanceModelPromise) {
    studentAttendanceModelPromise = (async () => {
      const hasNewTable = await hasTable('student_attendance');
      if (hasNewTable) {
        const checkInExists = await hasColumn('student_attendance', 'check_in_time');
        const checkOutExists = await hasColumn('student_attendance', 'check_out_time');
        const remarkColumn = (await hasColumn('student_attendance', 'remarks')) ? 'remarks' : 'remark';
        return {
          kind: 'new',
          table: 'student_attendance',
          remarkColumn,
          hasCheckInTime: checkInExists,
          hasCheckOutTime: checkOutExists,
        };
      }
      return {
        kind: 'legacy',
        table: 'attendance',
        remarkColumn: 'remarks',
        hasCheckInTime: true,
        hasCheckOutTime: true,
      };
    })();
  }
  return studentAttendanceModelPromise;
};

const resolveStudentAttendanceStatusMap = async () => {
  if (!studentAttendanceStatusMapPromise) {
    studentAttendanceStatusMapPromise = (async () => {
      const model = await resolveStudentAttendanceModel();
      if (model.kind !== 'new') return new Map();
      const result = await query(
        `SELECT pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public'
           AND t.relname = 'student_attendance'
           AND c.contype = 'c'
           AND c.conname ILIKE '%status_check%'
         ORDER BY c.conname
         LIMIT 1`
      );
      const def = String(result.rows?.[0]?.def || '');
      const map = new Map();
      const matches = def.matchAll(/'([^']+)'/g);
      for (const match of matches) {
        const token = String(match[1] || '').trim();
        if (!token) continue;
        map.set(toStatusKey(token), token);
      }
      return map;
    })().catch(() => new Map());
  }
  return studentAttendanceStatusMapPromise;
};

const resolveStudentStatusForDb = async (status) => {
  const normalized = toStatusKey(status);
  const model = await resolveStudentAttendanceModel();
  if (model.kind !== 'new') return normalized;
  const map = await resolveStudentAttendanceStatusMap();
  const mapped = map.get(normalized);
  if (mapped) return mapped;
  if (normalized === 'on_leave') {
    const fallback = map.get('excused');
    if (fallback) return fallback;
  }
  throw makeHttpError(400, `Invalid student attendance status "${status}".`, 'VALIDATION_ERROR');
};

const normalizeAttendanceStatusForApi = (status) => {
  const v = toStatusKey(status);
  if (v === 'halfday') return 'half_day';
  return v || null;
};
const resolveStaffAttendanceRemarkColumn = async (dbClient = null) => {
  const runQuery = dbClient?.query ? dbClient.query.bind(dbClient) : query;
  if (dbClient?.query) {
    const result = await runQuery(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'staff_attendance'
         AND column_name IN ('remark', 'remarks')`
    );
    const names = new Set((result.rows || []).map((row) => String(row.column_name || '').trim()));
    if (names.has('remarks')) return 'remarks';
    if (names.has('remark')) return 'remark';
    return 'remark';
  }
  if (!staffAttendanceRemarkColumnPromise) {
    staffAttendanceRemarkColumnPromise = (async () => {
      const result = await runQuery(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'staff_attendance'
           AND column_name IN ('remark', 'remarks')`
      );
      const names = new Set((result.rows || []).map((row) => String(row.column_name || '').trim()));
      if (names.has('remarks')) return 'remarks';
      if (names.has('remark')) return 'remark';
      return 'remark';
    })().catch(() => {
      // Safe fallback for restricted metadata permissions or transient failures.
      return 'remark';
    });
  }
  return staffAttendanceRemarkColumnPromise;
};

const resolveStaffAttendanceColumns = async () => {
  if (arguments[0]?.query) {
    const runQuery = arguments[0].query.bind(arguments[0]);
    const result = await runQuery(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'staff_attendance'`
    );
    return new Set((result.rows || []).map((row) => String(row.column_name || '').trim()));
  }
  if (!staffAttendanceColumnsPromise) {
    staffAttendanceColumnsPromise = (async () => {
      const result = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'staff_attendance'`
      );
      return new Set((result.rows || []).map((row) => String(row.column_name || '').trim()));
    })().catch(() => new Set());
  }
  return staffAttendanceColumnsPromise;
};

const toStatusKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const resolveStaffAttendanceStatusMap = async (dbClient = null) => {
  const runQuery = dbClient?.query ? dbClient.query.bind(dbClient) : query;
  if (dbClient?.query) {
    const result = await runQuery(
      `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'staff_attendance'
         AND c.contype = 'c'
         AND c.conname ILIKE '%status_check%'
       ORDER BY c.conname
       LIMIT 1`
    );
    const def = String(result.rows?.[0]?.def || '');
    const map = new Map();
    const matches = def.matchAll(/'([^']+)'/g);
    for (const match of matches) {
      const token = String(match[1] || '').trim();
      if (!token) continue;
      map.set(toStatusKey(token), token);
    }
    return map;
  }
  if (!staffAttendanceStatusMapPromise) {
    staffAttendanceStatusMapPromise = (async () => {
      const result = await query(
        `SELECT pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public'
           AND t.relname = 'staff_attendance'
           AND c.contype = 'c'
           AND c.conname ILIKE '%status_check%'
         ORDER BY c.conname
         LIMIT 1`
      );
      const def = String(result.rows?.[0]?.def || '');
      const map = new Map();
      const matches = def.matchAll(/'([^']+)'/g);
      for (const match of matches) {
        const token = String(match[1] || '').trim();
        if (!token) continue;
        map.set(toStatusKey(token), token);
      }
      return map;
    })().catch(() => new Map());
  }
  return staffAttendanceStatusMapPromise;
};

const resolveStaffStatusForDb = async (status, dbClient = null) => {
  const map = await resolveStaffAttendanceStatusMap(dbClient);
  if (!map.size) return status;
  return map.get(toStatusKey(status)) || status;
};

const resolveStaffAttendanceLeaveRequiredStatuses = async (dbClient = null) => {
  const runQuery = dbClient?.query ? dbClient.query.bind(dbClient) : query;
  const defaultRequired = new Set(['absent', 'half_day', 'on_leave']);
  if (dbClient?.query) {
    const result = await runQuery(
      `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'staff_attendance'
         AND c.contype = 'c'
         AND c.conname ILIKE '%leave%required%'
       ORDER BY c.conname
       LIMIT 1`
    );
    const def = String(result.rows?.[0]?.def || '');
    const required = new Set();
    const match = def.match(/\(status IN \(([^)]+)\)/i);
    if (!match) return defaultRequired;
    const quoted = match[1].matchAll(/'([^']+)'/g);
    for (const token of quoted) required.add(toStatusKey(token[1]));
    return required.size ? required : defaultRequired;
  }
  if (!staffAttendanceLeaveRequiredSetPromise) {
    staffAttendanceLeaveRequiredSetPromise = (async () => {
      const result = await runQuery(
        `SELECT pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public'
           AND t.relname = 'staff_attendance'
           AND c.contype = 'c'
           AND c.conname ILIKE '%leave%required%'
         ORDER BY c.conname
         LIMIT 1`
      );
      const def = String(result.rows?.[0]?.def || '');
      const required = new Set();
      const match = def.match(/\(status IN \(([^)]+)\)/i);
      if (!match) return defaultRequired;
      const quoted = match[1].matchAll(/'([^']+)'/g);
      for (const token of quoted) {
        required.add(toStatusKey(token[1]));
      }
      return required.size ? required : defaultRequired;
    })().catch(() => defaultRequired);
  }
  return staffAttendanceLeaveRequiredSetPromise;
};

const resolveSalaryAssignmentIdForDate = async (dbClient, staffId, attendanceDate) => {
  const runQuery = dbClient?.query ? dbClient.query.bind(dbClient) : query;
  const inRange = await runQuery(
    `SELECT id
     FROM staff_salary_assignments
     WHERE staff_id = $1
       AND valid_period @> $2::date
     ORDER BY lower(valid_period) DESC NULLS LAST
     LIMIT 1`,
    [staffId, attendanceDate]
  );
  const exactMatchId = Number(inRange.rows?.[0]?.id) || null;
  if (exactMatchId) return exactMatchId;

  const fallback = await runQuery(
    `SELECT id
     FROM staff_salary_assignments
     WHERE staff_id = $1
     ORDER BY lower(valid_period) DESC NULLS LAST, id DESC
     LIMIT 1`,
    [staffId]
  );
  const fallbackId = Number(fallback.rows?.[0]?.id) || null;
  if (fallbackId) return fallbackId;

  const created = await runQuery(
    `INSERT INTO staff_salary_assignments (
       staff_id,
       basic_salary,
       valid_period,
       created_at,
       updated_at
     ) VALUES (
       $1,
       0,
       daterange($2::date, NULL, '[)'),
       NOW(),
       NOW()
     )
     RETURNING id`,
    [staffId, attendanceDate]
  );
  return Number(created.rows?.[0]?.id) || null;
};

const resolveDefaultLeaveTypeId = async (dbClient) => {
  const runQuery = dbClient?.query ? dbClient.query.bind(dbClient) : query;
  const preferred = await runQuery(
    `SELECT id
     FROM leave_types
     WHERE deleted_at IS NULL
       AND (is_active IS TRUE OR is_active IS NULL)
       AND (applicable_for IN ('staff', 'both') OR applicable_for IS NULL)
     ORDER BY id ASC
     LIMIT 1`
  );
  const preferredId = Number(preferred.rows?.[0]?.id) || null;
  if (preferredId) return preferredId;

  const fallback = await runQuery('SELECT id FROM leave_types ORDER BY id ASC LIMIT 1');
  return Number(fallback.rows?.[0]?.id) || null;
};

const resolveLeaveApplicationIdForDate = async (dbClient, staffId, attendanceDate, markedBy) => {
  const runQuery = dbClient?.query ? dbClient.query.bind(dbClient) : query;
  const existing = await runQuery(
    `SELECT id
     FROM leave_applications
     WHERE applicant_staff_id = $1
       AND valid_period @> $2::date
       AND status IN ('Approved', 'Auto-Generated', 'Pending')
     ORDER BY id DESC
     LIMIT 1`,
    [staffId, attendanceDate]
  );
  const existingId = Number(existing.rows?.[0]?.id) || null;
  if (existingId) return existingId;

  const leaveTypeId = await resolveDefaultLeaveTypeId(dbClient);
  if (!leaveTypeId) return null;

  const inserted = await runQuery(
    `INSERT INTO leave_applications (
       applicant_staff_id,
       leave_type_id,
       valid_period,
       reason,
       status,
       approved_by,
       approval_date,
       remarks,
       created_at,
       updated_at
     ) VALUES (
       $1,
       $2,
       daterange($3::date, ($3::date + 1), '[)'),
       'Auto-generated from staff attendance marking',
       'Auto-Generated',
       $4,
       NOW(),
       'Created automatically to satisfy attendance leave linkage',
       NOW(),
       NOW()
     )
     RETURNING id`,
    [staffId, leaveTypeId, attendanceDate, markedBy]
  );
  return Number(inserted.rows?.[0]?.id) || null;
};

const makeHttpError = (statusCode, message, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = code;
  return err;
};

const upsertStudentRecord = async (client, payload) => {
  const {
    entityId,
    status,
    attendanceDate,
    classId = null,
    sectionId = null,
    markedBy = null,
    remark = null,
    checkInTime = null,
    checkOutTime = null,
  } = payload;
  const attendanceModel = payload.attendanceModel || (await resolveStudentAttendanceModel());
  if (attendanceModel.kind !== 'new') {
    const params = [
      entityId,
      classId,
      sectionId,
      attendanceDate,
      status,
      checkInTime,
      checkOutTime,
      markedBy,
      remark,
    ];
    const updated = await client.query(
      `UPDATE attendance
       SET
         class_id = $2,
         section_id = $3,
         status = $5,
         check_in_time = $6,
         check_out_time = $7,
         marked_by = $8,
         remarks = $9
       WHERE student_id = $1
         AND attendance_date = $4`,
      params
    );
    if ((updated.rowCount || 0) > 0) return;
    await client.query(
      `INSERT INTO attendance (
        student_id, class_id, section_id, attendance_date, status,
        check_in_time, check_out_time, marked_by, remarks
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      params
    );
    return;
  }

  const enrollment = await resolveStudentEnrollmentContext(client, entityId, classId, sectionId);
  if (!enrollment?.lifecycle_id || !enrollment?.class_id || !enrollment?.section_id || !enrollment?.academic_year_id) {
    throw makeHttpError(400, `No active enrollment found for student ID ${entityId}.`, 'VALIDATION_ERROR');
  }
  if (!enrollment.class_section_id) {
    throw makeHttpError(
      400,
      `Class-section mapping is missing for student ID ${entityId} (${enrollment.class_id}/${enrollment.section_id}).`,
      'VALIDATION_ERROR'
    );
  }
  const params = [
    entityId,
    Number(enrollment.academic_year_id),
    Number(enrollment.class_id),
    Number(enrollment.class_section_id),
    Number(enrollment.lifecycle_id),
    attendanceDate,
    status,
    markedBy,
    remark,
  ];
  const updated = await client.query(
    `UPDATE student_attendance
     SET
       academic_year_id = $2,
       class_id = $3,
       class_section_id = $4,
       lifecycle_id = $5,
       status = $7,
       marked_by = $8,
       remarks = $9
     WHERE student_id = $1
       AND attendance_date = $6`,
    params
  );
  if ((updated.rowCount || 0) > 0) return;
  await client.query(
    `INSERT INTO student_attendance (
      student_id, academic_year_id, class_id, class_section_id, lifecycle_id, attendance_date, status, marked_by, remarks
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    params
  );
};

const upsertStaffRecord = async (client, payload) => {
  const {
    entityId,
    status,
    attendanceDate,
    academicYearId = null,
    salaryAssignmentId = null,
    leaveApplicationId = null,
    markedBy = null,
    remark = null,
    checkInTime = null,
    checkOutTime = null,
  } = payload;
  const staffColumns = await resolveStaffAttendanceColumns(client);
  const remarkColumn = await resolveStaffAttendanceRemarkColumn(client);
  const params = [entityId, attendanceDate, status, checkInTime, checkOutTime, remark, markedBy];
  let academicYearSetter = '';
  let salaryAssignmentSetter = '';
  if (staffColumns.has('academic_year_id')) {
    params.push(academicYearId);
    academicYearSetter = `,\n       academic_year_id = $${params.length}`;
  }
  if (staffColumns.has('salary_assignment_id')) {
    params.push(salaryAssignmentId);
    salaryAssignmentSetter = `,\n       salary_assignment_id = $${params.length}`;
  }
  let leaveApplicationSetter = '';
  if (staffColumns.has('leave_application_id')) {
    params.push(leaveApplicationId);
    leaveApplicationSetter = `,\n       leave_application_id = $${params.length}`;
  }
  const updated = await client.query(
    `UPDATE staff_attendance
     SET
       status = $3,
       check_in_time = $4,
       check_out_time = $5,
       ${remarkColumn} = $6,
       marked_by = $7${academicYearSetter}${salaryAssignmentSetter}${leaveApplicationSetter}
     WHERE staff_id = $1
       AND attendance_date = $2`,
    params
  );
  if ((updated.rowCount || 0) > 0) return;
  const insertColumns = ['staff_id', 'attendance_date', 'status', 'check_in_time', 'check_out_time', remarkColumn, 'marked_by'];
  if (staffColumns.has('academic_year_id')) insertColumns.push('academic_year_id');
  if (staffColumns.has('salary_assignment_id')) insertColumns.push('salary_assignment_id');
  if (staffColumns.has('leave_application_id')) insertColumns.push('leave_application_id');
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(',');
  await client.query(
    `INSERT INTO staff_attendance (
      ${insertColumns.join(', ')}
    ) VALUES (${placeholders})`,
    params
  );
};

const upsertHandlers = {
  student: upsertStudentRecord,
  staff: upsertStaffRecord,
};

const getUserRoleContext = (user) => {
  const roleId = Number(user?.user_role_id ?? user?.role_id);
  const roleName = String(user?.role_name || user?.role || '').trim().toLowerCase();
  const isTeacher = roleId === ROLES.TEACHER || roleName === 'teacher' || roleName.includes('teacher');
  return { roleId, roleName, isTeacher };
};

const getTeacherIdentity = async (userId) => {
  const staffRows = await query(
    `SELECT s.id
     FROM staff s
     WHERE s.user_id = $1
       AND s.status = 'Active'
       AND s.deleted_at IS NULL`,
    [userId]
  );
  const staffIds = [...new Set((staffRows.rows || []).map((row) => Number(row.id)).filter(Number.isFinite))];
  const teacherIds = staffIds; // Staff ID is used as teacher ID
  return { teacherIds, staffIds };
};

const buildTeacherScopeSql = ({ classExpr, sectionExpr, academicYearExpr, teacherIdsParamRef, staffIdsParamRef }) => `
(
  EXISTS (
    SELECT 1
    FROM class_schedules cs
    LEFT JOIN class_sections csec ON csec.id = cs.class_section_id
    WHERE cs.class_id = ${classExpr}
      AND cs.teacher_id = ANY(${staffIdsParamRef})
      AND (${sectionExpr} IS NULL OR csec.section_id = ${sectionExpr} OR csec.section_id IS NULL)
      AND (${academicYearExpr} IS NULL OR cs.academic_year_id = ${academicYearExpr} OR cs.academic_year_id IS NULL)
  )
  OR EXISTS (
    SELECT 1
    FROM class_teachers ct
    LEFT JOIN class_sections ct_sec ON ct_sec.id = ct.class_section_id
    WHERE ct.staff_id = ANY(${staffIdsParamRef})
      AND ct.class_id = ${classExpr}
      AND ct.deleted_at IS NULL
      AND (${sectionExpr} IS NULL OR ct.class_section_id IS NULL OR ct_sec.section_id = ${sectionExpr})
      AND (${academicYearExpr} IS NULL OR ct.academic_year_id = ${academicYearExpr} OR ct.academic_year_id IS NULL)
  )
)`;

const resolveStudentEnrollmentContext = async (client, studentId, preferredClassId = null, preferredSectionId = null) => {
  const params = [studentId];
  let filters = '';
  if (preferredClassId) {
    params.push(Number(preferredClassId));
    filters += ` AND enr.class_id = $${params.length}`;
  }
  if (preferredSectionId) {
    params.push(Number(preferredSectionId));
    filters += ` AND enr.section_id = $${params.length}`;
  }
  const result = await client.query(
    `SELECT
       enr.lifecycle_id,
       enr.academic_year_id,
       enr.class_id,
       enr.section_id,
       csec.id AS class_section_id
     FROM students s
     ${lateralCurrentEnrollment('s.id')}
     LEFT JOIN class_sections csec
       ON csec.class_id = enr.class_id
      AND csec.section_id = enr.section_id
      AND csec.academic_year_id = enr.academic_year_id
      AND csec.deleted_at IS NULL
     WHERE s.id = $1
       AND s.deleted_at IS NULL
       AND s.status = 'Active'
       ${filters}
     LIMIT 1`,
    params
  );
  return result.rows?.[0] || null;
};

const saveAttendance = async (req, res) => {
  try {
    const { entityType, attendanceDate, records } = req.body;
    const bodyAcademicYearId = req.body?.academicYearId ?? req.body?.academic_year_id ?? null;
    const { isTeacher } = getUserRoleContext(req.user);

    if (!canWriteEntity(req.user, entityType)) {
      return errorResponse(res, 403, 'You are not authorized to mark this attendance type', 'FORBIDDEN');
    }

    const studentAttendanceModel = entityType === 'student' ? await resolveStudentAttendanceModel() : null;

    if (entityType === 'student') {
      const hasMissingClassOrSection = records.some((record) => !record.classId || !record.sectionId);
      if (hasMissingClassOrSection) {
        return errorResponse(res, 400, 'Student attendance requires classId and sectionId for each record', 'VALIDATION_ERROR');
      }

      if (isTeacher) {
        const { teacherIds, staffIds } = await getTeacherIdentity(req.user?.id);
        if (!teacherIds.length || !staffIds.length) {
          return errorResponse(res, 403, 'Access denied. User is not an active teacher.', 'FORBIDDEN');
        }

        const studentIds = [...new Set(records.map((record) => Number(record.entityId)).filter(Number.isFinite))];
        if (studentIds.length > 0) {
          const scopeParams = [studentIds, teacherIds, staffIds];
          const allowedRes = await query(
            `SELECT s.id
             FROM students s
             ${lateralCurrentEnrollment('s.id')}
             WHERE s.id = ANY($1::int[])
               AND s.deleted_at IS NULL
               AND s.status = 'Active'
               AND enr.class_id IS NOT NULL
               AND ${buildTeacherScopeSql({
                 classExpr: 'enr.class_id',
                 sectionExpr: 'enr.section_id',
                 academicYearExpr: 'enr.academic_year_id',
                 teacherIdsParamRef: '$2::int[]',
                 staffIdsParamRef: '$3::int[]',
               })}`,
            scopeParams
          );

          const allowedIds = new Set((allowedRes.rows || []).map((row) => Number(row.id)));
          const unauthorized = studentIds.filter((id) => !allowedIds.has(id));
          if (unauthorized.length > 0) {
            return errorResponse(
              res,
              403,
              'You can only mark attendance for students assigned to you.',
              'FORBIDDEN'
            );
          }
        }
      }
    }

    const activeHoliday = await getHolidayForDate(attendanceDate);
    if (activeHoliday) {
      return errorResponse(
        res,
        409,
        `Attendance marking is disabled on holidays (${activeHoliday.title}).`,
        'ATTENDANCE_HOLIDAY_LOCKED'
      );
    }

    await executeTransaction(async (client) => {
      const markedBy = Number(req.user?.staff_id) || null;
      const upsertRecord = upsertHandlers[entityType];
      let staffColumns = null;
      let resolvedAcademicYearId = null;
      const salaryAssignmentByStaff = new Map();

      if (entityType === 'staff') {
        staffColumns = await resolveStaffAttendanceColumns(client);
        if (staffColumns.has('academic_year_id')) {
          resolvedAcademicYearId = await resolveAcademicYearId(bodyAcademicYearId);
          if (!resolvedAcademicYearId) {
            throw makeHttpError(400, 'Active academic year not found for staff attendance.', 'ACADEMIC_YEAR_REQUIRED');
          }
        }
      }

      for (const record of records) {
        const normalizedStatus = normalizeStatus(record.status);
        const status = entityType === 'staff'
          ? await resolveStaffStatusForDb(normalizedStatus, client)
          : (entityType === 'student' ? await resolveStudentStatusForDb(normalizedStatus) : normalizedStatus);
        let salaryAssignmentId = null;
        let leaveApplicationId = null;
        if (entityType === 'staff' && staffColumns?.has('salary_assignment_id')) {
          const staffId = Number(record.entityId);
          if (!salaryAssignmentByStaff.has(staffId)) {
            const assignmentId = await resolveSalaryAssignmentIdForDate(client, staffId, attendanceDate);
            salaryAssignmentByStaff.set(staffId, assignmentId);
          }
          salaryAssignmentId = salaryAssignmentByStaff.get(staffId) || null;
          if (!salaryAssignmentId) {
            throw makeHttpError(500, `Unable to resolve salary assignment for staff ID ${staffId}.`, 'ATTENDANCE_SAVE_FAILED');
          }
        }
        if (entityType === 'staff' && staffColumns?.has('leave_application_id')) {
          const leaveRequiredStatuses = await resolveStaffAttendanceLeaveRequiredStatuses(client);
          const needsLeaveLink = leaveRequiredStatuses.has(toStatusKey(status));
          if (needsLeaveLink) {
            const staffId = Number(record.entityId);
            leaveApplicationId = await resolveLeaveApplicationIdForDate(client, staffId, attendanceDate, markedBy);
            if (!leaveApplicationId) {
              throw makeHttpError(400, `Leave application is required for status "${status}" on ${attendanceDate}.`, 'LEAVE_APPLICATION_REQUIRED');
            }
          }
        }
        await upsertRecord(client, {
          ...record,
          status,
          attendanceDate,
          markedBy,
          academicYearId: resolvedAcademicYearId,
          salaryAssignmentId,
          leaveApplicationId,
          checkInTime: toNullableTime(record.checkInTime),
          checkOutTime: toNullableTime(record.checkOutTime),
          remark: record.remark ? String(record.remark).trim() : null,
          attendanceModel: studentAttendanceModel,
        });
      }
    });

    return success(res, 200, 'Attendance saved successfully', {
      savedCount: records.length,
      attendanceDate,
      entityType,
      idempotent: true,
    });
  } catch (err) {
    console.error('saveAttendance error:', err);
    if (err?.statusCode) {
      return errorResponse(
        res,
        err.statusCode,
        err.message || 'Failed to save attendance',
        err.errorCode || 'ATTENDANCE_SAVE_FAILED'
      );
    }
    return errorResponse(res, 500, 'Failed to save attendance', 'ATTENDANCE_SAVE_FAILED');
  }
};

const updateAttendance = async (req, res) => {
  return saveAttendance(req, res);
};

const getMarkingRoster = async (req, res) => {
  try {
    const { entityType } = req.params;
    const { date, class_id, section_id, department_id, designation_id } = req.query;
    const { isTeacher } = getUserRoleContext(req.user);

    if (!TABLE_BY_ENTITY[entityType]) {
      return errorResponse(res, 400, 'Invalid attendance entity', 'INVALID_ENTITY');
    }

    if (entityType === 'student') {
      const studentAttendanceModel = await resolveStudentAttendanceModel();
      const params = [date];
      let where = "WHERE s.status = 'Active' AND s.deleted_at IS NULL AND enr.class_id IS NOT NULL";
      if (class_id) {
        params.push(Number(class_id));
        where += ` AND enr.class_id = $${params.length}`;
      }
      if (section_id) {
        params.push(Number(section_id));
        where += ` AND enr.section_id = $${params.length}`;
      }

      if (isTeacher) {
        const { teacherIds, staffIds } = await getTeacherIdentity(req.user?.id);
        if (!teacherIds.length || !staffIds.length) {
          return errorResponse(res, 403, 'Access denied. User is not an active teacher.', 'FORBIDDEN');
        }

        params.push(staffIds);
        const staffIdsParamRef = `$${params.length}::int[]`;
        where += ` AND ${buildTeacherScopeSql({
          classExpr: 'enr.class_id',
          sectionExpr: 'enr.section_id',
          academicYearExpr: 'enr.academic_year_id',
          teacherIdsParamRef: staffIdsParamRef,
          staffIdsParamRef: staffIdsParamRef,
        })}`;
      }

      const sql = `
        SELECT
          s.id AS entity_id,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS entity_name,
          enr.class_id,
          enr.section_id,
          a.status,
          a.${studentAttendanceModel.remarkColumn} AS remark,
          ${studentAttendanceModel.hasCheckInTime ? 'a.check_in_time::text' : 'NULL::text'} AS check_in_time,
          ${studentAttendanceModel.hasCheckOutTime ? 'a.check_out_time::text' : 'NULL::text'} AS check_out_time
        FROM students s
        LEFT JOIN users u ON u.id = s.user_id
        ${lateralCurrentEnrollment('s.id')}
        LEFT JOIN ${studentAttendanceModel.table} a ON a.student_id = s.id AND a.attendance_date = $1
        ${where}
        ORDER BY u.first_name ASC, u.last_name ASC`;
      const roster = await query(sql, params);
      const activeHoliday = await getHolidayForDate(date);
      const holidayMark = rosterHolidayMarkingStatus(activeHoliday);
      const rows = holidayMark
        ? (roster.rows || []).map((row) => ({ ...row, status: holidayMark }))
        : (roster.rows || []).map((row) => ({ ...row, status: normalizeAttendanceStatusForApi(row.status) }));
      return success(res, 200, 'Student attendance roster fetched', rows, { holiday: activeHoliday || null });
    }

    const remarkColumn = await resolveStaffAttendanceRemarkColumn();
    const params = [date];
    let where = "WHERE st.status = 'Active'";
    params.push(ROLES.TEACHER);
    where += ` AND u.role_id != $${params.length}`;
    where = appendStaffOrgFilters({ params, where, departmentId: department_id, designationId: designation_id });
    const academicYearJoinFilter = '';

    const sql = `
      SELECT
        st.id AS entity_id,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS entity_name,
        st.department_id,
        st.designation_id,
        d.department_name,
        des.designation_name,
        sa.status,
        sa.${remarkColumn} AS remark,
        sa.check_in_time::text AS check_in_time,
        sa.check_out_time::text AS check_out_time
      FROM staff st
      INNER JOIN users u ON u.id = st.user_id
      LEFT JOIN departments d ON d.id = st.department_id
      LEFT JOIN designations des ON des.id = st.designation_id
      LEFT JOIN staff_attendance sa
        ON sa.staff_id = st.id
       AND sa.attendance_date = $1
       ${academicYearJoinFilter}
      ${where}
      ORDER BY u.first_name ASC, u.last_name ASC`;
    const roster = await query(sql, params);
    const activeHoliday = await getHolidayForDate(date);
    const holidayMark = rosterHolidayMarkingStatus(activeHoliday);
    const rows = holidayMark
      ? (roster.rows || []).map((row) => ({ ...row, status: holidayMark }))
      : roster.rows;
    return success(res, 200, 'Staff attendance roster fetched', rows, { holiday: activeHoliday || null });
  } catch (err) {
    console.error('getMarkingRoster error:', err);
    return errorResponse(res, 500, 'Failed to fetch attendance roster', 'ATTENDANCE_ROSTER_FAILED', { error: err.message });
  }
};

const getAttendanceReport = async (req, res) => {
  try {
    const { entityType } = req.params;
    const { month, class_id, section_id, department_id, designation_id } = req.query;
    console.log('[attendanceController] getAttendanceReport requested:', { entityType, month, class_id, section_id });
    if (!month) {
      return errorResponse(res, 400, 'Month is required (YYYY-MM)', 'VALIDATION_ERROR');
    }
    const [year, monthNumber] = month.split('-').map(Number);
    const monthStart = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
    const monthEndResult = await query(
      "SELECT (date_trunc('month', $1::date) + interval '1 month - 1 day')::date AS month_end",
      [monthStart]
    );
    const monthEnd = monthEndResult.rows[0].month_end;
    const monthEndYmd = toYmd(monthEnd);

    if (entityType === 'student') {
      const studentAttendanceModel = await resolveStudentAttendanceModel();
      const params = [monthStart, monthEnd];
      let where = "WHERE s.status = 'Active' AND s.deleted_at IS NULL AND enr.class_id IS NOT NULL";
      if (class_id) {
        params.push(Number(class_id));
        where += ` AND enr.class_id = $${params.length}`;
      }
      if (section_id) {
        params.push(Number(section_id));
        where += ` AND enr.section_id = $${params.length}`;
      }

      const { isTeacher } = getUserRoleContext(req.user);
      if (isTeacher) {
        const { teacherIds, staffIds } = await getTeacherIdentity(req.user?.id);
        if (!teacherIds.length || !staffIds.length) {
          return errorResponse(res, 403, 'Access denied. User is not an active teacher.', 'FORBIDDEN');
        }
        params.push(staffIds);
        const staffIdsParamRef = `$${params.length}::int[]`;
        where += ` AND ${buildTeacherScopeSql({
          classExpr: 'enr.class_id',
          sectionExpr: 'enr.section_id',
          academicYearExpr: 'enr.academic_year_id',
          teacherIdsParamRef: staffIdsParamRef,
          staffIdsParamRef: staffIdsParamRef,
        })}`;
      }
      const result = await query(
        `
        SELECT
          s.id AS entity_id,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS entity_name,
          s.admission_number AS "rollNo",
          enr.class_id,
          enr.section_id,
          a.attendance_date::date AS attendance_date,
          a.status,
          a.${studentAttendanceModel.remarkColumn} AS remark
        FROM students s
        LEFT JOIN users u ON u.id = s.user_id
        ${lateralCurrentEnrollment('s.id')}
        LEFT JOIN ${studentAttendanceModel.table} a
          ON a.student_id = s.id
         AND a.attendance_date BETWEEN $1::date AND $2::date
        ${where}
        ORDER BY u.first_name ASC, u.last_name ASC, a.attendance_date ASC
      `,
        params
      );
      const holidays = await listHolidaysInRange(monthStart, monthEndYmd);
      const holidayDates = buildHolidayDateSet(holidays, monthStart, monthEndYmd);
      const rows = (result.rows || []).map((row) => {
        const day = toYmd(row.attendance_date);
        const isHoliday = day ? holidayDates.has(day) : false;
        const normalized = normalizeAttendanceStatusForApi(row.status);
        return {
          ...row,
          attendance_date: day || null,
          status: applyHolidayOverride(normalized, isHoliday),
        };
      });
      return success(res, 200, 'Student attendance report fetched', {
        rows,
        summary: buildSummaryFromRows(rows),
        holiday_dates: Array.from(holidayDates),
        filters: { entityType, month: `${year}-${String(monthNumber).padStart(2, '0')}`, class_id, section_id },
      });
    }

    const remarkColumn = await resolveStaffAttendanceRemarkColumn();
    const params = [monthStart, monthEnd];
    let where = "WHERE st.status = 'Active'";
    params.push(ROLES.TEACHER);
    where += ` AND u.role_id != $${params.length}`;
    where = appendStaffOrgFilters({ params, where, departmentId: department_id, designationId: designation_id });
    const academicYearJoinFilter = '';
    const result = await query(
      `
      SELECT
        st.id AS entity_id,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS entity_name,
        st.department_id,
        st.designation_id,
        d.department_name,
        des.designation_name,
        sa.attendance_date::date AS attendance_date,
        sa.status,
        sa.${remarkColumn} AS remark
      FROM staff st
      INNER JOIN users u ON u.id = st.user_id
      LEFT JOIN departments d ON d.id = st.department_id
      LEFT JOIN designations des ON des.id = st.designation_id
      LEFT JOIN staff_attendance sa
        ON sa.staff_id = st.id
       AND sa.attendance_date BETWEEN $1::date AND $2::date
       ${academicYearJoinFilter}
      ${where}
      ORDER BY u.first_name ASC, u.last_name ASC, sa.attendance_date ASC
    `,
      params
    );
    const holidays = await listHolidaysInRange(monthStart, monthEndYmd);
    const holidayDates = buildHolidayDateSet(holidays, monthStart, monthEndYmd);
    const rows = (result.rows || []).map((row) => {
      const day = toYmd(row.attendance_date);
      const isHoliday = day ? holidayDates.has(day) : false;
      const normalized = normalizeAttendanceStatusForApi(row.status);
      return {
        ...row,
        attendance_date: day || null,
        status: applyHolidayOverride(normalized, isHoliday),
      };
    });
    return success(res, 200, 'Staff attendance report fetched', {
      rows,
      summary: buildSummaryFromRows(rows),
      holiday_dates: Array.from(holidayDates),
      filters: { entityType, month: `${year}-${String(monthNumber).padStart(2, '0')}`, department_id, designation_id },
    });
  } catch (err) {
    console.error('getAttendanceReport error:', err);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch attendance report',
      code: 'ATTENDANCE_REPORT_FAILED',
      error: err.message,
      stack: err.stack
    });
  }
};

const getAttendanceDayWise = async (req, res) => {
  try {
    const { entityType } = req.params;
    const { date, class_id, section_id, department_id } = req.query;
    const params = [date];
    let sql = '';

    if (entityType === 'student') {
      const studentAttendanceModel = await resolveStudentAttendanceModel();
      let where = "WHERE s.status = 'Active' AND s.deleted_at IS NULL AND enr.class_id IS NOT NULL";
      if (class_id) {
        params.push(Number(class_id));
        where += ` AND enr.class_id = $${params.length}`;
      }
      if (section_id) {
        params.push(Number(section_id));
        where += ` AND enr.section_id = $${params.length}`;
      }
      sql = `
        SELECT
          s.id AS entity_id,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS entity_name,
          COALESCE(a.status, 'absent') AS status,
          a.${studentAttendanceModel.remarkColumn} AS remark
        FROM students s
        LEFT JOIN users u ON u.id = s.user_id
        ${lateralCurrentEnrollment('s.id')}
        LEFT JOIN ${studentAttendanceModel.table} a ON a.student_id = s.id AND a.attendance_date = $1::date
        ${where}
        ORDER BY u.first_name, u.last_name`;
    } else {
      const remarkColumn = await resolveStaffAttendanceRemarkColumn();
      let where = "WHERE st.status = 'Active'";
      where = appendStaffOrgFilters({ params, where, departmentId: department_id, designationId: null });
      const academicYearJoinFilter = '';
      sql = `
        SELECT
          st.id AS entity_id,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS entity_name,
          COALESCE(sa.status, 'absent') AS status,
          sa.${remarkColumn} AS remark
        FROM staff st
        INNER JOIN users u ON u.id = st.user_id
        LEFT JOIN staff_attendance sa
          ON sa.staff_id = st.id
         AND sa.attendance_date = $1::date
         ${academicYearJoinFilter}
        ${where}
        ORDER BY u.first_name, u.last_name`;
    }

    const result = await query(sql, params);
    const activeHoliday = await getHolidayForDate(date);
    const holidayMark = rosterHolidayMarkingStatus(activeHoliday);
    const rows = holidayMark
      ? (result.rows || []).map((row) => ({ ...row, status: holidayMark }))
      : (result.rows || []).map((row) => ({ ...row, status: normalizeAttendanceStatusForApi(row.status) }));
    return success(res, 200, 'Day-wise attendance fetched', {
      rows,
      summary: buildSummaryFromRows(rows),
      filters: { entityType, date, class_id, section_id, department_id },
      holiday: activeHoliday,
    });
  } catch (err) {
    console.error('getAttendanceDayWise error:', err);
    return errorResponse(res, 500, 'Failed to fetch day-wise attendance', 'ATTENDANCE_DAY_WISE_FAILED', { error: err.message });
  }
};

const getMyAttendance = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId)) {
      return errorResponse(res, 401, 'Not authenticated', 'UNAUTHORIZED');
    }

    const daysRaw = Number(req.query?.days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 30;

    const staffRes = await query(
      `SELECT st.id, u.first_name, u.last_name
       FROM staff st
       INNER JOIN users u ON u.id = st.user_id
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (!staffRes.rows.length) {
      return success(res, 200, 'My attendance fetched successfully', {
        staff: null,
      });
    }

    const staffId = Number(staffRes.rows[0].id);
    const staffName = [staffRes.rows[0].first_name, staffRes.rows[0].last_name].filter(Boolean).join(' ').trim();
    const staffRemarkColumn = await resolveStaffAttendanceRemarkColumn();

    const buildScope = async ({ scope, idField, table, entityId }) => {
      if (!entityId) return null;

      const params = [entityId, days];
      let academicYearClause = '';

      const rowsRes = await query(
        `SELECT
           attendance_date,
           status,
           ${table === 'staff_attendance' ? staffRemarkColumn : 'remarks'} AS remark,
           check_in_time::text AS check_in_time,
           check_out_time::text AS check_out_time
         FROM ${table}
         WHERE ${idField} = $1
           AND attendance_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
           ${academicYearClause}
         ORDER BY attendance_date DESC`,
        params
      );

      const rows = rowsRes.rows || [];
      const summary = buildSummaryFromRows(rows);
      const today = rows.find((row) => String(row.attendance_date) === new Date().toISOString().slice(0, 10)) || null;

      return {
        scope,
        entity_id: entityId,
        entity_name: staffName || 'User',
        summary,
        today,
        rows,
      };
    };

    const staffScope = await buildScope({
      scope: 'staff',
      idField: 'staff_id',
      table: 'staff_attendance',
      entityId: staffId,
    });

    return success(res, 200, 'My attendance fetched successfully', {
      staff: staffScope,
    });
  } catch (err) {
    console.error('getMyAttendance error:', err);
    return errorResponse(res, 500, 'Failed to fetch my attendance', 'MY_ATTENDANCE_FAILED', { error: err.message });
  }
};

module.exports = {
  saveAttendance,
  updateAttendance,
  getMarkingRoster,
  getAttendanceReport,
  getAttendanceDayWise,
  getMyAttendance,
};
