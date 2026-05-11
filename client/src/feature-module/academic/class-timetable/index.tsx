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
  subjectToTeachersMap: Record<string, string[]>;
  subjectTeacherMap: Record<string, string>;
  sectionRoomLabel: string;
  onSubjectChange: (value: string | null) => void;
  onTeacherChange: (value: string | null) => void;
  onSave: () => void;
  onDelete: () => void;
  canDelete: boolean;
  roomId: string;
  roomOptions: Opt[];
  onRoomChange: (value: string | null) => void;
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
  subjectToTeachersMap,
  subjectTeacherMap,
  sectionRoomLabel,
  onSubjectChange,
  onTeacherChange,
  onSave,
  onDelete,
  canDelete,
  roomId,
  roomOptions,
  onRoomChange,
}: CellProps) {
  const filteredTeacherOptions = useMemo(() => {
    if (!subjectId) return teacherOptions;
    const allowed = subjectToTeachersMap[subjectId] || [];
    // Fallback to full list when assignment map is unavailable/misaligned.
    if (allowed.length === 0) return teacherOptions;
    return teacherOptions.filter((opt) => !opt.value || allowed.includes(opt.value));
  }, [subjectId, teacherOptions, subjectToTeachersMap]);

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
          options={filteredTeacherOptions}
          value={teacherId || null}
          placeholder="Teacher"
          onChange={(v) => onTeacherChange(v || "")}
        />
      </div>
      <div className="mb-1">
        <CommonSelect
          className="select select-sm"
          options={roomOptions}
          value={roomId || null}
          placeholder="Room"
          onChange={(v) => onRoomChange(v || "")}
        />
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
  roomId: string;
  dirty: boolean;
};

const ClassTimetable = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");

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
      // Dedup by actual subject and mode, not just mapping ID
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

  const teacherOptions: Opt[] = [
    { value: "", label: "Select" },
    ...teachers.map((t: any) => {
      const sid = t.staff_id != null ? String(t.staff_id) : String(t.id);
      const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || sid;
      return { value: sid, label: name };
    }),
  ];

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

      // Preferred key: class_subject_id (matches subject dropdown value).
      const classSubjectKey = String(a.classSubjectId || a.class_subject_id || "").trim();
      if (classSubjectKey) pushTeacher(classSubjectKey, tid);

      // Compatibility key: subject_id (master subject) -> one or more class_subject ids.
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
          subjectId: String(od.class_subject_id || od.subject_id || ""),
          teacherId: String(od.teacher_id || od.staff_id || ""),
          roomId: String(od.class_room_id || od.room_id || ""),
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
        const dirty = !!base && (next.subjectId !== base.subjectId || next.teacherId !== base.teacherId || next.roomId !== base.roomId);
        return { ...prev, [key]: { ...next, dirty } };
      });
    },
    [initialCellDrafts]
  );

  const handleBulkSave = useCallback(async () => {
    const dirtyKeys = Object.keys(cellDrafts).filter((key) => cellDrafts[key]?.dirty);
    if (!dirtyKeys.length) return;

    for (const key of dirtyKeys) {
      const d = cellDrafts[key];
      if (!d.subjectId) {
        void Swal.fire({
          icon: "warning",
          title: "Incomplete assignment",
          text: `Please select a subject for ${d.dayLabel} (${d.slotLabel}).`,
        });
        return;
      }
      if (!d.teacherId) {
        void Swal.fire({
          icon: "warning",
          title: "Incomplete assignment",
          text: `Please select a teacher for ${d.dayLabel} (${d.slotLabel}).`,
        });
        return;
      }
    }

    setBulkSaving(true);
    try {
      const assignments = dirtyKeys.map((key) => {
        const d = cellDrafts[key];
        return {
          id: d.existingId,
          subject_id: d.subjectId ? Number(d.subjectId) : null,
          teacher_id: Number(d.teacherId),
          room_id: d.roomId ? Number(d.roomId) : null,
          day_of_week: d.dayNum,
          time_slot_id: d.slotId,
        };
      });

      const res = await apiService.bulkUpdateClassSchedules({
        academic_year_id: academicYearId,
        class_id: Number(filterClassId),
        section_id: filterSectionId ? Number(filterSectionId) : null,
        room_id: null, // Global room override not used when selecting per period
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
  }, [cellDrafts, academicYearId, filterClassId, filterSectionId, refetch]);

  const handleSingleSave = useCallback(
    async (key: string) => {
      const draft = cellDrafts[key];
      if (!draft) return;
      if (!draft.subjectId) {
        void Swal.fire({ icon: "warning", title: "Subject required", text: "Select a subject before saving." });
        return;
      }
      if (!draft.teacherId) {
        void Swal.fire({ icon: "warning", title: "Teacher required", text: "Select a teacher before saving." });
        return;
      }
      setSavingByKey((prev) => ({ ...prev, [key]: true }));
      try {
        const payload = {
          class_id: Number(filterClassId),
          section_id: filterSectionId ? Number(filterSectionId) : null,
          subject_id: Number(draft.subjectId),
          teacher_id: Number(draft.teacherId),
          room_id: draft.roomId ? Number(draft.roomId) : null,
          day_of_week: draft.dayNum,
          time_slot_id: draft.slotId,
          academic_year_id: academicYearId,
        };
        let res;
        if (draft.existingId) {
          res = await apiService.updateClassSchedule(draft.existingId, payload);
        } else {
          res = await apiService.createClassSchedule(payload);
        }

        if (res && res.success === false) {
          void Swal.fire({
            icon: "warning",
            title: "Conflict",
            text: res.message || "This slot is already occupied.",
          });
          return;
        }

        await refetch();
      } catch (e: any) {
        void Swal.fire({
          icon: "error",
          title: "Save failed",
          text: httpErrorMessage(e, "Could not save timetable."),
        });
      } finally {
        setSavingByKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [cellDrafts, filterClassId, filterSectionId, academicYearId, refetch]
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
        void Swal.fire({ icon: "error", title: "Delete failed", text: httpErrorMessage(e, "Could not delete.") });
      } finally {
        setSavingByKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [cellDrafts, refetch]
  );

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

      // Close modal manually via Bootstrap
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

  const pendingKeys = useMemo(
    () => Object.keys(cellDrafts).filter((key) => cellDrafts[key]?.dirty),
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
                                roomId={draft?.roomId ?? ""}
                                roomOptions={roomOptions}
                                subjectToTeachersMap={subjectToTeachersMap}
                                subjectTeacherMap={subjectTeacherMap}
                                sectionRoomLabel={sectionRoomLabel}
                                onSubjectChange={(v) => updateCellDraft(key, { subjectId: v || "" })}
                                onTeacherChange={(v) => updateCellDraft(key, { teacherId: v || "" })}
                                onRoomChange={(v) => updateCellDraft(key, { roomId: v || "" })}
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





