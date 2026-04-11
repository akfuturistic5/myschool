const sanitizeHtml = require('sanitize-html');
const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const cleanText = (value, max = 2000) =>
  sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max);

const normalizeHolidayTypeForDb = (value) => {
  const normalized = cleanText(value || '', 32).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'public') return 'national';
  if (normalized === 'school') return 'academic';
  if (normalized === 'custom') return 'optional';
  return normalized;
};

const normalizeHolidayTypeForApi = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'national' || normalized === 'religious') return 'public';
  if (normalized === 'academic') return 'school';
  if (normalized === 'optional') return 'custom';
  return normalized;
};

const serializeHolidayRow = (row) => {
  const title = String(row?.title || '').trim() || String(row?.holiday_name || '').trim() || 'Holiday';
  return {
    id: row.id,
    title,
    description: row.description || null,
    start_date: row.start_date,
    end_date: row.end_date,
    holiday_type: normalizeHolidayTypeForApi(row.holiday_type),
    academic_year_id: row.academic_year_id ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || row.modified_at || row.created_at || null,
  };
};

const validateDateRange = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= end;
};

const parseAcademicYearId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const ensureNoOverlap = async ({ startDate, endDate, excludeId = null }) => {
  const params = [startDate, endDate];
  let excludeClause = '';
  if (excludeId) {
    params.push(Number(excludeId));
    excludeClause = ` AND id <> $${params.length}`;
  }
  const overlap = await query(
    `SELECT
       id,
       COALESCE(NULLIF(TRIM(to_jsonb(h)->>'title'), ''), NULLIF(TRIM(to_jsonb(h)->>'holiday_name'), ''), 'Holiday') AS title,
       start_date,
       end_date
     FROM holidays h
     WHERE start_date <= $2::date
       AND end_date >= $1::date
       ${excludeClause}
     LIMIT 1`,
    params
  );
  return overlap.rows[0] || null;
};

const createHoliday = async (req, res) => {
  try {
    const title = cleanText(req.body?.title, 200);
    const description = cleanText(req.body?.description, 2000) || null;
    const startDate = String(req.body?.start_date || '');
    const endDate = String(req.body?.end_date || '');
    const holidayType = normalizeHolidayTypeForDb(req.body?.holiday_type);
    const academicYearId = parseAcademicYearId(req.body?.academic_year_id);

    if (!title) return errorResponse(res, 400, 'title is required', 'VALIDATION_ERROR');
    if (!validateDateRange(startDate, endDate)) {
      return errorResponse(res, 400, 'Invalid date range. start_date must be on or before end_date.', 'VALIDATION_ERROR');
    }
    const overlap = await ensureNoOverlap({ startDate, endDate });
    if (overlap) return errorResponse(res, 409, 'Holiday date range overlaps an existing holiday.', 'HOLIDAY_OVERLAP');

    const createdBy = Number(req.user?.id) || null;
    const result = await query(
      `INSERT INTO holidays (holiday_name, description, start_date, end_date, holiday_type, academic_year_id, created_by, modified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)
       RETURNING id, holiday_name, description, start_date::text AS start_date, end_date::text AS end_date, holiday_type, academic_year_id, created_by, created_at, modified_at`,
      [title, description, startDate, endDate, holidayType, academicYearId, createdBy]
    );
    return success(res, 201, 'Holiday created successfully', serializeHolidayRow(result.rows[0]));
  } catch (err) {
    console.error('createHoliday error:', err);
    return errorResponse(res, 500, 'Failed to create holiday', 'HOLIDAY_CREATE_FAILED');
  }
};

