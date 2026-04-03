const { query } = require('../config/database');
const { getAuthContext, isAdmin, resolveTeacherIdForUser, resolveStudentScopeForUser, resolveWardStudentIdsForUser, parseId } = require('../utils/accessControl');

// Parse academic_year_id from query (optional - when set, filter year-specific data)
function parseAcademicYearId(req) {
  const val = req.query?.academic_year_id;
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
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

    // Teachers: shared across years - always show full count (not filtered by academic year)
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

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Dashboard stats fetched successfully',
      data: stats,
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
        if (ctx.roleName === 'teacher' || ctx.roleId === 3) {
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

// Best performers (teachers) and star students for dashboard
const getBestPerformers = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 10);
    const result = await query(
      `SELECT t.id, t.subject_id, s.first_name, s.last_name, s.photo_url,
              sub.subject_name
       FROM teachers t
       INNER JOIN staff s ON t.staff_id = s.id
       LEFT JOIN subjects sub ON t.subject_id = sub.id
       WHERE t.status = 'Active' AND s.is_active = true
       ORDER BY s.first_name ASC, s.last_name ASC
       LIMIT $1`,
      [limit]
    );
    const data = result.rows.map((r) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'N/A',
      subject: r.subject_name || 'Teacher',
      photoUrl: r.photo_url || null,
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

    const result = await query(
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
    const data = result.rows.map((r) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'N/A',
      classSection: [r.class_name, r.section_name].filter(Boolean).join(', ') || 'N/A',
      photoUrl: r.photo_url || null,
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

// Performance summary from class_syllabus (Good/Average/Below Average by syllabus count per class)
const getPerformanceSummary = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    const result = await query(
      hasYearFilter
        ? `SELECT class_id, class_name, COUNT(*) AS syllabus_count
           FROM class_syllabus
           WHERE status = 'Active' AND academic_year_id = $1
           GROUP BY class_id, class_name`
        : `SELECT class_id, class_name, COUNT(*) AS syllabus_count
           FROM class_syllabus
           WHERE status = 'Active'
           GROUP BY class_id, class_name`,
      hasYearFilter ? [academicYearId] : []
    );
    const rows = result.rows;
    let good = 0;
    let average = 0;
    let below = 0;
    const maxCount = rows.length > 0 ? Math.max(...rows.map((r) => parseInt(r.syllabus_count, 10) || 0)) : 0;
    const minCount = rows.length > 0 ? Math.min(...rows.map((r) => parseInt(r.syllabus_count, 10) || 0)) : 0;
    rows.forEach((r) => {
      const c = parseInt(r.syllabus_count, 10) || 0;
      if (maxCount > 0 && c >= maxCount * 0.7) good += 1;
      else if (c > 0) average += 1;
      else below += 1;
    });
    if (rows.length === 0) {
      const classCount = hasYearFilter
        ? await query('SELECT COUNT(*)::int AS cnt FROM classes WHERE academic_year_id = $1', [academicYearId])
        : await query('SELECT COUNT(*)::int AS cnt FROM classes');
      const total = parseInt(classCount.rows[0]?.cnt, 10) || 0;
      if (total > 0) {
        below = total;
      }
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Performance summary fetched successfully',
      data: { good, average, below, series: [good, average, below] },
    });
  } catch (error) {
    console.error('Error fetching performance summary:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch performance summary',
    });
  }
};

// Top subjects (from subjects table - active subjects; when year filter, only subjects in that year's syllabus)
const getTopSubjects = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    const result = await query(
      hasYearFilter
        ? `SELECT DISTINCT sub.id, sub.subject_name, sub.subject_code
           FROM subjects sub
           INNER JOIN class_schedules cs ON cs.subject_id = sub.id
           INNER JOIN classes c ON cs.class_id = c.id
           WHERE sub.is_active = true AND c.academic_year_id = $1
           ORDER BY sub.subject_name ASC
           LIMIT 10`
        : `SELECT id, subject_name, subject_code
           FROM subjects
           WHERE is_active = true
           ORDER BY subject_name ASC
           LIMIT 10`,
      hasYearFilter ? [academicYearId] : []
    );
    const data = result.rows.map((r) => ({
      id: r.id,
      name: r.subject_name || r.subject_code || 'N/A',
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Top subjects fetched successfully',
      data,
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

    let totalFeesCollected = 0;
    let fineCollected = 0;
    let studentNotPaid = 0;
    let totalOutstanding = 0;

    try {
      const collectedResult = hasYearFilter
        ? await query(
            `SELECT COALESCE(SUM(fc.amount_paid::numeric), 0) AS total
             FROM fee_collections fc
             INNER JOIN students s ON fc.student_id = s.id
             WHERE fc.is_active = true AND s.academic_year_id = $1`,
            [academicYearId]
          )
        : await query(`
            SELECT COALESCE(SUM(amount_paid::numeric), 0) AS total
            FROM fee_collections
            WHERE is_active = true
          `);
      totalFeesCollected = parseFloat(collectedResult.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: fee_collections sum failed', e.message);
    }

    // fine_collected: no column in fee_collections - show 0
    fineCollected = 0;

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

// Finance summary: Total Earnings (from fees), Total Expenses (0 - no expense table)
const getDashboardFinanceSummary = async (req, res) => {
  try {
    const academicYearId = parseAcademicYearId(req);
    const hasYearFilter = academicYearId != null;

    let totalEarnings = 0;
    let totalExpenses = 0;

    try {
      const earningsResult = hasYearFilter
        ? await query(
            `SELECT COALESCE(SUM(fc.amount_paid::numeric), 0) AS total
             FROM fee_collections fc
             INNER JOIN students s ON fc.student_id = s.id
             WHERE fc.is_active = true AND s.academic_year_id = $1`,
            [academicYearId]
          )
        : await query(`
            SELECT COALESCE(SUM(amount_paid::numeric), 0) AS total
            FROM fee_collections
            WHERE is_active = true
          `);
      totalEarnings = parseFloat(earningsResult.rows[0]?.total || '0') || 0;
    } catch (e) {
      console.warn('Dashboard: total earnings (fees) failed', e.message);
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Finance summary fetched successfully',
      data: {
        totalEarnings,
        totalExpenses,
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
