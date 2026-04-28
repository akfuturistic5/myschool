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
  const staffTry = await query('SELECT id FROM staff WHERE id = $1 LIMIT 1', [teacherId]);
  if (staffTry.rows.length) return staffTry.rows[0].id;
  const teacherTry = await query('SELECT staff_id FROM teachers WHERE id = $1 LIMIT 1', [teacherId]);
  if (teacherTry.rows.length) return teacherTry.rows[0].staff_id;
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
  const sec = sectionMap[row.section_id] ?? sectionMap[row.section];
  const subj = subjectMap[row.subject_id] ?? subjectMap[row.subject];
  const teacher = teacherMap[row.teacher_id] ?? teacherMap[row.teacher];
  const teacherName = teacher
    ? (teacher.name ?? ([teacher.first_name, teacher.last_name].filter(Boolean).join(' ').trim() || null))
    : null;
  const roomFromFk = row.class_room_id != null ? roomMap[row.class_room_id] ?? roomMap[Number(row.class_room_id)] : null;
  const roomLabel = roomFromFk?.room_no ?? roomFromFk?.name ?? row.room_number ?? row.room ?? row.class_room ?? row.class_room_number ?? null;

  return {
    id: row.id,
    class_id: row.class_id ?? null,
    section_id: row.section_id ?? null,
    subject_id: row.subject_id ?? null,
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
    const r = await query('SELECT * FROM time_slots');
    r.rows.forEach((t) => {
      const id = t.id;
      const passKey = t.pass_key ?? t.passkey ?? t.period_key ?? id;
      [id, passKey, Number(id), String(id), Number(passKey), String(passKey)].forEach((k) => {
        if (k != null && k !== '') timeSlotMap[k] = t;
      });
    });
  } catch (e) {
    try {
      const r = await query('SELECT * FROM time_slots WHERE id = ANY($1)', [timeSlotIds]);
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
      console.error('time_slots fetch failed:', e2.message);
      }
    }
  return timeSlotMap;
}

