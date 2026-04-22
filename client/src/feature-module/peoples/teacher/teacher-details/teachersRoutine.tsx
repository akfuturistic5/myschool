import { Link, useLocation, useSearchParams } from "react-router-dom";
import { createFilter } from "react-select";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import CommonSelect from "../../../../core/common/commonSelect";
import { exportTimetableGridToExcel, exportTimetableGridToPDF } from "../../../../core/utils/exportUtils";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { useCurrentTeacher } from "../../../../core/hooks/useCurrentTeacher";
import { useTeachers } from "../../../../core/hooks/useTeachers";

interface TeacherDetailsLocationState {
  teacherId?: number;
  teacher?: any;
}

interface RoutineItem {
  id: number;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  subjectId: number;
  subjectName: string;
  timeSlotId: number;
  slotName: string;
  dayOfWeek: string;
  roomNumber: string;
  startTime: string;
  endTime: string;
  duration: string;
  isBreak: boolean;
  academicYearId: number;
}

const WEEK_DAYS: { label: string }[] = [
  { label: "Monday" },
  { label: "Tuesday" },
  { label: "Wednesday" },
  { label: "Thursday" },
  { label: "Friday" },
  { label: "Saturday" },
  { label: "Sunday" },
];

type PeriodCol = { id: number; label: string; start: string; end: string; isBreak: boolean };

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

function findCellForSlot(routineData: any[], dayLabel: string, slotId: number) {
  return (routineData || []).find((r: any) => {
    const d = String(r.day || "").toLowerCase();
    const od = r.originalData || {};
    return d === dayLabel.toLowerCase() && Number(od.time_slot_id) === slotId;
  });
}

function formatTeacherExportCell(slot: PeriodCol, entry: any | undefined): string {
  if (slot.isBreak) return "Break";
  if (!entry) return "—";
  const subj = String(entry.subject ?? "").trim() || "—";
  const cs = String(entry.classSection ?? "").trim() || "—";
  const room = String(entry.classRoom ?? "").trim() || "—";
  return `${subj}\n${cs}\nRoom: ${room}`;
}

function TeacherRoutineGridCell({ slot, entry }: { slot: PeriodCol; entry: any | undefined }) {
  if (slot.isBreak) {
    return (
      <td className="bg-light align-top text-center py-3">
        <small className="text-muted">Break</small>
      </td>
    );
  }
  if (entry) {
    return (
      <td className="align-top small" style={{ minWidth: 168, maxWidth: 240 }}>
        <div className="fw-medium text-break">{entry.subject ?? "—"}</div>
        <div className="text-muted text-break">{entry.classSection ?? "—"}</div>
        <div className="text-muted">Room: {entry.classRoom ?? "—"}</div>
      </td>
    );
  }
  return (
    <td className="align-top text-muted small text-center py-3" style={{ minWidth: 120 }}>
      —
    </td>
  );
}

