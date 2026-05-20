import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import type { ReactElement } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import { useClassSchedules } from "../../../../core/hooks/useClassSchedules";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { isTeacherRole } from "../../../../core/utils/roleUtils";
import {
  WEEK_DAYS,
  buildPeriodColumnsFromSlots,
  findCellForSlot,
} from "../../../academic/utils/sectionRoutineGrid";

interface PeriodCol {
  id: number;
  label: string;
  start: string;
  end: string;
  isBreak: boolean;
}

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function parsePositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = String(timeStr).trim();
  const match12 = clean.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = clean.match(/^(\d+):(\d+)$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  return 0;
}

function StudentRoutineGridCell({
  slot,
  entry,
}: {
  slot: PeriodCol;
  entry: any | undefined;
}): ReactElement {
  if (slot.isBreak) {
    return (
      <td className="bg-light align-middle text-center py-3" style={{ minWidth: 140, border: "1px solid #f1f1f4" }}>
        <span className="badge bg-soft-secondary text-uppercase fw-semibold" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>
          Break
        </span>
      </td>
    );
  }

  if (entry) {
    const isPractical = String(entry.subjectType || "").toLowerCase() === "practical";
    
    // Dynamic color coding based on subject name hash
    const colors = [
      { bg: "rgba(118, 56, 255, 0.06)", border: "#7638ff" }, // Purple
      { bg: "rgba(13, 110, 253, 0.06)", border: "#0d6efd" }, // Blue
      { bg: "rgba(25, 135, 84, 0.06)", border: "#198754" }, // Green
      { bg: "rgba(253, 126, 20, 0.06)", border: "#fd7e14" }, // Orange
      { bg: "rgba(111, 66, 193, 0.06)", border: "#6f42c1" }, // Indigo
      { bg: "rgba(220, 53, 69, 0.06)", border: "#dc3545" }, // Red
      { bg: "rgba(13, 202, 240, 0.06)", border: "#0dcaf0" }  // Cyan
    ];
    
    // Simple hash function to assign stable color per subject
    const subjectName = String(entry.subject || "");
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
      hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    const color = colors[colorIndex];

    const roomLabel = String(entry.classRoom ?? "").trim();
    const resolvedRoom = roomLabel && roomLabel !== "N/A" && roomLabel !== "—" ? `Room ${roomLabel}` : "Room TBA";

    return (
      <td className="align-middle p-2.5" style={{ minWidth: 185, maxWidth: 240, border: "1px solid #f1f1f4" }}>
        <div 
          className="rounded p-3 h-100 d-flex flex-column justify-content-between gap-2 transition-all shadow-sm-hover" 
          style={{ 
            backgroundColor: color.bg, 
            borderLeft: `4px solid ${color.border}`,
            boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
            minHeight: "95px"
          }}
        >
          <div>
            {/* Subject and Type Badge */}
            <div className="d-flex align-items-start justify-content-between gap-2 mb-1.5 flex-wrap">
              <span className="fw-bold text-dark text-break line-clamp-2" style={{ fontSize: "14.5px", lineHeight: "1.25" }}>
                {entry.subject ?? "—"}
              </span>
              <span 
                className={`badge rounded-pill text-uppercase px-2.5 py-1`} 
                style={{ 
                  fontSize: "10px", 
                  fontWeight: 700,
                  backgroundColor: isPractical ? "rgba(25, 135, 84, 0.15)" : "rgba(118, 56, 255, 0.15)",
                  color: isPractical ? "#198754" : "#7638ff",
                  letterSpacing: "0.2px"
                }}
              >
                {entry.subjectType || "Theory"}
              </span>
            </div>
            
            {/* Teacher Details */}
            <div className="text-muted text-truncate" style={{ fontSize: "12px" }} title={entry.teacher || "—"}>
              <i className="ti ti-user me-1 text-secondary" style={{ fontSize: "12px" }} />
              {entry.teacher || "—"}
            </div>
          </div>

          {/* Room details */}
          <div className="d-flex align-items-center justify-content-between mt-1.5 pt-1.5 border-top" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            <span className="text-muted text-truncate" style={{ fontSize: "12px" }}>
              <i className="ti ti-building me-1 text-secondary" style={{ fontSize: "12px" }} />
              {resolvedRoom}
            </span>
          </div>
        </div>
      </td>
    );
  }

  return (
    <td className="align-middle text-center py-4" style={{ minWidth: 120, border: "1px solid #f1f1f4" }}>
      <span className="text-muted opacity-40">—</span>
    </td>
  );
}

