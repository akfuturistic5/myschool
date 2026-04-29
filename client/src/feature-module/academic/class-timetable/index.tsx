import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClassSchedules } from "../../../core/hooks/useClassSchedules";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import { useSubjects } from "../../../core/hooks/useSubjects";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import { httpErrorMessage } from "../utils/httpErrorMessage";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const WEEK_DAYS: { label: string; dow: number }[] = [
  { label: "Monday", dow: 1 },
  { label: "Tuesday", dow: 2 },
  { label: "Wednesday", dow: 3 },
  { label: "Thursday", dow: 4 },
  { label: "Friday", dow: 5 },
  { label: "Saturday", dow: 6 },
  { label: "Sunday", dow: 7 },
];

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

/** Sort key from DB time (HH:MM or HH:MM:SS); avoids broken ordering from 12h display strings. */
function timeSortKey(t: unknown): string {
  const s = String(t ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return "99:99:99";
  const hh = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const ss = (m[3] ?? "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Dropdown label: name + Theory / Practical when the same subject exists in both forms. */
function formatSubjectOptionLabel(s: Record<string, unknown>): string {
  const name = String(s.subject_name ?? "");
  const mode = String(s.subject_mode ?? "").trim();
  if (mode) return `${name} (${mode})`;
  const th = Number(s.theory_hours ?? 0);
  const ph = Number(s.practical_hours ?? 0);
  if (th > 0 && ph > 0) return `${name} (Theory & Practical)`;
  if (ph > 0) return `${name} (Practical)`;
  if (th > 0) return `${name} (Theory)`;
  const code = String(s.subject_code ?? "").toLowerCase();
  const lname = name.toLowerCase();
  if (/(practical|lab|prac)\b/.test(lname) || /(practical|lab|prac|_p|\/p|-p)\b/.test(code)) return `${name} (Practical)`;
  if (/(theory|th)\b/.test(lname) || /(theory|th|_t|\/t|-t)\b/.test(code)) return `${name} (Theory)`;
  return name;
}

function slotIsBreakFromApi(s: Record<string, unknown>): boolean {
  const flag = s.is_break ?? s.isBreak;
  if (flag === true || flag === 1 || String(flag).toLowerCase() === "true") return true;
  const name = String(s.slot_name ?? s.slotName ?? "");
  if (/\bbreak\b/i.test(name) || /\brecess\b/i.test(name)) return true;
  return false;
}

function findCellForSlot(routineData: any[], dayLabel: string, slotId: number) {
  return (routineData || []).find((r: any) => {
    const d = String(r.day || "").toLowerCase();
    const od = r.originalData || {};
    return d === dayLabel.toLowerCase() && Number(od.time_slot_id) === slotId;
  });
}

type PeriodCol = { id: number; label: string; start: string; end: string; isBreak: boolean };

type Opt = { value: string; label: string };

function formatClassLabel(c: Record<string, unknown>): string {
  const name = String(c.class_name ?? "").trim();
  const code = String(c.class_code ?? "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || `Class #${String(c.id ?? "")}`;
}

type CellProps = {
  dayLabel: string;
  dayNum: number;
  slot: PeriodCol;
  subjectId: string;
  teacherId: string;
  dirty: boolean;
  busy: boolean;
  subjectOptions: Opt[];
  teacherOptions: Opt[];
  subjectTeacherMap: Record<string, string>;
  sectionRoomLabel: string;
  onSubjectChange: (value: string | null) => void;
  onTeacherChange: (value: string | null) => void;
  onSave: () => void;
  onDelete: () => void;
  canDelete: boolean;
};

function TimetableCell({
  dayLabel,
  slot,
  subjectId,
  teacherId,
  dirty,
  busy,
  subjectOptions,
  teacherOptions,
  subjectTeacherMap,
  sectionRoomLabel,
  onSubjectChange,
  onTeacherChange,
  onSave,
  onDelete,
  canDelete,
}: CellProps) {
  const handleSubjectChange = (v: string | null) => {
    const nextSubjectId = v || "";
    onSubjectChange(nextSubjectId);
    if (!nextSubjectId) return;
    const mappedTeacherId = subjectTeacherMap[nextSubjectId];
    if (mappedTeacherId) {
      onTeacherChange(mappedTeacherId);
    }
  };

  if (slot.isBreak) {
    return (
      <td className="bg-light align-top text-center py-3">
        <small className="text-muted">Break</small>
      </td>
    );
  }

  return (
    <td className="align-top" style={{ minWidth: 200, maxWidth: 260 }}>
      <div className="small text-muted mb-1">
        {slot.start}
        {slot.end ? ` – ${slot.end}` : ""}
      </div>
      <div className="mb-1">
        <CommonSelect
          className="select select-sm"
          options={subjectOptions}
          value={subjectId || null}
          placeholder="Subject"
          onChange={handleSubjectChange}
        />
      </div>
      <div className="mb-1">
        <CommonSelect
          className="select select-sm"
          options={teacherOptions}
          value={teacherId || null}
          placeholder="Teacher"
          onChange={(v) => onTeacherChange(v || "")}
        />
      </div>
      <div className="mb-1 small">
        <span className="text-muted">Room: </span>
        <span>{sectionRoomLabel || "—"}</span>
      </div>
      {dirty ? <div className="small text-warning mb-1">Unsaved change</div> : null}
      <div className="d-flex flex-wrap gap-1">
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onSave}>
          {busy ? "…" : canDelete ? "Update" : "Add"}
        </button>
        {canDelete ? (
          <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={onDelete}>
            Remove
          </button>
        ) : null}
      </div>
    </td>
  );
}

type CellDraft = {
  existingId: number | null;
  dayLabel: string;
  dayNum: number;
  slotId: number;
  slotLabel: string;
  subjectId: string;
  teacherId: string;
  dirty: boolean;
};

const ClassTimetable = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");

  const { classes = [] } = useClasses(academicYearId ?? undefined);
  const { sections = [] } = useSections(filterClassId || null, {
    fetchAllWhenNoClass: false,
    academicYearId: academicYearId ?? null,
  });
  const { subjects = [] } = useSubjects(filterClassId ? Number(filterClassId) : null, { fetchAllWhenNoClass: false });
  const { teachers = [] } = useTeachers();

  const selectionReady = Boolean(filterClassId && filterSectionId && academicYearId);

  const sectionRoomLabel = useMemo(() => {
    const sec = sections.find((x: { id?: unknown }) => String(x.id) === String(filterSectionId));
    const rn = sec && typeof sec === "object" && sec !== null && "room_number" in sec ? (sec as { room_number?: string }).room_number : "";
    return String(rn ?? "").trim() || "—";
  }, [sections, filterSectionId]);

  const { data: routineData, slots: apiSlots, loading, error, refetch } = useClassSchedules({
    academicYearId: academicYearId ?? null,
    classId: filterClassId ? Number(filterClassId) : null,
    sectionId: filterSectionId ? Number(filterSectionId) : null,
    skip: !selectionReady,
  });

  const options = (arr: any[], valueKey = "id", labelKey = "name"): Opt[] => {
    const seenIds = new Set<string>();
    const deduped = arr.filter((x: any) => {
      const id = String(x?.[valueKey] ?? "").trim();
      if (!id) return false;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
    return [{ value: "", label: "Select" }, ...deduped.map((x: any) => ({ value: String(x[valueKey]), label: String(x[labelKey] ?? x[valueKey]) }))];
  };

  const yearScopedClasses = useMemo(
    () => classes.filter((c: any) => !academicYearId || Number(c?.academic_year_id) === Number(academicYearId)),
    [classes, academicYearId]
  );
  const classOptions: Opt[] = useMemo(
    () => [{ value: "", label: "Select" }, ...yearScopedClasses.map((c: any) => ({ value: String(c.id), label: formatClassLabel(c) }))],
    [yearScopedClasses]
  );
  const sectionOptions = options(sections, "id", "section_name");
  const subjectOptions: Opt[] = useMemo(() => {
    const classIdNum = Number(filterClassId);
    const rows = Array.isArray(subjects) ? subjects : [];
    const seen = new Set<string>();
    const filtered = rows.filter((s: Record<string, unknown>) => {
      const sid = String(s.id ?? "").trim();
      if (!sid || seen.has(sid)) return false;
      const sClass = Number(s.class_id);
      if (!Number.isFinite(classIdNum) || classIdNum <= 0) return false;
      if (!Number.isFinite(sClass) || sClass !== classIdNum) return false;
      seen.add(sid);
      return true;
    });
    return [
      { value: "", label: "Select" },
      ...filtered.map((s: Record<string, unknown>) => ({
        value: String(s.id ?? ""),
        label: formatSubjectOptionLabel(s),
      })),
    ];
  }, [subjects, filterClassId]);
  const teacherOptions: Opt[] = [
    { value: "", label: "Select" },
    ...teachers.map((t: any) => {
      const sid = t.staff_id != null ? String(t.staff_id) : String(t.id);
      const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || sid;
      return { value: sid, label: name };
    }),
  ];
  const subjectTeacherMap = useMemo(() => {
    const validTeacherIds = new Set(teacherOptions.map((opt) => String(opt.value)));
    const rows = Array.isArray(subjects) ? subjects : [];
    return rows.reduce((acc: Record<string, string>, s: Record<string, unknown>) => {
      const sid = String(s.id ?? "").trim();
      const tid = String(s.teacher_id ?? "").trim();
      if (!sid || !tid) return acc;
      if (!validTeacherIds.has(tid)) return acc;
      acc[sid] = tid;
      return acc;
    }, {});
  }, [subjects, teacherOptions]);
  const periodColumns: PeriodCol[] = useMemo(() => {
    const raw = Array.isArray(apiSlots) ? apiSlots : [];
    const seenIds = new Set<number>();
    const rawDeduped = raw.filter((s: any) => {
      const id = Number(s?.id);
      if (!Number.isFinite(id) || id <= 0 || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    const usedSlotIds = new Set(
      (routineData || [])
        .map((r: any) => Number(r?.originalData?.time_slot_id))
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
  }, [apiSlots, routineData]);

  const exportColumns = useMemo(
    () => [
      { title: "Sr", dataKey: "sr" },
      { title: "Day", dataKey: "day" },
      { title: "Period", dataKey: "period" },
      { title: "Start", dataKey: "start" },
      { title: "End", dataKey: "end" },
      { title: "Subject", dataKey: "subject" },
      { title: "Teacher", dataKey: "teacher" },
      { title: "Room", dataKey: "room" },
    ],
    []
  );

  const exportRows = useMemo(() => {
    if (!selectionReady || !Array.isArray(routineData)) return [];
    return routineData.map((r: any, i: number) => {
      const od = r.originalData || {};
      return {
        sr: i + 1,
        day: String(r.day ?? ""),
        period: String(od.slotName ?? r.originalData?.slot_name ?? ""),
        start: String(r.startTime ?? ""),
        end: String(r.endTime ?? ""),
        subject: String(r.subject ?? ""),
        teacher: String(r.teacher ?? ""),
        room: String(r.classRoom ?? ""),
      };
    });
  }, [routineData, selectionReady]);

  const handleExportExcel = useCallback(() => {
    if (!exportRows.length) return;
    exportToExcel(exportRows, "class-timetable", "Timetable");
  }, [exportRows]);

  const handleExportPdf = useCallback(() => {
    if (!exportRows.length) return;
    exportToPDF(exportRows, "Class timetable", "class-timetable", exportColumns);
  }, [exportRows, exportColumns]);

  const handlePrint = useCallback(() => {
    if (!exportRows.length) return;
    printData("Class timetable", exportColumns, exportRows);
  }, [exportRows, exportColumns]);

  const [cellDrafts, setCellDrafts] = useState<Record<string, CellDraft>>({});
  const [initialCellDrafts, setInitialCellDrafts] = useState<Record<string, CellDraft>>({});
  const [savingByKey, setSavingByKey] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const makeCellKey = useCallback((dayNum: number, slotId: number) => `${dayNum}-${slotId}`, []);

  useEffect(() => {
    if (!selectionReady || loading || periodColumns.length === 0) {
      setCellDrafts({});
      setInitialCellDrafts({});
      return;
    }
    const next: Record<string, CellDraft> = {};
    WEEK_DAYS.forEach(({ label, dow }) => {
      periodColumns.forEach((col) => {
        if (col.isBreak) return;
        const entry = findCellForSlot(routineData, label, col.id);
        const od = entry?.originalData ?? {};
        const existingId = od.id != null && Number.isFinite(Number(od.id)) ? Number(od.id) : null;
        const key = makeCellKey(dow, col.id);
        next[key] = {
          existingId,
          dayLabel: label,
          dayNum: dow,
          slotId: col.id,
          slotLabel: col.label,
          subjectId: od.subject_id != null ? String(od.subject_id) : "",
          teacherId: od.teacher_id != null ? String(od.teacher_id) : "",
          dirty: false,
        };
      });
    });
    setCellDrafts(next);
    setInitialCellDrafts(next);
  }, [selectionReady, loading, periodColumns, routineData, makeCellKey]);

  const updateCellDraft = useCallback(
    (key: string, patch: Partial<CellDraft>) => {
      setCellDrafts((prev) => {
        const current = prev[key];
        if (!current) return prev;
        const next = { ...current, ...patch };
        const base = initialCellDrafts[key];
        const dirty = !!base && (next.subjectId !== base.subjectId || next.teacherId !== base.teacherId);
        return { ...prev, [key]: { ...next, dirty } };
      });
    },
    [initialCellDrafts]
  );

  const persistCell = useCallback(
    async (key: string, opts?: { skipRefetch?: boolean }) => {
      const draft = cellDrafts[key];
      if (!draft) return { ok: false, message: "Missing cell data." };
      if (!draft.teacherId) {
        return {
          ok: false,
          message: `${draft.dayLabel} - ${draft.slotLabel}: Please select a teacher before saving.`,
        };
      }
      setSavingByKey((prev) => ({ ...prev, [key]: true }));
      try {
        const payload = {
          class_id: Number(filterClassId),
          section_id: Number(filterSectionId),
          subject_id: draft.subjectId ? Number(draft.subjectId) : null,
          teacher_id: Number(draft.teacherId),
          day_of_week: draft.dayNum,
          time_slot_id: draft.slotId,
          academic_year_id: academicYearId,
        };
        if (draft.existingId) {
          await apiService.updateClassSchedule(draft.existingId, payload);
        } else {
          await apiService.createClassSchedule(payload);
        }
        if (!opts?.skipRefetch) {
          await refetch();
        }
        return { ok: true, message: "" };
      } catch (e) {
        return { ok: false, message: httpErrorMessage(e, "Could not save this slot.") };
      } finally {
        setSavingByKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [cellDrafts, filterClassId, filterSectionId, academicYearId, refetch]
  );

  const pendingKeys = useMemo(
    () => Object.keys(cellDrafts).filter((key) => cellDrafts[key]?.dirty),
    [cellDrafts]
  );

  const handleBulkSave = useCallback(async () => {
    if (!pendingKeys.length) return;
    setBulkSaving(true);
    try {
      const failures: string[] = [];
      for (const key of pendingKeys) {
        const result = await persistCell(key, { skipRefetch: true });
        if (!result.ok) failures.push(result.message);
      }
      await refetch();
      if (failures.length === 0) {
        void Swal.fire({
          icon: "success",
          title: "Bulk save completed",
          text: `${pendingKeys.length} timetable changes saved successfully.`,
        });
      } else {
        void Swal.fire({
          icon: "warning",
          title: "Bulk save completed with issues",
          text: failures.slice(0, 3).join(" | "),
        });
      }
    } finally {
      setBulkSaving(false);
    }
  }, [pendingKeys, persistCell, refetch]);

  const handleSingleSave = useCallback(
    async (key: string) => {
      const result = await persistCell(key);
      if (!result.ok) {
        void Swal.fire({
          icon: "error",
          title: "Could not save",
          text: result.message,
        });
      }
    },
    [persistCell]
  );

  const handleDelete = useCallback(
    async (key: string) => {
      const draft = cellDrafts[key];
      if (!draft?.existingId) return;
      const confirm = await Swal.fire({
        title: "Remove entry?",
        text: `Remove this timetable entry for ${draft.dayLabel}?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
      });
      if (!confirm.isConfirmed) return;
      setSavingByKey((prev) => ({ ...prev, [key]: true }));
      try {
        await apiService.deleteClassSchedule(draft.existingId);
        await refetch();
        void Swal.fire({ icon: "success", title: "Removed", timer: 1600, showConfirmButton: false });
      } catch (e) {
        const msg = httpErrorMessage(e, "Could not delete.");
        void Swal.fire({ icon: "error", title: "Delete failed", text: msg });
      } finally {
        setSavingByKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [cellDrafts, refetch]
  );

  return (
    <div>
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Create timetable</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Academic</li>
                  <li className="breadcrumb-item">Timetable</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Create timetable
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <TooltipOption
                onRefresh={() => void refetch()}
                onPrint={handlePrint}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h4 className="mb-0">Class &amp; section</h4>
              <p className="text-muted small mb-0 mt-1">
                Choose class and section, then fill each period for the full week. Times come from{" "}
                <strong>Timetable → Time slots</strong>.
              </p>
            </div>
            <div className="card-body">
              {!academicYearId ? (
                <div className="alert alert-warning mb-3">Select an academic year in the header.</div>
              ) : null}
              <div className="row g-3 mb-4">
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Class</label>
                  <CommonSelect
                    className="select"
                    options={classOptions}
                    value={filterClassId || null}
                    placeholder="Select class"
                    onChange={(v) => {
                      setFilterClassId(v || "");
                      setFilterSectionId("");
                    }}
                  />
                </div>
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Section</label>
                  <CommonSelect
                    className="select"
                    options={sectionOptions}
                    value={filterSectionId || null}
                    placeholder={filterClassId ? "Select section" : "Select class first"}
                    onChange={(v) => setFilterSectionId(v || "")}
                  />
                </div>
                <div className="col-md-12 col-lg-4 d-flex align-items-end justify-content-lg-end">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleBulkSave()}
                    disabled={!selectionReady || loading || bulkSaving || pendingKeys.length === 0}
                  >
                    {bulkSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}

              {selectionReady && loading ? (
                <div className="text-center py-4 text-muted">Loading timetable…</div>
              ) : null}

              {selectionReady && !loading && periodColumns.length === 0 ? (
                <div className="alert alert-secondary">
                  No periods found. Add active periods under <strong>Academic → Timetable → Time slots</strong>.
                </div>
              ) : null}

              {selectionReady && !loading && periodColumns.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ minWidth: 96 }}>Day</th>
                        {periodColumns.map((col) => (
                          <th key={col.id} className={col.isBreak ? "text-muted" : ""} style={{ minWidth: 200 }}>
                            <div>{col.label}</div>
                            <div className="small fw-normal text-muted">
                              {col.isBreak ? "Break" : `${col.start} – ${col.end}`}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEK_DAYS.map(({ label, dow }) => (
                        <tr key={label}>
                          <th className="table-light">{label}</th>
                          {periodColumns.map((col) => {
                            const key = makeCellKey(dow, col.id);
                            const draft = cellDrafts[key];
                            return (
                              <TimetableCell
                                key={`${label}-${col.id}`}
                                dayLabel={label}
                                dayNum={dow}
                                slot={col}
                                subjectId={draft?.subjectId ?? ""}
                                teacherId={draft?.teacherId ?? ""}
                                dirty={Boolean(draft?.dirty)}
                                busy={Boolean(savingByKey[key]) || bulkSaving}
                                subjectOptions={subjectOptions}
                                teacherOptions={teacherOptions}
                                subjectTeacherMap={subjectTeacherMap}
                                sectionRoomLabel={sectionRoomLabel}
                                onSubjectChange={(v) => updateCellDraft(key, { subjectId: v || "" })}
                                onTeacherChange={(v) => updateCellDraft(key, { teacherId: v || "" })}
                                onSave={() => void handleSingleSave(key)}
                                onDelete={() => void handleDelete(key)}
                                canDelete={Boolean(draft?.existingId)}
                              />
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {!selectionReady && academicYearId ? (
                <div className="alert alert-light border">Select <strong>class</strong> and <strong>section</strong> to edit the weekly timetable.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassTimetable;





