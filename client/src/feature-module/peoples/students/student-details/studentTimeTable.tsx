import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
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

  const { data: scheduleData, loading: scheduleLoading, error: scheduleError } = useClassSchedules({
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

  const weeklySchedule = useMemo(() => {
    if (!Array.isArray(filteredScheduleData)) {
      return DAY_ORDER.map((day) => ({ day, classes: [] as any[] }));
    }
    return DAY_ORDER.map((day) => ({
      day,
      classes: filteredScheduleData.filter(
        (item: any) => String(item.day || "").trim().toLowerCase() === day.toLowerCase()
      ),
    }));
  }, [filteredScheduleData]);

  const totalClasses = useMemo(
    () => weeklySchedule.reduce((sum, entry) => sum + entry.classes.length, 0),
    [weeklySchedule]
  );

  const totalSubjects = useMemo(() => {
    const subjects = new Set<string>();
    weeklySchedule.forEach((entry) => {
      entry.classes.forEach((item: any) => {
        const subject = String(item.subject || "").trim();
        if (subject && subject !== "N/A") subjects.add(subject);
      });
    });
    return subjects.size;
  }, [weeklySchedule]);

  const activeDays = weeklySchedule.filter((entry) => entry.classes.length > 0).length;
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
                        <div className="row g-3">
                          {weeklySchedule.map((entry) => (
                            <div className="col-12 col-xl-6" key={entry.day}>
                              <div className="border rounded h-100">
                                <div className="d-flex align-items-center justify-content-between border-bottom px-3 py-2">
                                  <h6 className="mb-0">{entry.day}</h6>
                                  <span className="badge badge-soft-primary">
                                    {entry.classes.length} Class{entry.classes.length === 1 ? "" : "es"}
                                  </span>
                                </div>
                                <div className="p-3">
                                  {entry.classes.length === 0 ? (
                                    <p className="text-muted mb-0">No classes scheduled.</p>
                                  ) : (
                                    <div className="row g-2">
                                      {entry.classes.map((cls: any) => (
                                        <div key={cls.id} className="col-6 d-flex">
                                          <div className="bg-light rounded p-2 w-100 h-100">
                                            <div className="min-w-0">
                                              <h6 className="mb-1 text-truncate">{cls.subject || "Subject"}</h6>
                                              <p className="mb-1 text-dark small text-truncate">
                                                <i className="ti ti-clock me-1" />
                                                {cls.startTime || "N/A"} - {cls.endTime || "N/A"}
                                              </p>
                                              <p className="mb-1 text-muted small text-truncate">
                                                <i className="ti ti-user me-1" />
                                                {cls.teacher || "Teacher not assigned"}
                                              </p>
                                              <p
                                                className="mb-0 text-muted small text-truncate"
                                                title={cls.classRoom && cls.classRoom !== "N/A" ? `Room ${cls.classRoom}` : "Room TBA"}
                                              >
                                                <i className="ti ti-building me-1" />
                                                {cls.classRoom && cls.classRoom !== "N/A" ? `Room ${cls.classRoom}` : "Room TBA"}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
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

