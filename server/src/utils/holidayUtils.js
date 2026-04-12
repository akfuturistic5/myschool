const { query } = require('../config/database');

const HOLIDAY_OVERRIDE_STATUSES = new Set(['present', 'absent', 'late', 'half_day', 'holiday']);

const normalizeDateString = (value) => {
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Civil calendar Sunday for YYYY-MM-DD (UTC date parts — matches school date keys). */
function isSundayYmd(ymd) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!parts) return false;
  const y = Number(parts[1]);
  const m = Number(parts[2]) - 1;
  const d = Number(parts[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  return new Date(Date.UTC(y, m, d)).getUTCDay() === 0;
}

function weeklySundayHoliday(ymd) {
  return {
    id: null,
    title: 'Weekly holiday (Sunday)',
    description: 'Scheduled weekly off',
    start_date: ymd,
    end_date: ymd,
    holiday_type: 'weekly',
  };
}

async function listHolidaysInRange(startDate, endDate, academicYearId = null) {
  const start = normalizeDateString(startDate);
  const end = normalizeDateString(endDate);
  if (!start || !end) return [];
  const yearId = Number(academicYearId);
  const hasAcademicYear = Number.isFinite(yearId) && yearId > 0;
  const result = await query(
    `SELECT
       h.id,
       COALESCE(NULLIF(TRIM(to_jsonb(h)->>'title'), ''), NULLIF(TRIM(to_jsonb(h)->>'holiday_name'), ''), 'Holiday') AS title,
       h.description,
       h.start_date::text AS start_date,
       h.end_date::text AS end_date,
       h.holiday_type
     FROM holidays h
     WHERE start_date <= $2::date
       AND end_date >= $1::date
       ${hasAcademicYear ? 'AND (h.academic_year_id = $3 OR h.academic_year_id IS NULL)' : ''}
     ORDER BY start_date ASC, id ASC`,
    hasAcademicYear ? [start, end, yearId] : [start, end]
  );
  return result.rows || [];
}

async function getHolidayForDate(date, academicYearId = null) {
  const normalized = normalizeDateString(date);
  if (!normalized) return null;
  // Sundays are always the configured weekly off for attendance (roster uses holiday_type `weekly`).
  // If we queried DB first, a "Sunday" / weekend row in `holidays` would win with holiday_type `school`
  // and UI would show generic "Holiday" instead of "Weekly holiday" for teachers and others.
  if (isSundayYmd(normalized)) {
    return weeklySundayHoliday(normalized);
  }
  const yearId = Number(academicYearId);
  const hasAcademicYear = Number.isFinite(yearId) && yearId > 0;
  const result = await query(
    `SELECT
       h.id,
       COALESCE(NULLIF(TRIM(to_jsonb(h)->>'title'), ''), NULLIF(TRIM(to_jsonb(h)->>'holiday_name'), ''), 'Holiday') AS title,
       h.description,
       h.start_date::text AS start_date,
       h.end_date::text AS end_date,
       h.holiday_type
     FROM holidays h
     WHERE start_date <= $1::date
       AND end_date >= $1::date
       ${hasAcademicYear ? 'AND (h.academic_year_id = $2 OR h.academic_year_id IS NULL)' : ''}
     ORDER BY start_date ASC, id ASC
     LIMIT 1`,
    hasAcademicYear ? [normalized, yearId] : [normalized]
  );
  return result.rows[0] || null;
}

function buildHolidayDateSet(holidays = [], rangeStart, rangeEnd) {
  const set = new Set();
  const start = normalizeDateString(rangeStart);
  const end = normalizeDateString(rangeEnd);
  if (!start || !end) return set;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);

  holidays.forEach((holiday) => {
    const hs = normalizeDateString(holiday?.start_date);
    const he = normalizeDateString(holiday?.end_date);
    if (!hs || !he) return;
    const holidayStart = new Date(`${hs}T00:00:00.000Z`);
    const holidayEnd = new Date(`${he}T00:00:00.000Z`);
    const cursor = holidayStart > startDate ? new Date(holidayStart) : new Date(startDate);
    const last = holidayEnd < endDate ? holidayEnd : endDate;
    while (cursor <= last) {
      set.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  });

  const sun = new Date(startDate);
  while (sun <= endDate) {
    if (sun.getUTCDay() === 0) {
      set.add(sun.toISOString().slice(0, 10));
    }
    sun.setUTCDate(sun.getUTCDate() + 1);
  }

  return set;
}

function applyHolidayOverride(status, isHoliday, options = {}) {
  if (!isHoliday) return status;
  const normalized = String(status || '').trim().toLowerCase();
  if (options.leavePriority && normalized === 'leave') return status;
  if (!normalized || HOLIDAY_OVERRIDE_STATUSES.has(normalized)) return 'holiday';
  return status;
}

module.exports = {
  listHolidaysInRange,
  getHolidayForDate,
  buildHolidayDateSet,
  applyHolidayOverride,
};
