import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

/** List-of-leaves date filter presets (drives `leave_from` / `leave_to` query params; "all" omits them). */
export type LeaveListDatePreset =
  | "all"
  | "current_week"
  | "current_month"
  | "last_2_weeks"
  | "last_2_months"
  | "custom";

const DATE_FMT = "YYYY-MM-DD";

/** Monday–Sunday week in local timezone. */
function currentWeekBounds() {
  const d = dayjs();
  const dow = d.day();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = d.add(mondayOffset, "day").startOf("day");
  const end = start.add(6, "day").endOf("day");
  return { leaveFrom: start.format(DATE_FMT), leaveTo: end.format(DATE_FMT) };
}

/**
 * API passes these to `getLeaveApplications` as `leave_from` / `leave_to` (optional).
 * `all` = no date bounds — rows are still scoped by `academic_year_id` in the list hook.
 */
export function getLeaveListDateBounds(
  preset: LeaveListDatePreset,
  customRange: [Dayjs, Dayjs]
): { leaveFrom: string | null; leaveTo: string | null } {
  if (preset === "all") {
    return { leaveFrom: null, leaveTo: null };
  }
  if (preset === "custom") {
    const a = customRange[0].startOf("day");
    const b = customRange[1].endOf("day");
    return { leaveFrom: a.format(DATE_FMT), leaveTo: b.format(DATE_FMT) };
  }
  if (preset === "current_week") {
    return currentWeekBounds();
  }
  if (preset === "current_month") {
    const start = dayjs().startOf("month");
    const end = dayjs().endOf("month");
    return { leaveFrom: start.format(DATE_FMT), leaveTo: end.format(DATE_FMT) };
  }
  if (preset === "last_2_weeks") {
    const end = dayjs().endOf("day");
    const start = end.subtract(13, "day").startOf("day");
    return { leaveFrom: start.format(DATE_FMT), leaveTo: end.format(DATE_FMT) };
  }
  if (preset === "last_2_months") {
    /** Prior calendar month through end of the current month (inclusive, full “current month”). */
    const start = dayjs().subtract(1, "month").startOf("month");
    const end = dayjs().endOf("month");
    return { leaveFrom: start.format(DATE_FMT), leaveTo: end.format(DATE_FMT) };
  }
  return { leaveFrom: null, leaveTo: null };
}

const DISPLAY_FMT = "YYYY/MM/DD";

export function getLeaveListDateInputLabel(
  preset: LeaveListDatePreset,
  customRange: [Dayjs, Dayjs]
): string {
  if (preset === "all") {
    return "All (current academic year)";
  }
  const { leaveFrom, leaveTo } = getLeaveListDateBounds(preset, customRange);
  if (leaveFrom && leaveTo) {
    return `${dayjs(leaveFrom).format(DISPLAY_FMT)} - ${dayjs(leaveTo).format(DISPLAY_FMT)}`;
  }
  return "—";
}

/** Sensible default when opening custom range the first time. */
export function defaultCustomDateRange(): [Dayjs, Dayjs] {
  const end = dayjs();
  return [end.subtract(1, "month").startOf("month"), end.endOf("day")];
}
