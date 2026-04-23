const { query, executeTransaction } = require('../config/database');
const bcrypt = require('bcryptjs');
const {
  normalizeCopyOptions,
  anyCopySelected,
  cloneAcademicYearData,
} = require('../services/academicYearCloneService');

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
  return String(s).trim();
}

function compareIsoDates(a, b) {
  if (!a || !b) return 0;
  return String(a).localeCompare(String(b));
}

function formatPgDateOnly(d) {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function makeHttpError(status, code, message, data) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (data !== undefined) err.data = data;
  return err;
}

// Active years only — header dropdowns and general use
const getAllAcademicYears = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM academic_years WHERE is_active = true ORDER BY start_date DESC NULLS LAST, id DESC'
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic years fetched successfully',
      data: result.rows,
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

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic years fetched successfully',
      data: result.rows,
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

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic year fetched successfully',
      data: result.rows[0],
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

    const statsRes = await query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM classes c WHERE c.academic_year_id = $1) AS classes_count,
        (SELECT COUNT(*)::int FROM sections s
          INNER JOIN classes c ON s.class_id = c.id
          WHERE c.academic_year_id = $1) AS sections_count,
        (SELECT COUNT(*)::int FROM students st
          WHERE st.academic_year_id = $1 AND COALESCE(st.is_active, true) = true) AS students_count,
        (SELECT COUNT(*)::int FROM class_schedules cs WHERE cs.academic_year_id = $1) AS class_schedules_count,
        (SELECT COUNT(*)::int FROM fee_structures fs WHERE fs.academic_year_id = $1) AS fee_structures_count,
        (SELECT COUNT(*)::int FROM exams e WHERE e.academic_year_id = $1) AS exams_count,
        (SELECT COUNT(*)::int FROM holidays h WHERE h.academic_year_id = $1) AS holidays_count,
        (SELECT COUNT(*)::int FROM class_syllabus csy WHERE csy.academic_year_id = $1) AS class_syllabus_count,
        (SELECT COUNT(*)::int FROM student_promotions sp WHERE sp.to_academic_year_id = $1) AS promotions_into_count,
        (SELECT COUNT(*)::int FROM student_promotions sp WHERE sp.from_academic_year_id = $1) AS promotions_from_count,
        (SELECT COUNT(*)::int FROM attendance a WHERE a.academic_year_id = $1) AS attendance_records_count,
        (SELECT COUNT(*)::int FROM teacher_routines tr WHERE tr.academic_year_id = $1) AS teacher_routines_count
      `,
      [id]
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Academic year summary fetched successfully',
      data: {
        academic_year: yearRes.rows[0],
        statistics: statsRes.rows[0] || {},
      },
    });
  } catch (error) {
    console.error('Error fetching academic year summary:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch academic year summary',
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

    if (copyFromYearRaw != null && copyFromYearRaw !== '' && !copyFromYearId) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'ACADEMIC_YEAR_INVALID_COPY_SOURCE',
        message: 'copy_from_year_id must be a positive integer',
      });
    }

    if (end_date && compareIsoDates(end_date, start_date) < 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'End date cannot be before start date',
      });
    }

    // End date is intentionally nullable at creation time and should be filled
    // later when the academic year closes.
    const endInsert = end_date || null;

    const created_by = await resolveStaffIdForUser(req.user?.id);
    const is_current = isCurrent === true;
    const is_active = isActive === false ? false : true;

    const row = await executeTransaction(async (client) => {
      // Enforce: you cannot open a new year until the latest year has an end date recorded.
      // Lock the latest row to serialize concurrent creates.
      const latest = await client.query(
        'SELECT id, year_name, start_date, end_date FROM academic_years ORDER BY start_date DESC NULLS LAST, id DESC LIMIT 1 FOR UPDATE'
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
      if (latestEnd && compareIsoDates(start_date, latestEnd) <= 0) {
        throw makeHttpError(
          400,
          'ACADEMIC_YEAR_START_DATE_TOO_EARLY',
          `Start date must be after the previous academic year end date (${latestEnd}).`
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
    if (error && error.code === '23502') {
      return res.status(500).json({
        status: 'ERROR',
        message:
          'Database schema does not allow empty end date. Please run migration 008 (academic_years_end_date_nullable) and retry.',
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

      fields.push('modified_at = CURRENT_TIMESTAMP');
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
    console.error('Error updating academic year:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update academic year',
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

      // class_schedules has unique indexes that can conflict after year reassignment.
      // For any source schedule that would collide in fallback year, drop dependent
      // teacher_routines for that source row, then delete the source schedule row.
      await client.query(
        `
        DELETE FROM teacher_routines tr
        USING class_schedules src
        WHERE tr.class_schedule_id = src.id
          AND src.academic_year_id = $1
          AND EXISTS (
            SELECT 1
            FROM class_schedules dst
            WHERE dst.academic_year_id = $2
              AND (
                (
                  src.teacher_id IS NOT NULL
                  AND dst.teacher_id = src.teacher_id
                  AND dst.day_of_week = src.day_of_week
                  AND dst.time_slot_id = src.time_slot_id
                )
                OR (
                  dst.class_id = src.class_id
                  AND COALESCE(dst.section_id, -1) = COALESCE(src.section_id, -1)
                  AND dst.day_of_week = src.day_of_week
                  AND dst.time_slot_id = src.time_slot_id
                )
              )
          )
        `,
        [id, fallbackYearId]
      );

      await client.query(
        `
        DELETE FROM class_schedules src
        WHERE src.academic_year_id = $1
          AND EXISTS (
            SELECT 1
            FROM class_schedules dst
            WHERE dst.academic_year_id = $2
              AND (
                (
                  src.teacher_id IS NOT NULL
                  AND dst.teacher_id = src.teacher_id
                  AND dst.day_of_week = src.day_of_week
                  AND dst.time_slot_id = src.time_slot_id
                )
                OR (
                  dst.class_id = src.class_id
                  AND COALESCE(dst.section_id, -1) = COALESCE(src.section_id, -1)
                  AND dst.day_of_week = src.day_of_week
                  AND dst.time_slot_id = src.time_slot_id
                )
              )
          )
        `,
        [id, fallbackYearId]
      );

      for (const row of fkColsRes.rows || []) {
        const schema = String(row.schema_name || '').replace(/"/g, '""');
        const table = String(row.table_name || '').replace(/"/g, '""');
        const column = String(row.column_name || '').replace(/"/g, '""');
        if (!schema || !table || !column) continue;
        if (schema === 'public' && table === 'class_schedules' && column === 'academic_year_id') {
          // already conflict-cleaned above; handle explicitly once.
          await client.query(
            'UPDATE public.class_schedules SET academic_year_id = $1 WHERE academic_year_id = $2',
            [fallbackYearId, id]
          );
          continue;
        }
        await client.query(
          `UPDATE "${schema}"."${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
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
