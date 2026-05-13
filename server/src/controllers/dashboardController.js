const { query } = require('../config/database');
const { getAuthContext, isAdmin, resolveTeacherStaffIdForUser, resolveStudentScopeForUser, resolveWardStudentIdsForUser, parseId } = require('../utils/accessControl');
const { ROLES } = require('../config/roles');
const { getExamSchemaFlags } = require('./examModuleController');
const { lateralCurrentEnrollment } = require('../utils/studentEnrollmentSql');

// Parse academic_year_id from query (optional - when set, filter year-specific data)
function parseAcademicYearId(req) {
  const val = req.query?.academic_year_id;
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) || n < 1 ? null : n;
}

/** Optional class filter for exam-based dashboard widgets (students in this class only). */
function parseClassId(req) {
  const val = req.query?.class_id;
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) || n < 1 ? null : n;
}

function parseTextQueryParam(req, key) {
  const raw = req.query?.[key];
  if (raw == null) return null;
  const val = String(raw).trim();
  if (!val) return null;
  return val.slice(0, 80);
}

function parseStarStudentsTimeRange(req) {
  const raw = String(req.query?.time_range || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (raw === 'this_month') return 'this_month';
  if (raw === 'this_year') return 'this_year';
  if (raw === 'last_week') return 'last_week';
  return 'all_time';
}

/**
 * Staff member with teaching activity in an academic year (staff id = class_schedules.teacher_id).
 * @param {string} s SQL alias for staff (e.g. 's')
 * @param {number} n PostgreSQL parameter index for academic_year_id
 */
function sqlTeacherInAcademicYear(s, n) {
  return `(
    EXISTS (SELECT 1 FROM class_schedules cs WHERE cs.teacher_id = ${s}.id AND cs.academic_year_id = $${n})
    OR EXISTS (
      SELECT 1 FROM class_teachers ct
      WHERE ct.staff_id = ${s}.id AND ct.academic_year_id = $${n} AND ct.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM subject_teacher_assignments sta
      WHERE sta.staff_id = ${s}.id AND sta.academic_year_id = $${n} AND sta.deleted_at IS NULL
    )
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
 * Build schema-safe marks expression and optional joins for star-students.
 * Handles mixed deployments where marks columns vary across exam_results/exam_subjects/exams.
 */
async function buildExamResultTotalMarksSpec() {
  const [columnsResult, examSubjectsTableResult] = await Promise.all([
    query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
         AND column_name = ANY($2::text[])`,
      [['exam_results', 'exam_subjects', 'exams'], ['max_marks', 'full_marks', 'total_marks']]
    ),
    query(`SELECT to_regclass('public.exam_subjects') IS NOT NULL AS exists`),
  ]);

  const has = new Set(columnsResult.rows.map((r) => `${String(r.table_name)}.${String(r.column_name)}`));
  const hasExamSubjectsTable = Boolean(examSubjectsTableResult.rows[0]?.exists);
  const parts = [];
  let joinExamSubjectsSql = '';

  if (has.has('exam_results.max_marks')) parts.push('er.max_marks::numeric');
  if (has.has('exam_results.full_marks')) parts.push('er.full_marks::numeric');
  if (has.has('exam_results.total_marks')) parts.push('er.total_marks::numeric');
  if (hasExamSubjectsTable && has.has('exam_subjects.max_marks')) {
    joinExamSubjectsSql = 'LEFT JOIN exam_subjects es ON es.id = er.exam_subject_id';
    parts.push('es.max_marks::numeric');
  }
  if (has.has('exams.total_marks')) parts.push('e.total_marks::numeric');
  parts.push('100');

  return {
    totalMarksExpr: `COALESCE(${parts.join(', ')})`,
    joinExamSubjectsSql,
  };
}

/**
 * Build schema-safe exam date expression for star-students latest exam selection.
 * Prefer scheduled exam dates; fallback to result timestamps.
 */
