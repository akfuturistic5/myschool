const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

function formatTime(val) {
  if (val == null) return null;
  if (typeof val === 'string' && /^\d{1,2}:\d{2}/.test(val)) return val;
  if (val instanceof Date) return val.toTimeString().slice(0, 5);
  return String(val);
}

// Format time for display (HH:MM AM/PM)
function formatTimeDisplay(t) {
  if (t == null || t === '') return null;
  const s = String(t).trim();
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(s)) return s;
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return s;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

async function assertStartBeforeEnd(start, end) {
  const r = await query('SELECT ($1::time < $2::time) AS ok', [start, end]);
  if (!r.rows[0]?.ok) {
    return 'End time must be after start time.';
  }
  return null;
}

/** Duration in whole minutes from start/end time-of-day (same rules as assertStartBeforeEnd). */
async function durationMinutesBetween(startTimeStr, endTimeStr) {
  const r = await query(
    `SELECT (EXTRACT(EPOCH FROM ($2::time - $1::time)) / 60)::int AS m`,
    [startTimeStr, endTimeStr]
  );
  const m = r.rows[0]?.m;
  return Number.isFinite(m) ? m : null;
}

function resolveUserIdForCreatedBy(req) {
  const id = req.user?.id;
  if (id == null) return null;
  const n = typeof id === 'number' ? id : parseInt(String(id), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Find another time_slots row whose range overlaps the given range (optional exclude id for updates). */
async function findOverlappingTimeSlot(newStart, newEnd, excludeId = null) {
  if (excludeId != null && excludeId !== '') {
    const r = await query(
      `SELECT id, slot_name, start_time, end_time FROM time_slots
       WHERE id <> $3::int AND ($1::time < end_time AND start_time < $2::time)
       LIMIT 1`,
      [newStart, newEnd, excludeId]
    );
    return r.rows[0] || null;
  }
  const r = await query(
    `SELECT id, slot_name, start_time, end_time FROM time_slots
     WHERE ($1::time < end_time AND start_time < $2::time)
     LIMIT 1`,
    [newStart, newEnd]
  );
  return r.rows[0] || null;
}

function mapScheduleRow(row) {
  const isActive = row.is_active !== false && row.is_active !== 'false' && row.status !== 'Inactive' && row.status !== 'inactive';
  const statusVal = row.status ?? (isActive ? 'Active' : 'Inactive');
  const dur = row.duration != null && row.duration !== '' ? Number(row.duration) : null;
  return {
    id: row.id,
    type: row.pass_key ?? row.type ?? row.slot_name ?? 'Class',
    startTime: formatTimeDisplay(row.start_time ?? row.start) ?? formatTime(row.start_time ?? row.start),
    endTime: formatTimeDisplay(row.end_time ?? row.end) ?? formatTime(row.end_time ?? row.end),
    duration: Number.isFinite(dur) ? dur : null,
    status: statusVal === 'Active' || statusVal === 'active' || statusVal === true ? 'Active' : 'Inactive',
    key: row.id,
    originalData: row
  };
}

// Get all schedules (time_slots) - NO status filter, return both active and inactive
const getAllSchedules = async (req, res) => {
  try {
    let rows = [];
    try {
      const result = await query('SELECT * FROM time_slots ORDER BY id ASC');
      rows = result.rows;
    } catch (e) {
      try {
        const result = await query('SELECT * FROM schedule ORDER BY id ASC');
        rows = result.rows;
      } catch (e2) {
        try {
          const result = await query('SELECT * FROM schedules ORDER BY id ASC');
          rows = result.rows;
        } catch (e3) {
          throw e;
        }
      }
    }
    const data = rows.map((row) => mapScheduleRow(row));
    return success(res, 200, 'Time slots fetched successfully', data, { count: data.length });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return errorResponse(res, 500, 'Failed to load time slots');
  }
};

const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    let row = null;
    try {
      const result = await query('SELECT * FROM time_slots WHERE id = $1', [id]);
      if (result.rows.length > 0) row = result.rows[0];
    } catch (e) {
      try {
        const result = await query('SELECT * FROM schedule WHERE id = $1', [id]);
        if (result.rows.length > 0) row = result.rows[0];
      } catch (e2) {
        try {
          const result = await query('SELECT * FROM schedules WHERE id = $1', [id]);
          if (result.rows.length > 0) row = result.rows[0];
        } catch (e3) {
          throw e;
        }
      }
    }
    if (!row) {
      return errorResponse(res, 404, 'Time slot not found');
    }
    const data = mapScheduleRow(row);
    return success(res, 200, 'Time slot fetched successfully', data);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return errorResponse(res, 500, 'Failed to load time slot');
  }
};

