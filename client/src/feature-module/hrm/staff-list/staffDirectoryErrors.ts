/**
 * Staff Directory — user-facing errors and HTTP message parsing.
 * Keeps raw stack traces and verbose fetch strings out of the UI.
 */

const HTTP_MSG_RE =
  /^HTTP error! status:\s*(\d+),\s*message:\s*([\s\S]*)$/i;

/**
 * Parse `?id=` or `?staffId=` as a positive integer staff primary key.
 */
export function parseStaffIdFromSearch(search: string): number | undefined {
  try {
    const p = new URLSearchParams(search);
    const raw = p.get("id") ?? p.get("staffId");
    if (raw == null || raw === "") return undefined;
    const n = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(n) || n < 1) return undefined;
    return n;
  } catch {
    return undefined;
  }
}

/**
 * Prefer query string (bookmarkable / refresh-safe), then explicit state.
 */
export function resolveStaffNumericId(args: {
  search: string;
  stateStaffId?: unknown;
  stateStaffRecord?: Record<string, unknown> | null;
}): number | undefined {
  const fromQuery = parseStaffIdFromSearch(args.search);
  if (fromQuery != null) return fromQuery;

  if (args.stateStaffId != null && args.stateStaffId !== "") {
    const n = Number(args.stateStaffId);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const sid = args.stateStaffRecord?.id;
  if (sid != null && sid !== "") {
    const n = Number(sid);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return undefined;
}

/**
 * Edit page: URL `?id=` first, then navigation state (including table row shapes).
 */
export function resolveStaffEditPageId(args: {
  search: string;
  locationState: unknown;
}): number | null {
  const q = parseStaffIdFromSearch(args.search);
  if (q != null) return q;

  if (!args.locationState || typeof args.locationState !== "object") {
    return null;
  }
  const s = args.locationState as Record<string, unknown>;
  if (s.staffId != null && s.staffId !== "") {
    const n = Number(s.staffId);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const staff = s.staff;
  if (staff && typeof staff === "object") {
    const o = staff as Record<string, unknown>;
    const od = o.originalData;
    if (od && typeof od === "object") {
      const id = (od as Record<string, unknown>).id;
      if (id != null) {
        const n = Number(id);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    if (o.dbId != null) {
      const n = Number(o.dbId);
      if (Number.isFinite(n) && n > 0) return n;
    }
    if (o.id != null) {
      const n = Number(o.id);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Map thrown API errors (from apiService makeRequest) to safe UI strings.
 */
export function staffDirectoryFriendlyError(error: unknown): string {
  if (error == null) return "Something went wrong. Please try again.";

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong. Please try again.";

  const m = raw.match(HTTP_MSG_RE);
  if (m) {
    const status = parseInt(m[1], 10);
    const body = m[2].trim();
    let parsed: { message?: string } | null = null;
    try {
      parsed = JSON.parse(body) as { message?: string };
    } catch {
      /* plain text body */
    }
    const serverMsg =
      parsed && typeof parsed.message === "string" ? parsed.message : null;

    if (status === 401) {
      return "Your session has expired or you are not signed in. Please sign in again.";
    }
    if (status === 403) {
      return "You do not have permission to perform this action.";
    }
    if (status === 404) {
      return "This staff record could not be found.";
    }
    if (status === 429) {
      return "Too many requests. Please wait a moment and try again.";
    }
    if (status >= 500) {
      return "Something went wrong on the server. Please try again later.";
    }
    if (serverMsg && serverMsg.length > 0 && serverMsg.length < 400) {
      return serverMsg;
    }
    return "Could not complete the request. Please try again.";
  }

  const lower = raw.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed")
  ) {
    return "Network error. Check your connection and try again.";
  }

  if (raw.length > 400) {
    return "Something went wrong. Please try again.";
  }
  return raw;
}

/** Map hook/API string or Error to a short UI message. */
export function staffDirectoryFriendlyMessage(maybe: unknown): string {
  if (maybe == null || maybe === "") {
    return "Something went wrong. Please try again.";
  }
  if (typeof maybe === "string") {
    return staffDirectoryFriendlyError(new Error(maybe));
  }
  return staffDirectoryFriendlyError(maybe);
}
