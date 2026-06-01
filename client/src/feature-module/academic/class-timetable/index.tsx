import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import {
  exportTimetableGridToExcel,
  exportTimetableGridToPDF,
  printTimetableGrid,
} from "../../../core/utils/exportUtils";
import {
  WEEK_DAYS as ROUTINE_WEEK_DAYS,
  buildPeriodColumnsFromSlots,
  findCellForSlot,
  formatSectionExportCell,
} from "../utils/sectionRoutineGrid";
import { useClassRooms } from "../../../core/hooks/useClassRooms";

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

function timeSortKey(t: unknown): string {
  const s = String(t ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return "99:99:99";
  const hh = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const ss = (m[3] ?? "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

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

function findAllCellsForSlot(routineData: any[], dayLabel: string, slotId: number) {
  return (routineData || []).filter((r: any) => {
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

type CellDraft = {
  existingId: number | null;
  dayLabel: string;
  dayNum: number;
  slotId: number;
  slotLabel: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  dirty: boolean;
  isOpenedByUser?: boolean;
};

type CellProps = {
  dayLabel: string;
  dayNum: number;
  slot: PeriodCol;
  drafts: CellDraft[];
  subjectOptions: Opt[];
  teacherOptions: Opt[];
  roomOptions: Opt[];
  onEditClick: () => void;
};

function TimetableCell({
  dayLabel,
  slot,
  drafts = [],
  subjectOptions,
  teacherOptions,
  roomOptions,
  onEditClick,
}: CellProps) {
  if (slot.isBreak) {
    return (
      <td className="bg-light align-top text-center py-3" style={{ minWidth: 80 }}>
        <small className="text-muted fw-bold">Break</small>
      </td>
    );
  }

  const activeDrafts = drafts.filter((d) => d.subjectId || d.teacherId || d.existingId);
  const isEmpty = activeDrafts.length === 0 || (
    activeDrafts.length === 1 &&
    !activeDrafts[0].existingId &&
    !activeDrafts[0].subjectId
  );

  const getSubjectLabel = (id: string) => {
    const opt = subjectOptions.find((o) => String(o.value) === String(id));
    return opt && opt.value ? opt.label : "";
  };

  const getTeacherLabel = (id: string) => {
    const opt = teacherOptions.find((o) => String(o.value) === String(id));
    return opt && opt.value ? opt.label : "";
  };

  const getRoomLabel = (id: string) => {
    const opt = roomOptions.find((o) => String(o.value) === String(id));
    return opt && opt.value ? opt.label : "";
  };

  if (isEmpty) {
    return (
      <td className="align-top p-2" style={{ minWidth: 170, maxWidth: 280 }}>
        <div className="small text-muted mb-2 border-bottom pb-1">
          <span>{slot.start}{slot.end ? ` – ${slot.end}` : ""}</span>
        </div>
        <div
          className="d-flex align-items-center justify-content-center rounded p-3 text-muted border border-dashed"
          style={{
            height: 85,
            backgroundColor: "#f8f9fa",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out"
          }}
          onClick={onEditClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#0d6efd";
            e.currentTarget.style.backgroundColor = "#f0f5ff";
            e.currentTarget.style.color = "#0d6efd";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#dee2e6";
            e.currentTarget.style.backgroundColor = "#f8f9fa";
            e.currentTarget.style.color = "#6c757d";
          }}
        >
          <div className="text-center">
            <i className="ti ti-plus fs-6 mb-1 d-block"></i>
            <span className="small fw-semibold">Add Class</span>
          </div>
        </div>
      </td>
    );
  }

  return (
    <td
      className="align-top p-2"
      style={{
        minWidth: 170,
        maxWidth: 280,
        backgroundColor: drafts.some((d) => d.dirty) ? "#fffdf5" : undefined,
        cursor: "pointer",
        transition: "all 0.15s"
      }}
      onClick={onEditClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "inset 0 0 0 1px #0d6efd";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="small text-muted mb-2 border-bottom pb-1 d-flex justify-content-between align-items-center">
        <span>{slot.start}{slot.end ? ` – ${slot.end}` : ""}</span>
        <span className="badge bg-light text-muted border px-1 py-0 fs-9 fw-normal">Edit</span>
      </div>
      <div className="d-flex flex-column gap-2">
        {activeDrafts.map((d, index) => {
          const sLabel = getSubjectLabel(d.subjectId);
          const tLabel = getTeacherLabel(d.teacherId);
          const rLabel = getRoomLabel(d.roomId);

          return (
            <div
              key={index}
              className="p-2 border rounded bg-white shadow-sm position-relative"
              style={{ borderLeft: d.dirty ? "3px solid #ffc107" : "3px solid #0d6efd" }}
            >
              <div className="fw-bold text-dark fs-12 text-truncate" title={sLabel || "Unassigned"}>
                {sLabel || "Unassigned Subject"}
              </div>
              <div className="text-muted fs-11 mt-1 d-flex align-items-center text-truncate" title={tLabel}>
                <i className="ti ti-user me-1 text-secondary"></i>
                {tLabel || "No Teacher Assigned"}
              </div>
              {rLabel && (
                <div className="text-muted fs-10 mt-1 d-flex align-items-center text-truncate" title={rLabel}>
                  <i className="ti ti-map-pin me-1 text-secondary"></i>
                  Room {rLabel}
                </div>
              )}
              <div className="mt-2 d-flex justify-content-between align-items-center">
                <span className="small text-muted fs-9">
                  {!d.existingId ? (
                    <span className="badge bg-light text-warning border border-warning fs-9 px-1 py-0">Draft</span>
                  ) : d.dirty ? (
                    <span className="badge bg-light text-warning border border-warning fs-9 px-1 py-0">Unsaved</span>
                  ) : (
                    <span className="badge bg-light text-success border border-success fs-9 px-1 py-0">Saved</span>
                  )}
                </span>
                {activeDrafts.length > 1 && (
                  <span className="badge bg-secondary fs-9">#{index + 1}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </td>
  );
}

const ClassTimetable = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");

  // Horizontal Scroll & Drag-to-Scroll helper hooks
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowLeftScroll(el.scrollLeft > 5);
    setShowRightScroll(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  const scrollTimetable = useCallback((direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = 300;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    const target = e.target as HTMLElement;
    if (
      target.closest("button") || 
      target.closest("a") || 
      target.closest("select") || 
      target.closest(".badge") ||
      target.closest("input") ||
      target.closest(".ts-control")
    ) {
      return;
    }
    const el = scrollContainerRef.current;
    if (!el) return;
    setIsDragging(true);
    startX.current = e.pageX - el.offsetLeft;
    scrollLeftStart.current = el.scrollLeft;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    el.scrollLeft = scrollLeftStart.current - walk;
  }, [isDragging]);

  const handleMouseUpOrLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUpOrLeave);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUpOrLeave);
    };
  }, [isDragging, handleMouseMove, handleMouseUpOrLeave]);

  // Copy Routine state
  const [copySourceClassId, setCopySourceClassId] = useState("");
  const [copySourceSectionId, setCopySourceSectionId] = useState("");
  const [subjectTeacherAssignments, setSubjectTeacherAssignments] = useState<any[]>([]);

  const { classes = [] } = useClasses();
  const { sections = [], loading: sectionsLoading } = useSections(filterClassId || null, {
    fetchAllWhenNoClass: false,
    academicYearId: academicYearId ?? null,
  });

  // For Copy Modal
  const { sections: copySections = [] } = useSections(copySourceClassId || null, {
    fetchAllWhenNoClass: false,
    academicYearId: academicYearId ?? null,
  });

  const { subjects = [] } = useSubjects(filterClassId ? Number(filterClassId) : null, {
    fetchAllWhenNoClass: false,
    academicYearId: academicYearId ?? null
  });
  const { teachers = [] } = useTeachers();
  const { classRooms = [] } = useClassRooms();

  const roomOptions: Opt[] = useMemo(() => {
    return options(classRooms, "id", "room_number");
  }, [classRooms]);

  const selectionReady = Boolean(
    filterClassId &&
    academicYearId &&
    (filterSectionId || (!sectionsLoading && sections.length === 0))
  );

  const sectionRoomLabel = useMemo(() => {
    const sec = sections.find((x: { id?: unknown }) => String(x.id) === String(filterSectionId));
    const rn = sec && typeof sec === "object" && sec !== null && "room_number" in sec ? (sec as { room_number?: string }).room_number : "";
    return String(rn ?? "").trim() || "—";
  }, [sections, filterSectionId]);

  const { data: routineData, slots: apiSlots, loading, error, refetch } = useClassSchedules({
    academicYearId: academicYearId ?? null,
    classId: filterClassId ? Number(filterClassId) : null,
    sectionId: filterSectionId ? Number(filterSectionId) : 0,
    skip: !selectionReady,
  });

  useEffect(() => {
    if (selectionReady) {
      apiService
        .getSubjectTeacherAssignments({ classId: filterClassId, academicYearId })
        .then((res: any) => {
          if (res.status === "SUCCESS") {
            setSubjectTeacherAssignments(res.data || []);
          }
        })
        .catch(() => { });
    }
  }, [filterClassId, academicYearId, selectionReady]);

  const classOptions: Opt[] = useMemo(
    () => [{ value: "", label: "Select" }, ...classes.map((c: any) => ({ value: String(c.id), label: formatClassLabel(c) }))],
    [classes]
  );
  const sectionOptions = options(sections, "id", "section_name");
  const copySectionOptions = options(copySections, "id", "section_name");

  const subjectOptions: Opt[] = useMemo(() => {
    const classIdNum = Number(filterClassId);
    const rows = Array.isArray(subjects) ? subjects : [];
    const seen = new Set<string>();
    const filtered = rows.filter((s: Record<string, unknown>) => {
      const mode = String(s.subject_mode ?? "").trim();
      const masterId = String(s.subject_id ?? s.master_subject_id ?? s.id ?? "");
      const dedupKey = `${masterId}-${mode}`;

      if (!masterId || seen.has(dedupKey)) return false;
      const sClass = Number(s.class_id);
      if (!Number.isFinite(classIdNum) || classIdNum <= 0) return false;
      if (!Number.isFinite(sClass) || sClass !== classIdNum) return false;
      seen.add(dedupKey);
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

  const teacherOptions: Opt[] = useMemo(() => [
    { value: "", label: "Select" },
    ...teachers.map((t: any) => {
      const sid = t.staff_id != null ? String(t.staff_id) : String(t.id);
      const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || sid;
      return { value: sid, label: name };
    }),
  ], [teachers]);

  const subjectAliasMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    (Array.isArray(subjects) ? subjects : []).forEach((s: any) => {
      const classSubjectId = String(s?.id ?? "").trim();
      const masterSubjectId = String(s?.subject_id ?? s?.master_subject_id ?? "").trim();
      if (!classSubjectId || !masterSubjectId) return;
      if (!map[masterSubjectId]) map[masterSubjectId] = [];
      if (!map[masterSubjectId].includes(classSubjectId)) {
        map[masterSubjectId].push(classSubjectId);
      }
    });
    return map;
  }, [subjects]);

  const subjectToTeachersMap = useMemo(() => {
    const validTeacherIds = new Set(teacherOptions.map((opt) => String(opt.value)));
    const map: Record<string, string[]> = {};
    const pushTeacher = (subjectKey: string, teacherKey: string) => {
      if (!subjectKey || !teacherKey) return;
      if (!map[subjectKey]) map[subjectKey] = [];
      if (!map[subjectKey].includes(teacherKey)) map[subjectKey].push(teacherKey);
    };

    subjectTeacherAssignments.forEach((a) => {
      const tid = String(a.teacherId || a.teacher_id || a.staff_id || "");
      if (!tid || !validTeacherIds.has(tid)) return;

      const classSubjectKey = String(a.classSubjectId || a.class_subject_id || "").trim();
      if (classSubjectKey) pushTeacher(classSubjectKey, tid);

      const masterSubjectKey = String(a.subjectId || a.subject_id || "").trim();
      if (masterSubjectKey) {
        (subjectAliasMap[masterSubjectKey] || []).forEach((classSubjectId) => {
          pushTeacher(classSubjectId, tid);
        });
      }
    });
    return map;
  }, [subjectTeacherAssignments, teacherOptions, subjectAliasMap]);

  const subjectTeacherMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(subjectToTeachersMap).forEach(([sid, tids]) => {
      if (tids.length > 0) map[sid] = tids[0];
    });
    return map;
  }, [subjectToTeachersMap]);

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

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      updateScrollButtons();
    });
    observer.observe(el);

    const tableEl = el.querySelector("table");
    if (tableEl) {
      observer.observe(tableEl);
    }

    updateScrollButtons();

    return () => {
      observer.disconnect();
    };
  }, [updateScrollButtons, periodColumns, selectionReady, loading]);


  const exportPeriodColumns = useMemo(
    () => buildPeriodColumnsFromSlots(apiSlots as Record<string, unknown>[], routineData || []),
    [apiSlots, routineData]
  );

  const selectedClassName = useMemo(() => {
    const c = classes.find((x: { id?: unknown }) => String(x.id) === String(filterClassId));
    return c ? formatClassLabel(c as Record<string, unknown>) : String(filterClassId || "");
  }, [classes, filterClassId]);

  const selectedSectionName = useMemo(() => {
    const s = sections.find((x: { id?: unknown }) => String(x.id) === String(filterSectionId));
    return s ? String((s as { section_name?: string }).section_name ?? filterSectionId) : String(filterSectionId || "");
  }, [sections, filterSectionId]);

  const exportGridHeaders = useMemo(
    () => [
      "Day",
      ...exportPeriodColumns.map((c) => (c.isBreak ? c.label : `${c.label}\n${c.start} – ${c.end}`)),
    ],
    [exportPeriodColumns]
  );

  const exportGridBody = useMemo(() => {
    if (!selectionReady || !exportPeriodColumns.length) return [] as string[][];
    return ROUTINE_WEEK_DAYS.map(({ label: dayLabel }) => [
      dayLabel,
      ...exportPeriodColumns.map((col) =>
        formatSectionExportCell(col, findCellForSlot(routineData, dayLabel, col.id), sectionRoomLabel)
      ),
    ]);
  }, [selectionReady, exportPeriodColumns, routineData, sectionRoomLabel]);

  const exportTitle = useMemo(
    () => `Class timetable — ${selectedClassName}${selectedSectionName ? ` / ${selectedSectionName}` : ""}`,
    [selectedClassName, selectedSectionName]
  );

  const hasGridExport = exportGridBody.length > 0;

  const notifyExportBlocked = useCallback((message: string) => {
    void Swal.fire({ icon: "info", title: "Export unavailable", text: message, confirmButtonText: "OK" });
  }, []);

  const handleExportExcel = useCallback(() => {
    if (!selectionReady) {
      notifyExportBlocked("Select class and section first.");
      return;
    }
    if (!hasGridExport) {
      notifyExportBlocked("Load the timetable grid before exporting.");
      return;
    }
    exportTimetableGridToExcel(exportGridHeaders, exportGridBody, "class-timetable", "Class timetable");
  }, [selectionReady, hasGridExport, exportGridHeaders, exportGridBody, notifyExportBlocked]);

  const handleExportPdf = useCallback(() => {
    if (!selectionReady) {
      notifyExportBlocked("Select class and section first.");
      return;
    }
    if (!hasGridExport) {
      notifyExportBlocked("Load the timetable grid before exporting.");
      return;
    }
    exportTimetableGridToPDF(exportTitle, exportGridHeaders, exportGridBody, "class-timetable", {
      showHead: "firstPage",
    });
  }, [selectionReady, hasGridExport, exportTitle, exportGridHeaders, exportGridBody, notifyExportBlocked]);

  const handlePrint = useCallback(() => {
    if (!selectionReady) {
      notifyExportBlocked("Select class and section first.");
      return;
    }
    if (!hasGridExport) {
      notifyExportBlocked("Load the timetable grid before printing.");
      return;
    }
    printTimetableGrid(exportTitle, exportGridHeaders, exportGridBody);
  }, [selectionReady, hasGridExport, exportTitle, exportGridHeaders, exportGridBody, notifyExportBlocked]);

  const [cellDrafts, setCellDrafts] = useState<Record<string, CellDraft[]>>({});
  const [initialCellDrafts, setInitialCellDrafts] = useState<Record<string, CellDraft[]>>({});
  const [savingByKey, setSavingByKey] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const makeCellKey = useCallback((dayNum: number, slotId: number) => `${dayNum}-${slotId}`, []);

  useEffect(() => {
    if (!selectionReady || loading || periodColumns.length === 0) {
      setCellDrafts({});
      setInitialCellDrafts({});
      return;
    }
    const next: Record<string, CellDraft[]> = {};
    WEEK_DAYS.forEach(({ label, dow }) => {
      periodColumns.forEach((col) => {
        if (col.isBreak) return;
        const entries = findAllCellsForSlot(routineData, label, col.id);
        const key = makeCellKey(dow, col.id);

        if (entries.length === 0) {
          next[key] = [{
            existingId: null,
            dayLabel: label,
            dayNum: dow,
            slotId: col.id,
            slotLabel: col.label,
            subjectId: "",
            teacherId: "",
            roomId: "",
            dirty: false,
          }];
        } else {
          next[key] = entries.map((entry) => {
            const od = entry.originalData || {};
            const existingId = od.id != null && Number.isFinite(Number(od.id)) ? Number(od.id) : null;
            return {
              existingId,
              dayLabel: label,
              dayNum: dow,
              slotId: col.id,
              slotLabel: col.label,
              subjectId: String(od.class_subject_id || od.subject_id || ""),
              teacherId: String(od.teacher_id || od.staff_id || ""),
              roomId: String(od.class_room_id || od.room_id || ""),
              dirty: false,
            };
          });
        }
      });
    });
    setCellDrafts(next);
    setInitialCellDrafts(next);
  }, [selectionReady, loading, periodColumns, routineData, makeCellKey]);

  // Modal Editing State Hooks
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editingCellLabel, setEditingCellLabel] = useState<string>("");
  const [editingCellSlotLabel, setEditingCellSlotLabel] = useState<string>("");
  const [modalDrafts, setModalDrafts] = useState<CellDraft[]>([]);
  const [modalError, setModalError] = useState<string>("");

  const validateElectiveGroupConflict = useCallback((draftsList: CellDraft[]): { valid: boolean; reason: string } => {
    if (draftsList.length <= 1) return { valid: true, reason: "" };

    const cardSubjects = draftsList.map((d) => {
      const subId = Number(d.subjectId);
      if (!subId) return null;
      return (subjects as any[]).find((s: any) => Number(s.id) === subId);
    }).filter((s): s is any => s != null);

    if (cardSubjects.length <= 1) return { valid: true, reason: "" };

    const hasCompulsory = cardSubjects.some((s) => !s.is_elective || !s.elective_group_id);
    if (hasCompulsory) {
      return {
        valid: false,
        reason: "Compulsory subjects cannot be scheduled parallely with other subjects.",
      };
    }

    const firstGroupId = cardSubjects[0].elective_group_id;
    const groupMismatch = cardSubjects.some((s) => s.elective_group_id !== firstGroupId);
    if (groupMismatch) {
      return {
        valid: false,
        reason: "Parallel optional subjects must belong to the exact same elective group.",
      };
    }

    return { valid: true, reason: "" };
  }, [subjects]);

  const openEditModal = useCallback((key: string, dayLabel: string, slotLabel: string) => {
    setEditingCellKey(key);
    setEditingCellLabel(dayLabel);
    setEditingCellSlotLabel(slotLabel);
    setModalError("");

    const current = cellDrafts[key] || [];
    setModalDrafts(JSON.parse(JSON.stringify(current)));

    const el = document.getElementById("edit_slot_modal");
    if (el) {
      const inst = (window as any).bootstrap?.Modal?.getOrCreateInstance(el);
      inst?.show();
    }
  }, [cellDrafts]);

  const updateModalDraft = useCallback((index: number, patch: Partial<CellDraft>) => {
    setModalDrafts((prev) => {
      const nextList = [...prev];
      const current = nextList[index];
      if (!current) return prev;
      nextList[index] = { ...current, ...patch, isOpenedByUser: true };

      // Live elective group validation inside modal
      const cardSubjects = nextList.map((d) => {
        const subId = Number(d.subjectId);
        if (!subId) return null;
        return (subjects as any[]).find((s: any) => Number(s.id) === subId);
      }).filter((s): s is any => s != null);

      if (cardSubjects.length > 1) {
        const hasCompulsory = cardSubjects.some((s) => !s.is_elective || !s.elective_group_id);
        if (hasCompulsory) {
          setModalError("Compulsory subjects cannot be scheduled parallely with other subjects.");
        } else {
          const firstGroupId = cardSubjects[0].elective_group_id;
          const groupMismatch = cardSubjects.some((s) => s.elective_group_id !== firstGroupId);
          if (groupMismatch) {
            setModalError("Parallel optional subjects must belong to the exact same elective group.");
          } else {
            setModalError("");
          }
        }
      } else {
        setModalError("");
      }

      return nextList;
    });
  }, [subjects]);

  const addModalParallelRow = useCallback(() => {
    setModalDrafts((prev) => {
      const current = prev[0];
      if (current && current.subjectId) {
        const sub = (subjects as any[]).find((s: any) => Number(s.id) === Number(current.subjectId));
        if (sub && (!sub.is_elective || !sub.elective_group_id)) {
          void Swal.fire({
            icon: "warning",
            title: "Cannot schedule parallel",
            text: "Parallel subjects can only be added for optional/elective subjects of the same group. The current subject is compulsory.",
          });
          return prev;
        }
      }

      if (modalError) return prev;

      const newRow: CellDraft = {
        existingId: null,
        dayLabel: editingCellLabel,
        dayNum: current?.dayNum ?? 0,
        slotId: current?.slotId ?? 0,
        slotLabel: editingCellSlotLabel,
        subjectId: "",
        teacherId: "",
        roomId: "",
        dirty: true,
        isOpenedByUser: true,
      };
      return [...prev, newRow];
    });
  }, [subjects, editingCellLabel, editingCellSlotLabel, modalError]);

  const removeModalRow = useCallback(async (index: number) => {
    const target = modalDrafts[index];
    if (!target) return;

    if (target.existingId) {
      const confirm = await Swal.fire({
        title: "Remove entry?",
        text: "This entry is already saved. Remove it permanently from the database?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete",
        confirmButtonColor: "#dc3545",
      });
      if (!confirm.isConfirmed) return;

      try {
        await apiService.deleteClassSchedule(target.existingId);
        await refetch();
        void Swal.fire({ icon: "success", title: "Removed from database", timer: 1500, showConfirmButton: false });
      } catch (e) {
        void Swal.fire({ icon: "error", title: "Delete failed", text: httpErrorMessage(e, "Could not delete.") });
        return;
      }
    }

    setModalDrafts((prev) => {
      const nextList = [...prev];
      nextList.splice(index, 1);
      if (nextList.length === 0) {
        nextList.push({
          existingId: null,
          dayLabel: editingCellLabel,
          dayNum: target?.dayNum ?? 0,
          slotId: target?.slotId ?? 0,
          slotLabel: editingCellSlotLabel,
          subjectId: "",
          teacherId: "",
          roomId: "",
          dirty: false,
          isOpenedByUser: false,
        });
      }
      return nextList;
    });
    setModalError("");
  }, [editingCellLabel, editingCellSlotLabel, modalDrafts, refetch]);

  const applyModalChanges = useCallback(() => {
    if (modalError) {
      void Swal.fire({
        icon: "warning",
        title: "Group Conflict",
        text: modalError,
      });
      return;
    }

    const incomplete = modalDrafts.some((d) => (d.subjectId || d.teacherId) && (!d.subjectId || !d.teacherId));
    if (incomplete) {
      void Swal.fire({
        icon: "warning",
        title: "Incomplete Card",
        text: "Please select both a subject and a teacher for all scheduled classes.",
      });
      return;
    }

    if (!editingCellKey) return;

    setCellDrafts((prev) => {
      const baseList = initialCellDrafts[editingCellKey] || [];
      const updatedList = modalDrafts.map((d, index) => {
        const base = baseList[index];
        if (!d.existingId && !d.subjectId && !d.teacherId && !d.roomId) {
          return { ...d, dirty: false };
        }
        const dirty = !base || (d.subjectId !== base.subjectId || d.teacherId !== base.teacherId || d.roomId !== base.roomId);
        return { ...d, dirty };
      });

      return { ...prev, [editingCellKey]: updatedList };
    });

    const el = document.getElementById("edit_slot_modal");
    if (el) {
      const inst = (window as any).bootstrap?.Modal?.getInstance(el);
      inst?.hide();
    }
  }, [editingCellKey, modalDrafts, modalError, initialCellDrafts]);

  const handleResetRoutine = async () => {
    if (!selectionReady) return;
    const confirm = await Swal.fire({
      title: "Reset Timetable?",
      text: "This will permanently delete ALL entries for this class and section routine.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, reset all",
      confirmButtonColor: "#dc3545",
    });
    if (!confirm.isConfirmed) return;

    setBulkSaving(true);
    try {
      await apiService.resetClassSchedule({
        class_id: Number(filterClassId),
        section_id: Number(filterSectionId),
        academic_year_id: academicYearId,
      });
      await refetch();
      void Swal.fire({ icon: "success", title: "Timetable reset", timer: 1600, showConfirmButton: false });
    } catch (e) {
      void Swal.fire({ icon: "error", title: "Reset failed", text: httpErrorMessage(e, "Failed to reset.") });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleCopyRoutine = async () => {
    if (!copySourceClassId || !academicYearId) return;
    setBulkSaving(true);
    try {
      const res = await apiService.copyClassSchedule({
        source_class_id: Number(copySourceClassId),
        source_section_id: copySourceSectionId ? Number(copySourceSectionId) : null,
        target_class_id: Number(filterClassId),
        target_section_id: Number(filterSectionId),
        academic_year_id: academicYearId,
      });

      const el = document.getElementById("copy_routine_modal");
      if (el) {
        const inst = (window as any).bootstrap?.Modal?.getInstance(el);
        inst?.hide();
      }

      await refetch();
      void Swal.fire({
        icon: "success",
        title: "Copy completed",
        text: `Copied ${res.data?.copiedCount || 0} entries. Skipped ${res.data?.skipCount || 0} due to conflicts.`,
      });
    } catch (e) {
      void Swal.fire({ icon: "error", title: "Copy failed", text: httpErrorMessage(e, "Failed to copy routine.") });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkSave = useCallback(async () => {
    const assignments: any[] = [];
    try {
      Object.keys(cellDrafts).forEach((key) => {
        const list = cellDrafts[key] || [];

        const { valid, reason } = validateElectiveGroupConflict(list);
        if (!valid) {
          void Swal.fire({
            icon: "warning",
            title: "Group Conflict",
            text: `Conflict in ${list[0]?.dayLabel} (${list[0]?.slotLabel}): ${reason}`,
          });
          throw new Error("VALIDATION_FAILED");
        }

        list.forEach((d) => {
          if (d.dirty) {
            if (d.subjectId || d.teacherId) {
              if (!d.subjectId) {
                void Swal.fire({
                  icon: "warning",
                  title: "Incomplete assignment",
                  text: `Please select a subject for ${d.dayLabel} (${d.slotLabel}).`,
                });
                throw new Error("VALIDATION_FAILED");
              }
              if (!d.teacherId) {
                void Swal.fire({
                  icon: "warning",
                  title: "Incomplete assignment",
                  text: `Please select a teacher for ${d.dayLabel} (${d.slotLabel}).`,
                });
                throw new Error("VALIDATION_FAILED");
              }
              assignments.push({
                id: d.existingId,
                subject_id: Number(d.subjectId),
                teacher_id: Number(d.teacherId),
                room_id: d.roomId ? Number(d.roomId) : null,
                day_of_week: d.dayNum,
                time_slot_id: d.slotId,
              });
            }
          }
        });
      });
    } catch (e: any) {
      if (e.message === "VALIDATION_FAILED") return;
      throw e;
    }

    if (assignments.length === 0) return;

    setBulkSaving(true);
    try {
      const res = await apiService.bulkUpdateClassSchedules({
        academic_year_id: academicYearId,
        class_id: Number(filterClassId),
        section_id: filterSectionId ? Number(filterSectionId) : null,
        room_id: null,
        assignments,
      });

      if (res.success === false) {
        void Swal.fire({
          icon: "warning",
          title: "Scheduling Conflict",
          text: res.message || "A conflict was detected in your routine.",
        });
        return;
      }

      await refetch();
      void Swal.fire({
        icon: "success",
        title: "Saved successfully",
        text: `Updated ${assignments.length} timetable entries.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (e: any) {
      void Swal.fire({
        icon: "error",
        title: "Save failed",
        text: httpErrorMessage(e, "Could not save timetable."),
      });
    } finally {
      setBulkSaving(false);
    }
  }, [cellDrafts, academicYearId, filterClassId, filterSectionId, refetch, validateElectiveGroupConflict]);

  const pendingKeys = useMemo(
    () => Object.keys(cellDrafts).filter((key) => cellDrafts[key]?.some((draft) => draft.dirty)),
    [cellDrafts]
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
              <button
                className="btn btn-outline-primary d-flex align-items-center"
                data-bs-toggle="modal"
                data-bs-target="#copy_routine_modal"
                disabled={!selectionReady || loading}
              >
                <i className="ti ti-copy me-2" />
                Copy Routine
              </button>
              <button
                className="btn btn-outline-danger d-flex align-items-center"
                onClick={handleResetRoutine}
                disabled={!selectionReady || loading || bulkSaving}
              >
                <i className="ti ti-refresh me-2" />
                Reset Routine
              </button>
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
                {filterClassId && !sectionsLoading && sections.length === 0 && (
                  <div className="col-12 mt-0">
                    <div className="alert alert-soft-info py-2 fs-12 mb-0 border-info-subtle">
                      <i className="ti ti-info-circle me-1"></i>
                      No sections defined for this class. Scheduling for the <strong>Entire Class</strong>.
                    </div>
                  </div>
                )}
                <div className="col-md-12 col-lg-4 d-flex align-items-end justify-content-lg-end">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleBulkSave()}
                    disabled={!selectionReady || loading || bulkSaving || pendingKeys.length === 0}
                  >
                    {bulkSaving ? "Saving..." : "Save Assignments"}
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
                <>
                  <style dangerouslySetInnerHTML={{ __html: `
                    .custom-timetable-container {
                      cursor: grab;
                    }
                    .custom-timetable-container.dragging {
                      cursor: grabbing;
                      user-select: none;
                    }
                    .custom-timetable-container::-webkit-scrollbar {
                      height: 8px;
                      width: 8px;
                    }
                    .custom-timetable-container::-webkit-scrollbar-track {
                      background: #f8f9fa;
                      border-radius: 4px;
                    }
                    .custom-timetable-container::-webkit-scrollbar-thumb {
                      background: #ced4da;
                      border-radius: 4px;
                    }
                    .custom-timetable-container::-webkit-scrollbar-thumb:hover {
                      background: #6c757d;
                    }
                    .timetable-scroll-wrapper {
                      position: relative;
                    }
                  ` }} />
                  <div className="timetable-scroll-wrapper">
                    <div className="d-flex justify-content-between align-items-center mb-2 px-1">
                      <div className="text-muted small d-flex align-items-center">
                        <i className="ti ti-info-circle me-1 text-primary"></i>
                        <span>Drag grid horizontally or use the navigation buttons</span>
                      </div>
                      <div className="d-flex gap-2">
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-primary py-1 px-2 d-flex align-items-center"
                          onClick={() => scrollTimetable("left")}
                          disabled={!showLeftScroll}
                          style={{ opacity: showLeftScroll ? 1 : 0.4 }}
                        >
                          <i className="ti ti-chevron-left me-1"></i> Left
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-primary py-1 px-2 d-flex align-items-center"
                          onClick={() => scrollTimetable("right")}
                          disabled={!showRightScroll}
                          style={{ opacity: showRightScroll ? 1 : 0.4 }}
                        >
                          Right <i className="ti ti-chevron-right ms-1"></i>
                        </button>
                      </div>
                    </div>
                    <div 
                      ref={scrollContainerRef}
                      onScroll={updateScrollButtons}
                      onMouseDown={handleMouseDown}
                      className={`table-responsive custom-timetable-container mb-0 ${isDragging ? "dragging" : ""}`}
                      style={{ 
                        maxHeight: "65vh", 
                        overflow: "auto", 
                        border: "1px solid #e9ecef", 
                        borderRadius: "6px" 
                      }}
                    >
                      <table className="table table-bordered table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th 
                              style={{ 
                                minWidth: 96, 
                                position: "sticky", 
                                top: 0,
                                left: 0, 
                                zIndex: 4, 
                                backgroundColor: "#f8f9fa", 
                                boxShadow: "2px 2px 5px rgba(0, 0, 0, 0.08)" 
                              }}
                            >
                              Day
                            </th>
                            {periodColumns.map((col) => (
                              <th 
                                key={col.id} 
                                className={col.isBreak ? "text-muted" : ""} 
                                style={{ 
                                  minWidth: col.isBreak ? 80 : 170,
                                  position: "sticky",
                                  top: 0,
                                  zIndex: 1,
                                  backgroundColor: "#f8f9fa"
                                }}
                              >
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
                              <th 
                                className="table-light"
                                style={{ 
                                  position: "sticky", 
                                  left: 0, 
                                  zIndex: 2, 
                                  backgroundColor: "#f8f9fa", 
                                  boxShadow: "2px 0 5px rgba(0, 0, 0, 0.08)" 
                                }}
                              >
                                {label}
                              </th>
                              {periodColumns.map((col) => {
                                const key = makeCellKey(dow, col.id);
                                const drafts = cellDrafts[key] || [];
                                return (
                                  <TimetableCell
                                    key={`${label}-${col.id}`}
                                    dayLabel={label}
                                    dayNum={dow}
                                    slot={col}
                                    drafts={drafts}
                                    subjectOptions={subjectOptions}
                                    teacherOptions={teacherOptions}
                                    roomOptions={roomOptions}
                                    onEditClick={() => openEditModal(key, label, col.label)}
                                  />
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}

              {!selectionReady && academicYearId ? (
                <div className="alert alert-light border">Select <strong>class</strong> and <strong>section</strong> to edit the weekly timetable.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Slot Modal */}
      <div className="modal fade" id="edit_slot_modal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static" style={{ overflow: "visible" }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" style={{ overflow: "visible" }}>
          <div className="modal-content border-0 shadow-lg" style={{ overflow: "visible" }}>
            <div className="modal-header bg-primary text-white py-3">
              <h5 className="modal-title text-white fw-bold d-flex align-items-center">
                <i className="ti ti-calendar-event me-2 fs-4"></i>
                Schedule Slot: {editingCellLabel} – {editingCellSlotLabel}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body p-4 bg-light-subtle" style={{ overflow: "visible" }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="text-secondary small fw-semibold">
                  Configure classes or parallel elective subjects running in this slot.
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-flex align-items-center"
                  onClick={addModalParallelRow}
                >
                  <i className="ti ti-plus me-1"></i>Parallel Elective
                </button>
              </div>

              {modalError ? (
                <div className="alert alert-soft-danger py-2 px-3 border border-danger-subtle rounded mb-3 d-flex align-items-center fs-13">
                  <i className="ti ti-alert-triangle text-danger me-2 fs-5"></i>
                  <div><strong>Conflict: </strong>{modalError}</div>
                </div>
              ) : null}

              <div className="d-flex flex-column gap-3" style={{ overflow: "visible" }}>
                {modalDrafts.map((d, index) => {
                  const subjectId = d.subjectId;
                  const allowed = subjectToTeachersMap[subjectId] || [];
                  const filteredTeacherOptions = teacherOptions.filter((opt) => !opt.value || allowed.includes(opt.value));

                  const handleSubjectSelect = (v: string | null) => {
                    const nextSubId = v || "";
                    updateModalDraft(index, { subjectId: nextSubId });
                    if (nextSubId) {
                      const mappedTeacherId = subjectTeacherMap[nextSubId];
                      if (mappedTeacherId) {
                        updateModalDraft(index, { teacherId: mappedTeacherId });
                      }
                    }
                  };

                  return (
                    <div
                      key={index}
                      className="card border shadow-sm mb-0"
                      style={{ borderLeft: "4px solid #0d6efd", overflow: "visible" }}
                    >
                      <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
                        <span className="fw-semibold text-secondary small">
                          Subject #{index + 1}
                        </span>
                        {(modalDrafts.length > 1 || d.existingId || d.isOpenedByUser) && (
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0 m-0 text-decoration-none fs-12 d-flex align-items-center"
                            onClick={() => removeModalRow(index)}
                          >
                            <i className="ti ti-trash me-1"></i>Delete Card
                          </button>
                        )}
                      </div>
                      <div className="card-body p-3" style={{ overflow: "visible" }}>
                        <div className="row g-2">
                          <div className="col-md-4">
                            <label className="form-label small fw-semibold text-muted mb-1">Subject</label>
                            <CommonSelect
                              options={subjectOptions}
                              value={d.subjectId || null}
                              placeholder="Select subject"
                              onChange={handleSubjectSelect}
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small fw-semibold text-muted mb-1">Teacher</label>
                            <CommonSelect
                              options={filteredTeacherOptions}
                              value={d.teacherId || null}
                              placeholder="Select teacher"
                              onChange={(v) => updateModalDraft(index, { teacherId: v || "" })}
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small fw-semibold text-muted mb-1">Room</label>
                            <CommonSelect
                              options={roomOptions}
                              value={d.roomId || null}
                              placeholder="Select classroom"
                              onChange={(v) => updateModalDraft(index, { roomId: v || "" })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer bg-light p-3">
              <button
                type="button"
                className="btn btn-light border"
                data-bs-dismiss="modal"
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={applyModalChanges}
              >
                Apply to Timetable
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Routine Modal */}
      <div className="modal fade" id="copy_routine_modal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Copy Routine From</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="small text-muted mb-3">Pick a source class and section to clone its timetable into the current view. Existing entries in the target will NOT be deleted, but conflicts will be skipped.</p>
              <div className="mb-3">
                <label className="form-label">Source Class</label>
                <CommonSelect
                  options={classOptions}
                  value={copySourceClassId || null}
                  placeholder="Select source class"
                  onChange={(v) => {
                    setCopySourceClassId(v || "");
                    setCopySourceSectionId("");
                  }}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Source Section (Optional)</label>
                <CommonSelect
                  options={copySectionOptions}
                  value={copySourceSectionId || null}
                  placeholder={copySourceClassId ? "Select source section" : "Select class first"}
                  onChange={(v) => setCopySourceSectionId(v || "")}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyRoutine}
                disabled={!copySourceClassId || bulkSaving}
              >
                {bulkSaving ? "Copying..." : "Start Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassTimetable;
