const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_TO_INT = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7
};

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
  const n = Number(day);
  if (n >= 0 && n <= 6) return DAY_NAMES[n];
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

// Get period start/end from time_slots row (support multiple column names)
function getSlotStart(slot) {
  if (!slot) return null;
  return slot.start_time ?? slot.period_start ?? slot.start_time_period ?? slot.start ?? null;
}
function getSlotEnd(slot) {
  if (!slot) return null;
  return slot.end_time ?? slot.period_end ?? slot.end_time_period ?? slot.end ?? null;
}

function mapScheduleRow(row, classMap, sectionMap, subjectMap, timeSlotMap, teacherMap) {
  const slotKey = row.time_slot_id ?? row.time_slot ?? row.period_id;
  const slot = timeSlotMap[slotKey] ?? timeSlotMap[Number(slotKey)] ?? timeSlotMap[String(slotKey)];
  const cls = classMap[row.class_id] ?? classMap[row.class];
  const sec = sectionMap[row.section_id] ?? sectionMap[row.section];
  const subj = subjectMap[row.subject_id] ?? subjectMap[row.subject];
  const teacher = teacherMap[row.teacher_id] ?? teacherMap[row.teacher];
  const teacherName = teacher
    ? (teacher.name ?? ([teacher.first_name, teacher.last_name].filter(Boolean).join(' ').trim() || null))
    : null;
  return {
    id: row.id,
    class: cls ? (cls.class_name ?? cls.name ?? cls.class_code) : null,
    section: sec ? (sec.section_name ?? sec.name) : null,
    teacher: teacherName,
    subject: subj ? (subj.subject_name ?? subj.name ?? subj.subject_code) : null,
    day: getDayName(row),
    startTime: slot ? formatTime(getSlotStart(slot)) : formatTime(row.start_time),
    endTime: slot ? formatTime(getSlotEnd(slot)) : formatTime(row.end_time),
    classRoom: row.room_number ?? row.room ?? row.class_room ?? row.class_room_number ?? null
  };
}

