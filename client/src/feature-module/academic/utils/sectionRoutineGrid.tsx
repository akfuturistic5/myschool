import type { ReactElement } from "react";

export const WEEK_DAYS: { label: string }[] = [
  { label: "Monday" },
  { label: "Tuesday" },
  { label: "Wednesday" },
  { label: "Thursday" },
  { label: "Friday" },
  { label: "Saturday" },
  { label: "Sunday" },
];

export type PeriodCol = { id: number; label: string; start: string; end: string; isBreak: boolean };

function formatSlotTime(t: unknown): string {
  if (t == null || t === "") return "";
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ap}`;
}

function timeSortKey(t: unknown): string {
  const s = String(t ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return "99:99:99";
  const hh = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const ss = (m[3] ?? "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function slotIsBreakFromApi(s: Record<string, unknown>): boolean {
  const flag = s.is_break ?? s.isBreak;
  if (flag === true || flag === 1 || String(flag).toLowerCase() === "true") return true;
  const name = String(s.slot_name ?? s.slotName ?? "");
  if (/\bbreak\b/i.test(name) || /\brecess\b/i.test(name)) return true;
  return false;
}

/**
 * Aligns columns with time_slots from the API, dedupes duplicate windows, and prefers slot ids
 * that actually appear in the section timetable rows.
 */
export function buildPeriodColumnsFromSlots(
  apiSlots: Record<string, unknown>[] | undefined,
  routineRows: Array<{ originalData?: Record<string, unknown> }>
): PeriodCol[] {
  const raw = Array.isArray(apiSlots) ? apiSlots : [];
  const seenIds = new Set<number>();
  const rawDeduped = raw.filter((s: any) => {
    const id = Number(s?.id);
    if (!Number.isFinite(id) || id <= 0 || seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  const usedSlotIds = new Set(
    routineRows
      .map((r) => Number(r?.originalData?.time_slot_id ?? r?.originalData?.time_slot ?? r?.originalData?.period_id))
      .filter((n: number) => Number.isFinite(n) && n > 0)
  );

  type Row = PeriodCol & { sortKey: string; windowKey: string };
  const mapped = rawDeduped
    .map((s: any) => {
      const id = Number(s.id);
      if (!id) return null;
      const isBreak = slotIsBreakFromApi(s);
      return {
        id,
        label: String(s.slot_name ?? `Period ${id}`),
        start: formatSlotTime(s.start_time),
        end: formatSlotTime(s.end_time),
        isBreak,
        sortKey: timeSortKey(s.start_time),
        windowKey: `${timeSortKey(s.start_time)}|${timeSortKey(s.end_time)}|${isBreak ? "1" : "0"}`,
      };
    })
    .filter(Boolean) as Row[];

  mapped.sort((a, b) => {
    const c = a.sortKey.localeCompare(b.sortKey);
    if (c !== 0) return c;
    return a.id - b.id;
  });

  const picked = new Map<string, Row>();
  for (const row of mapped) {
    const cur = picked.get(row.windowKey);
    if (!cur) {
      picked.set(row.windowKey, row);
      continue;
    }
    const curUsed = usedSlotIds.has(cur.id);
    const rowUsed = usedSlotIds.has(row.id);
    if (rowUsed && !curUsed) picked.set(row.windowKey, row);
    else if (rowUsed === curUsed && row.id < cur.id) picked.set(row.windowKey, row);
  }

  const deduped = Array.from(picked.values());
  deduped.sort((a, b) => {
    const c = a.sortKey.localeCompare(b.sortKey);
    if (c !== 0) return c;
    return a.id - b.id;
  });

  return deduped.map(({ sortKey: _sk, windowKey: _wk, ...col }) => col);
}

export function findCellForSlot(routineData: any[], dayLabel: string, slotId: number) {
  return (routineData || []).find((r: any) => {
    const d = String(r.day || "").toLowerCase();
    const od = r.originalData || {};
    const tid = Number(od.time_slot_id ?? od.time_slot ?? od.period_id);
    return d === dayLabel.toLowerCase() && tid === slotId;
  });
}

function resolveRoomLabel(entry: any, sectionRoomLabel: string): string {
  const raw = String(entry?.classRoom ?? "").trim();
  if (raw && raw !== "N/A" && raw !== "—") return raw;
  const sec = String(sectionRoomLabel ?? "").trim();
  return sec || "—";
}

export function formatSectionExportCell(slot: PeriodCol, entry: any | undefined, sectionRoomLabel: string): string {
  if (slot.isBreak) return "Break";
  if (!entry) return "—";
  const subj = String(entry.subject ?? "").trim() || "—";
  const teach = String(entry.teacher ?? "").trim() || "—";
  const room = resolveRoomLabel(entry, sectionRoomLabel);
  return `${subj}\n${teach}\nRoom: ${room}`;
}

export function RoutineGridCell({
  slot,
  entry,
  sectionRoomLabel,
}: {
  slot: PeriodCol;
  entry: any | undefined;
  sectionRoomLabel: string;
}): ReactElement {
  if (slot.isBreak) {
    return (
      <td className="bg-light align-top text-center py-3">
        <small className="text-muted">Break</small>
      </td>
    );
  }
  if (entry) {
    const room = resolveRoomLabel(entry, sectionRoomLabel);
    return (
      <td className="align-top small" style={{ minWidth: 168, maxWidth: 240 }}>
        <div className="fw-medium text-break">{entry.subject ?? "—"}</div>
        <div className="text-muted text-break">{entry.teacher ?? "—"}</div>
        <div className="text-muted">Room: {room}</div>
      </td>
    );
  }
  return (
    <td className="align-top text-muted small text-center py-3" style={{ minWidth: 120 }}>
      —
    </td>
  );
}

