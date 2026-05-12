const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const {
  getAuthContext,
  isAdmin,
  isParentOrGuardianPortalRole,
  resolveTeacherStaffIdForUser,
  resolveTeacherIdForUser,
  resolveStudentScopeForUser,
  resolveWardStudentIdsForUser,
  canAccessClass,
  parseId,
} = require('../utils/accessControl');
const { ROLES } = require('../config/roles');
const { lateralCurrentEnrollment } = require('../utils/studentEnrollmentSql');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_TO_INT = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
};
const ISO_DAY_NAMES = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

function timetableExclusionUserMessage(pgErr) {
  const constraint = String(pgErr?.constraint || '');
  const detail = String(pgErr?.detail || '').trim();
  const base =
    constraint === 'uq_timetable_teacher_no_overlap'
      ? 'This teacher already has another class in the same weekday and period with overlapping validity dates.'
      : constraint === 'uq_timetable_section_no_overlap'
        ? 'This section already has another subject in that weekday and period with overlapping validity dates.'
        : constraint === 'uq_timetable_room_no_overlap'
          ? 'This room is already booked for another class in that weekday and period with overlapping validity dates.'
          : 'Another timetable row uses the same slot and overlapping dates.';
  return detail ? `${base} Details: ${detail}` : base;
}

/**
 * Keep timetable scoping strict: only actual Teacher role should be teacher-scoped.
 * Roles like "headteacher"/"head master teacher" must not be treated as teacher here.
 */
function isStrictTeacherRole(ctx) {
  const name = String(ctx?.roleName || '').trim().toLowerCase();
  return ctx?.roleId === ROLES.TEACHER || name === 'teacher';
}

function formatTime(val) {
  if (val == null) return null;
  if (typeof val === 'string' && /^\d{1,2}:\d{2}/.test(val)) return val;
  if (val instanceof Date) return val.toTimeString().slice(0, 5);
  return String(val);
}

function getDayName(row) {
  const day = row.day_of_week ?? row.day ?? row.weekday;
  if (day == null) return null;
  if (typeof day === 'string' && DAY_NAMES.includes(day)) return day;
  if (typeof day === 'string') {
    const mapped = DAY_TO_INT[String(day).trim().toLowerCase()];
    if (mapped) return ISO_DAY_NAMES[mapped];
  }
  const n = Number(day);
  if (!Number.isNaN(n) && n >= 1 && n <= 7) return ISO_DAY_NAMES[n] || String(day);
  if (!Number.isNaN(n) && n >= 0 && n <= 6) return DAY_NAMES[n];
  return String(day);
}

function normalizeDayOfWeek(day) {
  if (day === undefined || day === null || day === '') return null;
  if (typeof day === 'number') return day >= 1 && day <= 7 ? day : null;
  const n = parseInt(day, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 7) return n;
  const mapped = DAY_TO_INT[String(day).trim().toLowerCase()];
  return mapped || null;
}

async function resolveTeacherToStaffId(teacherId) {
  if (!teacherId) return null;
  try {
    const staffTry = await query('SELECT id FROM staff WHERE id = $1 LIMIT 1', [teacherId]);
    if (staffTry.rows.length) return staffTry.rows[0].id;
  } catch (e) { }

  try {
    // Legacy support (might fail if table removed)
    const teacherTry = await query('SELECT staff_id FROM teachers WHERE id = $1 LIMIT 1', [teacherId]);
    if (teacherTry.rows.length) return teacherTry.rows[0].staff_id;
  } catch (e) { }

  return null;
}

function getSlotStart(slot) {
  if (!slot) return null;
  return slot.start_time ?? slot.period_start ?? slot.start_time_period ?? slot.start ?? null;
}
function getSlotEnd(slot) {
  if (!slot) return null;
  return slot.end_time ?? slot.period_end ?? slot.end_time_period ?? slot.end ?? null;
}

function subjectDisplayFromSubjectRow(subj) {
  if (!subj) return null;
  const name = subj.subject_name ?? subj.name ?? subj.subject_code ?? null;
  if (!name) return null;
  const th = Number(subj.theory_hours ?? 0);
  const ph = Number(subj.practical_hours ?? 0);
  if (th > 0 && ph > 0) return `${name} (Theory & Practical)`;
  if (ph > 0) return `${name} (Practical)`;
  if (th > 0) return `${name} (Theory)`;
  return name;
}

function mapScheduleRow(row, classMap, sectionMap, subjectMap, timeSlotMap, teacherMap, roomMap = {}) {
  const slotKey = row.time_slot_id ?? row.time_slot ?? row.period_id;
  const slot = timeSlotMap[slotKey] ?? timeSlotMap[Number(slotKey)] ?? timeSlotMap[String(slotKey)];
  const cls = classMap[row.class_id] ?? classMap[row.class];
  const sec = sectionMap[row.class_section_id] ?? sectionMap[row.section_id] ?? sectionMap[row.section];
  const subj = subjectMap[row.class_subject_id] ?? subjectMap[row.subject_id] ?? subjectMap[row.subject];
  const teacher = teacherMap[row.teacher_id] ?? teacherMap[row.teacher];
  const teacherName = teacher
    ? (
      teacher.name ??
      [teacher.first_name, teacher.last_name].filter(Boolean).join(' ').trim() ??
      teacher.username ??
      teacher.email ??
      null
    )
    : null;
  const roomKey = row.class_room_id ?? row.room_id ?? row.class_room;
  const roomFromFk =
    roomKey != null
      ? roomMap[roomKey] ?? roomMap[Number(roomKey)] ?? roomMap[String(roomKey)]
      : null;
  const roomLabel =
    roomFromFk?.room_number ??
    roomFromFk?.room_no ??
    roomFromFk?.name ??
    row.room_number ??
    row.room ??
    row.class_room ??
    row.class_room_number ??
    null;

  return {
    id: row.id,
    class_id: row.class_id ?? null,
    section_id: row.class_section_id ?? row.section_id ?? null,
    class_section_id: row.class_section_id ?? row.section_id ?? null,
    subject_id: row.class_subject_id ?? row.subject_id ?? null,
    class_subject_id: row.class_subject_id ?? row.subject_id ?? null,
    teacher_id: row.teacher_id ?? null,
    time_slot_id: row.time_slot_id ?? row.time_slot ?? row.period_id ?? null,
    academic_year_id: row.academic_year_id ?? null,
    class_room_id: row.class_room_id ?? null,
    day_of_week: row.day_of_week ?? null,
    class: cls ? (cls.class_name ?? cls.name ?? cls.class_code) : null,
    section: sec ? (sec.section_name ?? sec.name) : null,
    teacher: teacherName,
    subject: subjectDisplayFromSubjectRow(subj),
    day: getDayName(row),
    startTime: slot ? formatTime(getSlotStart(slot)) : formatTime(row.start_time),
    endTime: slot ? formatTime(getSlotEnd(slot)) : formatTime(row.end_time),
    classRoom: roomLabel,
    slotName: slot ? (slot.slot_name ?? slot.type ?? null) : null,
  };
}

