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
/**
 * Display format used on Finance & Accounts tables (e.g. "25 Apr 2024"), matching legacy template data.
 */
export function formatDateMonthDayYear(input: string | null | undefined): string {
  if (input == null || input === "") return "—";
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = dayjs(s);
      return d.isValid() ? d.format("DD MMM YYYY") : "—";
    }
    const d = dayjs(s);
    return d.isValid() ? d.format("DD MMM YYYY") : "—";
  }
  const d = dayjs(input);
  return d.isValid() ? d.format("DD MMM YYYY") : "—";
}

/** INR for account lists (e.g. "₹15,000"). Kept name formatUsdDisplay to avoid breaking imports. */
export function formatUsdDisplay(n: number | string | null | undefined): string {
  if (n === "" || n == null) return "—";
  const num = typeof n === "number" ? n : Number.parseFloat(String(n).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

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