const createSchedule = async (req, res) => {
  try {
    const { slot_name, start_time, end_time, is_break, is_active } = req.body;
    const rangeErr = await assertStartBeforeEnd(start_time, end_time);
    if (rangeErr) return errorResponse(res, 400, rangeErr);
    const overlap = await findOverlappingTimeSlot(start_time, end_time);
    if (overlap) {
      const label = overlap.slot_name || `slot #${overlap.id}`;
      const ex = `${formatTime(overlap.start_time)}–${formatTime(overlap.end_time)}`;
      return errorResponse(
        res,
        409,
        `This time overlaps with "${label}" (${ex}). Use a different time range.`
      );
    }
    const durationMins = await durationMinutesBetween(start_time, end_time);
    if (durationMins == null || durationMins < 1) {
      return errorResponse(res, 400, 'Could not compute slot duration from start and end time.');
    }
    const createdBy = resolveUserIdForCreatedBy(req);
    const result = await query(
      `INSERT INTO time_slots (slot_name, start_time, end_time, duration, is_break, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        slot_name.trim(),
        start_time,
        end_time,
        durationMins,
        Boolean(is_break),
        is_active !== false,
        createdBy,
      ]
    );
    return success(res, 201, 'Time slot created successfully', mapScheduleRow(result.rows[0]));
  } catch (error) {
    console.error('Error creating time slot:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'A time slot with this name or time range already exists');
    }
    if (error.code === '22001') {
      return errorResponse(res, 400, 'Slot name is too long. Use at most 100 characters.');
    }
    return errorResponse(res, 500, 'Failed to add time slot');
  }
};

// Update schedule - use modified_at (not updated_at)
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, pass_key, slot_name, start_time, end_time, status, is_active } = req.body;
    const typeVal = pass_key ?? type ?? slot_name;

    let isActiveBoolean = true;
    if (status !== undefined) {
      isActiveBoolean = status === 'Active' || status === 'active';
    } else if (is_active !== undefined) {
      isActiveBoolean = is_active === true || is_active === 'true' || is_active === 1;
    }

    let tableName = null;
    try {
      const r = await query('SELECT id FROM time_slots WHERE id = $1', [id]);
      if (r.rows.length > 0) tableName = 'time_slots';
    } catch (e) {}
    if (!tableName) {
      try {
        const r = await query('SELECT id FROM schedule WHERE id = $1', [id]);
        if (r.rows.length > 0) tableName = 'schedule';
      } catch (e2) {}
    }
    if (!tableName) {
      try {
        const r = await query('SELECT id FROM schedules WHERE id = $1', [id]);
        if (r.rows.length > 0) tableName = 'schedules';
      } catch (e3) {}
    }
    if (!tableName) {
      return errorResponse(res, 404, 'Time slot not found');
    }

    let slotMergedStart = null;
    let slotMergedEnd = null;
    if (tableName === 'time_slots') {
      const existingRow = await query('SELECT start_time, end_time FROM time_slots WHERE id = $1', [id]);
      if (!existingRow.rows.length) {
        return errorResponse(res, 404, 'Time slot not found');
      }
      const cur = existingRow.rows[0];
      const mergedStart = start_time !== undefined ? start_time : cur.start_time;
      const mergedEnd = end_time !== undefined ? end_time : cur.end_time;
      slotMergedStart = mergedStart;
      slotMergedEnd = mergedEnd;
      const rangeErr = await assertStartBeforeEnd(mergedStart, mergedEnd);
      if (rangeErr) return errorResponse(res, 400, rangeErr);
      const overlap = await findOverlappingTimeSlot(mergedStart, mergedEnd, id);
      if (overlap) {
        const label = overlap.slot_name || `slot #${overlap.id}`;
        const ex = `${formatTime(overlap.start_time)}–${formatTime(overlap.end_time)}`;
        return errorResponse(
          res,
          409,
          `This time overlaps with "${label}" (${ex}). Use a different time range.`
        );
      }
    }

    // Get existing columns to avoid updating non-existent columns
    let existingCols = [];
    try {
      const colRes = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);
      existingCols = colRes.rows.map((r) => r.column_name);
    } catch (_) {
      existingCols = [];
    }
    const hasCol = (name) => existingCols.includes(name);

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Label: pass_key, type, or slot_name (UI may send any of these)
    if (typeVal !== undefined) {
      if (hasCol('pass_key')) {
        updates.push(`pass_key = $${paramCount++}`);
        values.push(typeVal);
      } else if (hasCol('slot_name')) {
        updates.push(`slot_name = $${paramCount++}`);
        values.push(typeVal);
      } else if (hasCol('period_name')) {
        updates.push(`period_name = $${paramCount++}`);
        values.push(typeVal);
      } else if (hasCol('type')) {
        updates.push(`type = $${paramCount++}`);
        values.push(typeVal);
      }
    }
    if (start_time !== undefined && hasCol('start_time')) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(start_time);
    }
    if (end_time !== undefined && hasCol('end_time')) {
      updates.push(`end_time = $${paramCount++}`);
      values.push(end_time);
    }

    if (
      tableName === 'time_slots' &&
      hasCol('duration') &&
      (start_time !== undefined || end_time !== undefined) &&
      slotMergedStart &&
      slotMergedEnd
    ) {
      const dm = await durationMinutesBetween(slotMergedStart, slotMergedEnd);
      if (dm != null && dm >= 1) {
        updates.push(`duration = $${paramCount++}`);
        values.push(dm);
      }
    }

    // status/is_active column
    if (hasCol('status')) {
      updates.push(`status = $${paramCount++}`);
      values.push(isActiveBoolean ? 'Active' : 'Inactive');
    } else if (hasCol('is_active')) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActiveBoolean);
    }

    // modified_at (not updated_at)
    if (hasCol('modified_at')) {
      updates.push('modified_at = NOW()');
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(id);
    const setClause = updates.join(', ');
    const result = await query(
      `UPDATE ${tableName} SET ${setClause} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (!result.rows || result.rows.length === 0) {
      return errorResponse(res, 404, 'Time slot not found or update had no effect');
    }

    const data = mapScheduleRow(result.rows[0]);
    return success(res, 200, 'Time slot updated successfully', data);
  } catch (error) {
    console.error('Error updating schedule:', error);
    console.error('Update schedule error details:', error.message, error.stack);
    if (error.code === '22001') {
      return errorResponse(res, 400, 'Slot name is too long. Use at most 100 characters.');
    }
    return errorResponse(res, 500, 'Failed to update time slot');
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM time_slots WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return errorResponse(res, 404, 'Time slot not found');
    return success(res, 200, 'Time slot deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    if (error.code === '23503') {
      return errorResponse(res, 409, 'This time slot is in use by a class timetable and cannot be deleted');
    }
    return errorResponse(res, 500, 'Failed to delete time slot');
  }
};

module.exports = { getAllSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule };
