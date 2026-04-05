const { query } = require('../config/database');
const { getAuthContext, isAdmin, resolveTeacherIdForUser, resolveStudentScopeForUser, resolveWardStudentIdsForUser, parseId } = require('../utils/accessControl');
const { ROLES } = require('../config/roles');

// Parse academic_year_id from query (optional - when set, filter year-specific data)
function parseAcademicYearId(req) {
  const val = req.query?.academic_year_id;
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

/** Optional class filter for exam-based dashboard widgets (students in this class only). */
function parseClassId(req) {
  const val = req.query?.class_id;
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) || n < 1 ? null : n;
}

/**
 * Teacher row linked to an academic year (not only class_schedules — avoids 0 when timetable not entered).
 * @param {string} t SQL alias for teachers (e.g. 't')
 * @param {number} n PostgreSQL parameter index for academic_year_id
 */
function sqlTeacherInAcademicYear(t, n) {
  return `(
    EXISTS (SELECT 1 FROM class_schedules cs WHERE cs.teacher_id = ${t}.id AND cs.academic_year_id = $${n})
    OR EXISTS (SELECT 1 FROM classes c WHERE c.academic_year_id = $${n} AND c.class_teacher_id = ${t}.staff_id)
    OR EXISTS (SELECT 1 FROM classes c WHERE c.academic_year_id = $${n} AND c.id = ${t}.class_id)
  )`;
}

/** YYYY-MM-DD for dashboard attendance snapshot; invalid → null */
function parseAttendanceDate(req) {
  const val = req.query?.attendance_date;
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

/** Single day vs cumulative student marks: all_time aggregates every attendance row (optional year on students). */
function parseAttendanceScope(req) {
  const v = String(req.query?.attendance_scope || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (v === 'all_time' || v === 'alltime') return 'all_time';
  return 'day';
}

/**
 * Fee / earnings date window from fee_period query (optional).
 * all → no window; month → calendar month to date; year → Jan 1–today; 90d → rolling 90 days.
 */
function parseFeeDateWindow(req) {
  const p = String(req.query?.fee_period || 'all').trim().toLowerCase();
  if (p === 'all' || p === '') return { from: null, to: null, label: 'all' };
  const to = new Date();
  const toStr = to.toISOString().slice(0, 10);
  if (p === 'month') {
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: toStr, label: 'month' };
  }
  if (p === 'year') {
    const from = new Date(to.getFullYear(), 0, 1);
    return { from: from.toISOString().slice(0, 10), to: toStr, label: 'year' };
  }
  if (p === '90d' || p === '90') {
    const from = new Date(to);
    from.setDate(from.getDate() - 90);
    return { from: from.toISOString().slice(0, 10), to: toStr, label: '90d' };
  }
  return { from: null, to: null, label: 'all' };
}

function pctPart(num, den) {
  const n = parseInt(num, 10) || 0;
  const d = parseInt(den, 10) || 0;
  if (d <= 0) return 0;
  return Math.round((100 * n) / d);
}

/**
 * Students: either one calendar day or all rows in attendance (all_time).
 * Teachers/staff: leave-vs-active for a single day only (no historical staff clock-in table).
 */
async function buildAttendanceSnapshot(academicYearId, attendanceDate = null, scope = 'day') {
  const isAllTime = scope === 'all_time';
  const hasYear = academicYearId != null;

  let dateStr = null;
  if (!isAllTime) {
    dateStr = attendanceDate;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
      const dateRow = await query(`SELECT CURRENT_DATE::text AS d`);
      dateStr = dateRow.rows[0]?.d || new Date().toISOString().slice(0, 10);
    }
  }

  const students = { present: 0, absent: 0, late: 0, halfDay: 0, totalMarked: 0, attendancePct: 0 };
  try {
    if (isAllTime) {
      const studentParams = hasYear ? [academicYearId] : [];
      const yearClause = hasYear ? 'AND st.academic_year_id = $1' : '';
      const r = await query(
        `SELECT
           COUNT(*) FILTER (WHERE a.status = 'present')::int AS present,
           COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent,
           COUNT(*) FILTER (WHERE a.status = 'late')::int AS late,
           COUNT(*) FILTER (WHERE a.status = 'half_day')::int AS half_day,
           COUNT(*)::int AS total_marked
         FROM attendance a
         INNER JOIN students st ON a.student_id = st.id
         WHERE st.is_active = true
           ${yearClause}`,
        studentParams
      );
      const row = r.rows[0] || {};
      students.present = parseInt(row.present, 10) || 0;
      students.absent = parseInt(row.absent, 10) || 0;
      students.late = parseInt(row.late, 10) || 0;
      students.halfDay = parseInt(row.half_day, 10) || 0;
      students.totalMarked = parseInt(row.total_marked, 10) || 0;
    } else {
      const studentParams = hasYear ? [dateStr, academicYearId] : [dateStr];
      const yearClause = hasYear ? 'AND st.academic_year_id = $2' : '';
      const r = await query(
        `SELECT
           COUNT(*) FILTER (WHERE a.status = 'present')::int AS present,
           COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent,
           COUNT(*) FILTER (WHERE a.status = 'late')::int AS late,
           COUNT(*) FILTER (WHERE a.status = 'half_day')::int AS half_day,
           COUNT(*)::int AS total_marked
         FROM attendance a
         INNER JOIN students st ON a.student_id = st.id
         WHERE a.attendance_date = $1::date
           AND st.is_active = true
           ${yearClause}`,
        studentParams
      );
      const row = r.rows[0] || {};
      students.present = parseInt(row.present, 10) || 0;
      students.absent = parseInt(row.absent, 10) || 0;
      students.late = parseInt(row.late, 10) || 0;
      students.halfDay = parseInt(row.half_day, 10) || 0;
      students.totalMarked = parseInt(row.total_marked, 10) || 0;
    }
    const attended = students.present + students.late + students.halfDay;
    students.attendancePct = pctPart(attended, students.totalMarked);
  } catch (e) {
    console.warn('Dashboard: student attendance snapshot failed', e.message);
  }

  const teachers = {
    present: 0,
    absent: 0,
    late: 0,
    totalMarked: 0,
    attendancePct: 0,
    isProxy: true,
    dataSource: 'leave_vs_active',
  };
  if (!isAllTime) {
    try {
      const tParams = hasYear ? [academicYearId] : [];
      const teachYear = hasYear ? `AND ${sqlTeacherInAcademicYear('t', 1)}` : '';
      const totalR = await query(
        `SELECT COUNT(*)::int AS total
         FROM teachers t
         INNER JOIN staff s ON t.staff_id = s.id
         WHERE t.status = 'Active' AND s.is_active = true
         ${teachYear}`,
        tParams
      );
      const totalT = parseInt(totalR.rows[0]?.total, 10) || 0;
      const leaveParams = hasYear ? [dateStr, academicYearId] : [dateStr];
      const leaveYear = hasYear ? `AND ${sqlTeacherInAcademicYear('t', 2)}` : '';
      const leaveR = await query(
        `SELECT COUNT(DISTINCT t.id)::int AS on_leave
         FROM teachers t
         INNER JOIN staff s ON t.staff_id = s.id
         INNER JOIN leave_applications la ON la.staff_id = s.id
         WHERE t.status = 'Active' AND s.is_active = true
           AND LOWER(TRIM(la.status)) IN ('approved', 'approve')
           AND la.start_date <= $1::date AND la.end_date >= $1::date
         ${leaveYear}`,
        leaveParams
      );
      const onLeave = parseInt(leaveR.rows[0]?.on_leave, 10) || 0;
      teachers.absent = Math.min(onLeave, totalT);
      teachers.present = Math.max(0, totalT - teachers.absent);
      teachers.totalMarked = totalT;
      teachers.attendancePct = pctPart(teachers.present, totalT);
    } catch (e) {
      console.warn('Dashboard: teacher leave proxy snapshot failed', e.message);
    }
  } else {
    teachers.dataSource = 'daily_only';
  }

  const staff = {
    present: 0,
    absent: 0,
    late: 0,
    totalMarked: 0,
    attendancePct: 0,
    isProxy: true,
    dataSource: 'leave_vs_active',
  };
  if (!isAllTime) {
    try {
      const staffYear = hasYear
        ? `AND EXISTS (
             SELECT 1 FROM teachers t
             WHERE t.staff_id = s.id AND ${sqlTeacherInAcademicYear('t', 1)}
           )`
        : '';
      const sp = hasYear ? [academicYearId] : [];
      const totalS = await query(
        `SELECT COUNT(*)::int AS total FROM staff s WHERE s.is_active = true ${staffYear}`,
        sp
      );
      const totalSt = parseInt(totalS.rows[0]?.total, 10) || 0;
      const staffLeaveParams = hasYear ? [dateStr, academicYearId] : [dateStr];
      const staffLeaveYear = hasYear
        ? `AND EXISTS (
             SELECT 1 FROM teachers t
             WHERE t.staff_id = s.id AND ${sqlTeacherInAcademicYear('t', 2)}
           )`
        : '';
      const leaveS = await query(
        `SELECT COUNT(DISTINCT s.id)::int AS on_leave
         FROM staff s
         INNER JOIN leave_applications la ON la.staff_id = s.id
         WHERE s.is_active = true
           AND LOWER(TRIM(la.status)) IN ('approved', 'approve')
           AND la.start_date <= $1::date AND la.end_date >= $1::date
         ${staffLeaveYear}`,
        staffLeaveParams
      );
      const onLeaveS = parseInt(leaveS.rows[0]?.on_leave, 10) || 0;
      staff.absent = Math.min(onLeaveS, totalSt);
      staff.present = Math.max(0, totalSt - staff.absent);
      staff.totalMarked = totalSt;
      staff.attendancePct = pctPart(staff.present, totalSt);
    } catch (e) {
      console.warn('Dashboard: staff leave proxy snapshot failed', e.message);
    }
  } else {
    staff.dataSource = 'daily_only';
  }

  return {
    date: isAllTime ? null : dateStr,
    scope: isAllTime ? 'all_time' : 'day',
    students,
    teachers,
    staff,
  };
}

