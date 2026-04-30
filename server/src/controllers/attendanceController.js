const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { ROLES } = require('../config/roles');
const { buildSummaryFromRows } = require('../utils/attendanceMetrics');
const { toYmd } = require('../utils/dateOnly');
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
  student: 'attendance',
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

const toNullableTime = (value) => {
  if (value == null || value === '') return null;
  return String(value).trim();
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
};

const upsertStaffRecord = async (client, payload) => {
  const {
    entityId,
    status,
    attendanceDate,
    markedBy = null,
    remark = null,
    checkInTime = null,
    checkOutTime = null,
  } = payload;
  const params = [entityId, attendanceDate, status, checkInTime, checkOutTime, remark, markedBy];
  const updated = await client.query(
    `UPDATE staff_attendance
     SET
       status = $3,
       check_in_time = $4,
       check_out_time = $5,
       remark = $6,
       marked_by = $7
     WHERE staff_id = $1
       AND attendance_date = $2`,
    params
  );
  if ((updated.rowCount || 0) > 0) return;
  await client.query(
    `INSERT INTO staff_attendance (
      staff_id, attendance_date, status, check_in_time, check_out_time, remark, marked_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
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
  const teacherRows = await query(
    `SELECT t.id, t.staff_id
     FROM teachers t
     INNER JOIN staff st ON st.id = t.staff_id
     WHERE st.user_id = $1
       AND st.is_active = true`,
    [userId]
  );
  const teacherIds = [...new Set((teacherRows.rows || []).map((row) => Number(row.id)).filter(Number.isFinite))];
  const staffIds = [...new Set((teacherRows.rows || []).map((row) => Number(row.staff_id)).filter(Number.isFinite))];
  return { teacherIds, staffIds };
};

const saveAttendance = async (req, res) => {
  try {
    const { entityType, attendanceDate, records } = req.body;
    const { isTeacher } = getUserRoleContext(req.user);

    if (!canWriteEntity(req.user, entityType)) {
      return errorResponse(res, 403, 'You are not authorized to mark this attendance type', 'FORBIDDEN');
    }

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
            `SELECT id FROM students s
             WHERE s.id = ANY($1::int[])
               AND (
                 EXISTS (
                   SELECT 1 FROM class_schedules cs
                   WHERE cs.class_id = s.class_id
                     AND cs.teacher_id = ANY($2::int[])
                     AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
                 )
                 OR EXISTS (
                   SELECT 1 FROM teachers t
                   WHERE t.id = ANY($2::int[])
                     AND t.class_id = s.class_id
                 )
                 OR EXISTS (
                   SELECT 1 FROM sections sec_map
                   WHERE sec_map.id = s.section_id
                     AND sec_map.section_teacher_id = ANY($3::int[])
                 )
                 OR EXISTS (
                   SELECT 1 FROM classes c_map
                   WHERE c_map.id = s.class_id
                     AND (c_map.class_teacher_id = ANY($2::int[]) OR c_map.class_teacher_id = ANY($3::int[]))
                 )
               )`,
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

      for (const record of records) {
        const status = normalizeStatus(record.status);
        await upsertRecord(client, {
          ...record,
          status,
          attendanceDate,
          markedBy,
          checkInTime: toNullableTime(record.checkInTime),
          checkOutTime: toNullableTime(record.checkOutTime),
          remark: record.remark ? String(record.remark).trim() : null,
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
      const params = [date];
      let where = 'WHERE s.is_active = true';
      if (class_id) {
        params.push(Number(class_id));
        where += ` AND s.class_id = $${params.length}`;
      }
      if (section_id) {
        params.push(Number(section_id));
        where += ` AND s.section_id = $${params.length}`;
      }

      if (isTeacher) {
        const { teacherIds, staffIds } = await getTeacherIdentity(req.user?.id);
        if (!teacherIds.length || !staffIds.length) {
          return errorResponse(res, 403, 'Access denied. User is not an active teacher.', 'FORBIDDEN');
        }

        params.push(teacherIds);
        const teacherIdsParamRef = `$${params.length}::int[]`;
        params.push(staffIds);
        const staffIdsParamRef = `$${params.length}::int[]`;

        where += ` AND (
          EXISTS (
            SELECT 1 FROM class_schedules cs
            WHERE cs.class_id = s.class_id
              AND cs.teacher_id = ANY(${teacherIdsParamRef})
              AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
          )
          OR EXISTS (
            SELECT 1 FROM teachers t
            WHERE t.id = ANY(${teacherIdsParamRef})
              AND t.class_id = s.class_id
          )
          OR EXISTS (
            SELECT 1 FROM sections sec_map
            WHERE sec_map.id = s.section_id
              AND sec_map.section_teacher_id = ANY(${staffIdsParamRef})
          )
          OR EXISTS (
            SELECT 1 FROM classes c_map
            WHERE c_map.id = s.class_id
              AND (c_map.class_teacher_id = ANY(${teacherIdsParamRef}) OR c_map.class_teacher_id = ANY(${staffIdsParamRef}))
          )
        )`;
      }

      const sql = `
        SELECT
          s.id AS entity_id,
          CONCAT(s.first_name, ' ', COALESCE(s.last_name, '')) AS entity_name,
          s.class_id,
          s.section_id,
          a.status,
          a.remarks AS remark,
          a.check_in_time::text AS check_in_time,
          a.check_out_time::text AS check_out_time
        FROM students s
        LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date = $1
        ${where}
        ORDER BY s.first_name ASC, s.last_name ASC`;
      const roster = await query(sql, params);
      const activeHoliday = await getHolidayForDate(date);
      const holidayMark = rosterHolidayMarkingStatus(activeHoliday);
      const rows = holidayMark
        ? (roster.rows || []).map((row) => ({ ...row, status: holidayMark }))
        : roster.rows;
      return success(res, 200, 'Student attendance roster fetched', rows, { holiday: activeHoliday || null });
    }

    const params = [date];
    let where = 'WHERE st.is_active = true';
    if (department_id) {
      params.push(Number(department_id));
      where += ` AND st.department_id = $${params.length}`;
    }
    if (designation_id) {
      params.push(Number(designation_id));
      where += ` AND st.designation_id = $${params.length}`;
    }
    const academicYearJoinFilter = '';

    const sql = `
      SELECT
        st.id AS entity_id,
        CONCAT(st.first_name, ' ', COALESCE(st.last_name, '')) AS entity_name,
        st.department_id,
        st.designation_id,
        sa.status,
        sa.remark,
        sa.check_in_time::text AS check_in_time,
        sa.check_out_time::text AS check_out_time
      FROM staff st
      LEFT JOIN staff_attendance sa
        ON sa.staff_id = st.id
       AND sa.attendance_date = $1
       ${academicYearJoinFilter}
      ${where}
      ORDER BY st.first_name ASC, st.last_name ASC`;
    const roster = await query(sql, params);
    const activeHoliday = await getHolidayForDate(date);
    const holidayMark = rosterHolidayMarkingStatus(activeHoliday);
    const rows = holidayMark
      ? (roster.rows || []).map((row) => ({ ...row, status: holidayMark }))
      : roster.rows;
    return success(res, 200, 'Staff attendance roster fetched', rows, { holiday: activeHoliday || null });
  } catch (err) {
    console.error('getMarkingRoster error:', err);
    return errorResponse(res, 500, 'Failed to fetch attendance roster', 'ATTENDANCE_ROSTER_FAILED');
  }
};

const getAttendanceReport = async (req, res) => {
  try {
    const { entityType } = req.params;
    const { month, class_id, section_id, department_id, designation_id } = req.query;
    const [year, monthNumber] = month.split('-').map(Number);
    const monthStart = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
    const monthEndResult = await query(
      "SELECT (date_trunc('month', $1::date) + interval '1 month - 1 day')::date AS month_end",
      [monthStart]
    );
    const monthEnd = monthEndResult.rows[0].month_end;
    const monthEndYmd = toYmd(monthEnd);

    if (entityType === 'student') {
      const params = [monthStart, monthEnd];
      let where = 'WHERE s.is_active = true';
      if (class_id) {
        params.push(Number(class_id));
        where += ` AND s.class_id = $${params.length}`;
      }
      if (section_id) {
        params.push(Number(section_id));
        where += ` AND s.section_id = $${params.length}`;
      }
      const result = await query(
        `
        SELECT
          s.id AS entity_id,
          CONCAT(s.first_name, ' ', COALESCE(s.last_name, '')) AS entity_name,
          s.class_id,
          s.section_id,
          a.attendance_date::date AS attendance_date,
          a.status,
          a.remarks AS remark
        FROM students s
        LEFT JOIN attendance a
          ON a.student_id = s.id
         AND a.attendance_date BETWEEN $1::date AND $2::date
        ${where}
        ORDER BY s.first_name ASC, s.last_name ASC, a.attendance_date ASC
      `,
        params
      );
      const holidays = await listHolidaysInRange(monthStart, monthEndYmd);
      const holidayDates = buildHolidayDateSet(holidays, monthStart, monthEndYmd);
      const rows = (result.rows || []).map((row) => {
        const day = toYmd(row.attendance_date);
        const isHoliday = day ? holidayDates.has(day) : false;
        return {
          ...row,
          attendance_date: day || null,
          status: applyHolidayOverride(row.status, isHoliday),
        };
      });
      return success(res, 200, 'Student attendance report fetched', {
        rows,
        summary: buildSummaryFromRows(rows),
        holiday_dates: Array.from(holidayDates),
        filters: { entityType, month: `${year}-${String(monthNumber).padStart(2, '0')}`, class_id, section_id },
      });
    }

    const params = [monthStart, monthEnd];
    let where = 'WHERE st.is_active = true';
    if (department_id) {
      params.push(Number(department_id));
      where += ` AND st.department_id = $${params.length}`;
    }
    if (designation_id) {
      params.push(Number(designation_id));
      where += ` AND st.designation_id = $${params.length}`;
    }
    const academicYearJoinFilter = '';
    const result = await query(
      `
      SELECT
        st.id AS entity_id,
        CONCAT(st.first_name, ' ', COALESCE(st.last_name, '')) AS entity_name,
        st.department_id,
        sa.attendance_date::date AS attendance_date,
        sa.status,
        sa.remark
      FROM staff st
      LEFT JOIN staff_attendance sa
        ON sa.staff_id = st.id
       AND sa.attendance_date BETWEEN $1::date AND $2::date
       ${academicYearJoinFilter}
      ${where}
      ORDER BY st.first_name ASC, st.last_name ASC, sa.attendance_date ASC
    `,
      params
    );
    const holidays = await listHolidaysInRange(monthStart, monthEndYmd);
    const holidayDates = buildHolidayDateSet(holidays, monthStart, monthEndYmd);
    const rows = (result.rows || []).map((row) => {
      const day = toYmd(row.attendance_date);
      const isHoliday = day ? holidayDates.has(day) : false;
      return {
        ...row,
        attendance_date: day || null,
        status: applyHolidayOverride(row.status, isHoliday),
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
    return errorResponse(res, 500, 'Failed to fetch attendance report', 'ATTENDANCE_REPORT_FAILED');
  }
};

const getAttendanceDayWise = async (req, res) => {
  try {
    const { entityType } = req.params;
    const { date, class_id, section_id, department_id } = req.query;
    const params = [date];
    let sql = '';

    if (entityType === 'student') {
      let where = 'WHERE s.is_active = true';
      if (class_id) {
        params.push(Number(class_id));
        where += ` AND s.class_id = $${params.length}`;
      }
      if (section_id) {
        params.push(Number(section_id));
        where += ` AND s.section_id = $${params.length}`;
      }
      sql = `
        SELECT
          s.id AS entity_id,
          CONCAT(s.first_name, ' ', COALESCE(s.last_name, '')) AS entity_name,
          COALESCE(a.status, 'absent') AS status,
          a.remarks AS remark
        FROM students s
        LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date = $1::date
        ${where}
        ORDER BY s.first_name, s.last_name`;
    } else {
      let where = 'WHERE st.is_active = true';
      if (department_id) {
        params.push(Number(department_id));
        where += ` AND st.department_id = $${params.length}`;
      }
      const academicYearJoinFilter = '';
      sql = `
        SELECT
          st.id AS entity_id,
          CONCAT(st.first_name, ' ', COALESCE(st.last_name, '')) AS entity_name,
          COALESCE(sa.status, 'absent') AS status,
          sa.remark
        FROM staff st
        LEFT JOIN staff_attendance sa
          ON sa.staff_id = st.id
         AND sa.attendance_date = $1::date
         ${academicYearJoinFilter}
        ${where}
        ORDER BY st.first_name, st.last_name`;
    }

    const result = await query(sql, params);
    const activeHoliday = await getHolidayForDate(date);
    const holidayMark = rosterHolidayMarkingStatus(activeHoliday);
    const rows = holidayMark
      ? (result.rows || []).map((row) => ({ ...row, status: holidayMark }))
      : result.rows;
    return success(res, 200, 'Day-wise attendance fetched', {
      rows,
      summary: buildSummaryFromRows(rows),
      filters: { entityType, date, class_id, section_id, department_id },
      holiday: activeHoliday,
    });
  } catch (err) {
    console.error('getAttendanceDayWise error:', err);
    return errorResponse(res, 500, 'Failed to fetch day-wise attendance', 'ATTENDANCE_DAY_WISE_FAILED');
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
      `SELECT id, first_name, last_name
       FROM staff
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

    const buildScope = async ({ scope, idField, table, entityId }) => {
      if (!entityId) return null;

      const params = [entityId, days];
      let academicYearClause = '';

      const rowsRes = await query(
        `SELECT
           attendance_date,
           status,
           remark,
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
    return errorResponse(res, 500, 'Failed to fetch my attendance', 'MY_ATTENDANCE_FAILED');
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
