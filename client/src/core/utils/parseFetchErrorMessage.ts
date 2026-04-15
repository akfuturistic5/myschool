/**
 * apiService throws `Error` with text like: HTTP error! status: N, message: {json...}
 * Pulls the server `message` field when present for clearer UI alerts.
 */
export function parseFetchErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Request failed.";
  const full = err.message;
  const key = "message:";
  const i = full.indexOf(key);
  if (i !== -1) {
    const start = full.indexOf("{", i);
    if (start !== -1) {
      try {
        const j = JSON.parse(full.slice(start)) as { message?: string };
        if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
      } catch {
        /* ignore */
      }
    }
  }
  return full;
}