// Get dashboard stats (counts for students, teachers, staff, subjects)
const getDashboardStats = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    const stats = {
      students: { total: 0, active: 0, inactive: 0 },
      teachers: { total: 0, active: 0, inactive: 0 },
      staff: { total: 0, active: 0, inactive: 0 },
      subjects: { total: 0, active: 0, inactive: 0 },
    };

    // Students: total, active (is_active = true), inactive (is_active = false)
    // When academic_year_id provided, filter students by that year
    try {
      const studentsCount = await query(
        hasYearFilter
          ? `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE is_active = true)::int as active,
          COUNT(*) FILTER (WHERE is_active = false)::int as inactive
        FROM students
        WHERE academic_year_id = $1
      `
          : `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE is_active = true)::int as active,
          COUNT(*) FILTER (WHERE is_active = false)::int as inactive
        FROM students
      `,
        hasYearFilter ? [academicYearId] : []
      );
      if (studentsCount.rows[0]) {
        stats.students.total = parseInt(studentsCount.rows[0].total, 10) || 0;
        stats.students.active = parseInt(studentsCount.rows[0].active, 10) || 0;
        stats.students.inactive = parseInt(studentsCount.rows[0].inactive, 10) || 0;
      }
    } catch (e) {
      console.warn('Dashboard: students count failed', e.message);
    }

    // Teachers: always school-wide counts (matches People → Teachers grid: GET /teachers has no academic_year filter).
    // Many classes use NULL academic_year_id; year-scoped EXISTS here produced 0 while the grid still listed teachers.
    try {
      const teachersTotal = await query(`SELECT COUNT(*)::int as total FROM teachers`);
      stats.teachers.total = parseInt(teachersTotal.rows[0]?.total, 10) || 0;
      const teachersActive = await query(`
        SELECT COUNT(*)::int as active
        FROM teachers t
        INNER JOIN staff s ON t.staff_id = s.id
        WHERE t.status = 'Active' AND s.is_active = true
      `);
      stats.teachers.active = parseInt(teachersActive.rows[0]?.active, 10) || 0;
      stats.teachers.inactive = Math.max(0, stats.teachers.total - stats.teachers.active);
    } catch (e) {
      console.warn('Dashboard: teachers count failed', e.message);
    }

    // Staff: total, active, inactive
    try {
      const staffCount = await query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE is_active = true)::int as active,
          COUNT(*) FILTER (WHERE is_active = false)::int as inactive
        FROM staff
      `);
      if (staffCount.rows[0]) {
        stats.staff.total = parseInt(staffCount.rows[0].total, 10) || 0;
        stats.staff.active = parseInt(staffCount.rows[0].active, 10) || 0;
        stats.staff.inactive = parseInt(staffCount.rows[0].inactive, 10) || 0;
      }
    } catch (e) {
      console.warn('Dashboard: staff count failed', e.message);
    }

    // Subjects: total, active, inactive
    try {
      const subjectsCount = await query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE is_active = true)::int as active,
          COUNT(*) FILTER (WHERE is_active = false)::int as inactive
        FROM subjects
      `);
      if (subjectsCount.rows[0]) {
        stats.subjects.total = parseInt(subjectsCount.rows[0].total, 10) || 0;
        stats.subjects.active = parseInt(subjectsCount.rows[0].active, 10) || 0;
        stats.subjects.inactive = parseInt(subjectsCount.rows[0].inactive, 10) || 0;
      }
    } catch (e) {
      console.warn('Dashboard: subjects count failed', e.message);
    }

    const trends = {
      studentsActivePct: pctPart(stats.students.active, stats.students.total),
      teachersActivePct: pctPart(stats.teachers.active, stats.teachers.total),
      staffActivePct: pctPart(stats.staff.active, stats.staff.total),
      subjectsActivePct: pctPart(stats.subjects.active, stats.subjects.total),
    };

    let attendanceToday = {
      date: null,
      scope: 'day',
      students: { present: 0, absent: 0, late: 0, halfDay: 0, totalMarked: 0, attendancePct: 0 },
      teachers: { present: 0, absent: 0, late: 0, totalMarked: 0, attendancePct: 0, isProxy: true },
      staff: { present: 0, absent: 0, late: 0, totalMarked: 0, attendancePct: 0, isProxy: true },
    };
    try {
      const attendanceScope = parseAttendanceScope(req);
      const attendanceDate = parseAttendanceDate(req);
      attendanceToday = await buildAttendanceSnapshot(
        hasYearFilter ? academicYearId : null,
        attendanceDate,
        attendanceScope
      );
    } catch (e) {
      console.warn('Dashboard: attendance snapshot failed', e.message);
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Dashboard stats fetched successfully',
      data: {
        ...stats,
        trends,
        attendanceToday,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch dashboard stats',
    });
  }
};

