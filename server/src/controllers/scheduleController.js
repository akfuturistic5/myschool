const { query } = require('../config/database');

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

function mapScheduleRow(row) {
  const isActive = row.is_active !== false && row.is_active !== 'false' && row.status !== 'Inactive' && row.status !== 'inactive';
  const statusVal = row.status ?? (isActive ? 'Active' : 'Inactive');
  return {
    id: row.id,
    type: row.pass_key ?? row.type ?? row.slot_name ?? 'Class',
    startTime: formatTimeDisplay(row.start_time ?? row.start) ?? formatTime(row.start_time ?? row.start),
    endTime: formatTimeDisplay(row.end_time ?? row.end) ?? formatTime(row.end_time ?? row.end),
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
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Schedules fetched successfully',
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch schedules',
    });
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
      return res.status(404).json({ status: 'ERROR', message: 'Schedule not found' });
    }
    const data = mapScheduleRow(row);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Schedule fetched successfully',
      data
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch schedule',
    });
  }
};

// Update schedule - use modified_at (not updated_at)
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, pass_key, start_time, end_time, status, is_active } = req.body;

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
      return res.status(404).json({ status: 'ERROR', message: 'Schedule not found' });
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

    // pass_key or type (try pass_key, slot_name, period_name, type)
    const typeVal = pass_key ?? type;
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
      return res.status(400).json({ status: 'ERROR', message: 'No fields to update' });
    }

    values.push(id);
    const setClause = updates.join(', ');
    const result = await query(
      `UPDATE ${tableName} SET ${setClause} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Schedule not found or update had no effect' });
    }

    const data = mapScheduleRow(result.rows[0]);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Schedule updated successfully',
      data
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    console.error('Update schedule error details:', error.message, error.stack);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update schedule',
    });
  }
};

module.exports = { getAllSchedules, getScheduleById, updateSchedule };
