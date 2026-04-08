/**
 * Date-only helpers: no UTC day-shift for calendar fields (library DATE columns, etc.).
 *
 * - YYYY-MM-DD strings are passed through unchanged.
 * - Date objects use local calendar getters (not getUTC*), matching node-pg DATE deserialization.
 * - Other strings are parsed with Date() and formatted using local date parts.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Today's calendar date on this server as YYYY-MM-DD (NOT UTC midnight from toISOString).
 */
function todayLocalYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Format PostgreSQL DATE / JS Date / ISO string as YYYY-MM-DD for JSON (no timezone drift for plain dates).
 */
function toYmd(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : '';
    }
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return '';
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

module.exports = { toYmd, todayLocalYmd };
