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

type CellProps = {
  dayLabel: string;
  dayNum: number;
  slot: PeriodCol;
  entry: any | undefined;
  classId: string;
  sectionId: string;
  academicYearId: number;
  subjectOptions: Opt[];
  teacherOptions: Opt[];
  sectionRoomLabel: string;
  onSaved: () => void;
};

function TimetableCell({
  dayLabel,
  dayNum,
  slot,
  entry,
  classId,
  sectionId,
  academicYearId,
  subjectOptions,
  teacherOptions,
  sectionRoomLabel,
  onSaved,
}: CellProps) {
  const od = entry?.originalData ?? {};
  const existingId = od.id != null && Number.isFinite(Number(od.id)) ? Number(od.id) : null;

  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSubjectId(od.subject_id != null ? String(od.subject_id) : "");
    setTeacherId(od.teacher_id != null ? String(od.teacher_id) : "");
  }, [existingId, od.subject_id, od.teacher_id]);

  const handleSave = async () => {
    if (!teacherId) {
      void Swal.fire({
        icon: "warning",
        title: "Teacher required",
        text: "Please select a teacher before saving.",
      });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        class_id: Number(classId),
        section_id: Number(sectionId),
        subject_id: subjectId ? Number(subjectId) : null,
        teacher_id: Number(teacherId),
        day_of_week: dayNum,
        time_slot_id: slot.id,
        academic_year_id: academicYearId,
      };
      if (existingId) {
        await apiService.updateClassSchedule(existingId, payload);
      } else {
        await apiService.createClassSchedule(payload);
      }
      onSaved();
    } catch (e) {
      const msg = httpErrorMessage(e, "Could not save this slot.");
      void Swal.fire({
        icon: "error",
        title: "Could not save",
        text: msg,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    const confirm = await Swal.fire({
      title: "Remove entry?",
      text: `Remove this timetable entry for ${dayLabel}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    });
    if (!confirm.isConfirmed) return;
    setBusy(true);
    try {
      await apiService.deleteClassSchedule(existingId);
      onSaved();
      void Swal.fire({ icon: "success", title: "Removed", timer: 1600, showConfirmButton: false });
    } catch (e) {
      const msg = httpErrorMessage(e, "Could not delete.");
      void Swal.fire({ icon: "error", title: "Delete failed", text: msg });
    } finally {
      setBusy(false);
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
          onChange={(v) => setSubjectId(v || "")}
        />
      </div>
      <div className="mb-1">
        <CommonSelect
          className="select select-sm"
          options={teacherOptions}
          value={teacherId || null}
          placeholder="Teacher"
          onChange={(v) => setTeacherId(v || "")}
        />
      </div>
      <div className="mb-1 small">
        <span className="text-muted">Room: </span>
        <span>{sectionRoomLabel || "—"}</span>
      </div>
      <div className="d-flex flex-wrap gap-1">
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void handleSave()}>
          {busy ? "…" : existingId ? "Update" : "Add"}
        </button>
        {existingId ? (
          <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => void handleDelete()}>
            Remove
          </button>
        ) : null}
      </div>
    </td>
  );
}

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
    const seen = new Set<string>();
    const deduped = arr.filter((x: any) => {
      const label = String(x?.[labelKey] ?? x?.[valueKey] ?? "").trim().toLowerCase();
      if (!label) return false;
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    return [
      { value: "", label: "Select" },
      ...deduped.map((x: any) => ({ value: String(x[valueKey]), label: String(x[labelKey] ?? x[valueKey]) })),
    ];
  };

  const yearScopedClasses = useMemo(
    () => classes.filter((c: any) => !academicYearId || Number(c?.academic_year_id) === Number(academicYearId)),
    [classes, academicYearId]
  );
  const classOptions = options(yearScopedClasses, "id", "class_name");
  const sectionOptions = options(sections, "id", "section_name");
  const subjectOptions: Opt[] = useMemo(() => {
    const rows = Array.isArray(subjects) ? subjects : [];
    return [
      { value: "", label: "Select" },
      ...rows.map((s: Record<string, unknown>) => ({
        value: String(s.id ?? ""),
        label: formatSubjectOptionLabel(s),
      })),
    ];
  }, [subjects]);
  const teacherOptions: Opt[] = [
    { value: "", label: "Select" },
    ...teachers.map((t: any) => {
      const sid = t.staff_id != null ? String(t.staff_id) : String(t.id);
      const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || sid;
      return { value: sid, label: name };
    }),
  ];
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
                          {periodColumns.map((col) => (
                            <TimetableCell
                              key={`${label}-${col.id}`}
                              dayLabel={label}
                              dayNum={dow}
                              slot={col}
                              entry={findCellForSlot(routineData, label, col.id)}
                              classId={filterClassId}
                              sectionId={filterSectionId}
                              academicYearId={academicYearId!}
                              subjectOptions={subjectOptions}
                              teacherOptions={teacherOptions}
                              sectionRoomLabel={sectionRoomLabel}
                              onSaved={() => void refetch()}
                            />
                          ))}
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





