const { query, executeTransaction } = require('../config/database');
const bcrypt = require('bcryptjs');
const { clearSchemaInspectorCache } = require('../utils/schemaInspector');
const {
  normalizeCopyOptions,
  anyCopySelected,
  cloneAcademicYearData,
} = require('../services/academicYearCloneService');

async function tableExists(client, tableName) {
  const r = client
    ? await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1", [tableName])
    : await query("SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1", [tableName]);
  return r.rows.length > 0;
}

function parseYearId(param) {
  const n = parseInt(param, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function resolveStaffIdForUser(userId) {
  if (userId == null) return null;
  const r = await query('SELECT id FROM staff WHERE user_id = $1 LIMIT 1', [userId]);
  return r.rows[0]?.id ?? null;
}

function normalizeDateString(s) {
  if (s == null || s === '') return null;
  const str = String(s).trim();
  // If already YYYY-MM-DD, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Attempt to parse and format as ISO date only
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str; // Fallback to raw if unparseable, though DB might still reject
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function compareIsoDates(a, b) {
  if (!a || !b) return 0;
  return String(a).localeCompare(String(b));
}

function formatPgDateOnly(d) {
  if (d == null) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * When the client omits end_date but the DB column is NOT NULL, use a provisional
 * ~12-month window: the day before the same calendar date one year ahead.
 * Staff can edit the real end date on the year detail page when the session closes.
 */
function computeProvisionalAcademicYearEnd(startDateOnly) {
  const s = normalizeDateString(startDateOnly);
  if (!s || s.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return null;
  const iso = s.slice(0, 10);
  const [yy, mm, dd] = iso.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  const dt = new Date(yy, mm - 1, dd, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setFullYear(dt.getFullYear() + 1);
  dt.setDate(dt.getDate() - 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeHttpError(status, code, message, data) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (data !== undefined) err.data = data;
  return err;
}

/** True when PostgreSQL rejects a query because a table/column is missing. */
function isMissingSchemaObjectError(err) {
  const c = err && err.code;
  if (c === '42703' || c === '42P01') return true;
  return /\bdoes not exist\b/i.test(String(err && err.message));
}

/**
 * Run the first SQL variant that succeeds. Avoids relying on information_schema (and its cache),
 * which can disagree with the live DB and still reference non-existent columns.
 */
async function execStatFirstMatch(sqlVariants, params) {
  let lastErr;
  for (const sql of sqlVariants) {
    try {
      const r = await query(sql, params);
      const row = r.rows?.[0] || {};
      const v = row.v ?? row.count ?? Object.values(row)[0];
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      lastErr = e;
      if (isMissingSchemaObjectError(e)) {
        clearSchemaInspectorCache();
        continue;
      }
      console.warn('[academicYearSummary] stat query error:', e.code, e.message);
      return 0;
    }
  }
  if (lastErr) {
    console.warn('[academicYearSummary] all stat variants failed:', lastErr.code, lastErr.message);
  }
  return 0;
}

/** Build summary statistics for one academic year id — safe across legacy vs tenant layouts. */
async function collectAcademicYearSummaryStatistics(yearId) {
  const p = [yearId];

  const [
    classes_count,
    sections_count,
    students_count,
    class_schedules_count,
    fee_structures_count,
    exams_count,
    holidays_count,
    class_syllabus_count,
    promotions_into_count,
    promotions_from_count,
    attendance_records_count,
  ] = await Promise.all([
    execStatFirstMatch(
      [
        `SELECT COUNT(*)::int AS v FROM classes c WHERE c.academic_year_id = $1`,
        `SELECT COUNT(DISTINCT cs.class_id)::int AS v FROM class_sections cs WHERE cs.academic_year_id = $1 AND cs.deleted_at IS NULL`,
        `SELECT COUNT(DISTINCT cs.class_id)::int AS v FROM class_sections cs WHERE cs.academic_year_id = $1`,
        `SELECT COUNT(DISTINCT s.class_id)::int AS v FROM sections s WHERE s.academic_year_id = $1`,
      ],
      p
    ),
    execStatFirstMatch(
      [
        `SELECT COUNT(*)::int AS v FROM sections s INNER JOIN classes c ON s.class_id = c.id WHERE c.academic_year_id = $1`,
        `SELECT COUNT(*)::int AS v FROM class_sections cs WHERE cs.academic_year_id = $1 AND cs.deleted_at IS NULL`,
        `SELECT COUNT(*)::int AS v FROM class_sections cs WHERE cs.academic_year_id = $1`,
        `SELECT COUNT(*)::int AS v FROM sections s WHERE s.academic_year_id = $1`,
      ],
      p
    ),
    execStatFirstMatch(
      [
        `SELECT COUNT(*)::int AS v FROM students st WHERE st.academic_year_id = $1 AND COALESCE(st.is_active, true) = true`,
        `SELECT COUNT(DISTINCT l.student_id)::int AS v FROM student_lifecycle_ledger l
          INNER JOIN students st ON st.id = l.student_id AND COALESCE(st.is_active, true) = true
          WHERE l.to_academic_year_id = $1`,
        `SELECT COUNT(DISTINCT l.student_id)::int AS v FROM student_lifecycle_ledger l WHERE l.to_academic_year_id = $1`,
      ],
      p
    ),
    execStatFirstMatch([`SELECT COUNT(*)::int AS v FROM class_schedules cs WHERE cs.academic_year_id = $1`], p),
    execStatFirstMatch(
      [
        `SELECT COUNT(*)::int AS v FROM fee_structures fs WHERE fs.academic_year_id = $1`,
        `SELECT COUNT(*)::int AS v FROM fees f WHERE f.academic_year_id = $1`,
      ],
      p
    ),
    execStatFirstMatch([`SELECT COUNT(*)::int AS v FROM exams e WHERE e.academic_year_id = $1`], p),
    execStatFirstMatch(
      [
        `SELECT COUNT(*)::int AS v FROM school_holidays h WHERE h.academic_year_id = $1`,
        `SELECT COUNT(*)::int AS v FROM holidays h WHERE h.academic_year_id = $1`,
      ],
      p
    ),
    execStatFirstMatch([`SELECT COUNT(*)::int AS v FROM class_syllabus csy WHERE csy.academic_year_id = $1`], p),
    execStatFirstMatch(
      [`SELECT COUNT(*)::int AS v FROM student_promotions sp WHERE sp.to_academic_year_id = $1`],
      p
    ),
    execStatFirstMatch(
      [`SELECT COUNT(*)::int AS v FROM student_promotions sp WHERE sp.from_academic_year_id = $1`],
      p
    ),
    execStatFirstMatch([`SELECT COUNT(*)::int AS v FROM attendance a WHERE a.academic_year_id = $1`], p),
  ]);

  return {
    classes_count,
    sections_count,
    students_count,
    class_schedules_count,
    fee_structures_count,
    exams_count,
    holidays_count,
    class_syllabus_count,
    promotions_into_count,
    promotions_from_count,
    attendance_records_count,
    teacher_routines_count: 0,
  };
}

// Active years only — header dropdowns and general use
const getAllAcademicYears = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM academic_years WHERE is_active = true ORDER BY start_date DESC NULLS LAST, id DESC'
    );

    const data = result.rows.map(row => ({
      ...row,
      start_date: formatPgDateOnly(row.start_date),
      end_date: formatPgDateOnly(row.end_date),
    }));

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic years fetched successfully',
      data,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching academic years:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch academic years',
    });
  }
};

// All years (including inactive) — Academic Years management UI
const getAllAcademicYearsManage = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM academic_years ORDER BY start_date DESC NULLS LAST, id DESC'
    );

    const data = result.rows.map(row => ({
      ...row,
      start_date: formatPgDateOnly(row.start_date),
      end_date: formatPgDateOnly(row.end_date),
    }));

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic years fetched successfully',
      data,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching academic years (manage):', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch academic years',
    });
  }
};