const listHolidays = async (req, res) => {
  try {
    const { start_date, end_date, month, year, academic_year_id } = req.query || {};
    const academicYearId = parseAcademicYearId(academic_year_id);
    const params = [];
    const where = [];
    if (start_date && end_date) {
      params.push(start_date, end_date);
      where.push(`start_date <= $${params.length}::date AND end_date >= $${params.length - 1}::date`);
    } else if (month && year) {
      params.push(`${year}-${String(month).padStart(2, '0')}-01`);
      where.push(`date_trunc('month', start_date) <= date_trunc('month', $${params.length}::date)`);
      where.push(`date_trunc('month', end_date) >= date_trunc('month', $${params.length}::date)`);
    }
    if (academicYearId) {
      params.push(academicYearId);
      where.push(`(h.academic_year_id = $${params.length} OR h.academic_year_id IS NULL)`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(
      `SELECT
         h.id,
         COALESCE(NULLIF(TRIM(to_jsonb(h)->>'title'), ''), NULLIF(TRIM(to_jsonb(h)->>'holiday_name'), ''), 'Holiday') AS title,
         h.description,
         h.start_date::text AS start_date,
         h.end_date::text AS end_date,
         h.holiday_type,
         h.academic_year_id,
         h.created_by,
         h.created_at,
         COALESCE((to_jsonb(h)->>'updated_at')::timestamp, h.modified_at, h.created_at) AS updated_at
       FROM holidays h
       ${whereClause}
       ORDER BY h.start_date ASC, h.id ASC`,
      params
    );
    return success(res, 200, 'Holidays fetched successfully', (result.rows || []).map(serializeHolidayRow));
  } catch (err) {
    console.error('listHolidays error:', err);
    return errorResponse(res, 500, 'Failed to fetch holidays', 'HOLIDAY_LIST_FAILED');
  }
};

const getHolidayById = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    const result = await query(
      `SELECT
         h.id,
         COALESCE(NULLIF(TRIM(to_jsonb(h)->>'title'), ''), NULLIF(TRIM(to_jsonb(h)->>'holiday_name'), ''), 'Holiday') AS title,
         h.description,
         h.start_date::text AS start_date,
         h.end_date::text AS end_date,
         h.holiday_type,
         h.created_by,
         h.created_at,
         COALESCE((to_jsonb(h)->>'updated_at')::timestamp, h.modified_at, h.created_at) AS updated_at
       FROM holidays h
       WHERE h.id = $1
       LIMIT 1`,
      [id]
    );
    if (!result.rows.length) return errorResponse(res, 404, 'Holiday not found', 'HOLIDAY_NOT_FOUND');
    return success(res, 200, 'Holiday fetched successfully', serializeHolidayRow(result.rows[0]));
  } catch (err) {
    console.error('getHolidayById error:', err);
    return errorResponse(res, 500, 'Failed to fetch holiday', 'HOLIDAY_GET_FAILED');
  }
};

const updateHoliday = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    const title = cleanText(req.body?.title, 200);
    const description = cleanText(req.body?.description, 2000) || null;
    const startDate = String(req.body?.start_date || '');
    const endDate = String(req.body?.end_date || '');
    const holidayType = normalizeHolidayTypeForDb(req.body?.holiday_type);
    const academicYearId = parseAcademicYearId(req.body?.academic_year_id);

    if (!title) return errorResponse(res, 400, 'title is required', 'VALIDATION_ERROR');
    if (!validateDateRange(startDate, endDate)) {
      return errorResponse(res, 400, 'Invalid date range. start_date must be on or before end_date.', 'VALIDATION_ERROR');
    }
    const overlap = await ensureNoOverlap({ startDate, endDate, excludeId: id });
    if (overlap) return errorResponse(res, 409, 'Holiday date range overlaps an existing holiday.', 'HOLIDAY_OVERLAP');

    const updated = await query(
      `UPDATE holidays
       SET holiday_name = $2,
           description = $3,
           start_date = $4,
           end_date = $5,
           holiday_type = $6,
           academic_year_id = $7,
           modified_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, holiday_name, description, start_date::text AS start_date, end_date::text AS end_date, holiday_type, academic_year_id, created_by, created_at, modified_at`,
      [id, title, description, startDate, endDate, holidayType, academicYearId]
    );
    if (!updated.rows.length) return errorResponse(res, 404, 'Holiday not found', 'HOLIDAY_NOT_FOUND');
    return success(res, 200, 'Holiday updated successfully', serializeHolidayRow(updated.rows[0]));
  } catch (err) {
    console.error('updateHoliday error:', err);
    return errorResponse(res, 500, 'Failed to update holiday', 'HOLIDAY_UPDATE_FAILED');
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    const deleted = await query(`DELETE FROM holidays WHERE id = $1 RETURNING id`, [id]);
    if (!deleted.rows.length) return errorResponse(res, 404, 'Holiday not found', 'HOLIDAY_NOT_FOUND');
    return success(res, 200, 'Holiday deleted successfully', { id });
  } catch (err) {
    console.error('deleteHoliday error:', err);
    return errorResponse(res, 500, 'Failed to delete holiday', 'HOLIDAY_DELETE_FAILED');
  }
};

module.exports = {
  createHoliday,
  listHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
};
