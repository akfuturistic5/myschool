/** Roster API uses these when marking is blocked by holiday (DB vs weekly Sunday). */
export function formatRosterHolidayStatus(status: string | null | undefined): string {
  const s = String(status || "").trim().toLowerCase();
  if (s === "weekly_holiday") return "Weekly holiday";
  if (s === "holiday") return "Holiday";
  return "";
}