const getAcademicYearById = async (req, res) => {
  try {
    const id = parseYearId(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid academic year id' });
    }

    const result = await query('SELECT * FROM academic_years WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Academic year not found',
      });
    }

    const row = result.rows[0];
    const data = {
      ...row,
      start_date: formatPgDateOnly(row.start_date),
      end_date: formatPgDateOnly(row.end_date),
    };

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic year fetched successfully',
      data,
    });
  } catch (error) {
    console.error('Error fetching academic year:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch academic year',
    });
  }
};

const getAcademicYearSummary = async (req, res) => {
  try {
    const id = parseYearId(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid academic year id' });
    }

    const yearRes = await query('SELECT * FROM academic_years WHERE id = $1', [id]);
    if (yearRes.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Academic year not found' });
    }

    const statistics = await collectAcademicYearSummaryStatistics(id);

    const ay = yearRes.rows[0];
    const academic_year = {
      ...ay,
      start_date: formatPgDateOnly(ay.start_date),
      end_date: formatPgDateOnly(ay.end_date),
    };

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic year summary fetched successfully',
      data: {
        academic_year,
        statistics,
      },
    });
  } catch (error) {
    console.error('Error fetching academic year summary:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch academic year summary',
      error: error.message,
    });
  }
};

const createAcademicYear = async (req, res) => {
  try {
    const {
      name: nameRaw,
      year_name: yearNameRaw,
      start_date: startDateRaw,
      end_date: endDateRaw,
      is_current: isCurrent,
      is_active: isActive,
      copy_from_year_id: copyFromYearRaw,
      copy_options: copyOptionsRaw,
    } = req.body;

    const year_name = String(yearNameRaw ?? nameRaw ?? '').trim();
    const start_date = normalizeDateString(startDateRaw);
    const end_date = normalizeDateString(endDateRaw);
    const copyFromYearId =
      copyFromYearRaw == null || copyFromYearRaw === ''
        ? null
        : parseYearId(copyFromYearRaw);
    const normalizedCopyOptions = normalizeCopyOptions(copyOptionsRaw);
    const shouldClone = copyFromYearId != null && anyCopySelected(normalizedCopyOptions);

    if (!year_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Year name is required',
      });
    }

    if (!start_date) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Start date is required',
      });
    }

    if (copyFromYearRaw != null && copyFromYearRaw !== '' && !copyFromYearId) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_INVALID_COPY_SOURCE',
        message: 'copy_from_year_id must be a positive integer',
      });
    }

    if (compareIsoDates(end_date, start_date) < 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'End date cannot be before start date',
      });
    }

    // UI allows omitting end_date; DB may still enforce NOT NULL. Use a provisional
    // ~1-year span so inserts succeed — users set the official end date on the detail page.
    const endInsert =
      end_date ||
      computeProvisionalAcademicYearEnd(start_date);
    if (!endInsert) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid start date — could not derive an end date for this session.',
      });
    }

    const created_by = await resolveStaffIdForUser(req.user?.id);
    const is_current = isCurrent === true;
    const is_active = isActive === false ? false : true;

    const row = await executeTransaction(async (client) => {
      // 1. Comprehensive overlap check using the same logic as the DB constraint
      const overlapRes = await client.query(
        `SELECT id, year_name, start_date, end_date 
         FROM academic_years 
         WHERE daterange(start_date, end_date, '[]') && daterange($1::date, $2::date, '[]')
         LIMIT 1 FOR UPDATE`,
        [start_date, endInsert]
      );
      if (overlapRes.rows.length > 0) {
        const ov = overlapRes.rows[0];
        const ovStart = formatPgDateOnly(ov.start_date);
        const ovEnd = formatPgDateOnly(ov.end_date);
        throw makeHttpError(
          409,
          'ACADEMIC_YEAR_DATES_OVERLAP',
          `The period ${start_date} to ${endInsert} overlaps with existing academic year "${ov.year_name}" (${ovStart} to ${ovEnd}).`
        );
      }

      // 2. Chronology check: usually new years are added after the latest one.
      // We still allow inserting gaps, but we warn if it's before the latest end date.
      const latest = await client.query(
        'SELECT id, year_name, start_date, end_date FROM academic_years ORDER BY start_date DESC NULLS LAST, id DESC LIMIT 1'
      );
      const latestRow = latest.rows?.[0] || null;
      const latestEnd = latestRow?.end_date != null ? formatPgDateOnly(latestRow.end_date) : null;
      
      if (latestRow && !latestEnd) {
        throw makeHttpError(
          409,
          'ACADEMIC_YEAR_PREVIOUS_END_DATE_REQUIRED',
          'Please set the current/previous academic year end date before creating a new academic year.'
        );
      }

      if (is_current) {
        await client.query('UPDATE academic_years SET is_current = false');
      }
      const ins = await client.query(
        `INSERT INTO academic_years (year_name, start_date, end_date, is_current, is_active, created_by)
         VALUES ($1, $2::date, $3::date, $4, $5, $6)
         RETURNING *`,
        [year_name, start_date, endInsert, is_current, is_active, created_by]
      );
      const inserted = ins.rows[0];

      let cloneResult = null;
      if (shouldClone) {
        if (copyFromYearId === inserted.id) {
          throw makeHttpError(
            400,
            'ACADEMIC_YEAR_COPY_SOURCE_EQUALS_TARGET',
            'Source and target academic year cannot be the same'
          );
        }
        try {
          cloneResult = await cloneAcademicYearData(client, {
            sourceYearId: copyFromYearId,
            targetYearId: inserted.id,
            options: normalizedCopyOptions,
            createdByStaffId: created_by,
          });
        } catch (e) {
          if (e && e.status && e.code && e.message) {
            throw makeHttpError(e.status, e.code, e.message, e.details);
          }
          throw makeHttpError(
            500,
            'ACADEMIC_YEAR_CLONE_FAILED',
            e?.message || 'Failed to clone data from source academic year'
          );
        }
      }

      return { inserted, cloneResult };
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Academic year created successfully',
      data: row.inserted,
      ...(row.cloneResult
        ? {
            clone: {
              source_year_id: copyFromYearId,
              options: row.cloneResult.options,
              summary: row.cloneResult.summary,
              counts: row.cloneResult.summary,
              details: row.cloneResult.details || {},
            },
          }
        : {}),
    });
  } catch (error) {
    if (error && error.status && error.code && error.message) {
      return res.status(error.status).json({
        status: 'ERROR',
        code: error.code,
        message: error.message,
        ...(error.data !== undefined ? { data: error.data } : {}),
      });
    }
    if (error && error.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_NAME_EXISTS',
        message: 'An academic year with this name already exists',
      });
    }
    if (error && error.code === '23P01') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_DATES_OVERLAP',
        message:
          'These start/end dates overlap another academic session. Adjust dates so school years do not overlap on the timeline.',
      });
    }
    if (error && error.code === '23502') {
      return res.status(500).json({
        status: 'ERROR',
        message:
          'Database rejected this record — a required column was missing or invalid. Verify year name, dates, and try again.',
      });
    }
    console.error('Error creating academic year:', error?.code, error?.message, error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create academic year',
      ...(process.env.NODE_ENV !== 'production' && error?.message
        ? { detail: String(error.message) }
        : {}),
    });
  }
};