async function enrichScheduleRows(rows) {
    const classIds = [...new Set(rows.map((r) => r.class_id ?? r.class).filter(Boolean))];
    const sectionIds = [...new Set(rows.map((r) => r.section_id ?? r.section).filter(Boolean))];
    const subjectIds = [...new Set(rows.map((r) => r.subject_id ?? r.subject).filter(Boolean))];
    const timeSlotIds = [...new Set(rows.map((r) => r.time_slot_id ?? r.time_slot ?? r.period_id).filter(Boolean))];
    const teacherIds = [...new Set(rows.map((r) => r.teacher_id ?? r.teacher).filter(Boolean))];
  const roomIds = [...new Set(rows.map((r) => r.class_room_id).filter(Boolean))];

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
        const r = await query('SELECT * FROM sections WHERE id = ANY($1)', [sectionIds]);
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
    if (subjectIds.length > 0) {
      try {
        const r = await query('SELECT * FROM subjects WHERE id = ANY($1)', [subjectIds]);
        r.rows.forEach((s) => {
          subjectMap[s.id] = s;
          subjectMap[Number(s.id)] = s;
          subjectMap[String(s.id)] = s;
        });
      } catch (e) {
        console.error('subjects fetch for schedules:', e.message);
      }
    }
  const timeSlotMap = await buildTimeSlotMap(timeSlotIds);

    let teacherMap = {};
    if (teacherIds.length > 0) {
      try {
        const r = await query('SELECT * FROM staff WHERE id = ANY($1)', [teacherIds]);
        r.rows.forEach((t) => {
          teacherMap[t.id] = t;
          teacherMap[Number(t.id)] = t;
          teacherMap[String(t.id)] = t;
        });
      } catch (e) {
        try {
          const r = await query('SELECT * FROM teachers WHERE id = ANY($1)', [teacherIds]);
          r.rows.forEach((t) => {
            teacherMap[t.id] = t;
            teacherMap[Number(t.id)] = t;
            teacherMap[String(t.id)] = t;
          });
        } catch (e2) {}
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
      where += ` AND section_id = $${p++}`;
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
      where += ` AND section_id = $${p++}`;
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
      where += ` AND (section_id = $${p++} OR section_id IS NULL)`;
      params.push(scope.sectionId);
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
    where += ` AND EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = ANY($${p}::int[])
        AND s.is_active = true
        AND s.class_id = class_schedules.class_id
        AND (class_schedules.section_id IS NULL OR s.section_id IS NULL OR class_schedules.section_id = s.section_id)
    )`;
    params.push(wardIds);
    p += 1;
    if (classIdFilter) {
      where += ` AND class_id = $${p++}`;
      params.push(classIdFilter);
    }
    if (sectionIdFilter) {
      where += ` AND section_id = $${p++}`;
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
    const r2 = await query(
      `SELECT 1 FROM students s
       WHERE s.id = ANY($1::int[]) AND s.is_active = true
         AND s.class_id = $2
         AND ($3::int IS NULL OR s.section_id IS NOT DISTINCT FROM $3)
       LIMIT 1`,
      [wardIds, classId, sectionId]
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

async function resolveSectionRoomFields(client, sectionId) {
  if (sectionId == null || sectionId === '') return { roomNumber: null, classRoomId: null };
  const sid = parseId(sectionId);
  if (!sid) return { roomNumber: null, classRoomId: null };
  const r = await qexec(
    client,
    `SELECT NULLIF(TRIM(sec.room_number), '') AS room_number,
            (SELECT cr.id FROM class_rooms cr
             WHERE LOWER(TRIM(BOTH FROM cr.room_no)) = LOWER(TRIM(BOTH FROM sec.room_number))
               AND (cr.status IS NULL OR cr.status ILIKE 'active')
             ORDER BY cr.id ASC LIMIT 1) AS class_room_id
     FROM sections sec WHERE sec.id = $1 LIMIT 1`,
    [sid]
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
  forClassId,
  forSectionId,
  excludeId,
}) {
  const cid = parseId(forClassId);
  const sid = forSectionId != null && forSectionId !== '' ? parseId(forSectionId) : null;
  const params = [academicYearId, dayOfWeek, teacherStaffId, newStart, newEnd, cid, sid];
  let sql = `
    SELECT cs.id,
      TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS teacher_name,
      ts.slot_name,
      c.class_name,
      sec.section_name
    FROM class_schedules cs
    INNER JOIN time_slots ts ON ts.id = cs.time_slot_id
    LEFT JOIN staff st ON st.id = cs.teacher_id
    LEFT JOIN classes c ON c.id = cs.class_id
    LEFT JOIN sections sec ON sec.id = cs.section_id
    WHERE cs.academic_year_id = $1
      AND cs.day_of_week = $2
      AND cs.teacher_id = $3
      AND ts.start_time IS NOT NULL
      AND ts.end_time IS NOT NULL
      AND ($4::time < ts.end_time AND ts.start_time < $5::time)
      AND NOT (cs.class_id = $6 AND cs.section_id IS NOT DISTINCT FROM $7)`;
  if (excludeId) {
    sql += ' AND cs.id <> $8';
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
      TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS teacher_name
    FROM class_schedules cs
    INNER JOIN time_slots ts ON ts.id = cs.time_slot_id
    LEFT JOIN classes c ON c.id = cs.class_id
    LEFT JOIN sections sec ON sec.id = cs.section_id
    LEFT JOIN subjects sub ON sub.id = cs.subject_id
    LEFT JOIN staff st ON st.id = cs.teacher_id
    WHERE cs.academic_year_id = $1
      AND cs.day_of_week = $2
      AND cs.class_id = $3
      AND (cs.section_id IS NOT DISTINCT FROM $4)
      AND ts.start_time IS NOT NULL
      AND ts.end_time IS NOT NULL
      AND ($5::time < ts.end_time AND ts.start_time < $6::time)
      AND cs.teacher_id IS DISTINCT FROM $7`;
  if (excludeId) {
    sql += ' AND cs.id <> $8';
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

async function assertValidTimeSlotId(client, timeSlotId) {
  const r = await qexec(
    client,
    `SELECT id, slot_name, start_time, end_time, COALESCE(is_break, false) AS is_break
     FROM time_slots WHERE id = $1 LIMIT 1`,
    [timeSlotId]
  );
  if (!r.rows.length) {
    const err = new Error('INVALID_TIME_SLOT');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
  return r.rows[0];
}

async function assertSubjectAllowedForClass(client, subjectId, classId) {
  if (subjectId == null || subjectId === '') return;
  const sid = parseId(subjectId);
  if (!sid) {
    const err = new Error('Invalid subject_id');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
  const cid = parseId(classId);
  if (!cid) {
    const err = new Error('Invalid class_id');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
  const r = await qexec(
    client,
    `SELECT id FROM subjects
     WHERE id = $1 AND class_id = $2 AND (is_active IS DISTINCT FROM false)
     LIMIT 1`,
    [sid, cid]
  );
  if (!r.rows.length) {
    const err = new Error('This subject is not linked to the selected class.');
    err.code = 'TIMETABLE_VALIDATION';
    throw err;
  }
}

async function syncTeacherRoutineLink(client, row) {
  if (!row?.id || !row.teacher_id || !row.academic_year_id) return;
  try {
    await qexec(client, 'DELETE FROM teacher_routines WHERE class_schedule_id = $1', [row.id]);
    await qexec(
      client,
      `INSERT INTO teacher_routines (teacher_id, class_schedule_id, academic_year_id, is_active, created_at, modified_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())`,
      [row.teacher_id, row.id, row.academic_year_id]
    );
  } catch (e) {
    console.warn('teacher_routines sync skipped:', e.message);
  }
}

async function removeTeacherRoutineLink(client, scheduleId) {
  if (!scheduleId) return;
  try {
    await qexec(client, 'DELETE FROM teacher_routines WHERE class_schedule_id = $1', [scheduleId]);
  } catch (e) {
    console.warn('teacher_routines delete skipped:', e.message);
  }
}

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
    const sectionId = parseId(req.query.section_id);
    if (!academicYearId || !classId) {
      return errorResponse(res, 400, 'academic_year_id and class_id are required');
    }

    const acc = await canAccessClass(req, classId);
    if (!acc.ok) {
      return errorResponse(res, acc.status || 403, acc.message || 'Access denied');
    }

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx) && sectionId) {
      if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
        const scope = await resolveStudentScopeForUser(ctx.userId);
        if (scope?.sectionId && scope.sectionId !== sectionId) {
          return errorResponse(res, 403, 'Access denied');
        }
      } else if (isParentOrGuardianPortalRole(ctx)) {
        const wardIds = await resolveWardStudentIdsForUser(req);
        const secOk = await query(
          `SELECT 1 FROM students s
           WHERE s.id = ANY($1::int[]) AND s.is_active = true
             AND s.class_id = $2 AND s.section_id IS NOT DISTINCT FROM $3
           LIMIT 1`,
          [wardIds, classId, sectionId]
        ).catch(() => ({ rows: [] }));
        if (!secOk.rows?.length) {
          return errorResponse(res, 403, 'Access denied');
        }
      }
    }

    const scoped = await buildScopedWhere(req, academicYearId, { class_id: classId, section_id: sectionId || undefined });
    if (scoped.forbidden) {
      return errorResponse(res, 403, 'Access denied');
    }

    let where = scoped.where;
    const params = [...scoped.params];
    let p = params.length + 1;
    where += ` AND class_id = $${p++}`;
    params.push(classId);
    if (sectionId) {
      where += ` AND (section_id = $${p++} OR section_id IS NULL)`;
      params.push(sectionId);
    }

    const rows = await loadSchedulesFromDb(where, params);
    const data = await enrichScheduleRows(rows);

    let slots = [];
    try {
      const sr = await query('SELECT id, slot_name, start_time, end_time, duration, is_break, is_active FROM time_slots WHERE is_active IS DISTINCT FROM false ORDER BY start_time ASC NULLS LAST, id ASC');
      slots = sr.rows || [];
    } catch (e) {
      slots = [];
    }

    return success(res, 200, 'Class timetable fetched successfully', { entries: data, slots }, { count: data.length });
  } catch (error) {
    console.error('Error fetching class timetable:', error);
    return errorResponse(res, 500, 'Failed to fetch class timetable');
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
      const sr = await query('SELECT id, slot_name, start_time, end_time, duration, is_break, is_active FROM time_slots WHERE is_active IS DISTINCT FROM false ORDER BY start_time ASC NULLS LAST, id ASC');
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
  if (c === 'uq_class_schedules_teacher_year_day_slot' || d.includes('uq_class_schedules_teacher_year_day_slot')) {
    return 'This teacher is already booked in that period (database constraint).';
  }
  if (c === 'uq_class_schedules_class_year_day_slot' || d.includes('uq_class_schedules_class_year_day_slot')) {
    return 'This class and section already have an entry in that period (database constraint).';
  }
  return 'This timetable change conflicts with an existing entry. Refresh and try again.';
}

const createClassSchedule = async (req, res) => {
  try {
    const {
      teacher_id, class_id, section_id, subject_id, day_of_week,
      time_slot_id, academic_year_id,
    } = req.body;

    let slotId = time_slot_id || null;
    if (!slotId) {
      const slotRes = await query('SELECT id FROM time_slots ORDER BY id ASC LIMIT 1');
      slotId = slotRes.rows.length > 0 ? slotRes.rows[0].id : null;
    }
    if (!slotId) {
      return errorResponse(res, 400, 'time_slot_id is required (no time slots defined)');
    }

    const dayInt = normalizeDayOfWeek(day_of_week);
    if (!dayInt) return errorResponse(res, 400, 'Invalid day_of_week. Use 1-7 or day name');
    const teacherStaffId = await resolveTeacherToStaffId(teacher_id);
    if (!teacherStaffId) return errorResponse(res, 400, 'Invalid teacher_id');
    let academicYearId = academic_year_id || null;
    if (!academicYearId) {
      const classRes = await query('SELECT academic_year_id FROM classes WHERE id = $1 LIMIT 1', [class_id]);
      academicYearId = classRes.rows[0]?.academic_year_id || null;
    }
    if (!academicYearId) return errorResponse(res, 400, 'academic_year_id is required');

    const created = await executeTransaction(async (client) => {
      const slotMeta = await assertValidTimeSlotId(client, slotId);
      assertSlotNotBreak(slotMeta);
      assertSlotTimesForOverlap(slotMeta);
      const newStart = toPgTime(slotMeta.start_time);
      const newEnd = toPgTime(slotMeta.end_time);
      await assertSubjectAllowedForClass(client, subject_id, class_id);

      const tRow = await findTeacherOverlappingConflictRow(client, {
        academicYearId,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        teacherStaffId,
        forClassId: class_id,
        forSectionId: section_id ?? null,
        excludeId: null,
      });
      if (tRow) {
        const err = new Error(buildTeacherConflictMessage(tRow, dayInt, slotMeta.slot_name));
        err.code = 'TIMETABLE_CONFLICT';
        throw err;
      }
      const cRow = await findClassSectionOverlappingConflictRow(client, {
        academicYearId,
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

      const ins = await client.query(
        `INSERT INTO class_schedules (teacher_id, class_id, section_id, subject_id, time_slot_id, day_of_week, room_number, class_room_id, academic_year_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
      teacherStaffId,
      class_id,
      section_id || null,
      subject_id || null,
      slotId,
      dayInt,
          secRoom.roomNumber,
          secRoom.classRoomId,
          academicYearId,
        ]
      );
      const row = ins.rows[0];
      await syncTeacherRoutineLink(client, row);
      return row;
    });

    return success(res, 201, 'Class routine added successfully', created);
  } catch (error) {
    console.error('Error creating class schedule:', error);
    if (error.code === 'TIMETABLE_CONFLICT') {
      return errorResponse(res, 409, error.message);
    }
    if (error.code === 'TIMETABLE_VALIDATION') {
      if (error.message === 'INVALID_TIME_SLOT') {
        return errorResponse(res, 400, 'Invalid time_slot_id: period does not exist');
      }
      if (error.message === 'INVALID_SUBJECT') {
        return errorResponse(res, 400, 'Invalid subject_id');
      }
      return errorResponse(res, 400, error.message || 'Validation failed');
    }
    if (error.code === '23505') {
      return errorResponse(res, 409, uniqueViolationUserMessage(error));
    }
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid references in routine payload');
    if (String(error.message || '').includes('class_room_id')) {
      return errorResponse(res, 400, 'class_room_id column missing — run migration 039_timetable_class_schedules_hardening.sql');
    }
    return errorResponse(res, 500, 'Failed to add class routine');
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
        await assertSubjectAllowedForClass(client, payload.subject_id, nextClass);
      }

      const tRow = await findTeacherOverlappingConflictRow(client, {
        academicYearId: nextYear,
        dayOfWeek: dayInt,
        newStart,
        newEnd,
        teacherStaffId: teacherId,
        forClassId: nextClass,
        forSectionId: nextSection ?? null,
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

      const result = await client.query(
      `UPDATE class_schedules SET
        teacher_id = $1, class_id = $2, section_id = $3, subject_id = $4, time_slot_id = $5,
        day_of_week = $6, room_number = $7, class_room_id = $8, academic_year_id = $9, modified_at = NOW()
      WHERE id = $10 RETURNING *`,
      [
        teacherId,
          nextClass,
          nextSection,
          payload.subject_id !== undefined ? payload.subject_id : cur.subject_id,
          nextSlot,
        dayInt,
          secRoom.roomNumber,
          secRoom.classRoomId,
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
    if (error.code === 'TIMETABLE_CONFLICT') {
      return errorResponse(res, 409, error.message);
    }
    if (error.code === 'TIMETABLE_VALIDATION') {
      return errorResponse(res, 400, error.message || 'Validation failed');
    }
    if (error.code === '23505') {
      return errorResponse(res, 409, uniqueViolationUserMessage(error));
    }
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid references in routine payload');
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
      const r = await query('SELECT * FROM time_slots ORDER BY id ASC LIMIT 10');
      out.time_slots_count = r.rows.length;
      out.sample_time_slots = r.rows;
    } catch (e) {
      out.errors.push(`time_slots: ${e?.message || String(e)}`);
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

module.exports = {
  getAllClassSchedules,
  getClassScheduleById,
  getTimetableClass,
  getTimetableTeacher,
  createClassSchedule,
  updateClassSchedule,
  deleteClassSchedule,
  getClassSchedulesDebug,
};
