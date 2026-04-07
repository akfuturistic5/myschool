const { query, executeTransaction } = require('../config/database');

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
      year_name: yearNameRaw,
      start_date: startDateRaw,
      end_date: endDateRaw,
      is_current: isCurrent,
      is_active: isActive,
    } = req.body;

    const year_name = String(yearNameRaw).trim();
    const start_date = normalizeDateString(startDateRaw);
    const end_date = normalizeDateString(endDateRaw);

    if (end_date && compareIsoDates(end_date, start_date) < 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'End date cannot be before start date',
      });
    }

    const created_by = await resolveStaffIdForUser(req.user?.id);
    const is_current = isCurrent === true;
    const is_active = isActive === false ? false : true;

    const row = await executeTransaction(async (client) => {
      if (is_current) {
        await client.query('UPDATE academic_years SET is_current = false');
      }
      const ins = await client.query(
        `INSERT INTO academic_years (year_name, start_date, end_date, is_current, is_active, created_by)
         VALUES ($1, $2::date, $3::date, $4, $5, $6)
         RETURNING *`,
        [year_name, start_date, end_date || null, is_current, is_active, created_by]
      );
      return ins.rows[0];
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Academic year created successfully',
      data: row,
    });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        message: 'An academic year with this name already exists',
      });
    }
    console.error('Error creating academic year:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create academic year',
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

module.exports = {
  getAllAcademicYears,
  getAllAcademicYearsManage,
  getAcademicYearById,
  getAcademicYearSummary,
  createAcademicYear,
  updateAcademicYear,
};