const updateAcademicYear = async (req, res) => {
  try {
    const id = parseYearId(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid academic year id' });
    }

    const patch = req.body;
    const existing = await query('SELECT * FROM academic_years WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Academic year not found' });
    }

    const cur = existing.rows[0];
    let yearName = cur.year_name;
    let startStr = formatPgDateOnly(cur.start_date);
    let endStr = cur.end_date != null ? formatPgDateOnly(cur.end_date) : null;
    let isCurrent = cur.is_current === true || cur.is_current === 't';
    let isActive = cur.is_active !== false && cur.is_active !== 'f';

    if (patch.year_name !== undefined) yearName = String(patch.year_name).trim();
    if (patch.start_date !== undefined && patch.start_date !== null && patch.start_date !== '') {
      startStr = normalizeDateString(patch.start_date);
    }
    if (patch.end_date !== undefined) {
      endStr =
        patch.end_date === null || patch.end_date === ''
          ? null
          : normalizeDateString(patch.end_date);
    }
    if (patch.is_current !== undefined) isCurrent = patch.is_current === true;
    if (patch.is_active !== undefined) isActive = patch.is_active !== false;

    if (endStr && startStr && compareIsoDates(endStr, startStr) < 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'End date cannot be before start date',
      });
    }

    const row = await executeTransaction(async (client) => {
      await client.query('SELECT id FROM academic_years WHERE id = $1 FOR UPDATE', [id]);

      // Check for overlaps with OTHER years
      const overlapRes = await client.query(
        `SELECT id, year_name, start_date, end_date 
         FROM academic_years 
         WHERE id <> $1
           AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')
         LIMIT 1`,
        [id, startStr, endStr]
      );
      if (overlapRes.rows.length > 0) {
        const ov = overlapRes.rows[0];
        const ovStart = formatPgDateOnly(ov.start_date);
        const ovEnd = formatPgDateOnly(ov.end_date);
        throw makeHttpError(
          409,
          'ACADEMIC_YEAR_DATES_OVERLAP',
          `The period ${startStr} to ${endStr || 'open'} overlaps with existing academic year "${ov.year_name}" (${ovStart} to ${ovEnd}).`
        );
      }

      if (patch.is_current === true) {
        await client.query('UPDATE academic_years SET is_current = false WHERE id <> $1', [id]);
      }

      const fields = [];
      const values = [];
      let p = 1;

      if (patch.year_name !== undefined) {
        fields.push(`year_name = $${p++}`);
        values.push(yearName);
      }
      if (patch.start_date !== undefined && patch.start_date !== null && patch.start_date !== '') {
        fields.push(`start_date = $${p++}::date`);
        values.push(startStr);
      }
      if (patch.end_date !== undefined) {
        fields.push(`end_date = $${p++}`);
        values.push(endStr);
      }
      if (patch.is_current !== undefined) {
        fields.push(`is_current = $${p++}`);
        values.push(isCurrent);
      }
      if (patch.is_active !== undefined) {
        fields.push(`is_active = $${p++}`);
        values.push(isActive);
      }

      if (fields.length === 0) {
        const again = await client.query('SELECT * FROM academic_years WHERE id = $1', [id]);
        return again.rows[0];
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE academic_years SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`;
      const upd = await client.query(sql, values);
      return upd.rows[0];
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic year updated successfully',
      data: row,
    });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_NAME_EXISTS',
        message: 'An academic year with this name already exists',
      });
    }
    if (error && error.code === '23P01') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_DATES_OVERLAP',
        message:
          'These start/end dates overlap another academic session. Adjust dates so school years do not overlap on the timeline.',
      });
    }
    if (error && error.code === '23514') {
      return res.status(400).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_DATE_RULE',
        message: 'End date must be on or after start date.',
      });
    }
    console.error('Error updating academic year:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update academic year',
      ...(process.env.NODE_ENV !== 'production' && error?.message ? { detail: String(error.message) } : {}),
    });
  }
};

const deleteAcademicYear = async (req, res) => {
  try {
    const id = parseYearId(req.params.id);
    if (!id) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid academic year id' });
    }

    const enteredPassword = String(req.body?.password || '');
    // Avoid any logging of password; just enforce presence (schema already checks).
    if (!enteredPassword.trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Password is required' });
    }
    // Verify against users.password_hash (same as login)
    const userId = req.user?.id;
    const ph = await query('SELECT password_hash FROM users WHERE id = $1 AND is_active = true LIMIT 1', [userId]);
    const passwordHash = ph.rows?.[0]?.password_hash;
    let ok = false;
    try {
      ok = await bcrypt.compare(enteredPassword, String(passwordHash || ''));
    } catch {
      ok = false;
    }
    if (!ok) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'PASSWORD_INCORRECT',
        message: 'Password is incorrect',
      });
    }

    const existing = await query('SELECT * FROM academic_years WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Academic year not found' });
    }

    const cur = existing.rows[0];
    const isCurrent = cur.is_current === true || cur.is_current === 't';
    if (isCurrent) {
      return res.status(409).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_DELETE_CURRENT_BLOCKED',
        message: 'Cannot delete the current academic year. Mark another year as current first.',
      });
    }

    await executeTransaction(async (client) => {
      // Lock target row to avoid races with concurrent writes.
      await client.query('SELECT id FROM academic_years WHERE id = $1 FOR UPDATE', [id]);

      // Keep only "current year" as the blocking rule by re-pointing FK references
      // from the deleted year to another existing year (prefer current).
      const fallbackRes = await client.query(
        `
        SELECT id
        FROM academic_years
        WHERE id <> $1
        ORDER BY (is_current = true) DESC, start_date DESC NULLS LAST, id DESC
        LIMIT 1
        `,
        [id]
      );
      const fallbackYearId = fallbackRes.rows?.[0]?.id ?? null;
      if (!fallbackYearId) {
        throw makeHttpError(
          409,
          'ACADEMIC_YEAR_DELETE_FALLBACK_REQUIRED',
          'Cannot delete this academic year because no fallback year exists. Create another year first.'
        );
      }

      const fkColsRes = await client.query(
        `
        SELECT
          ns.nspname AS schema_name,
          cls.relname AS table_name,
          att.attname AS column_name
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        JOIN unnest(con.conkey) AS k(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
        WHERE con.contype = 'f'
          AND con.confrelid = 'public.academic_years'::regclass
          AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
        `
      );

      // 1. HARD DELETE session-scoped records.
      // These tables are strictly year-scoped and cannot be reassigned without breaking triple-key integrity.
      const tablesToDelete = [
        'subject_teacher_assignments',
        'class_teachers',
        'class_schedules',
        'class_subjects',
        'class_sections',
      ];
      for (const table of tablesToDelete) {
        if (await tableExists(client, table)) {
          await client.query(`DELETE FROM public.${table} WHERE academic_year_id = $1`, [id]);
        }
      }

      // 2. Reassign remaining records to fallback year.
      const tableUpdates = {};
      for (const row of fkColsRes.rows || []) {
        const schema = String(row.schema_name || '');
        const table = String(row.table_name || '');
        const column = String(row.column_name || '');
        if (!schema || !table || !column) continue;
        
        // Skip tables we already hard-deleted
        if (schema === 'public' && tablesToDelete.includes(table)) continue;

        const key = `"${schema}"."${table}"`;
        if (!tableUpdates[key]) tableUpdates[key] = [];
        tableUpdates[key].push(`"${column}"`);
      }

      for (const [tablePath, columns] of Object.entries(tableUpdates)) {
        const setClause = columns.map(col => `${col} = $1`).join(', ');
        const whereClause = columns.map(col => `${col} = $2`).join(' OR ');
        await client.query(
          `UPDATE ${tablePath} SET ${setClause} WHERE ${whereClause}`,
          [fallbackYearId, id]
        );
      }

      await client.query('DELETE FROM academic_years WHERE id = $1', [id]);
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic year deleted successfully',
      data: { id },
    });
  } catch (error) {
    if (error && error.status && error.code && error.message) {
      return res.status(409).json({
        status: 'ERROR',
        code: error.code,
        message: error.message,
      });
    }
    if (error && error.code === '23503') {
      console.error('Academic year delete FK block:', {
        code: error.code,
        schema: error.schema,
        table: error.table,
        constraint: error.constraint,
        detail: error.detail,
      });
      return res.status(409).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_DELETE_CONSTRAINT_BLOCKED',
        message: 'Delete is blocked by database constraints.',
        data: {
          schema: error.schema || null,
          table: error.table || null,
          constraint: error.constraint || null,
          detail: error.detail || null,
        },
      });
    }
    if (error && error.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_DELETE_REASSIGN_CONFLICT',
        message: 'Delete failed because fallback-year reassignment created duplicate records.',
      });
    }
    console.error('Error deleting academic year:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to delete academic year',
      error: error.message,
    });
  }
};

module.exports = {
  getAllAcademicYears,
  getAllAcademicYearsManage,
  getAcademicYearById,
  getAcademicYearSummary,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
};
