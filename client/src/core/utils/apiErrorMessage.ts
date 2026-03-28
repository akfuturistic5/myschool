/**
 * apiService throws `HTTP error! status: N, message: <JSON body>`.
 * Extract the API `message` field when present.
 */
export function extractMessageFromApiError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const raw = error.message;
  const marker = 'message: ';
  const idx = raw.lastIndexOf(marker);
  if (idx === -1) return raw;
  const jsonPart = raw.slice(idx + marker.length).trim();
  try {
    const j = JSON.parse(jsonPart) as { message?: string };
    if (typeof j?.message === 'string' && j.message.trim()) {
      return j.message.trim();
    }
  } catch {
    /* ignore */
  }
  return raw;
}