// Get upcoming calendar events (admin sees all; for dashboard Schedules section)
const getUpcomingEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const ctx = getAuthContext(req);
    if (!ctx.userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }
    const result = await query(
      isAdmin(ctx)
        ? `SELECT ce.id, ce.title, ce.description, ce.start_date, ce.end_date, ce.event_color, ce.is_all_day, ce.location,
              u.first_name AS user_first_name, u.last_name AS user_last_name, u.username
       FROM calendar_events ce
       LEFT JOIN users u ON ce.user_id = u.id
       WHERE ce.start_date >= CURRENT_TIMESTAMP
       ORDER BY ce.start_date ASC
           LIMIT $1`
        : `SELECT ce.id, ce.title, ce.description, ce.start_date, ce.end_date, ce.event_color, ce.is_all_day, ce.location,
                u.first_name AS user_first_name, u.last_name AS user_last_name, u.username
           FROM calendar_events ce
           LEFT JOIN users u ON ce.user_id = u.id
           WHERE ce.user_id = $1 AND ce.start_date >= CURRENT_TIMESTAMP
           ORDER BY ce.start_date ASC
           LIMIT $2`,
      isAdmin(ctx) ? [limit] : [ctx.userId, limit]
    );
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Upcoming events fetched successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch upcoming events',
    });
  }
};

// Headmaster dashboard: merge school `events` and personal/school `calendar_events` (admin: all calendar rows)
const getDashboardMergedUpcomingEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
    const ctx = getAuthContext(req);
    if (!ctx.userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const schoolRes = await query(
      `SELECT e.id, e.title, e.description, e.start_date, e.end_date, e.event_color, e.is_all_day, e.location
       FROM events e
       WHERE e.start_date >= CURRENT_TIMESTAMP
       ORDER BY e.start_date ASC
       LIMIT $1`,
      [limit]
    );

    let calRows = [];
    try {
      const calRes = await query(
        isAdmin(ctx)
          ? `SELECT ce.id, ce.title, ce.description, ce.start_date, ce.end_date, ce.event_color, ce.is_all_day, ce.location
             FROM calendar_events ce
             WHERE ce.start_date >= CURRENT_TIMESTAMP
             ORDER BY ce.start_date ASC
             LIMIT $1`
          : `SELECT ce.id, ce.title, ce.description, ce.start_date, ce.end_date, ce.event_color, ce.is_all_day, ce.location
             FROM calendar_events ce
             WHERE ce.user_id = $1 AND ce.start_date >= CURRENT_TIMESTAMP
             ORDER BY ce.start_date ASC
             LIMIT $2`,
        isAdmin(ctx) ? [limit] : [ctx.userId, limit]
      );
      calRows = calRes.rows || [];
    } catch (e) {
      console.warn('Dashboard: merged calendar_events fetch failed', e.message);
    }

    const merged = [];
    (schoolRes.rows || []).forEach((r) => {
      merged.push({
        id: `school-${r.id}`,
        source: 'school',
        title: r.title,
        description: r.description,
        start_date: r.start_date,
        end_date: r.end_date,
        event_color: r.event_color,
        is_all_day: r.is_all_day,
        location: r.location,
      });
    });
    calRows.forEach((r) => {
      merged.push({
        id: `calendar-${r.id}`,
        source: 'calendar',
        title: r.title,
        description: r.description,
        start_date: r.start_date,
        end_date: r.end_date,
        event_color: r.event_color,
        is_all_day: r.is_all_day,
        location: r.location,
      });
    });

    merged.sort((a, b) => {
      const ta = new Date(a.start_date).getTime();
      const tb = new Date(b.start_date).getTime();
      return ta - tb;
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Merged upcoming events fetched successfully',
      data: merged.slice(0, limit),
    });
  } catch (error) {
    console.error('Error fetching merged upcoming events:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch merged upcoming events',
    });
  }
};

