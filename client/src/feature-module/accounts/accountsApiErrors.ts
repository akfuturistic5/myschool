/**
 * Maps API / network errors from /api/accounts endpoints to short, user-facing copy.
 */

function extractBackendMessage(err: unknown): string {
  if (err == null) return "";
  const msg = err instanceof Error ? err.message : String(err);
  const httpMatch = msg.match(/^HTTP error!\s*status:\s*\d+,\s*message:\s*([\s\S]*)$/i);
  const payload = (httpMatch ? httpMatch[1] : msg).trim();
  if (!payload) return "";
  try {
    const j = JSON.parse(payload);
    if (j && typeof j === "object" && typeof (j as { message?: string }).message === "string") {
      return String((j as { message: string }).message).trim();
    }
  } catch {
    /* not JSON */
  }
  if (payload.length > 180 && /[<>]/.test(payload)) return "";
  return payload;
}

function looksTechnicalOrUnhelpful(s: string): boolean {
  const t = s.toLowerCase();
  return (
    t.includes("http error") ||
    /\bstatus\s*:\s*\d{3}/.test(t) ||
    (t.includes("{") && t.includes("}")) ||
    t.includes("econnrefused") ||
    t.includes("failed to fetch") ||
    t.includes("networkerror") ||
    t.includes("server returned empty")
  );
}

export function getAccountsErrorMessage(err: unknown, fallback: string): string {
  const raw = extractBackendMessage(err);
  if (raw && !looksTechnicalOrUnhelpful(raw)) {
    if (raw.toLowerCase().includes("invoice number already exists")) {
      return "That invoice number is already used for this academic year.";
    }
    return raw.length > 220 ? `${raw.slice(0, 217)}…` : raw;
  }
  return fallback;
}