const TeachersRoutine = () => {
  const routes = all_routes;
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const authUser = useSelector(selectUser);
  const authRole = String(authUser?.role ?? "").trim().toLowerCase();
  const isTeacherPortal =
    Number((authUser as { user_role_id?: number })?.user_role_id) === 2 || authRole === "teacher";
  const { teacher: currentTeacher, loading: currentTeacherLoading } = useCurrentTeacher();
  const selfTeacher = currentTeacher as { id?: number; first_name?: string; last_name?: string } | null;
  const { teachers = [], loading: teachersListLoading, error: teachersListError } = useTeachers({
    skip: isTeacherPortal,
  });
  const rosterLoading = isTeacherPortal ? currentTeacherLoading : teachersListLoading;
  const state = location.state as TeacherDetailsLocationState | null;

  const routeDefaultTeacherId = useMemo(() => {
    const q = searchParams.get("teacher_id");
    if (q != null && q !== "") {
      const n = Number(q);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const sid = state?.teacherId ?? state?.teacher?.id;
    if (sid != null && Number.isFinite(Number(sid))) return Number(sid);
    if (selfTeacher?.id != null && Number.isFinite(Number(selfTeacher.id))) return Number(selfTeacher.id);
    return null;
  }, [searchParams, state?.teacherId, state?.teacher?.id, selfTeacher?.id]);

  const [selectTeacherId, setSelectTeacherId] = useState<string>(() =>
    routeDefaultTeacherId != null ? String(routeDefaultTeacherId) : ""
  );

  useEffect(() => {
    if (routeDefaultTeacherId != null) setSelectTeacherId(String(routeDefaultTeacherId));
    else setSelectTeacherId("");
  }, [routeDefaultTeacherId, location.key]);

  const effectiveTeacherId = useMemo(() => {
    if (!selectTeacherId) return null;
    const n = Number(selectTeacherId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectTeacherId]);

  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [apiSlots, setApiSlots] = useState<Record<string, unknown>[]>([]);
  const [routineLoading, setRoutineLoading] = useState(false);

  const portalTeacherDisplayName = useMemo(() => {
    if (!selfTeacher?.id) return "";
    return `${selfTeacher.first_name || ""} ${selfTeacher.last_name || ""}`.trim() || `Teacher #${selfTeacher.id}`;
  }, [selfTeacher]);

  const teacherSelectOptions = useMemo(() => {
    const rows = (teachers as any[]).filter((t) => {
      const s = String(t?.status ?? "").trim().toLowerCase();
      if (!s) return true;
      if (["inactive", "terminated", "resigned", "deleted"].includes(s)) return false;
      return true;
    });
    return [
      { value: "", label: "Select teacher" },
      ...rows.map((t) => ({
        value: String(t.id),
        label: `${t.first_name || ""} ${t.last_name || ""}`.trim() || `Teacher #${t.id}`,
      })),
    ];
  }, [teachers]);

  const handleTeacherSelect = (val: string | null) => {
    const v = val || "";
    setSelectTeacherId(v);
    if (v) setSearchParams({ teacher_id: v }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (!effectiveTeacherId) {
      setRoutine([]);
      setApiSlots([]);
      return;
    }
    setRoutineLoading(true);
    apiService
      .getTeacherRoutine(effectiveTeacherId, { academicYearId })
      .then((res: any) => {
        if (res?.data) {
          setRoutine(res.data.routine || []);
          setApiSlots(Array.isArray(res.data.slots) ? res.data.slots : []);
        } else {
          setRoutine([]);
          setApiSlots([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching teacher routine:", err);
        setRoutine([]);
        setApiSlots([]);
      })
      .finally(() => setRoutineLoading(false));
  }, [effectiveTeacherId, academicYearId]);

  const gridData = useMemo(
    () =>
      routine.map((item, index) => ({
        key: String(item.id ?? index),
        day: item.dayOfWeek,
        subject: item.subjectName,
        classRoom: item.roomNumber,
        classSection: [item.className, item.sectionName].filter(Boolean).join(" · ") || "—",
        originalData: { time_slot_id: item.timeSlotId },
      })),
    [routine]
  );

  const periodColumnsFromSlots: PeriodCol[] = useMemo(() => {
    const raw = Array.isArray(apiSlots) ? apiSlots : [];
    const seenIds = new Set<number>();
    const rawDeduped = raw.filter((s: any) => {
      const id = Number(s?.id);
      if (!Number.isFinite(id) || id <= 0 || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    const usedSlotIds = new Set(
      gridData.map((r: any) => Number(r?.originalData?.time_slot_id)).filter((n: number) => Number.isFinite(n) && n > 0)
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
  }, [apiSlots, gridData]);

  const periodColumnsFallback: PeriodCol[] = useMemo(() => {
    const map = new Map<number, RoutineItem>();
    for (const item of routine) {
      const id = Number(item.timeSlotId);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!map.has(id)) map.set(id, item);
    }
    type Row = PeriodCol & { sortKey: string };
    const rows: Row[] = [...map.entries()].map(([id, item]) => ({
      id,
      label: String(item.slotName?.trim() || `Period ${id}`),
      start: formatSlotTime(item.startTime),
      end: formatSlotTime(item.endTime),
      isBreak: Boolean(item.isBreak),
      sortKey: timeSortKey(item.startTime),
    }));
    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id - b.id);
    return rows.map(({ sortKey: _s, ...c }) => c);
  }, [routine]);

  const periodColumns =
    periodColumnsFromSlots.length > 0 ? periodColumnsFromSlots : periodColumnsFallback;

  const selectedTeacherName = useMemo(() => {
    const t = (teachers as any[]).find((x) => String(x.id) === String(selectTeacherId));
    if (t) return `${t.first_name || ""} ${t.last_name || ""}`.trim() || `Teacher #${t.id}`;
    return selectTeacherId ? `Teacher #${selectTeacherId}` : "";
  }, [teachers, selectTeacherId]);

  const exportGridHeaders = useMemo(
    () => [
      "Day",
      ...periodColumns.map((c) => (c.isBreak ? c.label : `${c.label}\n${c.start} – ${c.end}`)),
    ],
    [periodColumns]
  );

  const exportGridBody = useMemo(() => {
    if (!effectiveTeacherId || !periodColumns.length) return [] as string[][];
    return WEEK_DAYS.map(({ label: dayLabel }) => [
      dayLabel,
      ...periodColumns.map((col) =>
        formatTeacherExportCell(col, findCellForSlot(gridData, dayLabel, col.id))
      ),
    ]);
  }, [effectiveTeacherId, periodColumns, gridData]);

  const exportTitle = useMemo(
    () => `Teacher timetable — ${selectedTeacherName || "Teacher"}`,
    [selectedTeacherName]
  );

  const canExport = Boolean(effectiveTeacherId && !routineLoading && exportGridBody.length > 0);

  const handleExportPdf = useCallback(() => {
    if (!exportGridBody.length) return;
    exportTimetableGridToPDF(exportTitle, exportGridHeaders, exportGridBody, "teacher-routine", {
      showHead: "firstPage",
    });
  }, [exportTitle, exportGridHeaders, exportGridBody]);

  const handleExportExcel = useCallback(() => {
    if (!exportGridBody.length) return;
    exportTimetableGridToExcel(exportGridHeaders, exportGridBody, "teacher-routine", "Teacher routine");
  }, [exportGridHeaders, exportGridBody]);

  const teacherSelectFilter = useMemo(() => {
    const base = createFilter({ ignoreAccents: true, trim: true, matchFrom: "any" });
    return (option: any, inputValue: string) => {
      const val = option?.value ?? option?.data?.value;
      if (val === "" && String(inputValue || "").trim().length > 0) return false;
      return base(option, inputValue);
    };
  }, []);

  const teacherRoutineSelectStyles = useMemo(
    () => ({
      control: (base: Record<string, unknown>, state: { isFocused?: boolean }) => ({
        ...base,
        minHeight: 44,
        fontSize: "0.9375rem",
        borderRadius: 8,
        borderWidth: 2,
        borderColor: state.isFocused ? "#3d5ee1" : "#c5cdd8",
        boxShadow: state.isFocused ? "0 0 0 2px rgba(61, 94, 225, 0.22)" : "none",
        backgroundColor: "#fff",
        cursor: "pointer",
      }),
      singleValue: (base: Record<string, unknown>) => ({
        ...base,
        fontWeight: 600,
        color: "#1a1d21",
      }),
      placeholder: (base: Record<string, unknown>) => ({
        ...base,
        color: "#6c757d",
        fontWeight: 500,
      }),
      input: (base: Record<string, unknown>) => ({
        ...base,
        fontSize: "0.9375rem",
        margin: 0,
        padding: 0,
      }),
      valueContainer: (base: Record<string, unknown>) => ({
        ...base,
        paddingLeft: 10,
        paddingRight: 4,
      }),
      dropdownIndicator: (base: Record<string, unknown>) => ({
        ...base,
        color: "#3d5ee1",
        paddingRight: 10,
      }),
      menu: (base: Record<string, unknown>) => ({
        ...base,
        borderRadius: 8,
        marginTop: 6,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.14)",
        border: "1px solid #e2e6ea",
      }),
      menuList: (base: Record<string, unknown>) => ({
        ...base,
        paddingTop: 4,
        paddingBottom: 4,
      }),
      option: (base: Record<string, unknown>, state: { isSelected?: boolean; isFocused?: boolean }) => ({
        ...base,
        fontSize: "0.9375rem",
        padding: "9px 14px",
        cursor: "pointer",
        backgroundColor: state.isSelected ? "#3d5ee1" : state.isFocused ? "#e8ecfc" : "#fff",
        color: state.isSelected ? "#fff" : "#212529",
        fontWeight: state.isSelected ? 600 : 400,
      }),
    }),
    []
  );

  return (
    <div className="page-wrapper">
      <div className="content content-two">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Teacher routine</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={routes.teacherList}>Teachers</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Teacher routine
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div className="card">
          <div className="card-header border-0 pb-0">
            <h5 className="card-title mb-0">Timetable</h5>
          </div>
          <div className="card-body pt-2 pb-0">
            <div className="row g-3 g-lg-4 align-items-end mb-3 mb-lg-4">
              <div className="col-12 col-md col-xl-7">
                {isTeacherPortal ? (
                  <>
                    <span className="form-label d-block fw-semibold text-dark mb-2" style={{ fontSize: "0.9375rem" }}>
                      Your timetable
                    </span>
                    <p className="mb-1 fw-semibold text-dark" style={{ fontSize: "1.05rem" }}>
                      {rosterLoading ? "Loading…" : portalTeacherDisplayName || "—"}
                    </p>
                    <p className="text-muted small mb-0">
                      Weekly periods for the selected academic year are shown in the grid below.
                    </p>
                  </>
                ) : (
                  <>
                    <span className="form-label d-block fw-semibold text-dark mb-2" style={{ fontSize: "0.9375rem" }}>
                      Select teacher
                    </span>
                    <CommonSelect
                      className="select teacher-routine-teacher-select w-100"
                      styles={teacherRoutineSelectStyles}
                      options={teacherSelectOptions}
                      value={selectTeacherId || null}
                      placeholder={rosterLoading ? "Loading teachers…" : "Type to search or choose a teacher…"}
                      onChange={(v) => handleTeacherSelect(v || null)}
                      isSearchable
                      filterOption={teacherSelectFilter}
                      noOptionsMessage={() => "No matching teacher"}
                    />
                    <p className="text-muted small mt-2 mb-0">Choose a teacher to load their weekly periods below.</p>
                  </>
                )}
              </div>
              <div className="col-12 col-md-auto ms-md-auto text-md-end">
                <div className="dropdown d-inline-block text-start">
                  <button
                    type="button"
                    className="btn dropdown-toggle d-inline-flex align-items-center gap-2 fw-semibold px-3 py-2 rounded-3 border-0 shadow-none"
                    style={{ backgroundColor: "#e8edf5", color: "#2c3e50", minHeight: 44 }}
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    disabled={!canExport}
                  >
                    <i className="ti ti-file-export fs-5" aria-hidden />
                    <span>Export</span>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end shadow-sm border mt-2 py-1 rounded-3" style={{ minWidth: 220 }}>
                    <li>
                      <button
                        type="button"
                        className="dropdown-item d-flex align-items-center gap-2 py-2"
                        onClick={handleExportPdf}
                      >
                        <i className="ti ti-file-type-pdf text-danger fs-5" aria-hidden />
                        <span>Export as PDF</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className="dropdown-item d-flex align-items-center gap-2 py-2"
                        onClick={handleExportExcel}
                      >
                        <i className="ti ti-file-type-xls text-success fs-5" aria-hidden />
                        <span>Export as Excel</span>
                      </button>
                    </li>
                  </ul>
                </div>
                {!canExport ? (
                  <p className="text-muted small mt-2 mb-0 text-md-end">
                    {isTeacherPortal
                      ? "Export is available once your timetable has loaded."
                      : "Export unlocks after a teacher with a timetable is selected."}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="card-body border-top pt-3 mt-0">
                      {!academicYearId ? (
                        <div className="alert alert-warning mb-3">Select an academic year in the header to filter this timetable.</div>
                      ) : null}
                      {!isTeacherPortal && teachersListError ? (
                        <div className="alert alert-danger mb-3">
                          Could not load teacher list: {teachersListError}. Check your permissions or try refreshing.
                        </div>
                      ) : null}
                      {!effectiveTeacherId ? (
                        <div className="text-center p-5 border rounded bg-light">
                          <p className="text-muted mb-0">
                            {isTeacherPortal
                              ? rosterLoading
                                ? "Loading your teacher profile…"
                                : "Your account is not linked to a teacher profile. Please contact the school office."
                              : "Choose a teacher above to view their weekly timetable."}
                          </p>
                        </div>
                      ) : routineLoading ? (
                        <div className="d-flex justify-content-center align-items-center p-5">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading routine...</span>
                          </div>
                          <span className="ms-2">Loading routine...</span>
                        </div>
                      ) : periodColumns.length === 0 ? (
                        <div className="text-center p-5">
                          <p className="text-muted mb-0">
                            No periods are configured. Add active time slots under Academic → Timetable → Time slots.
                          </p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-bordered table-sm align-middle">
                            <thead className="table-light">
                              <tr>
                                <th style={{ minWidth: 96 }}>Day</th>
                                {periodColumns.map((col) => (
                                  <th key={col.id} className={col.isBreak ? "text-muted" : ""} style={{ minWidth: 140 }}>
                                    <div>{col.label}</div>
                                    <div className="small fw-normal text-muted">
                                      {col.isBreak ? "Break" : `${col.start} – ${col.end}`}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {WEEK_DAYS.map(({ label }) => (
                                <tr key={label}>
                                  <th className="table-light">{label}</th>
                                  {periodColumns.map((col) => (
                                    <TeacherRoutineGridCell
                                      key={`${label}-${col.id}`}
                                      slot={col}
                                      entry={findCellForSlot(gridData, label, col.id)}
                                    />
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeachersRoutine;