// Recent student-facing activity (leaves, enrollments, exam highlights)
const getDashboardStudentActivity = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    const items = [];

    try {
      const leaveParams = hasYearFilter ? [academicYearId] : [];
      const leaveYear = hasYearFilter ? 'AND st.academic_year_id = $1' : '';
      const leaveRes = await query(
        `SELECT la.id, st.first_name, st.last_name, lt.leave_type AS leave_type_name,
                COALESCE(la.applied_at, la.created_at, la.start_date) AS sort_date
         FROM leave_applications la
         INNER JOIN students st ON la.student_id = st.id
         LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
         WHERE la.student_id IS NOT NULL AND st.is_active = true ${leaveYear}
         ORDER BY sort_date DESC NULLS LAST
         LIMIT 8`,
        leaveParams
      );
      leaveRes.rows.forEach((r) => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Student';
        items.push({
          id: `leave-${r.id}`,
          title: `${name} applied for ${r.leave_type_name || 'leave'}`,
          subtitle: 'Leave request',
          date: r.sort_date,
        });
      });
    } catch (e) {
      console.warn('Dashboard: student activity leaves failed', e.message);
    }

    try {
      const enrParams = hasYearFilter ? [academicYearId] : [];
      const enrYear = hasYearFilter ? 'AND st.academic_year_id = $1' : '';
      const enrRes = await query(
        `SELECT st.id, st.first_name, st.last_name, st.created_at
         FROM students st
         WHERE st.is_active = true AND st.created_at >= CURRENT_TIMESTAMP - INTERVAL '120 days'
         ${enrYear}
         ORDER BY st.created_at DESC
         LIMIT 8`,
        enrParams
      );
      enrRes.rows.forEach((r) => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Student';
        items.push({
          id: `enroll-${r.id}-${r.created_at}`,
          title: `${name} added to student records`,
          subtitle: 'Enrollment',
          date: r.created_at,
        });
      });
    } catch (e) {
      console.warn('Dashboard: student activity enrollments failed', e.message);
    }

    try {
      const exParams = hasYearFilter ? [academicYearId] : [];
      const exYear = hasYearFilter ? 'AND st.academic_year_id = $1' : '';
      const exRes = await query(
        `SELECT er.id, st.first_name, st.last_name, sub.subject_name, er.marks_obtained,
                COALESCE(er.modified_at, er.created_at) AS sort_date
         FROM exam_results er
         INNER JOIN students st ON er.student_id = st.id
         INNER JOIN subjects sub ON er.subject_id = sub.id
         WHERE er.is_absent = false AND COALESCE(er.is_active, true) = true
           ${exYear}
         ORDER BY sort_date DESC NULLS LAST
         LIMIT 8`,
        exParams
      );
      exRes.rows.forEach((r) => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Student';
        const marks = r.marks_obtained != null ? String(r.marks_obtained) : '';
        items.push({
          id: `exam-${r.id}`,
          title: `${name}: ${marks ? `${marks} in ` : ''}${r.subject_name || 'subject'}`,
          subtitle: 'Exam result',
          date: r.sort_date,
        });
      });
    } catch (e) {
      console.warn('Dashboard: student activity exams failed', e.message);
    }

    items.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return tb - ta;
    });

    const seen = new Set();
    const deduped = [];
    for (let i = 0; i < items.length && deduped.length < limit; i += 1) {
      const it = items[i];
      const k = `${it.title}|${it.subtitle}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(it);
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student activity fetched successfully',
      data: deduped,
    });
  } catch (error) {
    console.error('Error fetching dashboard student activity:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch student activity',
    });
  }
};

// Get class routine for dashboard (recent class_schedules)
const getClassRoutineForDashboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;
    const ctx = getAuthContext(req);
    if (!ctx.userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    let rows = [];
    try {
      let where = '';
      const params = [];

      if (!isAdmin(ctx)) {
        // Teacher scope: only own schedules.
        if (ctx.roleName === 'teacher' || ctx.roleId === ROLES.TEACHER) {
          const teacherId = await resolveTeacherIdForUser(ctx.userId);
          if (teacherId) {
            where = ` WHERE (cs.teacher_id = $${params.length + 1} OR cs.teacher = $${params.length + 1})`;
            params.push(teacherId);
          }
        }

        // Student scope: only their class/section schedules.
        if (!where && (ctx.roleName === 'student')) {
          const scope = await resolveStudentScopeForUser(ctx.userId);
          if (scope?.classId) {
            where = ` WHERE cs.class_id = $${params.length + 1}`;
            params.push(scope.classId);
            if (scope.sectionId) {
              where += ` AND (cs.section_id = $${params.length + 1} OR cs.section_id IS NULL)`;
              params.push(scope.sectionId);
            }
          }
        }

        // Parent/Guardian scope: schedules for children's classes (and sections when available).
        if (!where && (ctx.roleName === 'parent' || ctx.roleName === 'guardian')) {
          const wardIds = await resolveWardStudentIdsForUser(req);
          if (wardIds.length > 0) {
            const wardRows = await query(
              `SELECT DISTINCT class_id, section_id
               FROM students
               WHERE id = ANY($1) AND is_active = true`,
              [wardIds]
            );
            const classIds = [...new Set(wardRows.rows.map((r) => parseId(r.class_id)).filter(Boolean))];
            const sectionIds = [...new Set(wardRows.rows.map((r) => parseId(r.section_id)).filter(Boolean))];
            if (classIds.length > 0) {
              where = ` WHERE cs.class_id = ANY($${params.length + 1})`;
              params.push(classIds);
              if (sectionIds.length > 0) {
                where += ` AND (cs.section_id IS NULL OR cs.section_id = ANY($${params.length + 1}))`;
                params.push(sectionIds);
              }
            }
          }
        }

        // Deny-by-default for roles without a defined scope.
        if (!where) {
          return res.status(200).json({ status: 'SUCCESS', data: [], count: 0 });
        }
      }

      if (hasYearFilter) {
        const r = await query(
          `SELECT cs.id, cs.class_id, cs.section_id, cs.subject_id, cs.teacher_id, cs.class_room_id, cs.day_of_week, cs.day, cs.weekday, cs.room_number, cs.room_id, cs.class_room
           FROM class_schedules cs
           INNER JOIN classes c ON cs.class_id = c.id
           ${where ? where + ' AND c.academic_year_id = $' + (params.length + 1) : 'WHERE c.academic_year_id = $1'}
           ORDER BY cs.id DESC LIMIT $${params.length + 2}`,
          where ? [...params, academicYearId, limit] : [academicYearId, limit]
        );
        rows = r.rows;
      } else {
        const r = await query(
          `SELECT id, class_id, section_id, subject_id, teacher_id, class_room_id, day_of_week, day, weekday, room_number, room_id, class_room
           FROM class_schedules cs
           ${where}
           ORDER BY id DESC LIMIT $${params.length + 1}`,
          [...params, limit]
        );
        rows = r.rows;
      }
    } catch (e) {
      try {
        const r = await query(
          `SELECT id, class_id, section_id, subject_id, teacher_id, class_room_id, day_of_week, day, weekday, room_number, room_id, class_room
           FROM class_schedule
           ORDER BY id DESC LIMIT $1`,
          [limit]
        );
        rows = r.rows;
      } catch (e2) {
        return res.status(200).json({ status: 'SUCCESS', data: [], count: 0 });
      }
    }
    if (rows.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', data: [], count: 0 });
    }
    const classIds = [...new Set(rows.map((r) => r.class_id ?? r.class).filter(Boolean))];
    const sectionIds = [...new Set(rows.map((r) => r.section_id ?? r.section).filter(Boolean))];
    const subjectIds = [...new Set(rows.map((r) => r.subject_id ?? r.subject).filter(Boolean))];
    const teacherIds = [...new Set(rows.map((r) => r.teacher_id ?? r.teacher).filter(Boolean))];
    const roomIds = [...new Set(rows.map((r) => r.class_room_id ?? r.room_id ?? r.class_room).filter(Boolean))];

    const classMap = {};
    const sectionMap = {};
    const subjectMap = {};
    const teacherMap = {};
    const roomMap = {};

    if (classIds.length > 0) {
      const r = await query('SELECT id, class_name FROM classes WHERE id = ANY($1)', [classIds]);
      r.rows.forEach((c) => { classMap[c.id] = c; classMap[Number(c.id)] = c; classMap[String(c.id)] = c; });
    }
    if (sectionIds.length > 0) {
      const r = await query('SELECT id, section_name FROM sections WHERE id = ANY($1)', [sectionIds]);
      r.rows.forEach((s) => { sectionMap[s.id] = s; sectionMap[Number(s.id)] = s; sectionMap[String(s.id)] = s; });
    }
    if (subjectIds.length > 0) {
      const r = await query('SELECT id, subject_name FROM subjects WHERE id = ANY($1)', [subjectIds]);
      r.rows.forEach((s) => { subjectMap[s.id] = s; subjectMap[Number(s.id)] = s; subjectMap[String(s.id)] = s; });
    }
    if (teacherIds.length > 0) {
      const r = await query(`SELECT t.id, t.staff_id, s.first_name, s.last_name, s.photo_url
        FROM teachers t INNER JOIN staff s ON t.staff_id = s.id WHERE t.id = ANY($1) OR s.id = ANY($2)`, [teacherIds, teacherIds]);
      r.rows.forEach((t) => {
        const name = [t.first_name, t.last_name].filter(Boolean).join(' ').trim();
        teacherMap[t.id] = { ...t, name };
        if (t.staff_id) teacherMap[t.staff_id] = { ...t, name };
      });
    }
    if (roomIds.length > 0) {
      try {
        const r = await query('SELECT id, room_no FROM class_rooms WHERE id = ANY($1)', [roomIds]);
        r.rows.forEach((rm) => { roomMap[rm.id] = rm; roomMap[Number(rm.id)] = rm; roomMap[String(rm.id)] = rm; });
      } catch (e) { /* ignore */ }
    }

    const mapped = rows.map((row) => {
      const cls = classMap[row.class_id ?? row.class] ?? classMap[Number(row.class_id ?? row.class)] ?? classMap[String(row.class_id ?? row.class)];
      const sec = sectionMap[row.section_id ?? row.section] ?? sectionMap[Number(row.section_id ?? row.section)] ?? sectionMap[String(row.section_id ?? row.section)];
      const subj = subjectMap[row.subject_id ?? row.subject] ?? subjectMap[Number(row.subject_id ?? row.subject)] ?? subjectMap[String(row.subject_id ?? row.subject)];
      const teacher = teacherMap[row.teacher_id ?? row.teacher] ?? teacherMap[Number(row.teacher_id ?? row.teacher)] ?? teacherMap[String(row.teacher_id ?? row.teacher)];
      const room = roomMap[row.class_room_id ?? row.room_id ?? row.class_room] ?? roomMap[Number(row.class_room_id ?? row.room_id ?? row.class_room)] ?? roomMap[String(row.class_room_id ?? row.room_id ?? row.class_room)];
      return {
        id: row.id,
        className: cls?.class_name ?? null,
        sectionName: sec?.section_name ?? null,
        subjectName: subj?.subject_name ?? null,
        teacherName: teacher?.name ?? null,
        teacherPhotoUrl: teacher?.photo_url ?? null,
        roomNo: room?.room_no ?? row.room_number ?? row.room ?? null,
        day: row.day_of_week ?? row.day ?? row.weekday ?? null,
      };
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class routine fetched successfully',
      data: mapped,
      count: mapped.length,
    });
  } catch (error) {
    console.error('Error fetching class routine:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch class routine',
    });
  }
};

// Teachers ranked by average exam marks for subjects they teach (fallback: most class schedules)
const getBestPerformers = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 10);
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    let rows = [];
    try {
      const examParams = hasYearFilter ? [academicYearId, limit] : [limit];
      const examSql = hasYearFilter
        ? `SELECT t.id, s.first_name, s.last_name, s.photo_url,
                  MAX(sub.subject_name) AS subject_name,
                  ROUND(AVG(er.marks_obtained)::numeric, 1) AS metric_avg
           FROM exam_results er
           INNER JOIN students st ON er.student_id = st.id AND st.academic_year_id = $1
           INNER JOIN class_schedules cs ON cs.class_id = st.class_id AND cs.subject_id = er.subject_id
             AND cs.academic_year_id = $1
           INNER JOIN teachers t ON t.id = cs.teacher_id
           INNER JOIN staff s ON t.staff_id = s.id
           LEFT JOIN subjects sub ON er.subject_id = sub.id
           WHERE er.is_absent = false AND COALESCE(er.is_active, true) = true
             AND t.status = 'Active' AND s.is_active = true
           GROUP BY t.id, s.first_name, s.last_name, s.photo_url
           ORDER BY metric_avg DESC NULLS LAST
           LIMIT $2`
        : `SELECT t.id, s.first_name, s.last_name, s.photo_url,
                  MAX(sub.subject_name) AS subject_name,
                  ROUND(AVG(er.marks_obtained)::numeric, 1) AS metric_avg
           FROM exam_results er
           INNER JOIN students st ON er.student_id = st.id
           INNER JOIN class_schedules cs ON cs.class_id = st.class_id AND cs.subject_id = er.subject_id
           INNER JOIN teachers t ON t.id = cs.teacher_id
           INNER JOIN staff s ON t.staff_id = s.id
           LEFT JOIN subjects sub ON er.subject_id = sub.id
           WHERE er.is_absent = false AND COALESCE(er.is_active, true) = true
             AND t.status = 'Active' AND s.is_active = true
           GROUP BY t.id, s.first_name, s.last_name, s.photo_url
           ORDER BY metric_avg DESC NULLS LAST
           LIMIT $1`;
      const examResult = await query(examSql, examParams);
      rows = examResult.rows;
    } catch (e) {
      console.warn('Dashboard: exam-based best performers failed', e.message);
    }

    if (rows.length === 0) {
      const fb = await query(
        `SELECT t.id, s.first_name, s.last_name, s.photo_url, sub.subject_name,
                COUNT(cs.id)::int AS schedule_count
         FROM teachers t
         INNER JOIN staff s ON t.staff_id = s.id
         LEFT JOIN subjects sub ON t.subject_id = sub.id
         LEFT JOIN class_schedules cs ON cs.teacher_id = t.id
           ${hasYearFilter ? 'AND cs.academic_year_id = $2' : ''}
         WHERE t.status = 'Active' AND s.is_active = true
         GROUP BY t.id, s.first_name, s.last_name, s.photo_url, sub.subject_name
         ORDER BY schedule_count DESC NULLS LAST, s.first_name ASC, s.last_name ASC
         LIMIT $1`,
        hasYearFilter ? [limit, academicYearId] : [limit]
      );
      rows = fb.rows.map((r) => ({ ...r, metric_avg: null }));
    }

    const data = rows.map((r) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'N/A',
      subject: r.subject_name || 'Teacher',
      photoUrl: r.photo_url || null,
      avgMarks: r.metric_avg != null ? parseFloat(String(r.metric_avg), 10) : null,
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Best performers fetched successfully',
      data,
    });
  } catch (error) {
    console.error('Error fetching best performers:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch best performers',
    });
  }
};

const getStarStudents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 10);
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    let rows = [];
    try {
      const params = hasYearFilter ? [academicYearId, limit] : [limit];
      const sql = hasYearFilter
        ? `SELECT st.id, st.first_name, st.last_name, st.photo_url,
                  c.class_name, sec.section_name,
                  ROUND(AVG(er.marks_obtained)::numeric, 1) AS avg_marks
           FROM students st
           LEFT JOIN classes c ON st.class_id = c.id
           LEFT JOIN sections sec ON st.section_id = sec.id
           INNER JOIN exam_results er ON er.student_id = st.id
           WHERE st.is_active = true AND st.academic_year_id = $1
             AND er.is_absent = false AND COALESCE(er.is_active, true) = true
           GROUP BY st.id, st.first_name, st.last_name, st.photo_url, c.class_name, sec.section_name
           ORDER BY avg_marks DESC NULLS LAST
           LIMIT $2`
        : `SELECT st.id, st.first_name, st.last_name, st.photo_url,
                  c.class_name, sec.section_name,
                  ROUND(AVG(er.marks_obtained)::numeric, 1) AS avg_marks
           FROM students st
           LEFT JOIN classes c ON st.class_id = c.id
           LEFT JOIN sections sec ON st.section_id = sec.id
           INNER JOIN exam_results er ON er.student_id = st.id
           WHERE st.is_active = true
             AND er.is_absent = false AND COALESCE(er.is_active, true) = true
           GROUP BY st.id, st.first_name, st.last_name, st.photo_url, c.class_name, sec.section_name
           ORDER BY avg_marks DESC NULLS LAST
           LIMIT $1`;
      const result = await query(sql, params);
      rows = result.rows;
    } catch (e) {
      console.warn('Dashboard: exam-based star students failed', e.message);
    }

    if (rows.length === 0) {
      const fb = await query(
        hasYearFilter
          ? `SELECT st.id, st.first_name, st.last_name, st.photo_url, st.class_id, st.section_id,
                    c.class_name, sec.section_name
             FROM students st
             LEFT JOIN classes c ON st.class_id = c.id
             LEFT JOIN sections sec ON st.section_id = sec.id
             WHERE st.is_active = true AND st.academic_year_id = $1
             ORDER BY st.first_name ASC, st.last_name ASC
             LIMIT $2`
          : `SELECT st.id, st.first_name, st.last_name, st.photo_url, st.class_id, st.section_id,
                    c.class_name, sec.section_name
             FROM students st
             LEFT JOIN classes c ON st.class_id = c.id
             LEFT JOIN sections sec ON st.section_id = sec.id
             WHERE st.is_active = true
             ORDER BY st.first_name ASC, st.last_name ASC
             LIMIT $1`,
        hasYearFilter ? [academicYearId, limit] : [limit]
      );
      rows = fb.rows.map((r) => ({ ...r, avg_marks: null }));
    }

    const data = rows.map((r) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'N/A',
      classSection: [r.class_name, r.section_name].filter(Boolean).join(', ') || 'N/A',
      photoUrl: r.photo_url || null,
      avgMarks: r.avg_marks != null ? parseFloat(String(r.avg_marks), 10) : null,
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Star students fetched successfully',
      data,
    });
  } catch (error) {
    console.error('Error fetching star students:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch star students',
    });
  }
};

// Performance summary from exam_results + exams: student-level average score %, then Strong / Satisfactory / Below bands.
const getPerformanceSummary = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;
    const classId = parseClassId(req);
    const hasClassFilter = classId != null;

    let good = 0;
    let average = 0;
    let below = 0;
    let averageScorePct = null;
    let passPct = null;
    let studentsWithExamData = 0;
    const dataSource = 'exam_results';

    try {
      const params = [];
      let extra = '';
      let p = 1;
      if (hasYearFilter) {
        extra += ` AND st.academic_year_id = $${p++}`;
        params.push(academicYearId);
      }
      if (hasClassFilter) {
        extra += ` AND st.class_id = $${p++}`;
        params.push(classId);
      }
      const agg = await query(
        `WITH scored AS (
           SELECT st.id AS student_id,
             AVG(
               (er.marks_obtained::numeric / NULLIF(COALESCE(e.total_marks, 100), 0)::numeric) * 100
             ) AS avg_score_pct
           FROM students st
           INNER JOIN exam_results er ON er.student_id = st.id
             AND er.is_absent = false AND COALESCE(er.is_active, true) = true
           LEFT JOIN exams e ON e.id = er.exam_id AND COALESCE(e.is_active, true) = true
           WHERE st.is_active = true
             ${extra}
           GROUP BY st.id
           HAVING COUNT(er.id) > 0
         )
         SELECT
           COUNT(*) FILTER (WHERE avg_score_pct >= 75)::int AS strong_cnt,
           COUNT(*) FILTER (WHERE avg_score_pct >= 40 AND avg_score_pct < 75)::int AS sat_cnt,
           COUNT(*) FILTER (WHERE avg_score_pct < 40)::int AS below_cnt,
           ROUND(AVG(avg_score_pct)::numeric, 1) AS school_avg,
           COUNT(*) FILTER (WHERE avg_score_pct >= 40)::int AS pass_cnt,
           COUNT(*)::int AS total_students
         FROM scored`,
        params
      );
      const row = agg.rows[0] || {};
      good = parseInt(row.strong_cnt, 10) || 0;
      average = parseInt(row.sat_cnt, 10) || 0;
      below = parseInt(row.below_cnt, 10) || 0;
      studentsWithExamData = parseInt(row.total_students, 10) || 0;
      if (row.school_avg != null) {
        const v = Number.parseFloat(String(row.school_avg));
        averageScorePct = Number.isFinite(v) ? v : null;
      }
      const passCnt = parseInt(row.pass_cnt, 10) || 0;
      if (studentsWithExamData > 0) {
        passPct = Math.round((100 * passCnt) / studentsWithExamData);
      }
    } catch (e) {
      console.warn('Dashboard: exam-based performance summary failed', e.message);
    }

    const emptyMessage =
      studentsWithExamData === 0
        ? hasClassFilter
          ? 'No exam result data for this class yet. Add marks or pick another class.'
          : 'No exam result data yet. Enter marks in Exam Results to see performance bands.'
        : null;

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Performance summary fetched successfully',
      data: {
        good,
        average,
        below,
        series: [good, average, below],
        averageScorePct,
        passPct,
        studentsWithExamData,
        dataSource,
        emptyMessage,
        classId: hasClassFilter ? classId : null,
      },
    });
  } catch (error) {
    console.error('Error fetching performance summary:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch performance summary',
    });
  }
};

// Top subjects by average exam marks (fallback: scheduled subjects list; optional class filter)
const getTopSubjects = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;
    const classId = parseClassId(req);
    const hasClassFilter = classId != null;

    let rows = [];
    try {
      const params = [];
      let extra = '';
      let p = 1;
      if (hasYearFilter) {
        extra += ` AND st.academic_year_id = $${p++}`;
        params.push(academicYearId);
      }
      if (hasClassFilter) {
        extra += ` AND st.class_id = $${p++}`;
        params.push(classId);
      }
      const sql = `SELECT sub.id, sub.subject_name, sub.subject_code,
                  ROUND(AVG(er.marks_obtained)::numeric, 1) AS avg_marks
           FROM exam_results er
           INNER JOIN subjects sub ON er.subject_id = sub.id
           INNER JOIN students st ON er.student_id = st.id
           WHERE sub.is_active = true AND er.is_absent = false AND COALESCE(er.is_active, true) = true
             AND st.is_active = true
             ${extra}
           GROUP BY sub.id, sub.subject_name, sub.subject_code
           ORDER BY avg_marks DESC NULLS LAST
           LIMIT 10`;
      const result = await query(sql, params);
      rows = result.rows;
    } catch (e) {
      console.warn('Dashboard: exam-based top subjects failed', e.message);
    }

    if (rows.length === 0) {
      let fb;
      if (hasYearFilter && hasClassFilter) {
        fb = await query(
          `SELECT DISTINCT sub.id, sub.subject_name, sub.subject_code, NULL::numeric AS avg_marks
             FROM subjects sub
             INNER JOIN class_schedules cs ON cs.subject_id = sub.id AND cs.academic_year_id = $1 AND cs.class_id = $2
             WHERE sub.is_active = true
             ORDER BY sub.subject_name ASC
             LIMIT 10`,
          [academicYearId, classId]
        );
      } else if (hasYearFilter) {
        fb = await query(
          `SELECT DISTINCT sub.id, sub.subject_name, sub.subject_code, NULL::numeric AS avg_marks
             FROM subjects sub
             INNER JOIN class_schedules cs ON cs.subject_id = sub.id AND cs.academic_year_id = $1
             WHERE sub.is_active = true
             ORDER BY sub.subject_name ASC
             LIMIT 10`,
          [academicYearId]
        );
      } else if (hasClassFilter) {
        fb = await query(
          `SELECT DISTINCT sub.id, sub.subject_name, sub.subject_code, NULL::numeric AS avg_marks
             FROM subjects sub
             INNER JOIN class_schedules cs ON cs.subject_id = sub.id AND cs.class_id = $1
             WHERE sub.is_active = true
             ORDER BY sub.subject_name ASC
             LIMIT 10`,
          [classId]
        );
      } else {
        fb = await query(
          `SELECT id, subject_name, subject_code, NULL::numeric AS avg_marks
             FROM subjects
             WHERE is_active = true
             ORDER BY subject_name ASC
             LIMIT 10`
        );
      }
      rows = fb.rows;
    }

    let maxAvg = 0;
    rows.forEach((r) => {
      const v = parseFloat(String(r.avg_marks || '0'), 10) || 0;
      if (v > maxAvg) maxAvg = v;
    });
    const data = rows.map((r) => {
      const avg = parseFloat(String(r.avg_marks || '0'), 10) || 0;
      const scorePercent = maxAvg > 0 ? Math.round((avg / maxAvg) * 100) : (rows.length > 0 ? 100 : 0);
      return {
        id: r.id,
        name: r.subject_name || r.subject_code || 'N/A',
        avgMarks: r.avg_marks != null ? parseFloat(String(r.avg_marks), 10) : null,
        scorePercent,
      };
    });
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Top subjects fetched successfully',
      data,
      meta: { classId: hasClassFilter ? classId : null },
    });
  } catch (error) {
    console.error('Error fetching top subjects:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch top subjects',
    });
  }
};

// Get recent notices for dashboard
const getNoticeBoardForDashboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
    const result = await query(
      `SELECT id, title, content, created_at, modified_at
       FROM notice_board
       ORDER BY COALESCE(modified_at, created_at) DESC
       LIMIT $1`,
      [limit]
    );
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Notices fetched successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching notices for dashboard:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch notices',
    });
  }
};

// Fee stats for dashboard (from fee_collections and fee_structures)
const getDashboardFeeStats = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;
    const feeWin = parseFeeDateWindow(req);

    let totalFeesCollected = 0;
    let fineCollected = 0;
    let studentNotPaid = 0;
    let totalOutstanding = 0;

    try {
      const earnParams = hasYearFilter ? [academicYearId] : [];
      let earnSql = hasYearFilter
        ? `SELECT COALESCE(SUM(fc.amount_paid::numeric), 0) AS total
             FROM fee_collections fc
             INNER JOIN students s ON fc.student_id = s.id
             WHERE fc.is_active = true AND s.academic_year_id = $1`
        : `SELECT COALESCE(SUM(amount_paid::numeric), 0) AS total
            FROM fee_collections
            WHERE is_active = true`;
      if (feeWin.from && feeWin.to) {
        const a = earnParams.length + 1;
        const b = earnParams.length + 2;
        earnSql += hasYearFilter
          ? ` AND fc.payment_date >= $${a}::date AND fc.payment_date <= $${b}::date`
          : ` AND payment_date >= $${a}::date AND payment_date <= $${b}::date`;
        earnParams.push(feeWin.from, feeWin.to);
      }
      const collectedResult = await query(earnSql, earnParams);
      totalFeesCollected = parseFloat(collectedResult.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: fee_collections sum failed', e.message);
    }

    try {
      const fineRes = await query(`
        SELECT COALESCE(SUM(fine_amount::numeric), 0) AS total
        FROM library_book_issues
        WHERE is_active = true AND COALESCE(fine_amount, 0) > 0
          AND LOWER(TRIM(COALESCE(status, ''))) = 'returned'
      `);
      fineCollected = parseFloat(fineRes.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: library fines sum failed', e.message);
    }

    try {
      const studentWhere = hasYearFilter ? ' AND s.academic_year_id = $1' : '';
      const outstandingParams = hasYearFilter ? [academicYearId] : [];
      const outstandingResult = await query(
        `WITH student_fee_due AS (
          SELECT s.id AS student_id, fs.id AS fee_structure_id, fs.amount::numeric AS due_amount,
            COALESCE((
              SELECT SUM(fc.amount_paid::numeric)
              FROM fee_collections fc
              WHERE fc.student_id = s.id AND fc.fee_structure_id = fs.id AND fc.is_active = true
            ), 0) AS paid
          FROM students s
          INNER JOIN fee_structures fs ON (fs.class_id IS NULL OR fs.class_id = s.class_id) AND COALESCE(fs.is_active, true) = true
          WHERE s.is_active = true${studentWhere}
        ),
        with_outstanding AS (
          SELECT student_id, (due_amount - paid) AS outstanding
          FROM student_fee_due
          WHERE paid < due_amount AND due_amount > 0
        )
        SELECT
          COUNT(DISTINCT student_id)::int AS student_not_paid,
          COALESCE(SUM(outstanding), 0)::numeric AS total_outstanding
        FROM with_outstanding
      `,
        outstandingParams
      );
      const row = outstandingResult.rows[0];
      studentNotPaid = parseInt(row?.student_not_paid || '0', 10) || 0;
      totalOutstanding = parseFloat(row?.total_outstanding || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: fee outstanding calc failed', e.message);
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Fee stats fetched successfully',
      data: {
        totalFeesCollected,
        fineCollected,
        studentNotPaid,
        totalOutstanding,
        feePeriod: feeWin.label,
      },
    });
  } catch (error) {
    console.error('Error fetching fee stats:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch fee stats',
    });
  }
};

// Finance summary: fees + library fines (earnings); expenses when school_expenses table exists
const getDashboardFinanceSummary = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;
    const feeWin = parseFeeDateWindow(req);

    let totalEarnings = 0;
    let totalFines = 0;
    let totalExpenses = 0;
    let expensesTracked = false;

    try {
      const earnParams = hasYearFilter ? [academicYearId] : [];
      let earnSql = hasYearFilter
        ? `SELECT COALESCE(SUM(fc.amount_paid::numeric), 0) AS total
             FROM fee_collections fc
             INNER JOIN students s ON fc.student_id = s.id
             WHERE fc.is_active = true AND s.academic_year_id = $1`
        : `SELECT COALESCE(SUM(amount_paid::numeric), 0) AS total
            FROM fee_collections
            WHERE is_active = true`;
      if (feeWin.from && feeWin.to) {
        const a = earnParams.length + 1;
        const b = earnParams.length + 2;
        earnSql += hasYearFilter
          ? ` AND fc.payment_date >= $${a}::date AND fc.payment_date <= $${b}::date`
          : ` AND payment_date >= $${a}::date AND payment_date <= $${b}::date`;
        earnParams.push(feeWin.from, feeWin.to);
      }
      const earningsResult = await query(earnSql, earnParams);
      totalEarnings = parseFloat(earningsResult.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: total earnings (fees) failed', e.message);
    }

    try {
      const fineRes = await query(`
        SELECT COALESCE(SUM(fine_amount::numeric), 0) AS total
        FROM library_book_issues
        WHERE is_active = true AND COALESCE(fine_amount, 0) > 0
          AND LOWER(TRIM(COALESCE(status, ''))) = 'returned'
      `);
      totalFines = parseFloat(fineRes.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: finance fines failed', e.message);
    }

    try {
      const tbl = await query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'school_expenses'
         ) AS e`
      );
      expensesTracked = Boolean(tbl.rows[0]?.e);
      if (expensesTracked) {
        const expRes = await query(
          'SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM school_expenses WHERE COALESCE(is_active, true) = true'
        );
        totalExpenses = parseFloat(expRes.rows[0]?.total || '0') || 0;
      }
    } catch (e) {
      totalExpenses = 0;
      expensesTracked = false;
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Finance summary fetched successfully',
      data: {
        totalEarnings,
        totalFines,
        totalExpenses,
        netPosition: totalEarnings + totalFines - totalExpenses,
        feePeriod: feeWin.label,
        expensesTracked,
      },
    });
  } catch (error) {
    console.error('Error fetching finance summary:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch finance summary',
    });
  }
};

