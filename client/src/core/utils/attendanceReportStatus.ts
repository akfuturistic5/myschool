/** API: calendar holiday + recorded attendance same day (`getAttendanceReport` in studentController). */
export const HOLIDAY_ATTENDANCE_PREFIX = "holiday_";

export function isHolidayAttendanceCompound(status: string | null | undefined): boolean {
  const s = String(status || "").trim().toLowerCase();
  if (!s.startsWith(HOLIDAY_ATTENDANCE_PREFIX)) return false;
  const rest = s.slice(HOLIDAY_ATTENDANCE_PREFIX.length);
  return Boolean(rest && rest !== "holiday");
}

export function getCompoundHolidayAttendancePart(status: string | null | undefined): string {
  if (!isHolidayAttendanceCompound(status)) return "";
  return String(status).trim().toLowerCase().slice(HOLIDAY_ATTENDANCE_PREFIX.length);
}

export type DailyAttendanceBucket = "present_side" | "absent_side" | "none";

/** Used by section/day summaries: present+late vs absent+half_day; holiday-only counts toward total only. */
export function getDailyAttendancePresentAbsentBucket(status: string | null | undefined): DailyAttendanceBucket {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "none";
  if (s === "holiday" || s === "weekly_holiday") return "none";
  if (isHolidayAttendanceCompound(s)) {
    const rest = getCompoundHolidayAttendancePart(s);
    if (rest === "present" || rest === "late") return "present_side";
    if (rest === "absent" || rest === "half_day" || rest === "halfday") return "absent_side";
    return "none";
  }
  if (s === "present" || s === "late") return "present_side";
  if (s === "absent" || s === "half_day" || s === "halfday") return "absent_side";
  return "none";
}

export function tallyMonthAttendanceDay(
  status: string | null | undefined,
  totals: { present: number; late: number; absent: number; half_day: number; holiday: number }
): void {
  const s = String(status || "").trim().toLowerCase();
  if (isHolidayAttendanceCompound(s)) {
    totals.holiday += 1;
    const rest = getCompoundHolidayAttendancePart(s);
    if (rest === "present") totals.present += 1;
    else if (rest === "late") totals.late += 1;
    else if (rest === "absent") totals.absent += 1;
    else if (rest === "half_day" || rest === "halfday") totals.half_day += 1;
    return;
  }
  if (s === "holiday" || s === "weekly_holiday") {
    totals.holiday += 1;
    return;
  }
  if (s === "present") totals.present += 1;
  else if (s === "late") totals.late += 1;
  else if (s === "absent") totals.absent += 1;
  else if (s === "half_day" || s === "halfday") totals.half_day += 1;
}

const SUB_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  half_day: "Half Day",
  halfday: "Half Day",
};

export function formatAttendanceDayHumanLabel(status: string | null | undefined): string {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "Not Marked";
  if (s === "weekly_holiday") return "Weekly holiday";
  if (isHolidayAttendanceCompound(s)) {
    const rest = getCompoundHolidayAttendancePart(s);
    return `Holiday + ${SUB_LABEL[rest] || rest.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}`;
  }
  if (s === "holiday") return "Holiday";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function formatAttendanceDayShort(status: string | null | undefined): string {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "";
  if (s === "weekly_holiday") return "H";
  if (isHolidayAttendanceCompound(s)) {
    const rest = getCompoundHolidayAttendancePart(s);
    const sub =
      rest === "present"
        ? "P"
        : rest === "late"
          ? "L"
          : rest === "absent"
            ? "A"
            : rest === "half_day" || rest === "halfday"
              ? "HD"
              : "?";
    return `H/${sub}`;
  }
  if (s === "holiday") return "H";
  if (s === "present") return "P";
  if (s === "late") return "L";
  if (s === "absent") return "A";
  if (s === "half_day" || s === "halfday") return "HD";
  return "";
}
