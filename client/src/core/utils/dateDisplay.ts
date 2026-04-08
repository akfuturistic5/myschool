import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

/**
 * Project standard: show calendar dates as DD-MM-YYYY.
 * Plain YYYY-MM-DD strings are split (no timezone). ISO strings with time/zone use local calendar via dayjs.
 */
export function formatDateDMY(input: string | Date | null | undefined): string {
  if (input == null || input === "") return "—";
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    }
    const d = dayjs(s);
    return d.isValid() ? d.format("DD-MM-YYYY") : "—";
  }
  const d = dayjs(input);
  return d.isValid() ? d.format("DD-MM-YYYY") : "—";
}

/** Normalize to YYYY-MM-DD for API / HTML date inputs (no naive slice of ISO strings). */
export function toYmdString(input: string | Date | null | undefined): string {
  if (input == null || input === "") return "";
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = dayjs(s);
    return d.isValid() ? d.format("YYYY-MM-DD") : "";
  }
  const d = dayjs(input);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
}