async function buildExamResultExamDateSpec() {
  const [columnsResult, examSubjectsTableResult] = await Promise.all([
    query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
         AND column_name = ANY($2::text[])`,
      [['exam_subjects', 'exams'], ['exam_date', 'start_date', 'end_date', 'created_at', 'updated_at']]
    ),
    query(`SELECT to_regclass('public.exam_subjects') IS NOT NULL AS exists`),
  ]);

  const has = new Set(columnsResult.rows.map((r) => `${String(r.table_name)}.${String(r.column_name)}`));
  const hasExamSubjectsTable = Boolean(examSubjectsTableResult.rows[0]?.exists);
  const parts = [];

  const hasExamSubjectsExamDate = hasExamSubjectsTable && has.has('exam_subjects.exam_date');
  if (hasExamSubjectsExamDate) parts.push('es.exam_date::timestamp');
  if (has.has('exams.exam_date')) parts.push('e.exam_date::timestamp');
  if (has.has('exams.start_date')) parts.push('e.start_date::timestamp');
  if (has.has('exams.end_date')) parts.push('e.end_date::timestamp');
  if (has.has('exams.updated_at')) parts.push('e.updated_at');
  if (has.has('exams.created_at')) parts.push('e.created_at');
  parts.push('COALESCE(er.updated_at, er.created_at)');

  return {
    examDateExpr: `COALESCE(${parts.join(', ')})`,
    requiresExamSubjectsJoinForDate: hasExamSubjectsExamDate,
  };
}

/**
 * Students: either one calendar day or all rows in attendance (all_time).
 * Staff (including teachers): staff_attendance for a single day, or all_time scope metadata only.
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
      const yearClause = hasYear ? 'AND a.academic_year_id = $1' : '';
      const r = await query(
        `SELECT
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) = 'present')::int AS present,
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) = 'absent')::int AS absent,
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) = 'late')::int AS late,
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) IN ('half-day', 'half_day'))::int AS half_day,
           COUNT(*)::int AS total_marked
         FROM student_attendance a
         INNER JOIN students st ON a.student_id = st.id
         WHERE (st.status = 'Active')
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
      const yearClause = hasYear ? 'AND a.academic_year_id = $2' : '';
      const r = await query(
        `SELECT
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) = 'present')::int AS present,
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) = 'absent')::int AS absent,
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) = 'late')::int AS late,
           COUNT(*) FILTER (WHERE LOWER(TRIM(a.status::text)) IN ('half-day', 'half_day'))::int AS half_day,
           COUNT(*)::int AS total_marked
         FROM student_attendance a
         INNER JOIN students st ON a.student_id = st.id
         WHERE a.attendance_date = $1::date
           AND (st.status = 'Active')
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
    const attended = students.present + students.late + (students.halfDay * 0.5);
    students.attendancePct = pctPart(attended, students.totalMarked);
  } catch (e) {
    console.warn('Dashboard: student attendance snapshot failed', e.message);
  }

  const staff = {
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    totalMarked: 0,
    attendancePct: 0,
    isProxy: false,
    dataSource: 'staff_attendance',
  };
  try {
    const params = [];
    let where = '';
    // Staff attendance is operationally date-based and may contain mixed/null academic_year_id.
    // Do not apply academic-year filtering here to avoid hiding valid staff rows.
    if (!isAllTime) {
      params.push(dateStr);
      where = 'WHERE sa.attendance_date = $1::date';
    }
    const marks = await query(
      `SELECT
         COUNT(*) FILTER (WHERE LOWER(TRIM(sa.status::text)) = 'present')::int AS present,
         COUNT(*) FILTER (WHERE LOWER(TRIM(sa.status::text)) = 'absent')::int AS absent,
         COUNT(*) FILTER (WHERE LOWER(TRIM(sa.status::text)) = 'late')::int AS late,
         COUNT(*) FILTER (WHERE LOWER(TRIM(sa.status::text)) IN ('half-day', 'half_day'))::int AS half_day,
         COUNT(*)::int AS total_marked
       FROM staff_attendance sa
       INNER JOIN staff s ON s.id = sa.staff_id
       INNER JOIN users u ON u.id = s.user_id
       ${where ? where + ' AND' : 'WHERE'} u.role_id NOT IN (2, 3, 4, 5)`,
      params
    );
    const row = marks.rows[0] || {};
    staff.present = parseInt(row.present, 10) || 0;
    staff.absent = parseInt(row.absent, 10) || 0;
    staff.late = parseInt(row.late, 10) || 0;
    staff.halfDay = parseInt(row.half_day, 10) || 0;
    staff.totalMarked = parseInt(row.total_marked, 10) || 0;
    staff.attendancePct = pctPart((staff.present + staff.late) + (staff.halfDay * 0.5), staff.totalMarked);
    staff.dataSource = isAllTime ? 'staff_attendance_all_time' : 'staff_attendance';
  } catch (e) {
    console.warn('Dashboard: staff attendance snapshot failed', e.message);
    staff.isProxy = true;
    staff.dataSource = 'leave_vs_active';
  }

  return {
    date: isAllTime ? null : dateStr,
    scope: isAllTime ? 'all_time' : 'day',
    students,
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
          COUNT(*) FILTER (WHERE st.status = 'Active')::int as active,
          COUNT(*) FILTER (WHERE st.status != 'Active')::int as inactive
        FROM students st
        LEFT JOIN LATERAL (
          SELECT l.to_academic_year_id
          FROM student_lifecycle_ledger l
          WHERE l.student_id = st.id
          ORDER BY l.event_date DESC NULLS LAST, l.id DESC
          LIMIT 1
        ) enr ON true
        WHERE enr.to_academic_year_id = $1
      `
          : `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'Active')::int as active,
          COUNT(*) FILTER (WHERE status != 'Active')::int as inactive
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

    // Teachers: total, active, inactive (school-wide headcount)
    try {
      const teachersCount = await query(`
        SELECT
          COUNT(DISTINCT s.id)::int as total,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'Active')::int as active,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status != 'Active')::int as inactive
        FROM staff s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL
          AND u.role_id = 2
      `);
      if (teachersCount.rows[0]) {
        stats.teachers.total = parseInt(teachersCount.rows[0].total, 10) || 0;
        stats.teachers.active = parseInt(teachersCount.rows[0].active, 10) || 0;
        stats.teachers.inactive = parseInt(teachersCount.rows[0].inactive, 10) || 0;
      }
    } catch (e) {
      console.warn('Dashboard: teachers count failed', e.message);
    }

    // Staff: total, active, inactive
    try {
      const staffCount = await query(`
        SELECT
          COUNT(DISTINCT s.id)::int as total,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'Active')::int as active,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status != 'Active')::int as inactive
        FROM staff s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL
          AND u.role_id NOT IN (2, 3, 4, 5)
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
      const leaveYear = hasYearFilter
        ? `AND EXISTS (SELECT 1 FROM academic_years ay WHERE ay.id = $1
             AND la.valid_period && daterange(ay.start_date, ay.end_date, '[]'))`
        : '';
      const leaveRes = await query(
        `SELECT la.id, u.first_name, u.last_name, lt.leave_type AS leave_type_name,
                COALESCE(la.updated_at, la.created_at) AS sort_date
         FROM leave_applications la
         INNER JOIN staff s ON s.id = la.applicant_staff_id
         INNER JOIN users u ON u.id = s.user_id
         LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
         WHERE (s.status = 'Active') ${leaveYear}
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
      const enrYear = hasYearFilter
        ? `AND EXISTS (
             SELECT 1 FROM student_lifecycle_ledger l
             WHERE l.student_id = st.id AND l.to_academic_year_id = $1
           )`
        : '';
      const enrRes = await query(
        `SELECT st.id, u.first_name, u.last_name, st.created_at
         FROM students st
         INNER JOIN users u ON u.id = st.user_id
         WHERE (st.status = 'Active') AND st.created_at >= CURRENT_TIMESTAMP - INTERVAL '120 days'
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
      const exYear = hasYearFilter ? 'AND esc.academic_year_id = $1' : '';
      const exRes = await query(
        `SELECT er.id, u.first_name, u.last_name, sub.subject_name, er.marks_obtained,
                COALESCE(er.updated_at, er.created_at) AS sort_date
         FROM exam_results er
         INNER JOIN exam_schedules esc ON esc.id = er.exam_schedule_id
         INNER JOIN class_subjects csj ON csj.id = esc.class_subject_id
           AND csj.class_id = esc.class_id AND csj.academic_year_id = esc.academic_year_id
         INNER JOIN subjects sub ON sub.id = csj.subject_id
         INNER JOIN students st ON er.student_id = st.id
         INNER JOIN users u ON u.id = st.user_id
         WHERE er.is_absent = false
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
          const staffId = await resolveTeacherStaffIdForUser(ctx.userId);
          if (staffId) {
            where = ` WHERE (cs.teacher_id = $${params.length + 1} OR cs.teacher = $${params.length + 1})`;
            params.push(staffId);
          }
        }

        // Student scope: only their class/section schedules.
        if (!where && (ctx.roleName === 'student')) {
          const scope = await resolveStudentScopeForUser(ctx.userId);
          if (scope?.classId) {
            where = ` WHERE cs.class_id = $${params.length + 1}`;
            params.push(scope.classId);
            if (scope.sectionId) {
              where += ` AND (csec.section_id = $${params.length + 1} OR cs.class_section_id IS NULL)`;
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
               WHERE id = ANY($1) AND status = 'Active' `,
              [wardIds]
            );
            const classIds = [...new Set(wardRows.rows.map((r) => parseId(r.class_id)).filter(Boolean))];
            const sectionIds = [...new Set(wardRows.rows.map((r) => parseId(r.section_id)).filter(Boolean))];
            if (classIds.length > 0) {
              where = ` WHERE cs.class_id = ANY($${params.length + 1})`;
              params.push(classIds);
              if (sectionIds.length > 0) {
                where += ` AND (cs.class_section_id IS NULL OR csec.section_id = ANY($${params.length + 1}))`;
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

      const finalWhere = hasYearFilter
        ? (where ? `${where} AND cs.academic_year_id = $${params.length + 1}` : ` WHERE cs.academic_year_id = $1`)
        : (where || '');
      const finalParams = hasYearFilter ? [...params, academicYearId, limit] : [...params, limit];
      const limitParam = hasYearFilter ? params.length + 2 : params.length + 1;

      const r = await query(
        `SELECT cs.id, cs.class_id, csec.section_id, cs.class_subject_id AS subject_id, cs.teacher_id, cs.class_room_id, cs.day_of_week
         FROM class_schedules cs
         LEFT JOIN class_sections csec ON csec.id = cs.class_section_id
         ${finalWhere}
         ORDER BY cs.id DESC LIMIT $${limitParam}`,
        finalParams
      );
      rows = r.rows;
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
      const r = await query(
        `SELECT s.id AS id, s.id AS staff_id, u.first_name, u.last_name, s.photo_url
         FROM staff s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = ANY($1)`,
        [teacherIds]
      );
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

// Teachers ranked by timetable coverage (canonical schema: staff + class_schedules)
const getBestPerformers = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 10);
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    const fbParams = hasYearFilter ? [limit, academicYearId] : [limit];
    const fb = await query(
      `SELECT s.id, u.first_name, u.last_name, s.photo_url, NULL::text AS subject_name,
              COUNT(cs.id)::int AS schedule_count
       FROM staff s
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN class_schedules cs ON cs.teacher_id = s.id
         ${hasYearFilter ? 'AND cs.academic_year_id = $2' : ''}
       WHERE s.deleted_at IS NULL AND s.is_active = true
       GROUP BY s.id, u.first_name, u.last_name, s.photo_url
       ORDER BY schedule_count DESC NULLS LAST, u.first_name ASC, u.last_name ASC
       LIMIT $1`,
      fbParams
    );
    const rows = fb.rows.map((r) => ({ ...r, metric_avg: null }));

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
    const requestedLimit = parseInt(req.query.limit, 10) || 3;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;
    const classNameFilter = parseTextQueryParam(req, 'class_name');
    const sectionNameFilter = parseTextQueryParam(req, 'section_name');
    const timeRange = parseStarStudentsTimeRange(req);
    const [{ totalMarksExpr, joinExamSubjectsSql }, { examDateExpr, requiresExamSubjectsJoinForDate }, schema] =
      await Promise.all([
        buildExamResultTotalMarksSpec(),
        buildExamResultExamDateSpec(),
        getExamSchemaFlags(),
      ]);
    const joinExamSubjectsDateSql = requiresExamSubjectsJoinForDate
      ? 'LEFT JOIN exam_subjects es ON es.id = er.exam_subject_id'
      : '';
    const joinExamSubjectsForScoredSql =
      joinExamSubjectsSql || joinExamSubjectsDateSql;
    const ctx = getAuthContext(req);
    if (!ctx.userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const isTeacherUser = ctx.roleName === 'teacher' || ctx.roleId === ROLES.TEACHER;
    let teacherStaffId = null;
    if (isTeacherUser) {
      teacherStaffId = await resolveTeacherStaffIdForUser(ctx.userId);
      if (!teacherStaffId) {
        return res.status(200).json({
          status: 'SUCCESS',
          message: 'Star students fetched successfully',
          data: [],
        });
      }
    }

    const baseParams = [];
    let p = 1;
    let examYearClause = '';
    if (hasYearFilter) {
      examYearClause = ` AND (e.academic_year_id = $${p} OR esc.academic_year_id = $${p})`;
      baseParams.push(academicYearId);
      p += 1;
    }
    let teacherScopeCte = '';
    let teacherScopeWhere = '';
    if (isTeacherUser) {
      teacherScopeCte = `teacher_scope AS (
        SELECT DISTINCT cs.class_id, csec.section_id
        FROM class_schedules cs
        INNER JOIN class_sections csec ON csec.id = cs.class_section_id
          AND csec.class_id = cs.class_id AND csec.academic_year_id = cs.academic_year_id
        WHERE cs.teacher_id = $${p}
          ${hasYearFilter ? `AND cs.academic_year_id = $${p + 1}` : ''}
        UNION
        SELECT DISTINCT ct.class_id, csec2.section_id
        FROM class_teachers ct
        INNER JOIN class_sections csec2 ON csec2.id = ct.class_section_id
        WHERE ct.staff_id = $${p}
          AND ct.deleted_at IS NULL
          ${hasYearFilter ? `AND ct.academic_year_id = $${p + 1}` : ''}
      ),`;
      baseParams.push(teacherStaffId);
      if (hasYearFilter) {
        baseParams.push(academicYearId);
      }
      p += hasYearFilter ? 2 : 1;
      teacherScopeWhere = ` AND EXISTS (
        SELECT 1
        FROM teacher_scope ts
        WHERE ts.class_id = enr.class_id
          AND (ts.section_id IS NULL OR ts.section_id = enr.section_id)
      )`;
    }

    const extraFilters = [];
    const extraParams = [];
    let dateFilterSql = '';
    // Some deployments have older `exams` schema without start_date/end_date.
    // Use exam_results timestamps for filtering/sorting to stay compatible.
    if (timeRange === 'this_month') {
      dateFilterSql = `AND COALESCE(er.updated_at, er.created_at) >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (timeRange === 'this_year') {
      dateFilterSql = `AND COALESCE(er.updated_at, er.created_at) >= DATE_TRUNC('year', CURRENT_DATE)`;
    } else if (timeRange === 'last_week') {
      dateFilterSql = `AND COALESCE(er.updated_at, er.created_at) >= CURRENT_DATE - INTERVAL '7 days'`;
    }
    if (classNameFilter) {
      extraFilters.push(`AND LOWER(TRIM(c.class_name)) = LOWER(TRIM($${p + extraParams.length}))`);
      extraParams.push(classNameFilter);
    }
    if (sectionNameFilter) {
      extraFilters.push(`AND LOWER(TRIM(sec.section_name)) = LOWER(TRIM($${p + extraParams.length}))`);
      extraParams.push(sectionNameFilter);
    }
    const classSectionFilterSql = extraFilters.join('\n            ');

    const useLedgerEnrollment = schema.hasStudentLifecycleLedger;
    const scheduleBackedStar =
      schema.examResultsHasExamScheduleIdColumn &&
      !schema.examResultsHasSubjectIdColumn &&
      schema.hasExamSchedulesTable &&
      (useLedgerEnrollment || schema.studentsHasLegacyClassColumns);

    const legacySubjectsStar =
      !scheduleBackedStar &&
      schema.hasExamSubjectsTable &&
      schema.examResultsHasExamIdColumn &&
      schema.examResultsHasSubjectIdColumn &&
      (useLedgerEnrollment || schema.studentsHasLegacyClassColumns);

    const teacherScopeWhereStar = isTeacherUser
      ? useLedgerEnrollment
        ? ` AND EXISTS (
        SELECT 1
        FROM teacher_scope ts
        WHERE ts.class_id = enr.class_id
          AND (ts.section_id IS NULL OR ts.section_id = enr.section_id)
      )`
        : ` AND EXISTS (
        SELECT 1
        FROM teacher_scope ts
        WHERE ts.class_id = st.class_id
          AND (ts.section_id IS NULL OR ts.section_id = st.section_id)
      )`
      : '';

    const latestExamResult = await query(
      `WITH ${teacherScopeCte}
        latest_exam AS (
          SELECT
            esc.exam_id,
            COALESCE(MAX(e.exam_name), 'Exam') AS exam_name,
            MAX(${examDateExpr}) AS sort_date
          FROM exam_results er
          INNER JOIN exam_schedules esc ON esc.id = er.exam_schedule_id
          INNER JOIN students st ON st.id = er.student_id
          INNER JOIN users u ON u.id = st.user_id
          LEFT JOIN LATERAL (
            SELECT l.to_class_id AS class_id, l.to_section_id AS section_id
            FROM student_lifecycle_ledger l
            WHERE l.student_id = st.id
            ORDER BY l.event_date DESC NULLS LAST, l.id DESC
            LIMIT 1
          ) enr ON true
          LEFT JOIN classes c ON c.id = enr.class_id
          LEFT JOIN sections sec ON sec.id = enr.section_id
          LEFT JOIN exams e ON e.id = esc.exam_id
          ${joinExamSubjectsDateSql}
          WHERE st.status = 'Active'
            AND esc.exam_id IS NOT NULL
            AND er.is_absent = false
            ${examYearClause}
            ${dateFilterSql}
            ${teacherScopeWhere}
            ${classSectionFilterSql}
          GROUP BY esc.exam_id
        )
       SELECT exam_id, exam_name, sort_date
       FROM latest_exam
       ORDER BY sort_date DESC NULLS LAST, exam_id DESC
       LIMIT 1`,
      [...baseParams, ...extraParams]
    );

    const latestExam = latestExamResult.rows[0];
    if (!latestExam?.exam_id) {
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Star students fetched successfully',
        data: [],
      });
    }

    const topParams = [...baseParams, ...extraParams, latestExam.exam_id, limit];
    const topExamIdParam = p + extraParams.length;
    const topLimitParam = p + extraParams.length + 1;
    const yearFilterForTopExam = hasYearFilter
      ? ` AND EXISTS (SELECT 1 FROM exams exyf WHERE exyf.id = $${topExamIdParam} AND exyf.academic_year_id = $1)`
      : '';

    const rosterJoinSchedulePlan = useLedgerEnrollment
      ? `${lateralCurrentEnrollment('st.id')}
         INNER JOIN subject_plan sp
           ON sp.class_id::integer = enr.class_id::integer
          AND sp.section_id::integer = enr.section_id::integer`
      : `INNER JOIN subject_plan sp
           ON sp.class_id::integer = st.class_id::integer
          AND sp.section_id::integer = st.section_id::integer`;

    const rosterJoinLegacySubjects = useLedgerEnrollment
      ? `${lateralCurrentEnrollment('st.id')}
         INNER JOIN subject_plan sp
           ON sp.class_id::text = enr.class_id::text
          AND sp.section_id::text = enr.section_id::text`
      : `INNER JOIN subject_plan sp
           ON sp.class_id::text = st.class_id::text
          AND sp.section_id::text = st.section_id::text`;

    const enrolClassSql = useLedgerEnrollment ? 'enr.class_id' : 'st.class_id';
    const enrolSectionSql = useLedgerEnrollment ? 'enr.section_id' : 'st.section_id';
    const enrolNotNullSql = useLedgerEnrollment
      ? 'enr.class_id IS NOT NULL AND enr.section_id IS NOT NULL'
      : 'st.class_id IS NOT NULL AND st.section_id IS NOT NULL';

    const scoredOuterSelect = `
       SELECT
         id,
         first_name,
         last_name,
         photo_url,
         class_name,
         section_name,
         marks_obtained,
         total_marks,
         ROUND(
           CASE
             WHEN total_marks > 0 THEN (marks_obtained / total_marks) * 100
             ELSE 0
           END::numeric,
           1
         ) AS percentage,
         exam_name,
         exam_date
       FROM scored
       ORDER BY percentage DESC NULLS LAST, marks_obtained DESC NULLS LAST, first_name ASC, last_name ASC
       LIMIT $${topLimitParam}`;

    let rowsResult;
    if (scheduleBackedStar) {
      rowsResult = await query(
        `WITH ${teacherScopeCte}
         subject_plan AS (
           SELECT esch.class_id,
                  csec.section_id,
                  esch.id AS exam_schedule_id,
                  COALESCE(esch.max_marks, 100)::numeric AS max_marks
           FROM exam_schedules esch
           INNER JOIN class_sections csec
             ON csec.id = esch.class_section_id
            AND csec.class_id = esch.class_id
            AND csec.academic_year_id = esch.academic_year_id
           WHERE esch.exam_id = $${topExamIdParam}
         ),
         scored AS (
           SELECT
             st.id,
             u.first_name,
             u.last_name,
             u.avatar AS photo_url,
             c.class_name,
             sec.section_name,
             COALESCE(SUM(
               CASE WHEN COALESCE(er.is_absent, false) THEN 0::numeric
               ELSE COALESCE(er.marks_obtained, 0)::numeric END
             ), 0) AS marks_obtained,
             COALESCE(SUM(sp.max_marks), 0)::numeric AS total_marks,
             COALESCE(MAX(e.exam_name), 'Exam') AS exam_name,
             MAX(${examDateExpr}) AS exam_date
           FROM students st
           INNER JOIN users u ON u.id = st.user_id
           ${rosterJoinSchedulePlan}
           LEFT JOIN classes c ON c.id = ${enrolClassSql}
           LEFT JOIN sections sec ON sec.id = ${enrolSectionSql}
           LEFT JOIN exam_results er
             ON er.exam_schedule_id = sp.exam_schedule_id
            AND er.student_id = st.id
           LEFT JOIN exam_schedules esc ON esc.id = sp.exam_schedule_id
           LEFT JOIN exams e ON e.id = esc.exam_id
           ${joinExamSubjectsForScoredSql}
           WHERE st.status = 'Active'
             AND ${enrolNotNullSql}
             AND EXISTS (
               SELECT 1 FROM exam_results erx
               INNER JOIN exam_schedules esx ON esx.id = erx.exam_schedule_id
               WHERE erx.student_id = st.id
                 AND esx.exam_id = $${topExamIdParam}
                 AND COALESCE(erx.is_absent, false) = false
             )
             ${examYearClause}
             ${teacherScopeWhereStar}
             ${classSectionFilterSql}
           GROUP BY
             st.id, u.first_name, u.last_name, u.avatar,
             c.class_name, sec.section_name
         )
         ${scoredOuterSelect}`,
        topParams
      );
    } else if (legacySubjectsStar) {
      rowsResult = await query(
        `WITH ${teacherScopeCte}
         subject_plan AS (
           SELECT es.class_id, es.section_id, es.subject_id,
                  COALESCE(es.max_marks, 100)::numeric AS max_marks
           FROM exam_subjects es
           WHERE es.exam_id = $${topExamIdParam}
         ),
         scored AS (
           SELECT
             st.id,
             u.first_name,
             u.last_name,
             u.avatar AS photo_url,
             c.class_name,
             sec.section_name,
             COALESCE(SUM(
               CASE WHEN COALESCE(er.is_absent, false) THEN 0::numeric
               ELSE COALESCE(er.marks_obtained, 0)::numeric END
             ), 0) AS marks_obtained,
             COALESCE(SUM(sp.max_marks), 0)::numeric AS total_marks,
             COALESCE(MAX(e.exam_name), 'Exam') AS exam_name,
             MAX(${examDateExpr}) AS exam_date
           FROM students st
           INNER JOIN users u ON u.id = st.user_id
           ${rosterJoinLegacySubjects}
           LEFT JOIN classes c ON c.id = ${enrolClassSql}
           LEFT JOIN sections sec ON sec.id = ${enrolSectionSql}
           LEFT JOIN exam_results er
             ON er.exam_id = $${topExamIdParam}
            AND er.student_id = st.id
            AND er.subject_id = sp.subject_id
           LEFT JOIN exam_schedules esc ON esc.id = er.exam_schedule_id
           LEFT JOIN exams e ON e.id = $${topExamIdParam}
           ${joinExamSubjectsForScoredSql}
           WHERE st.status = 'Active'
             AND ${enrolNotNullSql}
             AND EXISTS (
               SELECT 1 FROM exam_results erx
               WHERE erx.exam_id = $${topExamIdParam}
                 AND erx.student_id = st.id
                 AND COALESCE(erx.is_absent, false) = false
             )
             ${yearFilterForTopExam}
             ${teacherScopeWhereStar}
             ${classSectionFilterSql}
           GROUP BY
             st.id, u.first_name, u.last_name, u.avatar,
             c.class_name, sec.section_name
         )
         ${scoredOuterSelect}`,
        topParams
      );
    } else {
      rowsResult = await query(
      `WITH ${teacherScopeCte}
       scored AS (
         SELECT
           st.id,
           u.first_name,
           u.last_name,
           u.avatar AS photo_url,
           c.class_name,
           sec.section_name,
           SUM(er.marks_obtained::numeric) AS marks_obtained,
           SUM(${totalMarksExpr}) AS total_marks,
           COALESCE(MAX(e.exam_name), 'Exam') AS exam_name,
          MAX(${examDateExpr}) AS exam_date
         FROM exam_results er
         INNER JOIN exam_schedules esc ON esc.id = er.exam_schedule_id
         INNER JOIN students st ON st.id = er.student_id
         INNER JOIN users u ON u.id = st.user_id
         LEFT JOIN LATERAL (
           SELECT l.to_class_id AS class_id, l.to_section_id AS section_id
           FROM student_lifecycle_ledger l
           WHERE l.student_id = st.id
           ORDER BY l.event_date DESC NULLS LAST, l.id DESC
           LIMIT 1
         ) enr ON true
         LEFT JOIN classes c ON c.id = enr.class_id
         LEFT JOIN sections sec ON sec.id = enr.section_id
        LEFT JOIN exams e ON e.id = esc.exam_id
        ${joinExamSubjectsForScoredSql}
         WHERE st.status = 'Active'
           AND esc.exam_id = $${topExamIdParam}
           AND er.is_absent = false
           ${examYearClause}
           ${dateFilterSql}
           ${teacherScopeWhere}
           ${classSectionFilterSql}
         GROUP BY
           st.id, u.first_name, u.last_name, u.avatar,
           c.class_name, sec.section_name
       )
       SELECT
         id,
         first_name,
         last_name,
         photo_url,
         class_name,
         section_name,
         marks_obtained,
         total_marks,
         ROUND(
           CASE
             WHEN total_marks > 0 THEN (marks_obtained / total_marks) * 100
             ELSE 0
           END::numeric,
           1
         ) AS percentage,
         exam_name,
         exam_date
       FROM scored
       ORDER BY percentage DESC NULLS LAST, marks_obtained DESC NULLS LAST, first_name ASC, last_name ASC
       LIMIT $${topLimitParam}`,
      topParams
    );
    }

    const data = rowsResult.rows.map((r) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'N/A',
      classSection: [r.class_name, r.section_name].filter(Boolean).join(', ') || 'N/A',
      photoUrl: r.photo_url || null,
      avgMarks: r.marks_obtained != null ? parseFloat(String(r.marks_obtained), 10) : null,
      marksObtained: r.marks_obtained != null ? parseFloat(String(r.marks_obtained), 10) : null,
      totalMarks: r.total_marks != null ? parseFloat(String(r.total_marks), 10) : null,
      percentage: r.percentage != null ? parseFloat(String(r.percentage), 10) : null,
      examId: latestExam.exam_id,
      examName: r.exam_name || latestExam.exam_name || 'Exam',
      examDate: r.exam_date || latestExam.sort_date || null,
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
        extra += ` AND enr.to_academic_year_id = $${p++}`;
        params.push(academicYearId);
      }
      if (hasClassFilter) {
        extra += ` AND enr.to_class_id = $${p++}`;
        params.push(classId);
      }
      const agg = await query(
        `WITH scored AS (
           SELECT st.id AS student_id,
             AVG(
               (er.marks_obtained::numeric / NULLIF(esc.max_marks, 0)::numeric) * 100
             ) AS avg_score_pct
           FROM students st
           INNER JOIN exam_results er ON er.student_id = st.id
             AND er.is_absent = false
           INNER JOIN exam_schedules esc ON esc.id = er.exam_schedule_id
           LEFT JOIN exams e ON e.id = esc.exam_id AND COALESCE(e.is_active, true) = true
           LEFT JOIN LATERAL (
             SELECT l.to_class_id, l.to_academic_year_id
             FROM student_lifecycle_ledger l
             WHERE l.student_id = st.id
             ORDER BY l.event_date DESC NULLS LAST, l.id DESC
             LIMIT 1
           ) enr ON true
           WHERE st.status = 'Active'
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
        extra += ` AND esc.academic_year_id = $${p++}`;
        params.push(academicYearId);
      }
      if (hasClassFilter) {
        extra += ` AND enr.class_id = $${p++}`;
        params.push(classId);
      }
      const sql = `SELECT sub.id, sub.subject_name, sub.subject_code,
                  ROUND(AVG(er.marks_obtained)::numeric, 1) AS avg_marks
           FROM exam_results er
           INNER JOIN exam_schedules esc ON esc.id = er.exam_schedule_id
           INNER JOIN class_subjects csj ON csj.id = esc.class_subject_id
             AND csj.class_id = esc.class_id AND csj.academic_year_id = esc.academic_year_id
           INNER JOIN subjects sub ON sub.id = csj.subject_id
           INNER JOIN students st ON er.student_id = st.id
           LEFT JOIN LATERAL (
             SELECT l.to_class_id AS class_id, l.to_academic_year_id AS academic_year_id
             FROM student_lifecycle_ledger l
             WHERE l.student_id = st.id
             ORDER BY l.event_date DESC NULLS LAST, l.id DESC
             LIMIT 1
           ) enr ON true
           WHERE sub.deleted_at IS NULL
             AND er.is_absent = false
             AND st.status = 'Active'
             AND (csj.deleted_at IS NULL)
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
             INNER JOIN class_subjects cs ON cs.subject_id = sub.id
               AND cs.academic_year_id = $1 AND cs.class_id = $2 AND cs.deleted_at IS NULL
             WHERE sub.deleted_at IS NULL
             ORDER BY sub.subject_name ASC
             LIMIT 10`,
          [academicYearId, classId]
        );
      } else if (hasYearFilter) {
        fb = await query(
          `SELECT DISTINCT sub.id, sub.subject_name, sub.subject_code, NULL::numeric AS avg_marks
             FROM subjects sub
             INNER JOIN class_subjects cs ON cs.subject_id = sub.id
               AND cs.academic_year_id = $1 AND cs.deleted_at IS NULL
             WHERE sub.deleted_at IS NULL
             ORDER BY sub.subject_name ASC
             LIMIT 10`,
          [academicYearId]
        );
      } else if (hasClassFilter) {
        fb = await query(
          `SELECT DISTINCT sub.id, sub.subject_name, sub.subject_code, NULL::numeric AS avg_marks
             FROM subjects sub
             INNER JOIN class_subjects cs ON cs.subject_id = sub.id
               AND cs.class_id = $1 AND cs.deleted_at IS NULL
             WHERE sub.deleted_at IS NULL
             ORDER BY sub.subject_name ASC
             LIMIT 10`,
          [classId]
        );
      } else {
        fb = await query(
          `SELECT id, subject_name, subject_code, NULL::numeric AS avg_marks
             FROM subjects
             WHERE deleted_at IS NULL
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
      `SELECT id, title, content, created_at, updated_at
       FROM notice_board
       WHERE deleted_at IS NULL
       ORDER BY COALESCE(updated_at, created_at) DESC
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

// Fee stats for dashboard (fees_paids ledger)
const getDashboardFeeStats = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    let effectiveAcademicYearId = academicYearId;
    let hasYearFilter = effectiveAcademicYearId != null;
    const feeWin = parseFeeDateWindow(req);

    if (hasYearFilter) {
      try {
        const yrPresence = await query(
          `SELECT
             EXISTS(SELECT 1 FROM fees WHERE academic_year_id = $1) AS has_assign,
             EXISTS(SELECT 1 FROM fees_paids WHERE academic_year_id = $1) AS has_collect`,
          [effectiveAcademicYearId]
        );
        const hasAssign = Boolean(yrPresence.rows?.[0]?.has_assign);
        const hasCollect = Boolean(yrPresence.rows?.[0]?.has_collect);
        if (!hasAssign && !hasCollect) {
          effectiveAcademicYearId = null;
          hasYearFilter = false;
        }
      } catch (e) {
        console.warn('Dashboard: year fallback probe failed', e.message);
      }
    }

    let totalFeesCollected = 0;
    let fineCollected = 0;
    let studentNotPaid = 0;
    let totalOutstanding = 0;
    let totalAssignedAmount = 0;
    let studentsWithAssignments = 0;
    let studentsWithAnyPayment = 0;

    try {
      const earnParams = hasYearFilter ? [effectiveAcademicYearId] : [];
      let earnSql = hasYearFilter
        ? `SELECT COALESCE(SUM(fp.total_paid::numeric), 0) AS total
             FROM fees_paids fp
             WHERE fp.academic_year_id = $1`
        : `SELECT COALESCE(SUM(fp.total_paid::numeric), 0) AS total
            FROM fees_paids fp`;
      if (feeWin.from && feeWin.to) {
        const a = earnParams.length + 1;
        const b = earnParams.length + 2;
        earnSql += ` AND fp.updated_at >= $${a}::timestamptz AND fp.updated_at <= $${b}::timestamptz + interval '1 day'`;
        earnParams.push(feeWin.from, feeWin.to);
      }
      const collectedResult = await query(earnSql, earnParams);
      totalFeesCollected = parseFloat(collectedResult.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: fees_paids sum failed', e.message);
    }

    try {
      const fineRes = await query(`
        SELECT COALESCE(SUM(fine_amount::numeric), 0) AS total
        FROM library_book_issues
        WHERE deleted_at IS NULL
          AND COALESCE(fine_amount, 0) > 0
          AND LOWER(TRIM(COALESCE(status, ''))) = 'returned'
      `);
      fineCollected = parseFloat(fineRes.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: library fines sum failed', e.message);
    }

    try {
      const outstandingParams = hasYearFilter ? [effectiveAcademicYearId] : [];
      const outstandingResult = await query(
        `SELECT
          COUNT(*) FILTER (WHERE fp.balance_amount > 0)::int AS student_not_paid,
          COALESCE(SUM(fp.balance_amount) FILTER (WHERE fp.balance_amount > 0), 0)::numeric AS total_outstanding
        FROM fees_paids fp
        INNER JOIN students s ON s.id = fp.student_id AND COALESCE(s.is_active, true) = true
        WHERE (${hasYearFilter ? 'fp.academic_year_id = $1' : 'TRUE'})
      `,
        outstandingParams
      );
      const row = outstandingResult.rows[0];
      studentNotPaid = parseInt(row?.student_not_paid || '0', 10) || 0;
      totalOutstanding = parseFloat(row?.total_outstanding || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: fee outstanding calc failed', e.message);
    }

    try {
      const detailParams = hasYearFilter ? [effectiveAcademicYearId] : [];
      const detailResult = await query(
        `SELECT
          COALESCE(SUM(fp.total_payable), 0)::numeric AS total_assigned_amount,
          COUNT(*)::int AS students_with_assignments,
          COUNT(*) FILTER (WHERE fp.total_paid > 0)::int AS students_with_any_payment
        FROM fees_paids fp
        INNER JOIN students s ON s.id = fp.student_id AND COALESCE(s.is_active, true) = true
        WHERE (${hasYearFilter ? 'fp.academic_year_id = $1' : 'TRUE'})`,
        detailParams
      );
      const row = detailResult.rows[0];
      totalAssignedAmount = parseFloat(row?.total_assigned_amount || '0') || 0;
      studentsWithAssignments = parseInt(row?.students_with_assignments || '0', 10) || 0;
      studentsWithAnyPayment = parseInt(row?.students_with_any_payment || '0', 10) || 0;
    } catch (e) {
      console.warn('Dashboard: fee details summary failed', e.message);
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Fee stats fetched successfully',
      data: {
        totalFeesCollected,
        fineCollected,
        studentNotPaid,
        totalOutstanding,
        totalAssignedAmount,
        studentsWithAssignments,
        studentsWithAnyPayment,
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
    let effectiveAcademicYearId = academicYearId;
    let hasYearFilter = effectiveAcademicYearId != null;
    const feeWin = parseFeeDateWindow(req);

    if (hasYearFilter) {
      try {
        const yrPresence = await query(
          `SELECT
             EXISTS(SELECT 1 FROM fees WHERE academic_year_id = $1) AS has_assign,
             EXISTS(SELECT 1 FROM fees_paids WHERE academic_year_id = $1) AS has_collect`,
          [effectiveAcademicYearId]
        );
        const hasAssign = Boolean(yrPresence.rows?.[0]?.has_assign);
        const hasCollect = Boolean(yrPresence.rows?.[0]?.has_collect);
        if (!hasAssign && !hasCollect) {
          effectiveAcademicYearId = null;
          hasYearFilter = false;
        }
      } catch (e) {
        console.warn('Dashboard: finance year fallback probe failed', e.message);
      }
    }

    let totalEarnings = 0;
    let totalFines = 0;
    let totalExpenses = 0;
    let expensesTracked = false;

    try {
      const earnParams = hasYearFilter ? [effectiveAcademicYearId] : [];
      let earnSql = hasYearFilter
        ? `SELECT COALESCE(SUM(fp.total_paid::numeric), 0) AS total
             FROM fees_paids fp
             WHERE fp.academic_year_id = $1`
        : `SELECT COALESCE(SUM(fp.total_paid::numeric), 0) AS total
            FROM fees_paids fp`;
      if (feeWin.from && feeWin.to) {
        const a = earnParams.length + 1;
        const b = earnParams.length + 2;
        earnSql += ` AND fp.updated_at >= $${a}::timestamptz AND fp.updated_at <= $${b}::timestamptz + interval '1 day'`;
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
        WHERE deleted_at IS NULL
          AND COALESCE(fine_amount, 0) > 0
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
      ? ` AND EXISTS (
          SELECT 1 FROM academic_years ay
          WHERE ay.id = $1
            AND la.valid_period && daterange(ay.start_date, ay.end_date, '[]')
        )`
      : '';
    const params = hasYearFilter ? [academicYearId] : [];

    const result = await query(
      `SELECT la.id,
             lower(la.valid_period)::date AS start_date,
             (CASE WHEN upper_inf(la.valid_period) THEN lower(la.valid_period)::date
              ELSE (upper(la.valid_period)::date - interval '1 day')::date END) AS end_date,
             COALESCE(la.updated_at, la.created_at) AS applied_at,
             la.created_at,
             lt.leave_type AS leave_type_name,
             TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS applicant_name,
             NULL::text AS class_name,
             NULL::text AS section_name
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
      INNER JOIN staff s ON la.applicant_staff_id = s.id
      INNER JOIN users u ON u.id = s.user_id
      WHERE 1=1${yearFilter}
      ORDER BY COALESCE(la.updated_at, la.created_at) DESC NULLS LAST
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