async function buildTimeSlotMap(timeSlotIds) {
  const timeSlotMap = {};
  if (timeSlotIds.length === 0) return timeSlotMap;
  try {
    const r = await query('SELECT * FROM timetable_time_slots');
    r.rows.forEach((t) => {
      const id = t.id;
      const passKey = t.pass_key ?? t.passkey ?? t.period_key ?? id;
      [id, passKey, Number(id), String(id), Number(passKey), String(passKey)].forEach((k) => {
        if (k != null && k !== '') timeSlotMap[k] = t;
      });
    });
  } catch (e) {
    try {
      const r = await query('SELECT * FROM timetable_time_slots WHERE id = ANY($1)', [timeSlotIds]);
      r.rows.forEach((t) => {
        timeSlotMap[t.id] = t;
        timeSlotMap[Number(t.id)] = t;
        timeSlotMap[String(t.id)] = t;
        if (t.pass_key != null) {
          timeSlotMap[t.pass_key] = t;
          timeSlotMap[String(t.pass_key)] = t;
        }
      });
    } catch (e2) {
      console.error('timetable_time_slots fetch failed:', e2.message);
    }
  }
  return timeSlotMap;
}

async function enrichScheduleRows(rows) {
  const classIds = [...new Set(rows.map((r) => r.class_id).filter(Boolean))];
  const sectionIds = [...new Set(rows.map((r) => r.class_section_id).filter(Boolean))];
  const classSubjectIds = [...new Set(rows.map((r) => r.class_subject_id).filter(Boolean))];
  const timeSlotIds = [...new Set(rows.map((r) => r.time_slot_id).filter(Boolean))];
  const teacherIds = [
    ...new Set(
      rows
        .map((r) => r.teacher_id ?? r.teacher)
        .filter((v) => v != null && v !== '')
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  const roomIds = [
    ...new Set(
      rows
        .map((r) => r.class_room_id ?? r.room_id ?? r.class_room)
        .filter((v) => v != null && v !== '')
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];

  let classMap = {};
  if (classIds.length > 0) {
    try {
      const r = await query('SELECT * FROM classes WHERE id = ANY($1)', [classIds]);
      r.rows.forEach((c) => {
        classMap[c.id] = c;
        classMap[Number(c.id)] = c;
        classMap[String(c.id)] = c;
      });
    } catch (e) {
      console.error('classes fetch for schedules:', e.message);
    }
  }
  let sectionMap = {};
  if (sectionIds.length > 0) {
    try {
      const r = await query(
        `SELECT cs.id, sec.section_name 
           FROM class_sections cs 
           JOIN sections sec ON sec.id = cs.section_id 
           WHERE cs.id = ANY($1)`,
        [sectionIds]
      );
      r.rows.forEach((s) => {
        sectionMap[s.id] = s;
        sectionMap[Number(s.id)] = s;
        sectionMap[String(s.id)] = s;
      });
    } catch (e) {
      console.error('sections fetch for schedules:', e.message);
    }
  }
  let subjectMap = {};
  if (classSubjectIds.length > 0) {
    try {
      const r = await query(
        `SELECT cs.id as class_subject_id, s.*, s.subject_type as subject_mode
           FROM class_subjects cs
           JOIN subjects s ON cs.subject_id = s.id
           WHERE cs.id = ANY($1)`,
        [classSubjectIds]
      );
      r.rows.forEach((s) => {
        subjectMap[s.class_subject_id] = s;
        subjectMap[Number(s.class_subject_id)] = s;
        subjectMap[String(s.class_subject_id)] = s;
      });
    } catch (e) {
      console.error('subjects fetch for schedules:', e.message);
    }
  }
  const timeSlotMap = await buildTimeSlotMap(timeSlotIds);

  let teacherMap = {};
  if (teacherIds.length > 0) {
    try {
      const r = await query(
        `SELECT
           st.id,
           NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS name,
           u.username,
           u.email,
           u.avatar AS photo_url
           FROM staff st
           JOIN users u ON u.id = st.user_id
           WHERE st.id = ANY($1)`,
        [teacherIds]
      );
      r.rows.forEach((t) => {
        teacherMap[t.id] = t;
        teacherMap[Number(t.id)] = t;
        teacherMap[String(t.id)] = t;
      });

      // Backward compatibility: some legacy rows may store teachers.id in class_schedules.teacher_id.
      const legacyTeacherRows = await query(
        `SELECT
           t.id AS teacher_id,
           st.id AS staff_id,
           NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS name,
           u.username,
           u.email,
           u.avatar AS photo_url
         FROM teachers t
         JOIN staff st ON st.id = t.staff_id
         JOIN users u ON u.id = st.user_id
         WHERE t.id = ANY($1)`,
        [teacherIds]
      );
      legacyTeacherRows.rows.forEach((t) => {
        const normalized = {
          id: t.staff_id,
          name: t.name,
          username: t.username,
          email: t.email,
          photo_url: t.photo_url,
        };
        teacherMap[t.teacher_id] = normalized;
        teacherMap[Number(t.teacher_id)] = normalized;
        teacherMap[String(t.teacher_id)] = normalized;
        teacherMap[t.staff_id] = normalized;
        teacherMap[Number(t.staff_id)] = normalized;
        teacherMap[String(t.staff_id)] = normalized;
      });
    } catch (e) {
      console.error('teacher fetch for schedules:', e.message);
    }
  }

  let roomMap = {};
  if (roomIds.length > 0) {
    try {
      const r = await query('SELECT * FROM class_rooms WHERE id = ANY($1)', [roomIds]);
      r.rows.forEach((rm) => {
        roomMap[rm.id] = rm;
        roomMap[Number(rm.id)] = rm;
        roomMap[String(rm.id)] = rm;
      });
    } catch (e) {
      /* class_rooms optional */
    }
  }

  return rows.map((row) => mapScheduleRow(row, classMap, sectionMap, subjectMap, timeSlotMap, teacherMap, roomMap));
}

async function loadSchedulesFromDb(whereSql, params) {
  const result = await query(
    `SELECT * FROM class_schedules ${whereSql} ORDER BY day_of_week ASC, time_slot_id ASC, id ASC`,
    params
  );
  return result.rows;
}

/**
 * Build role-scoped WHERE for class_schedules (PostgreSQL).
 * Always includes academic_year_id = $1 as first param.
 */
async function buildScopedWhere(req, academicYearId, extraFilters = {}) {
  const ctx = getAuthContext(req);
  if (!ctx.userId) {
    return { forbidden: true };
  }

  const params = [academicYearId];
  let p = 2;
  let where = 'WHERE academic_year_id = $1';

  const classIdFilter = parseId(extraFilters.class_id);
  const sectionIdFilter = parseId(extraFilters.section_id);

  if (isAdmin(ctx)) {
    if (classIdFilter) {
      where += ` AND class_id = $${p++}`;
      params.push(classIdFilter);
    }
    if (sectionIdFilter) {
      where += ` AND class_section_id = $${p++}`;
      params.push(sectionIdFilter);
    }
    return { where, params, ctx };
  }

  if (isStrictTeacherRole(ctx)) {
    const staffId = await resolveTeacherStaffIdForUser(ctx.userId);
    if (!staffId) {
      return { where: `${where} AND 1=0`, params, ctx };
    }
    where += ` AND teacher_id = $${p++}`;
    params.push(staffId);
    if (classIdFilter) {
      where += ` AND class_id = $${p++}`;
      params.push(classIdFilter);
    }
    if (sectionIdFilter) {
      where += ` AND class_section_id = $${p++}`;
      params.push(sectionIdFilter);
    }
    return { where, params, ctx };
  }

  if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
    const scope = await resolveStudentScopeForUser(ctx.userId);
    if (!scope?.classId) {
      return { where: `${where} AND 1=0`, params, ctx };
    }
    where += ` AND class_id = $${p++}`;
    params.push(scope.classId);
    if (scope.sectionId) {
      where += ` AND (
        class_section_id IS NULL
        OR EXISTS (
          SELECT 1 FROM class_sections cs_scope
          WHERE cs_scope.id = class_schedules.class_section_id
            AND cs_scope.class_id = class_schedules.class_id
            AND cs_scope.section_id = $${p}
        )
      )`;
      params.push(scope.sectionId);
      p += 1;
    }
    if (classIdFilter && classIdFilter !== scope.classId) {
      return { forbidden: true };
    }
    if (sectionIdFilter && scope.sectionId && sectionIdFilter !== scope.sectionId) {
      return { forbidden: true };
    }
    return { where, params, ctx };
  }

  if (isParentOrGuardianPortalRole(ctx)) {
    const wardIds = await resolveWardStudentIdsForUser(req);
    if (!wardIds.length) {
      return { where: `${where} AND 1=0`, params, ctx };
    }
    // Class/section live on student_lifecycle_ledger (enr.*), not on students.* (cast_id is unrelated).
    // Use latest enrollment (no to_academic_year_id filter), same as resolveStudentScopeForUser / canAccessClass for parents.
    // Timetable rows are already restricted by class_schedules.academic_year_id = $1 above.
    where += ` AND EXISTS (
      SELECT 1 FROM students s
      ${lateralCurrentEnrollment('s.id')}
      WHERE s.id = ANY($${p}::int[])
        AND s.deleted_at IS NULL
        AND COALESCE(s.is_active, true) = true
        AND enr.class_id IS NOT NULL
        AND enr.class_id = class_schedules.class_id
        AND (
          class_schedules.class_section_id IS NULL
          OR enr.section_id IS NULL
          OR EXISTS (
            SELECT 1 FROM class_sections cs_scope
            WHERE cs_scope.id = class_schedules.class_section_id
              AND cs_scope.class_id = class_schedules.class_id
              AND cs_scope.section_id = enr.section_id
          )
        )
    )`;
    params.push(wardIds);
    p += 1;
    if (classIdFilter) {
      where += ` AND class_id = $${p++}`;
      params.push(classIdFilter);
    }
    if (sectionIdFilter) {
      where += ` AND class_section_id = $${p++}`;
      params.push(sectionIdFilter);
    }
    return { where, params, ctx };
  }

  return { forbidden: true };
}

async function assertCanReadScheduleRow(req, row) {
  const ctx = getAuthContext(req);
  if (!ctx.userId) return { ok: false, status: 401, message: 'Not authenticated' };
  if (isAdmin(ctx)) return { ok: true };

  const classId = parseId(row.class_id);
  const sectionId = parseId(row.section_id);

  if (isStrictTeacherRole(ctx)) {
    const staffId = await resolveTeacherStaffIdForUser(ctx.userId);
    if (staffId && parseId(row.teacher_id) === staffId) return { ok: true };
    return { ok: false, status: 403, message: 'Access denied' };
  }

  if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
    const scope = await resolveStudentScopeForUser(ctx.userId);
    if (!scope?.classId || scope.classId !== classId) return { ok: false, status: 403, message: 'Access denied' };
    if (scope.sectionId && sectionId && scope.sectionId !== sectionId) return { ok: false, status: 403, message: 'Access denied' };
    return { ok: true };
  }

  if (isParentOrGuardianPortalRole(ctx)) {
    const wardIds = await resolveWardStudentIdsForUser(req);
    if (!wardIds.length) return { ok: false, status: 403, message: 'Access denied' };
    const classIdRow = parseId(row.class_id);
    const classSectionId = parseId(row.class_section_id);
    if (!classIdRow) return { ok: false, status: 403, message: 'Access denied' };

    const r2 = await query(
      `SELECT 1 FROM students s
       ${lateralCurrentEnrollment('s.id')}
       WHERE s.id = ANY($1::int[])
         AND s.deleted_at IS NULL
         AND COALESCE(s.is_active, true) = true
         AND enr.class_id IS NOT NULL
         AND enr.class_id = $2
         AND (
           $3::int IS NULL
           OR enr.section_id IS NULL
           OR EXISTS (
             SELECT 1 FROM class_sections cs2
             WHERE cs2.id = $3
               AND cs2.class_id = enr.class_id
               AND cs2.section_id = enr.section_id
           )
         )
       LIMIT 1`,
      [wardIds, classIdRow, classSectionId]
    ).catch(() => ({ rows: [] }));
    if (r2.rows && r2.rows.length) return { ok: true };
    return { ok: false, status: 403, message: 'Access denied' };
  }

  return { ok: false, status: 403, message: 'Access denied' };
}

function qexec(client, text, params) {
  return client ? client.query(text, params) : query(text, params);
}

function toPgTime(val) {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString().slice(11, 19);
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const ss = (m[3] || '00').padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

async function resolveSectionRoomFields(client, classSectionId) {
  if (classSectionId == null || classSectionId === '') return { roomNumber: null, classRoomId: null };
  const csid = parseId(classSectionId);
  if (!csid) return { roomNumber: null, classRoomId: null };
  const r = await qexec(
    client,
    `SELECT NULLIF(TRIM(room_number), '') AS room_number, class_room_id
     FROM class_sections WHERE id = $1 LIMIT 1`,
    [csid]
  );
  const row = r.rows[0];
  if (!row) return { roomNumber: null, classRoomId: null };
  return {
    roomNumber: row.room_number || null,
    classRoomId: row.class_room_id != null ? Number(row.class_room_id) : null,
  };
}

function assertSlotNotBreak(slotMeta) {
  const byFlag = slotMeta?.is_break === true;
  const name = String(slotMeta?.slot_name || '');
  const byName = /\bbreak\b/i.test(name) || /\brecess\b/i.test(name);
  if (byFlag || byName) {
    const err = new Error('Lessons cannot be scheduled during a break period.');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
}

function assertSlotTimesForOverlap(slotMeta) {
  const st = toPgTime(slotMeta?.start_time);
  const en = toPgTime(slotMeta?.end_time);
  if (!st || !en) {
    const err = new Error('This period has no start/end time; fix it under Time slots before scheduling.');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
}

async function findTeacherOverlappingConflictRow(client, {
  academicYearId,
  dayOfWeek,
  newStart,
  newEnd,
  teacherStaffId,
  excludeId,
}) {
  const params = [academicYearId, dayOfWeek, teacherStaffId, newStart, newEnd];
  let sql = `
    SELECT cs.id,
      TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS teacher_name,
      ts.slot_name,
      c.class_name,
      sec.section_name
    FROM class_schedules cs
    INNER JOIN timetable_time_slots ts ON ts.id = cs.time_slot_id
    LEFT JOIN staff st ON st.id = cs.teacher_id
    LEFT JOIN users u ON u.id = st.user_id
    LEFT JOIN classes c ON c.id = cs.class_id
    LEFT JOIN class_sections csec ON csec.id = cs.class_section_id
    LEFT JOIN sections sec ON sec.id = csec.section_id
    WHERE cs.academic_year_id = $1
      AND cs.day_of_week = $2
      AND cs.teacher_id = $3
      AND ts.start_time IS NOT NULL
      AND ts.end_time IS NOT NULL
      AND ($4::time < ts.end_time AND ts.start_time < $5::time)
      AND daterange(cs.valid_from, COALESCE(cs.valid_to, 'infinity')) && daterange(CURRENT_DATE, 'infinity')
`;
  if (excludeId) {
    sql += ' AND cs.id <> $6';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const r = await qexec(client, sql, params);
  return r.rows[0] || null;
}

async function findClassSectionOverlappingConflictRow(client, {
  academicYearId,
  dayOfWeek,
  newStart,
  newEnd,
  classId,
  sectionId,
  forTeacherStaffId,
  excludeId,
}) {
  const params = [academicYearId, dayOfWeek, classId, sectionId, newStart, newEnd, forTeacherStaffId];
  let sql = `
    SELECT cs.id,
      c.class_name,
      sec.section_name,
      sub.subject_name,
      ts.slot_name,
      TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS teacher_name
    FROM class_schedules cs
    INNER JOIN timetable_time_slots ts ON ts.id = cs.time_slot_id
    LEFT JOIN classes c ON c.id = cs.class_id
    LEFT JOIN class_sections csec ON csec.id = cs.class_section_id
    LEFT JOIN sections sec ON sec.id = csec.section_id
    LEFT JOIN class_subjects csub ON csub.id = cs.class_subject_id
    LEFT JOIN subjects sub ON sub.id = csub.subject_id
    LEFT JOIN staff st ON st.id = cs.teacher_id
    LEFT JOIN users u ON u.id = st.user_id
    WHERE cs.academic_year_id = $1
      AND cs.day_of_week = $2
      AND cs.class_id = $3
      AND (cs.class_section_id IS NOT DISTINCT FROM $4)
      AND ts.start_time IS NOT NULL
      AND ts.end_time IS NOT NULL
      AND ($5::time < ts.end_time AND ts.start_time < $6::time)
      AND daterange(cs.valid_from, COALESCE(cs.valid_to, 'infinity')) && daterange(CURRENT_DATE, 'infinity')
      AND cs.teacher_id IS DISTINCT FROM $7
`;
  if (excludeId) {
    sql += ' AND cs.id <> $8';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const r = await qexec(client, sql, params);
  return r.rows[0] || null;
}

async function findRoomOverlappingConflictRow(client, {
  academicYearId,
  dayOfWeek,
  newStart,
  newEnd,
  roomId,
  excludeId,
}) {
  if (!roomId) return null;
  const params = [academicYearId, dayOfWeek, roomId, newStart, newEnd];
  let sql = `
    SELECT cs.id,
      c.class_name,
      sec.section_name,
      sub.subject_name,
      ts.slot_name,
      rm.room_number
    FROM class_schedules cs
    INNER JOIN timetable_time_slots ts ON ts.id = cs.time_slot_id
    LEFT JOIN class_rooms rm ON rm.id = cs.class_room_id
    LEFT JOIN classes c ON c.id = cs.class_id
    LEFT JOIN class_sections csec ON csec.id = cs.class_section_id
    LEFT JOIN sections sec ON sec.id = csec.section_id
    LEFT JOIN class_subjects csub ON csub.id = cs.class_subject_id
    LEFT JOIN subjects sub ON sub.id = csub.subject_id
    WHERE cs.academic_year_id = $1
      AND cs.day_of_week = $2
      AND cs.class_room_id = $3
      AND ts.start_time IS NOT NULL
      AND ts.end_time IS NOT NULL
      AND ($4::time < ts.end_time AND ts.start_time < $5::time)
      AND daterange(cs.valid_from, COALESCE(cs.valid_to, 'infinity')) && daterange(CURRENT_DATE, 'infinity')
`;
  if (excludeId) {
    sql += ' AND cs.id <> $6';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const r = await qexec(client, sql, params);
  return r.rows[0] || null;
}

function dayLabel(n) {
  return ISO_DAY_NAMES[Number(n)] || String(n);
}

function buildTeacherConflictMessage(row, dayInt, slotName) {
  const t = (row.teacher_name || '').trim() || 'This teacher';
  const slot = row.slot_name || slotName || 'this period';
  const day = dayLabel(dayInt);
  const grp = [row.class_name, row.section_name].filter(Boolean).join('-') || 'another class/section';
  return `${t} is already teaching ${grp} on ${day} (${slot}) during an overlapping time. A teacher cannot teach two different classes or sections at the same time.`;
}

function buildClassConflictMessage(row, dayInt, slotName) {
  const cls = row.class_name || 'This class';
  const sec = row.section_name ? `-${row.section_name}` : '';
  const sub = row.subject_name ? ` Current entry: ${row.subject_name}.` : '';
  const slot = row.slot_name || slotName || 'this period';
  const day = dayLabel(dayInt);
  return `${cls}${sec} already has a timetable entry on ${day} (${slot}).${sub}`;
}

function buildRoomConflictMessage(row, dayInt, slotName) {
  const room = row.room_number || 'This room';
  const slot = row.slot_name || slotName || 'this period';
  const day = dayLabel(dayInt);
  const grp = [row.class_name, row.section_name].filter(Boolean).join('-') || 'another class';
  return `${room} is already booked for ${grp} on ${day} (${slot}).`;
}

async function assertValidTimeSlotId(client, timeSlotId) {
  const r = await qexec(
    client,
    `SELECT id, slot_name, start_time, end_time, COALESCE(is_break, false) AS is_break
     FROM timetable_time_slots WHERE id = $1 LIMIT 1`,
    [timeSlotId]
  );
  if (!r.rows.length) {
    const err = new Error('INVALID_TIME_SLOT');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
  return r.rows[0];
}

async function assertSubjectAllowedForClass(client, classSubjectId, classId, academicYearId = null) {
  if (classSubjectId == null || classSubjectId === '') return;
  const csid = parseId(classSubjectId);
  if (!csid) {
    const err = new Error('Invalid class_subject_id');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
  const cid = parseId(classId);
  if (!cid) {
    const err = new Error('Invalid class_id');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }

  const params = [csid, cid];
  let sql = 'SELECT id FROM class_subjects WHERE id = $1 AND class_id = $2 AND (deleted_at IS NULL)';
  if (academicYearId) {
    sql += ' AND academic_year_id = $3';
    params.push(academicYearId);
  }

  const r = await qexec(client, sql + ' LIMIT 1', params);
  if (!r.rows.length) {
    const err = new Error('This subject mapping is not linked to the selected class/academic year.');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
}

// teacher_routines table is deprecated in new schema. Logic removed.

const getAllClassSchedules = async (req, res) => {
  try {
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    if (academicYearId == null || Number.isNaN(academicYearId)) {
      return errorResponse(res, 400, 'academic_year_id query parameter is required');
    }

    const classIdQ = parseId(req.query.class_id);
    const sectionIdQ = parseId(req.query.section_id);

    const scoped = await buildScopedWhere(req, academicYearId, { class_id: classIdQ, section_id: sectionIdQ });
    if (scoped.forbidden) {
      return errorResponse(res, 403, 'Access denied');
    }

    const rows = await loadSchedulesFromDb(scoped.where, scoped.params);
    const data = await enrichScheduleRows(rows);
    return success(res, 200, 'Class schedules fetched successfully', data, { count: data.length });
  } catch (error) {
    console.error('Error fetching class schedules:', error);
    return errorResponse(res, 500, 'Failed to fetch class schedules');
  }
};

/** GET /api/timetable/class — explicit class+section timetable (RBAC enforced). */
const getTimetableClass = async (req, res) => {
  try {
    const academicYearId = parseId(req.query.academic_year_id);
    const classId = parseId(req.query.class_id);
    const requestedSectionId = parseId(req.query.section_id);
    if (!academicYearId || !classId) {
      return errorResponse(res, 400, 'academic_year_id and class_id are required');
    }

    let sectionMasterId = null; // sections.id
    let classSectionId = null; // class_sections.id
    if (requestedSectionId) {
      const byClassSectionId = await query(
        `SELECT id, section_id
         FROM class_sections
         WHERE id = $1 AND class_id = $2 AND academic_year_id = $3
         LIMIT 1`,
        [requestedSectionId, classId, academicYearId]
      );
      if (byClassSectionId.rows.length > 0) {
        classSectionId = parseId(byClassSectionId.rows[0].id);
        sectionMasterId = parseId(byClassSectionId.rows[0].section_id);
      } else {
        const bySectionId = await query(
          `SELECT id, section_id
           FROM class_sections
           WHERE class_id = $1 AND section_id = $2 AND academic_year_id = $3
           ORDER BY id DESC
           LIMIT 1`,
          [classId, requestedSectionId, academicYearId]
        );
        if (bySectionId.rows.length > 0) {
          classSectionId = parseId(bySectionId.rows[0].id);
          sectionMasterId = parseId(bySectionId.rows[0].section_id);
        } else {
          return success(res, 200, 'Class timetable fetched successfully', { entries: [], slots: [] }, { count: 0 });
        }
      }
    }

    const acc = await canAccessClass(req, classId);
    if (!acc.ok) {
      return errorResponse(res, acc.status || 403, acc.message || 'Access denied');
    }

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx) && sectionMasterId) {
      if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
        const scope = await resolveStudentScopeForUser(ctx.userId);
        if (scope?.sectionId && scope.sectionId !== sectionMasterId) {
          return errorResponse(res, 403, 'Access denied');
        }
      } else if (isParentOrGuardianPortalRole(ctx)) {
        const wardIds = await resolveWardStudentIdsForUser(req);
        const secOk = await query(
          `SELECT 1 FROM students s
           ${lateralCurrentEnrollment('s.id')}
           WHERE s.id = ANY($1::int[])
             AND s.deleted_at IS NULL
             AND COALESCE(s.is_active, true) = true
             AND enr.class_id IS NOT NULL
             AND enr.class_id = $2
             AND enr.section_id IS NOT DISTINCT FROM $3
           LIMIT 1`,
          [wardIds, classId, sectionMasterId]
        ).catch(() => ({ rows: [] }));
        if (!secOk.rows?.length) {
          return errorResponse(res, 403, 'Access denied');
        }
      }
    }

    // Keep scoped builder section-agnostic here.
    // We apply exact class_section_id filtering below after resolving section id type,
    // otherwise admin flow may incorrectly compare class_section_id with sections.id.
    const scoped = await buildScopedWhere(req, academicYearId, { class_id: classId });
    if (scoped.forbidden) {
      return errorResponse(res, 403, 'Access denied');
    }

    let where = scoped.where;
    const params = [...scoped.params];
    let p = params.length + 1;
    where += ` AND class_id = $${p++}`;
    params.push(classId);
    if (classSectionId) {
      where += ` AND (class_section_id = $${p++} OR class_section_id IS NULL)`;
      params.push(classSectionId);
    }

    const rows = await loadSchedulesFromDb(where, params);
    const data = await enrichScheduleRows(rows);

    let slots = [];
    try {
      const sr = await query('SELECT id, slot_name, start_time, end_time, duration, is_break FROM timetable_time_slots WHERE is_active IS DISTINCT FROM false ORDER BY start_time ASC NULLS LAST, id ASC');
      slots = sr.rows || [];
    } catch (e) {
      slots = [];
    }

    return success(res, 200, 'Class timetable fetched successfully', { entries: data, slots }, { count: data.length });
  } catch (error) {
    console.error('Error fetching class timetable:', error);
    return errorResponse(res, 500, 'Failed to fetch class timetable', error.message);
  }
};

/** GET /api/timetable/teacher — teacher-scoped rows (teachers.id in query). */
const getTimetableTeacher = async (req, res) => {
  try {
    const academicYearId = parseId(req.query.academic_year_id);
    const teacherId = parseId(req.query.teacher_id);
    if (!academicYearId || !teacherId) {
      return errorResponse(res, 400, 'academic_year_id and teacher_id are required');
    }

    const ctx = getAuthContext(req);
    if (!ctx.userId) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    if (!isAdmin(ctx)) {
      const myTid = await resolveTeacherIdForUser(ctx.userId);
      if (!myTid || myTid !== teacherId) {
        return errorResponse(res, 403, 'You can only view your own timetable');
      }
    }

    const tRes = await query(
      `SELECT staff_id FROM teachers
       WHERE id = $1 AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
       LIMIT 1`,
      [teacherId]
    );
    if (!tRes.rows.length) {
      return errorResponse(res, 404, 'Teacher not found');
    }
    const staffId = parseId(tRes.rows[0].staff_id);
    if (!staffId) {
      return success(res, 200, 'Teacher timetable fetched successfully', { entries: [], slots: [] }, { count: 0 });
    }

    const rows = await loadSchedulesFromDb(
      'WHERE academic_year_id = $1 AND teacher_id = $2',
      [academicYearId, staffId]
    );
    const data = await enrichScheduleRows(rows);

    let slots = [];
    try {
      const sr = await query('SELECT id, slot_name, start_time, end_time, duration, is_break FROM timetable_time_slots WHERE is_active IS DISTINCT FROM false ORDER BY start_time ASC NULLS LAST, id ASC');
      slots = sr.rows || [];
    } catch (e) {
      slots = [];
    }

    return success(res, 200, 'Teacher timetable fetched successfully', { entries: data, slots }, { count: data.length });
  } catch (error) {
    console.error('Error fetching teacher timetable:', error);
    return errorResponse(res, 500, 'Failed to fetch teacher timetable');
  }
};

const getClassScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM class_schedules WHERE id = $1', [id]);
    const row = result.rows[0] || null;
    if (!row) {
      return errorResponse(res, 404, 'Class schedule not found');
    }

    const gate = await assertCanReadScheduleRow(req, row);
    if (!gate.ok) {
      return errorResponse(res, gate.status || 403, gate.message || 'Access denied');
    }

    const [data] = await enrichScheduleRows([row]);
    return success(res, 200, 'Class schedule fetched successfully', data);
  } catch (error) {
    console.error('Error fetching class schedule:', error);
    return errorResponse(res, 500, 'Failed to fetch class schedule');
  }
};

function uniqueViolationUserMessage(err) {
  const c = String(err?.constraint || '');
  const d = String(err?.detail || '');
  if (c === 'uq_timetable_teacher_no_overlap' || d.includes('uq_timetable_teacher_no_overlap')) {
    return 'This teacher is already booked in that period (temporal overlap).';
  }
  if (c === 'uq_timetable_section_no_overlap' || d.includes('uq_timetable_section_no_overlap')) {
    return 'This class and section already have an entry in that period (temporal overlap).';
  }
  if (c === 'uq_timetable_room_no_overlap' || d.includes('uq_timetable_room_no_overlap')) {
    return 'This room is already occupied in that period (temporal overlap).';
  }
  return 'This timetable change conflicts with an existing entry. Refresh and try again.';
}

const createClassSchedule = async (req, res) => {
  try {
    const {
      teacher_id, class_id, section_id, subject_id, day_of_week,
      time_slot_id, academic_year_id, room_id,
    } = req.body;

    let slotId = time_slot_id || null;
    if (!slotId) {
      const slotRes = await query('SELECT id FROM timetable_time_slots ORDER BY id ASC LIMIT 1');
      slotId = slotRes.rows.length > 0 ? slotRes.rows[0].id : null;
    }
    if (!slotId) {
      return errorResponse(res, 400, 'time_slot_id is required (no time slots defined)');
    }

    const dayInt = normalizeDayOfWeek(day_of_week);
    if (!dayInt) return errorResponse(res, 400, 'Invalid day_of_week. Use 1-7 or day name');

    // Resolve teacher_id (which might be staff_id or legacy teacher_id)
    const teacherStaffId = await resolveTeacherToStaffId(teacher_id);
    if (!teacherStaffId) return errorResponse(res, 400, 'Invalid teacher_id');

    let ayId = academic_year_id || null;
    if (!ayId) {
      const classRes = await query('SELECT academic_year_id FROM classes WHERE id = $1 LIMIT 1', [class_id]);
      ayId = classRes.rows[0]?.academic_year_id || null;
    }
    if (!ayId) return errorResponse(res, 400, 'academic_year_id is required');

    const created = await executeTransaction(async (client) => {
      const slotMeta = await assertValidTimeSlotId(client, slotId);
      assertSlotNotBreak(slotMeta);
      assertSlotTimesForOverlap(slotMeta);
      const newStart = toPgTime(slotMeta.start_time);
      const newEnd = toPgTime(slotMeta.end_time);
      await assertSubjectAllowedForClass(client, subject_id, class_id, ayId);

      const tRow = await findTeacherOverlappingConflictRow(client, {
        academicYearId: ayId,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        teacherStaffId,
        excludeId: null,
      });
      if (tRow) {
        const err = new Error(buildTeacherConflictMessage(tRow, dayInt, slotMeta.slot_name));
        err.code = 'TIMETABLE_CONFLICT';
        throw err;
      }
      const cRow = await findClassSectionOverlappingConflictRow(client, {
        academicYearId: ayId,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        classId: class_id,
        sectionId: section_id ?? null,
        forTeacherStaffId: teacherStaffId,
        excludeId: null,
      });
      if (cRow) {
        const err = new Error(buildClassConflictMessage(cRow, dayInt, slotMeta.slot_name));
        err.code = 'TIMETABLE_CONFLICT';
        throw err;
      }

      const secRoom = await resolveSectionRoomFields(client, section_id);
      const effectiveRoomId = room_id || secRoom.classRoomId;

      const rRow = await findRoomOverlappingConflictRow(client, {
        academicYearId: ayId,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        roomId: effectiveRoomId,
        excludeId: null,
      });
      if (rRow) {
        const err = new Error(buildRoomConflictMessage(rRow, dayInt, slotMeta.slot_name));
        err.code = 'TIMETABLE_CONFLICT';
        throw err;
      }

      const ins = await client.query(
        `INSERT INTO class_schedules (teacher_id, class_id, class_section_id, class_subject_id, time_slot_id, day_of_week, class_room_id, academic_year_id, valid_from)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
         RETURNING *`,
        [
          teacherStaffId,
          class_id,
          section_id || null,
          subject_id || null,
          slotId,
          dayInt,
          room_id || secRoom.classRoomId,
          ayId,
        ]
      );
      const row = ins.rows[0];
      return row;
    });

    return success(res, 201, 'Class routine added successfully', created);
  } catch (error) {
    console.error('Error creating class schedule:', error);
    if (error.code === 'TIMETABLE_CONFLICT' || error.code === 'TIMETABLE_VALIDATION') {
      return res.status(200).json({ success: false, status: 'ERROR', message: error.message });
    }
    if (error.code === '409') {
       return res.status(200).json({ success: false, status: 'ERROR', message: error.message });
    }
    if (error.code === '23505') {
      return res.status(200).json({ success: false, status: 'ERROR', message: uniqueViolationUserMessage(error) });
    }
    if (error.code === '23P01') {
      return res.status(200).json({ success: false, status: 'ERROR', message: timetableExclusionUserMessage(error) });
    }
    return errorResponse(res, 500, 'Failed to add class routine', error.message);
  }
};

const updateClassSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const sid = parseId(id);
    if (!sid) return errorResponse(res, 400, 'Invalid id');

    const updated = await executeTransaction(async (client) => {
      const lock = await client.query('SELECT * FROM class_schedules WHERE id = $1 FOR UPDATE', [sid]);
      if (!lock.rows.length) {
        const err = new Error('NOT_FOUND');
        err.code = 'NOT_FOUND';
        throw err;
      }
      const cur = lock.rows[0];

      const teacherId = payload.teacher_id ? await resolveTeacherToStaffId(payload.teacher_id) : cur.teacher_id;
      if (!teacherId) {
        const err = new Error('Invalid teacher_id');
        err.code = 'TIMETABLE_VALIDATION';
        throw err;
      }
      const dayInt = payload.day_of_week !== undefined ? normalizeDayOfWeek(payload.day_of_week) : cur.day_of_week;
      if (!dayInt) {
        const err = new Error('Invalid day_of_week');
        err.code = 'TIMETABLE_VALIDATION';
        throw err;
      }

      const nextSlot = payload.time_slot_id ?? cur.time_slot_id;
      const nextYear = payload.academic_year_id ?? cur.academic_year_id;
      const nextClass = payload.class_id ?? cur.class_id;
      const nextSection = payload.section_id !== undefined ? payload.section_id : cur.section_id;

      const slotMeta = await assertValidTimeSlotId(client, nextSlot);
      assertSlotNotBreak(slotMeta);
      assertSlotTimesForOverlap(slotMeta);
      const newStart = toPgTime(slotMeta.start_time);
      const newEnd = toPgTime(slotMeta.end_time);
      if (payload.subject_id !== undefined) {
        await assertSubjectAllowedForClass(client, payload.subject_id, nextClass, nextYear);
      }

      const tRow = await findTeacherOverlappingConflictRow(client, {
        academicYearId: nextYear,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        teacherStaffId: teacherId,
        excludeId: sid,
      });
      if (tRow) {
        const err = new Error(buildTeacherConflictMessage(tRow, dayInt, slotMeta.slot_name));
        err.code = 'TIMETABLE_CONFLICT';
        throw err;
      }
      const cRow = await findClassSectionOverlappingConflictRow(client, {
        academicYearId: nextYear,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        classId: nextClass,
        sectionId: nextSection ?? null,
        forTeacherStaffId: teacherId,
        excludeId: sid,
      });
      if (cRow) {
        const err = new Error(buildClassConflictMessage(cRow, dayInt, slotMeta.slot_name));
        err.code = 'TIMETABLE_CONFLICT';
        throw err;
      }

      const secRoom = await resolveSectionRoomFields(client, nextSection);
      const effectiveRoomId = payload.room_id || payload.class_room_id || secRoom.classRoomId;

      const rRow = await findRoomOverlappingConflictRow(client, {
        academicYearId: nextYear,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        roomId: effectiveRoomId,
        excludeId: sid,
      });
      if (rRow) {
        const err = new Error(buildRoomConflictMessage(rRow, dayInt, slotMeta.slot_name));
        err.code = 'TIMETABLE_CONFLICT';
        throw err;
      }

      const result = await client.query(
        `UPDATE class_schedules SET
        teacher_id = $1, class_id = $2, class_section_id = $3, class_subject_id = $4, time_slot_id = $5,
        day_of_week = $6, class_room_id = $7, academic_year_id = $8, updated_at = NOW()
      WHERE id = $9 RETURNING *`,
        [
          teacherId,
          nextClass,
          nextSection || null,
          payload.subject_id !== undefined ? payload.subject_id : cur.class_subject_id,
          nextSlot,
          dayInt,
          payload.room_id || payload.class_room_id || secRoom.classRoomId,
          nextYear,
          sid,
        ]
      );
      const row = result.rows[0];
      await syncTeacherRoutineLink(client, row);
      return row;
    });

    return success(res, 200, 'Class routine updated successfully', updated);
  } catch (error) {
    console.error('Error updating class schedule:', error);
    if (error.code === 'NOT_FOUND') return errorResponse(res, 404, 'Class schedule not found');
    if (error.code === 'TIMETABLE_CONFLICT' || error.code === 'TIMETABLE_VALIDATION') {
      return res.status(200).json({ success: false, status: 'ERROR', message: error.message });
    }
    if (error.code === '23505') {
      return res.status(200).json({ success: false, status: 'ERROR', message: uniqueViolationUserMessage(error) });
    }
    if (error.code === '23P01') {
      return res.status(200).json({ success: false, status: 'ERROR', message: timetableExclusionUserMessage(error) });
    }
    return errorResponse(res, 500, 'Failed to update class routine');
  }
};

const deleteClassSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const sid = parseId(id);
    if (!sid) return errorResponse(res, 400, 'Invalid id');

    const deleted = await executeTransaction(async (client) => {
      const cur = await client.query('SELECT id FROM class_schedules WHERE id = $1 FOR UPDATE', [sid]);
      if (!cur.rows.length) {
        const err = new Error('NOT_FOUND');
        err.code = 'NOT_FOUND';
        throw err;
      }
      await removeTeacherRoutineLink(client, sid);
      const result = await client.query('DELETE FROM class_schedules WHERE id = $1 RETURNING id', [sid]);
      return result.rows[0];
    });

    return success(res, 200, 'Class routine deleted successfully', { id: deleted.id });
  } catch (error) {
    console.error('Error deleting class schedule:', error);
    if (error.code === 'NOT_FOUND') return errorResponse(res, 404, 'Class schedule not found');
    return errorResponse(res, 500, 'Failed to delete class routine');
  }
};

const getClassSchedulesDebug = async (req, res) => {
  try {
    const out = {
      class_schedules_count: 0,
      time_slots_count: 0,
      classes_count: 0,
      sample_schedules: [],
      sample_time_slots: [],
      raw_first_schedule: null,
      errors: [],
    };
    try {
      const r = await query('SELECT * FROM class_schedules ORDER BY id ASC LIMIT 5');
      out.class_schedules_count = r.rows.length;
      out.sample_schedules = r.rows;
      if (r.rows.length > 0) out.raw_first_schedule = r.rows[0];
    } catch (e) {
      out.errors.push(`class_schedules: ${e?.message || String(e)}`);
    }
    try {
      const r = await query('SELECT * FROM timetable_time_slots ORDER BY id ASC LIMIT 10');
      out.time_slots_count = r.rows.length;
      out.sample_time_slots = r.rows;
    } catch (e) {
      out.errors.push(`timetable_time_slots: ${e?.message || String(e)}`);
    }
    try {
      const r = await query('SELECT COUNT(*) AS c FROM classes');
      out.classes_count = parseInt(r.rows[0]?.c, 10) || 0;
    } catch (e) {
      out.errors.push(`classes: ${e?.message || String(e)}`);
    }
    return success(res, 200, 'Class schedule debug fetched', out);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to process request');
  }
};

/**
 * POST /api/timetable/bulk — Save multiple rows in one transaction.
 */
const bulkUpdateClassSchedules = async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return errorResponse(res, 400, "assignments array is required");
    }

    const academicYearId = parseId(req.body.academic_year_id);
    const classId = parseId(req.body.class_id);
    const sectionId = parseId(req.body.section_id);

    if (!academicYearId || !classId) {
      return errorResponse(res, 400, "academic_year_id and class_id are required");
    }

    const result = await executeTransaction(async (client) => {
      const roomFields = await resolveSectionRoomFields(client, sectionId);
      const savedIds = [];

      // Internal overlap check for the current bulk request
      for (let i = 0; i < assignments.length; i++) {
        for (let j = i + 1; j < assignments.length; j++) {
          const a1 = assignments[i];
          const a2 = assignments[j];
          if (Number(a1.day_of_week) === Number(a2.day_of_week)) {
            const s1 = await assertValidTimeSlotId(client, a1.time_slot_id);
            const s2 = await assertValidTimeSlotId(client, a2.time_slot_id);
            const st1 = toPgTime(s1.start_time);
            const en1 = toPgTime(s1.end_time);
            const st2 = toPgTime(s2.start_time);
            const en2 = toPgTime(s2.end_time);

            if (st1 < en2 && st2 < en1) {
              if (String(a1.teacher_id) === String(a2.teacher_id)) {
                throw new Error(`Teacher conflict in bulk request: Same teacher assigned to multiple slots on Day ${a1.day_of_week} at ${s1.slot_name} and ${s2.slot_name}.`);
              }
              if (String(a1.room_id || roomFields.classRoomId) === String(a2.room_id || roomFields.classRoomId)) {
                throw new Error(`Room conflict in bulk request: Same room assigned to multiple slots on Day ${a1.day_of_week} at ${s1.slot_name} and ${s2.slot_name}.`);
              }
            }
          }
        }
      }

      for (const item of assignments) {
        const { id, subject_id, teacher_id, day_of_week, time_slot_id } = item;
        const dayInt = normalizeDayOfWeek(day_of_week);
        if (!dayInt) throw new Error("Invalid day_of_week: " + day_of_week);

        const teacherStaffId = await resolveTeacherToStaffId(teacher_id);
        if (!teacherStaffId) throw new Error("Invalid teacher_id: " + teacher_id);

        const slotMeta = await assertValidTimeSlotId(client, time_slot_id);
        assertSlotNotBreak(slotMeta);
        assertSlotTimesForOverlap(slotMeta);

        const st = toPgTime(slotMeta.start_time);
        const en = toPgTime(slotMeta.end_time);

        // Conflict check: Teacher
        const tConflict = await findTeacherOverlappingConflictRow(client, {
          academicYearId,
          dayOfWeek: dayInt,
          newStart: st,
          newEnd: en,
          teacherStaffId,
          excludeId: id ? parseId(id) : null
        });
        if (tConflict) throw new Error(buildTeacherConflictMessage(tConflict, dayInt, slotMeta.slot_name));

        // Conflict check: Class/Section
        const cConflict = await findClassSectionOverlappingConflictRow(client, {
          academicYearId,
          dayOfWeek: dayInt,
          newStart: st,
          newEnd: en,
          classId,
          sectionId,
          forTeacherStaffId: teacherStaffId,
          excludeId: id ? parseId(id) : null
        });
        if (cConflict) throw new Error(buildClassConflictMessage(cConflict, dayInt, slotMeta.slot_name));

        const effectiveRoomId = item.room_id || roomFields.classRoomId;
        const rConflict = await findRoomOverlappingConflictRow(client, {
          academicYearId,
          dayOfWeek: dayInt,
          newStart: st,
          newEnd: en,
          roomId: effectiveRoomId,
          excludeId: id ? parseId(id) : null
        });
        if (rConflict) throw new Error(buildRoomConflictMessage(rConflict, dayInt, slotMeta.slot_name));

        if (id) {
          const r = await client.query(
            "UPDATE class_schedules SET class_subject_id = $1, teacher_id = $2, day_of_week = $3, time_slot_id = $4, class_room_id = $5, updated_at = NOW() WHERE id = $6 RETURNING *",
            [subject_id, teacherStaffId, dayInt, time_slot_id, effectiveRoomId, id]
          );
          if (r.rows[0]) {
            savedIds.push(r.rows[0].id);
          }
        } else {
          const r = await client.query(
            "INSERT INTO class_schedules (class_id, class_section_id, class_subject_id, teacher_id, day_of_week, time_slot_id, academic_year_id, class_room_id, valid_from) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE) RETURNING *",
            [classId, sectionId, subject_id, teacherStaffId, dayInt, time_slot_id, academicYearId, effectiveRoomId]
          );
          if (r.rows[0]) {
            savedIds.push(r.rows[0].id);
          }
        }
      }
      return savedIds;
    });

    return success(res, 200, "Successfully saved " + result.length + " timetable entries", { ids: result });
  } catch (err) {
    console.error("Bulk update error:", err.message);
    return res.status(200).json({ success: false, status: 'ERROR', message: err.message });
  }
};

