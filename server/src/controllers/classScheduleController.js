const { query } = require('../config/database');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
      const result = await query('SELECT * FROM class_schedules ORDER BY id ASC');
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
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class schedules fetched successfully',
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching class schedules:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch class schedules',
    });
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
      return res.status(404).json({ status: 'ERROR', message: 'Class schedule not found' });
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
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class schedule fetched successfully',
      data
    });
  } catch (error) {
    console.error('Error fetching class schedule:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch class schedule',
    });
  }
};

// Create class schedule
const createClassSchedule = async (req, res) => {
  try {
    const { teacher_id, class_id, section_id, subject_id, day_of_week, class_room_id, room_number, time_slot_id } = req.body;

    if (!teacher_id || !class_id || !section_id) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Teacher, Class, and Section are required'
      });
    }

    let slotId = time_slot_id || null;
    if (!slotId) {
      const slotRes = await query('SELECT id FROM time_slots ORDER BY id ASC LIMIT 1');
      slotId = slotRes.rows.length > 0 ? slotRes.rows[0].id : null;
    }

    const roomVal = room_number || class_room_id || null;
    let tableName = 'class_schedules';
    try {
      await query(`SELECT 1 FROM ${tableName} LIMIT 1`);
    } catch (e) {
      tableName = 'class_schedule';
    }

    const result = await query(`
      INSERT INTO ${tableName} (teacher_id, class_id, section_id, subject_id, time_slot_id, day_of_week, room_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      teacher_id,
      class_id,
      section_id || null,
      subject_id || null,
      slotId,
      day_of_week || 'Monday',
      roomVal != null ? String(roomVal) : null
    ]);

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Class routine added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating class schedule:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to add class routine'
    });
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
    res.status(200).json({ status: 'SUCCESS', ...out });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Failed to process request' });
  }
};

module.exports = { getAllClassSchedules, getClassScheduleById, createClassSchedule, getClassSchedulesDebug };
