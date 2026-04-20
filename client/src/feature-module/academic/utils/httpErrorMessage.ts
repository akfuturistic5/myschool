/** Extract server `message` from failed fetch errors thrown by apiService (timetable / academic forms). */
export function httpErrorMessage(err: unknown, fallback = "Request failed"): string {
  const m = err instanceof Error ? err.message : String(err ?? "");
  const marker = "message: ";
  const idx = m.indexOf(marker);
  if (idx === -1) return m || fallback;
  const jsonPart = m.slice(idx + marker.length).trim();
  try {
    const j = JSON.parse(jsonPart) as { message?: string };
    if (j?.message && typeof j.message === "string") return j.message;
  } catch {
    /* ignore */
  }
  return m || fallback;
}