/**
 * POST /api/timetable/copy — Clone routine from one section to another.
 */
const copyClassSchedule = async (req, res) => {
  try {
    const { source_class_id, source_section_id, target_class_id, target_section_id, academic_year_id } = req.body;

    if (!source_class_id || !target_class_id || !academic_year_id) {
      return errorResponse(res, 400, "source_class_id, target_class_id, and academic_year_id are required");
    }

    const sourceRows = await query(
      "SELECT * FROM class_schedules WHERE class_id = $1 AND (class_section_id = $2 OR class_section_id IS NULL) AND academic_year_id = $3",
      [source_class_id, source_section_id || null, academic_year_id]
    );

    if (sourceRows.rows.length === 0) {
      return errorResponse(res, 404, "Source timetable is empty");
    }

    const result = await executeTransaction(async (client) => {
      const roomFields = await resolveSectionRoomFields(client, target_section_id);
      let copiedCount = 0;
      let skipCount = 0;

      for (const row of sourceRows.rows) {
        try {
          const slotMeta = await assertValidTimeSlotId(client, row.time_slot_id);
          const st = toPgTime(slotMeta.start_time);
          const en = toPgTime(slotMeta.end_time);

          const tConflict = await findTeacherOverlappingConflictRow(client, {
            academicYearId: academic_year_id,
            dayOfWeek: row.day_of_week,
            newStart: st,
            newEnd: en,
            teacherStaffId: row.teacher_id,
            forClassId: target_class_id,
            forSectionId: target_section_id
          });
          if (tConflict) { skipCount++; continue; }

          const cConflict = await findClassSectionOverlappingConflictRow(client, {
            academicYearId: academic_year_id,
            dayOfWeek: row.day_of_week,
            newStart: st,
            newEnd: en,
            classId: target_class_id,
            sectionId: target_section_id,
            forTeacherStaffId: row.teacher_id
          });
          if (cConflict) { skipCount++; continue; }

          const ins = await client.query(
            "INSERT INTO class_schedules (class_id, class_section_id, class_subject_id, teacher_id, day_of_week, time_slot_id, academic_year_id, class_room_id, valid_from) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE) RETURNING *",
            [target_class_id, target_section_id, row.class_subject_id, row.teacher_id, row.day_of_week, row.time_slot_id, academic_year_id, roomFields.classRoomId]
          );
          if (ins.rows[0]) {
            copiedCount++;
          }
        } catch (e) {
          skipCount++;
        }
      }
      return { copiedCount, skipCount };
    });

    return success(res, 200, "Copied " + result.copiedCount + " entries, skipped " + result.skipCount + " due to conflicts.", result);
  } catch (error) {
    console.error("Copy timetable error:", error);
    return errorResponse(res, 500, "Failed to copy timetable");
  }
};

/**
 * DELETE /api/timetable/reset — Clear timetable for a section.
 */
const resetClassSchedule = async (req, res) => {
  try {
    const { class_id, section_id, academic_year_id } = req.body;
    if (!class_id || !academic_year_id) {
      return errorResponse(res, 400, "class_id and academic_year_id are required");
    }

    await query(
      "DELETE FROM class_schedules WHERE class_id = $1 AND (class_section_id = $2 OR class_section_id IS NULL) AND academic_year_id = $3",
      [class_id, section_id || null, academic_year_id]
    );

    return success(res, 200, "Timetable reset successfully");
  } catch (error) {
    console.error("Reset timetable error:", error);
    return errorResponse(res, 500, "Failed to reset timetable");
  }
};

module.exports = {
  getAllClassSchedules,
  getClassScheduleById,
  getTimetableClass,
  getTimetableTeacher,
  createClassSchedule,
  updateClassSchedule,
  deleteClassSchedule,
  getClassSchedulesDebug,
  bulkUpdateClassSchedules,
  copyClassSchedule,
  resetClassSchedule,
};