const StudentTimeTable = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const user = useSelector(selectUser);
  const isTeacher = isTeacherRole(user);
  const headerAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const { student, loading, parentPlacementForWard, isParentRole } = useLinkedStudentContext({
    locationState: state,
  });
  const effectiveStudentId = parsePositiveId(student?.id);

  /**
   * Parent/guardian portal: same placement rules server-side as GET /students/:id + /parents/me.
   * Timetable must use GET /class-schedules (scoped list) like the student tab — not /timetable/class with
   * sections.id, which returns empty when class_sections cannot be resolved for that year.
   */
  const classIdForSchedule = parsePositiveId(
    isParentRole
      ? parentPlacementForWard?.class_id ??
          student?.class_id ??
          (student as { classId?: unknown })?.classId
      : student?.class_id ??
          (student as { classId?: unknown })?.classId ??
          parentPlacementForWard?.class_id
  );
  const sectionIdForSchedule = parsePositiveId(
    isParentRole
      ? parentPlacementForWard?.section_id ??
          student?.section_id ??
          (student as { sectionId?: unknown })?.sectionId
      : student?.section_id ??
          (student as { sectionId?: unknown })?.sectionId ??
          parentPlacementForWard?.section_id
  );
  const sectionNameForSchedule = normalizeText(
    student?.section_name ??
      (student as { sectionName?: unknown })?.sectionName ??
      parentPlacementForWard?.section_name
  );

  const studentAcademicYearId = parsePositiveId(
    isParentRole
      ? parentPlacementForWard?.academic_year_id ??
          student?.academic_year_id ??
          (student as { academicYearId?: unknown })?.academicYearId
      : student?.academic_year_id ??
          (student as { academicYearId?: unknown })?.academicYearId ??
          parentPlacementForWard?.academic_year_id
  );
  const academicYearForSchedules =
    studentAcademicYearId ?? headerAcademicYearId ?? undefined;

  const { data: scheduleData, slots: apiSlots, loading: scheduleLoading, error: scheduleError } = useClassSchedules({
    academicYearId: academicYearForSchedules,
    classId: classIdForSchedule ?? undefined,
    sectionId: undefined,
    relaxClientFilters: isParentRole,
    skip: !classIdForSchedule,
  });

  const filteredScheduleData = useMemo(() => {
    const list = Array.isArray(scheduleData) ? scheduleData : [];
    if (!classIdForSchedule) return [];
    return list.filter((item: any) => {
      const rowClassId = parsePositiveId(item?.originalData?.class_id);
      if (rowClassId !== classIdForSchedule) return false;
      // Parent/guardian: API is already scoped server-side to this ward's class/section; do not re-filter by
      // section name (labels often differ from /parents/me) or by section id (class_sections.id vs sections.id).
      if (isParentRole) return true;
      if (!sectionIdForSchedule && !sectionNameForSchedule) return true;
      const rowSectionId = parsePositiveId(
        item?.originalData?.section_id ?? item?.originalData?.class_section_id
      );
      const rowSectionName = normalizeText(item?.section);
      return (
        rowSectionId == null ||
        (sectionIdForSchedule != null && rowSectionId === sectionIdForSchedule) ||
        (!!sectionNameForSchedule && rowSectionName === sectionNameForSchedule)
      );
    });
  }, [scheduleData, classIdForSchedule, sectionIdForSchedule, sectionNameForSchedule, isParentRole]);

  const periodColumns = useMemo(() => {
    if (apiSlots && apiSlots.length > 0) {
      return buildPeriodColumnsFromSlots(apiSlots, filteredScheduleData);
    }
    const slotsMap = new Map<string, any>();
    filteredScheduleData.forEach((item: any) => {
      const start = item.startTime;
      const end = item.endTime;
      const slotId = Number(item.originalData?.time_slot_id ?? item.originalData?.time_slot ?? item.originalData?.period_id);
      if (!start || start === "N/A" || !end || end === "N/A" || !slotId) return;

      const key = `${start}-${end}`;
      if (!slotsMap.has(key)) {
        slotsMap.set(key, {
          id: slotId,
          label: "Period",
          start,
          end,
          isBreak: false,
        });
      }
    });

    const deduped = Array.from(slotsMap.values());
    deduped.sort((a, b) => {
      return parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start);
    });

    return deduped.map((col, index) => ({
      ...col,
      label: `Period ${index + 1}`,
    }));
  }, [apiSlots, filteredScheduleData]);

  const totalClasses = useMemo(
    () => filteredScheduleData.length,
    [filteredScheduleData]
  );

  const totalSubjects = useMemo(() => {
    const subjects = new Set<string>();
    filteredScheduleData.forEach((item: any) => {
      const subject = String(item.subject || "").trim();
      if (subject && subject !== "N/A") subjects.add(subject);
    });
    return subjects.size;
  }, [filteredScheduleData]);

  const activeDays = useMemo(() => {
    const days = new Set<string>();
    filteredScheduleData.forEach((item: any) => {
      const day = String(item.day || "").trim().toLowerCase();
      if (day) days.add(day);
    });
    return days.size;
  }, [filteredScheduleData]);

  const showLoading = loading;

  if (showLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading student...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StudentBreadcrumb />
          </div>
          <div className="row">
            <StudentSidebar student={student} />
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentDetail}?studentId=${effectiveStudentId}` : routes.studentDetail}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-school me-2" />
                        Student Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentTimeTable}?studentId=${effectiveStudentId}` : routes.studentTimeTable}
                        className="nav-link active"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-table-options me-2" />
                        Time Table
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentLeaves}?studentId=${effectiveStudentId}` : routes.studentLeaves}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    {!isTeacher && (
                      <li>
                        <Link
                          to={effectiveStudentId ? `${routes.studentFees}?studentId=${effectiveStudentId}` : routes.studentFees}
                          className="nav-link"
                          state={student ? { studentId: student.id, student } : undefined}
                        >
                          <i className="ti ti-report-money me-2" />
                          Fees
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentResult}?studentId=${effectiveStudentId}` : routes.studentResult}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Exam &amp; Results
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentLibrary}?studentId=${effectiveStudentId}` : routes.studentLibrary}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-books me-2" />
                        Library
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentSubjects}?studentId=${effectiveStudentId}` : routes.studentSubjects}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-book me-2" />
                        Subjects
                      </Link>
                    </li>
                  </ul>

                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <h4 className="mb-3">Weekly Time Table</h4>
                      <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
                        <span className="badge badge-soft-primary">Classes: {totalClasses}</span>
                        <span className="badge badge-soft-success">Subjects: {totalSubjects}</span>
                        <span className="badge badge-soft-info">Active Days: {activeDays}</span>
                      </div>
                    </div>
                    <div className="card-body">
                      {scheduleError && (
                        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
                          <i className="ti ti-alert-circle me-2 fs-18" />
                          <span>{scheduleError}</span>
                        </div>
                      )}

                      {scheduleLoading && (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading timetable...</span>
                        </div>
                      )}

                      {!scheduleLoading && totalClasses === 0 && (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>
                            {isParentRole
                              ? "No timetable is published for this child's class (and section) for the selected year yet."
                              : "No timetable is available for your class and section yet."}
                          </span>
                        </div>
                      )}

                      {!scheduleLoading && totalClasses > 0 && (
                        <div className="table-responsive">
                          <table className="table table-bordered table-sm align-middle">
                            <thead className="table-light">
                              <tr>
                                <th style={{ minWidth: 96 }}>Day</th>
                                {periodColumns.map((col) => (
                                  <th key={col.id} className={col.isBreak ? "text-muted" : ""} style={{ minWidth: 185 }}>
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
                                    <StudentRoutineGridCell
                                      key={`${label}-${col.id}`}
                                      slot={col}
                                      entry={findCellForSlot(filteredScheduleData, label, col.id)}
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
            </div>
          </div>
        </div>
      </div>
      <StudentModals />
    </>
  );
};

export default StudentTimeTable;

