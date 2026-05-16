export type MonthlyAttendanceGridSummary = {
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  holiday: number;
  percentage: number;
};

export type MonthlyAttendanceGridRow = {
  key: string | number;
  name: string;
  studentId?: number;
  entityId?: number;
  rollNo?: string;
  daily: Record<string, string>;
  summary: MonthlyAttendanceGridSummary;
};

const normalizeStatusKey = (status: unknown): string =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_–—−]+/g, "_")
    .replace(/^halfday$/, "half_day");

function summaryFromDaily(daily: Record<string, string>): MonthlyAttendanceGridSummary {
  const summary = { present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0, percentage: 0 };
  Object.values(daily).forEach((raw) => {
    const status = normalizeStatusKey(raw);
    if (status === "present") summary.present += 1;
    else if (status === "late") summary.late += 1;
    else if (status === "absent") summary.absent += 1;
    else if (status === "half_day") summary.halfDay += 1;
    else if (status === "holiday" || status === "weekly_holiday") summary.holiday += 1;
  });
  const workedDays = summary.present + summary.late + summary.absent + summary.halfDay;
  const effectivePresent = summary.present + summary.late + summary.halfDay * 0.5;
  summary.percentage = workedDays > 0 ? Number(((effectivePresent / workedDays) * 100).toFixed(2)) : 0;
  return summary;
}

function mapApiSummary(summary: Record<string, unknown> | undefined): MonthlyAttendanceGridSummary {
  if (!summary || typeof summary !== "object") {
    return { present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0, percentage: 0 };
  }
  const present = Number(summary.present) || 0;
  const late = Number(summary.late) || 0;
  const absent = Number(summary.absent) || 0;
  const halfDay = Number(summary.halfDay ?? summary.half_day) || 0;
  const holiday = Number(summary.holiday) || 0;
  const pctRaw = summary.percentage ?? summary.attendance_percentage;
  let percentage = Number(pctRaw);
  if (!Number.isFinite(percentage)) {
    return summaryFromDaily({});
  }
  return { present, late, absent, halfDay, holiday, percentage };
}

function buildDailyMapFromGroupedRow(row: Record<string, unknown>): Record<string, string> {
  if (row.daily && typeof row.daily === "object" && !Array.isArray(row.daily)) {
    const out: Record<string, string> = {};
    Object.entries(row.daily as Record<string, unknown>).forEach(([date, status]) => {
      const d = String(date || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) out[d] = normalizeStatusKey(status);
    });
    return out;
  }
  const out: Record<string, string> = {};
  flattenEntityAttendanceReportRows([row]).forEach((ev) => {
    const d = String(ev.attendance_date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) out[d] = normalizeStatusKey(ev.status);
  });
  return out;
}

/**
 * Monthly attendance reports return one row per person with `daily` / `records`.
 * Profile "Leave & Attendance" pages need flat per-day rows.
 */
export function flattenEntityAttendanceReportRows(
  rows: unknown[],
  entityId?: number | null
): Array<Record<string, unknown>> {
  const list = Array.isArray(rows) ? rows : [];
  const scoped =
    entityId != null && Number.isFinite(Number(entityId))
      ? list.filter((r) => Number((r as { entity_id?: unknown })?.entity_id) === Number(entityId))
      : list;

  return scoped.flatMap((row) => {
    const r = row as Record<string, unknown>;
    const records = r.records ?? r._events;
    if (Array.isArray(records) && records.length > 0) {
      return records.map((ev) => {
        const e = ev as Record<string, unknown>;
        return {
          entity_id: e.entity_id ?? r.entity_id,
          entity_name: e.entity_name ?? r.entity_name,
          attendance_date: e.attendance_date,
          status: e.status,
          remark: e.remark ?? null,
          check_in_time: e.check_in_time ?? null,
          check_out_time: e.check_out_time ?? null,
        };
      });
    }
    const daily = r.daily;
    if (daily && typeof daily === "object" && !Array.isArray(daily)) {
      return Object.entries(daily as Record<string, string>).map(([attendance_date, status]) => ({
        entity_id: r.entity_id,
        entity_name: r.entity_name,
        attendance_date,
        status,
        remark: null,
        check_in_time: null,
        check_out_time: null,
      }));
    }
    if (r.attendance_date) return [r];
    return [];
  });
}

/**
 * Map API monthly report rows (entity_id + daily + summary) to grid/table shape.
 */
export type ReportDayMeta = { day: number; date: string; weekdayShort?: string };

const toReportDateKey = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Fill empty calendar cells with holiday (H) for monthly student reports — mirrors staff report behaviour. */
export function applyHolidayDatesToMonthlyGrid(
  rows: MonthlyAttendanceGridRow[],
  days: ReportDayMeta[],
  holidayDates: unknown[]
): MonthlyAttendanceGridRow[] {
  const holidaySet = new Set(
    (Array.isArray(holidayDates) ? holidayDates : [])
      .map((d) => toReportDateKey(d))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );

  return rows.map((row) => {
    const daily = { ...row.daily };
    days.forEach((d) => {
      const date = toReportDateKey(d.date);
      if (!date) return;
      if (!daily[date] && holidaySet.has(date)) {
        daily[date] = "holiday";
      }
    });
    return { ...row, daily, summary: summaryFromDaily(daily) };
  });
}

export function normalizeMonthlyAttendanceGridRows(rows: unknown[]): MonthlyAttendanceGridRow[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row, index) => {
    const r = row as Record<string, unknown>;
    const entityId = Number(r.entity_id ?? r.studentId);
    const daily = buildDailyMapFromGroupedRow(r);
    const hasApiSummary =
      r.summary != null && typeof r.summary === "object" && Object.keys(r.summary as object).length > 0;
    const summary = hasApiSummary
      ? mapApiSummary(r.summary as Record<string, unknown>)
      : summaryFromDaily(daily);

    return {
      key: Number.isFinite(entityId) && entityId > 0 ? entityId : `row-${index}`,
      name: String(r.entity_name ?? r.name ?? "—").trim() || "—",
      studentId: Number.isFinite(entityId) && entityId > 0 ? entityId : undefined,
      entityId: Number.isFinite(entityId) && entityId > 0 ? entityId : undefined,
      rollNo:
        String(r.rollNo ?? r.roll_number ?? r.admission_number ?? "")
          .trim() || undefined,
      daily,
      summary,
    };
  });
}