const getAllClassSchedules = async (req, res) => {
  try {
    let rows = [];
    try {
      const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
      const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
      const result = hasYearFilter
        ? await query('SELECT * FROM class_schedules WHERE academic_year_id = $1 ORDER BY id ASC', [academicYearId])
        : await query('SELECT * FROM class_schedules ORDER BY id ASC');
      rows = result.rows;
    } catch (e) {
      try {
        const result = await query('SELECT * FROM class_schedule ORDER BY id ASC');
        rows = result.rows;
      } catch (e2) {
        throw e;
      }
    }
    const classIds = [...new Set(rows.map((r) => r.class_id ?? r.class).filter(Boolean))];
    const sectionIds = [...new Set(rows.map((r) => r.section_id ?? r.section).filter(Boolean))];
    const subjectIds = [...new Set(rows.map((r) => r.subject_id ?? r.subject).filter(Boolean))];
    const timeSlotIds = [...new Set(rows.map((r) => r.time_slot_id ?? r.time_slot ?? r.period_id).filter(Boolean))];
    const teacherIds = [...new Set(rows.map((r) => r.teacher_id ?? r.teacher).filter(Boolean))];

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
    let timeSlotMap = {};
    if (timeSlotIds.length > 0) {
      try {
        // time_slot_id in class_schedules stores the period's pass key – may match time_slots.id or time_slots.pass_key
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
    }
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
        // staff may not exist, try teachers
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

    const data = rows.map((row) =>
      mapScheduleRow(row, classMap, sectionMap, subjectMap, timeSlotMap, teacherMap)
    );
    return success(res, 200, 'Class schedules fetched successfully', data, { count: data.length });
  } catch (error) {
    console.error('Error fetching class schedules:', error);
    return errorResponse(res, 500, 'Failed to fetch class schedules');
  }
};

const getClassScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    let row = null;
    try {
      const result = await query('SELECT * FROM class_schedules WHERE id = $1', [id]);
      if (result.rows.length > 0) row = result.rows[0];
    } catch (e) {
      try {
        const result = await query('SELECT * FROM class_schedule WHERE id = $1', [id]);
        if (result.rows.length > 0) row = result.rows[0];
      } catch (e2) {
        throw e;
      }
    }
    if (!row) {
      return errorResponse(res, 404, 'Class schedule not found');
    }
    const classIds = [row.class_id ?? row.class].filter(Boolean);
    const sectionIds = [row.section_id ?? row.section].filter(Boolean);
    const subjectIds = [row.subject_id ?? row.subject].filter(Boolean);
    const timeSlotIds = [row.time_slot_id ?? row.time_slot].filter(Boolean);
    const teacherIds = [row.teacher_id ?? row.teacher].filter(Boolean);

    let classMap = {};
    let sectionMap = {};
    let subjectMap = {};
    let timeSlotMap = {};
    let teacherMap = {};
    if (classIds.length > 0) {
      const r = await query('SELECT * FROM classes WHERE id = $1', [classIds[0]]);
      if (r.rows.length > 0) classMap[classIds[0]] = r.rows[0];
    }
    if (sectionIds.length > 0) {
      const r = await query('SELECT * FROM sections WHERE id = $1', [sectionIds[0]]);
      if (r.rows.length > 0) sectionMap[sectionIds[0]] = r.rows[0];
    }
    if (subjectIds.length > 0) {
      const r = await query('SELECT * FROM subjects WHERE id = $1', [subjectIds[0]]);
      if (r.rows.length > 0) subjectMap[subjectIds[0]] = r.rows[0];
    }
    if (timeSlotIds.length > 0) {
      try {
        const r = await query('SELECT * FROM time_slots WHERE id = $1', [timeSlotIds[0]]);
        if (r.rows.length > 0) timeSlotMap[timeSlotIds[0]] = r.rows[0];
      } catch (e) {}
    }
    if (teacherIds.length > 0) {
      try {
        const r = await query('SELECT * FROM staff WHERE id = $1', [teacherIds[0]]);
        if (r.rows.length > 0) teacherMap[teacherIds[0]] = r.rows[0];
      } catch (e) {
        try {
          const r = await query('SELECT * FROM teachers WHERE id = $1', [teacherIds[0]]);
          if (r.rows.length > 0) teacherMap[teacherIds[0]] = r.rows[0];
        } catch (e2) {}
      }
    }

    const data = mapScheduleRow(row, classMap, sectionMap, subjectMap, timeSlotMap, teacherMap);
    return success(res, 200, 'Class schedule fetched successfully', data);
  } catch (error) {
    console.error('Error fetching class schedule:', error);
    return errorResponse(res, 500, 'Failed to fetch class schedule');
  }
};

