/**
 * Maps API / network errors from library endpoints to short, user-facing copy.
 * Does not surface HTTP status codes, "HTTP error!", or raw JSON wrappers.
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
    t.includes("{") && t.includes("}") ||
    t.includes("econnrefused") ||
    t.includes("failed to fetch") ||
    t.includes("networkerror") ||
    t.includes("server returned empty")
  );
}

/**
 * Known backend `message` strings from library controllers → friendly text.
 * Order: more specific phrases before generic substrings.
 */
function mapKnownLibraryMessage(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  if (lower.includes("duplicate card number") && lower.includes("member already registered")) {
    return "This card number is already in use, or this member is already registered.";
  }
  if (lower.includes("duplicate card number")) {
    return "This card number is already assigned to another member.";
  }
  if (lower.includes("duplicate isbn") || lower.includes("duplicate") && lower.includes("book code")) {
    return "This book code or ISBN is already in use.";
  }
  if (lower.includes("book has active issues")) {
    return "Return all borrowed copies before deleting this book.";
  }
  if (lower.includes("no copies available")) {
    return "No copies are available to issue right now.";
  }
  if (lower.includes("member and book must belong to the same academic year")) {
    return "The member and book must belong to the same academic year.";
  }
  if (lower.includes("issue is not open")) {
    return "This loan is already closed.";
  }
  if (lower.includes("invalid or inactive library member")) {
    return "This library member is inactive or invalid. Choose another member.";
  }
  if (lower === "book not found" || lower.startsWith("book not found")) {
    return "We couldn't find that book.";
  }
  if (lower === "member not found" || lower.startsWith("member not found")) {
    return "We couldn't find that member.";
  }
  if (lower === "issue not found" || lower.startsWith("issue not found")) {
    return "We couldn't find that loan record.";
  }
  if (lower.includes("access denied")) {
    return "You don't have permission to do that.";
  }
  if (lower.includes("invalid student, staff, or book reference")) {
    return "Invalid book or borrower. Refresh the page and try again.";
  }
  if (lower.includes("category name already exists")) {
    return "A category with this name already exists.";
  }
  if (lower.includes("category is assigned to books")) {
    return "This category is still used by books. Reassign those books first.";
  }
  if (lower.includes("maximum 500 rows")) {
    return "You can import at most 500 rows at a time.";
  }
  if (lower.includes("books array required")) {
    return "Please fill all required fields correctly.";
  }
  if (
    lower.includes("run migration") ||
    (lower.includes("table is missing") && lower.includes("library"))
  ) {
    return "Library isn't fully set up yet. Ask an administrator for help.";
  }

  if (
    lower.includes(" is required") ||
    /must be (student|staff)/i.test(s) ||
    (lower.length < 100 &&
      (/\b(book_id|library_member_id|due_date|student_id|staff_id|card_number|member_type)\b/i.test(s) &&
        (lower.includes("required") || lower.includes("must"))))
  ) {
    return "Please fill all required fields correctly.";
  }

  if (/^failed to (list|get|create|update|delete|issue|record|import)/i.test(s)) {
    return null;
  }

  return null;
}

/**
 * User-facing error for library UI (toasts, inline form alerts).
 * @param err — value from catch
 * @param fallback — context-specific default (e.g. "Could not load books.")
 */
export function getLibraryErrorMessage(err: unknown, fallback: string): string {
  const extracted = extractBackendMessage(err);
  if (!extracted) {
    if (err instanceof Error && looksTechnicalOrUnhelpful(err.message)) {
      return "Something went wrong. Please try again.";
    }
    return fallback;
  }

  const mapped = mapKnownLibraryMessage(extracted);
  if (mapped) return mapped;

  if (looksTechnicalOrUnhelpful(extracted)) {
    return "Something went wrong. Please try again.";
  }

  if (/^failed to /i.test(extracted.trim())) {
    return "Something went wrong. Please try again.";
  }

  return extracted.length > 160 ? fallback : extracted;
}