// Recent activity for alert (most recent leave application)
const getRecentActivity = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;
    const yearFilter = hasYearFilter
      ? ' AND (la.student_id IS NULL OR st.academic_year_id = $1)'
      : '';
    const params = hasYearFilter ? [academicYearId] : [];

    const result = await query(
      `SELECT la.id, la.start_date, la.end_date, la.applied_at, la.created_at,
             lt.leave_type AS leave_type_name,
             COALESCE(s.first_name || ' ' || s.last_name, st.first_name || ' ' || st.last_name) AS applicant_name,
             c.class_name, sec.section_name
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
      LEFT JOIN staff s ON la.staff_id = s.id
      LEFT JOIN students st ON la.student_id = st.id
      LEFT JOIN classes c ON st.class_id = c.id
      LEFT JOIN sections sec ON st.section_id = sec.id
      WHERE 1=1${yearFilter}
      ORDER BY COALESCE(la.applied_at, la.created_at, la.start_date) DESC NULLS LAST
      LIMIT 1`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(200).json({
        status: 'SUCCESS',
        data: null,
        message: 'No recent activity',
      });
    }
    const r = result.rows[0];
    const name = (r.applicant_name || '').trim() || 'Someone';
    const classSec = [r.class_name, r.section_name].filter(Boolean).join(', ');
    res.status(200).json({
      status: 'SUCCESS',
      data: {
        type: 'leave',
        message: `${name}${classSec ? ' (' + classSec + ')' : ''} applied for ${r.leave_type_name || 'leave'}`,
        date: r.applied_at || r.created_at || r.start_date,
      },
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(200).json({
      status: 'SUCCESS',
      data: null,
      message: 'No recent activity',
    });
  }
};

module.exports = {
  getDashboardStats,
  getUpcomingEvents,
  getDashboardMergedUpcomingEvents,
  getDashboardStudentActivity,
  getClassRoutineForDashboard,
  getBestPerformers,
  getStarStudents,
  getPerformanceSummary,
  getTopSubjects,
  getRecentActivity,
  getNoticeBoardForDashboard,
  getDashboardFeeStats,
  getDashboardFinanceSummary,
};