// Create class schedule
const createClassSchedule = async (req, res) => {
  try {
    const {
      teacher_id, class_id, section_id, subject_id, day_of_week, class_room_id,
      room_number, time_slot_id, academic_year_id
    } = req.body;

    let slotId = time_slot_id || null;
    if (!slotId) {
      const slotRes = await query('SELECT id FROM time_slots ORDER BY id ASC LIMIT 1');
      slotId = slotRes.rows.length > 0 ? slotRes.rows[0].id : null;
    }

    const dayInt = normalizeDayOfWeek(day_of_week);
    if (!dayInt) return errorResponse(res, 400, 'Invalid day_of_week. Use 1-7 or day name');
    const teacherStaffId = await resolveTeacherToStaffId(teacher_id);
    if (!teacherStaffId) return errorResponse(res, 400, 'Invalid teacher_id');
    const roomVal = room_number != null ? String(room_number) : null;
    let academicYearId = academic_year_id || null;
    if (!academicYearId) {
      const classRes = await query('SELECT academic_year_id FROM classes WHERE id = $1 LIMIT 1', [class_id]);
      academicYearId = classRes.rows[0]?.academic_year_id || null;
    }
    if (!academicYearId) return errorResponse(res, 400, 'academic_year_id is required');
    let tableName = 'class_schedules';
    try {
      await query(`SELECT 1 FROM ${tableName} LIMIT 1`);
    } catch (e) {
      tableName = 'class_schedule';
    }

    const result = await query(`
      INSERT INTO ${tableName} (teacher_id, class_id, section_id, subject_id, time_slot_id, day_of_week, room_number, class_room_id, academic_year_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      teacherStaffId,
      class_id,
      section_id || null,
      subject_id || null,
      slotId,
      dayInt,
      roomVal,
      class_room_id || null,
      academicYearId
    ]);

    return success(res, 201, 'Class routine added successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating class schedule:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid references in routine payload');
    return errorResponse(res, 500, 'Failed to add class routine');
  }
};

const updateClassSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const current = await query('SELECT * FROM class_schedules WHERE id = $1', [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Class schedule not found');
    const cur = current.rows[0];

    const teacherId = payload.teacher_id ? await resolveTeacherToStaffId(payload.teacher_id) : cur.teacher_id;
    if (!teacherId) return errorResponse(res, 400, 'Invalid teacher_id');
    const dayInt = payload.day_of_week !== undefined ? normalizeDayOfWeek(payload.day_of_week) : cur.day_of_week;
    if (!dayInt) return errorResponse(res, 400, 'Invalid day_of_week. Use 1-7 or day name');

    const result = await query(
      `UPDATE class_schedules SET
        teacher_id = $1, class_id = $2, section_id = $3, subject_id = $4, time_slot_id = $5,
        day_of_week = $6, room_number = $7, class_room_id = $8, academic_year_id = $9, modified_at = NOW()
      WHERE id = $10 RETURNING *`,
      [
        teacherId,
        payload.class_id ?? cur.class_id,
        payload.section_id ?? cur.section_id,
        payload.subject_id ?? cur.subject_id,
        payload.time_slot_id ?? cur.time_slot_id,
        dayInt,
        payload.room_number ?? cur.room_number,
        payload.class_room_id ?? cur.class_room_id,
        payload.academic_year_id ?? cur.academic_year_id,
        id
      ]
    );
    return success(res, 200, 'Class routine updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating class schedule:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid references in routine payload');
    return errorResponse(res, 500, 'Failed to update class routine');
  }
};

const deleteClassSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM class_schedules WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return errorResponse(res, 404, 'Class schedule not found');
    return success(res, 200, 'Class routine deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting class schedule:', error);
    return errorResponse(res, 500, 'Failed to delete class routine');
  }
};

// Debug: raw counts and sample rows (no DB writes). Helps verify table/column names.
const getClassSchedulesDebug = async (req, res) => {
  try {
    const out = { class_schedules_count: 0, time_slots_count: 0, classes_count: 0, sample_schedules: [], sample_time_slots: [], raw_first_schedule: null, errors: [] };
    try {
      const r = await query('SELECT * FROM class_schedules ORDER BY id ASC LIMIT 5');
      out.class_schedules_count = r.rows.length;
      out.sample_schedules = r.rows;
      if (r.rows.length > 0) out.raw_first_schedule = r.rows[0];
    } catch (e) {
      try {
        const r = await query('SELECT * FROM class_schedule ORDER BY id ASC LIMIT 5');
        out.class_schedules_count = r.rows.length;
        out.sample_schedules = r.rows;
        if (r.rows.length > 0) out.raw_first_schedule = r.rows[0];
      } catch (e2) {
        out.errors.push('class_schedules/class_schedule: ' + (e?.message || String(e)));
      }
    }
    try {
      const r = await query('SELECT * FROM time_slots ORDER BY id ASC LIMIT 10');
      out.time_slots_count = r.rows.length;
      out.sample_time_slots = r.rows;
    } catch (e) {
      out.errors.push('time_slots: ' + (e?.message || String(e)));
    }
    try {
      const r = await query('SELECT COUNT(*) AS c FROM classes');
      out.classes_count = parseInt(r.rows[0]?.c, 10) || 0;
    } catch (e) {
      out.errors.push('classes: ' + (e?.message || String(e)));
    }
    return success(res, 200, 'Class schedule debug fetched', out);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to process request');
  }
};

module.exports = {
  getAllClassSchedules,
  getClassScheduleById,
  createClassSchedule,
  updateClassSchedule,
  deleteClassSchedule,
  getClassSchedulesDebug
};
