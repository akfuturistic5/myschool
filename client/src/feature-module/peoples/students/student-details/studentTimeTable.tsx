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
  const headerAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const { student, loading, role } = useLinkedStudentContext({
    locationState: state,
  });
  const effectiveStudentId = parsePositiveId(student?.id);

  const classIdForSchedule = parsePositiveId(
    student?.class_id ?? (student as { classId?: unknown })?.classId
  );
  const sectionIdForSchedule = parsePositiveId(
    student?.section_id ?? (student as { sectionId?: unknown })?.sectionId
  );
  const sectionNameForSchedule = normalizeText(
    student?.section_name ?? (student as { sectionName?: unknown })?.sectionName
  );

  /** Parents/guardians should default to the child's enrolled year to avoid empty timetable on header-year mismatch. */
  const studentAcademicYearId = parsePositiveId(
    student?.academic_year_id ?? (student as { academicYearId?: unknown })?.academicYearId
  );
  const normalizedRole = String(role || "").trim().toLowerCase();
  const isParentViewer =
    normalizedRole === "parent" ||
    normalizedRole === "guardian" ||
    normalizedRole === "father" ||
    normalizedRole === "mother" ||
    normalizedRole.includes("parent") ||
    normalizedRole.includes("guardian");
  const academicYearForSchedules = isParentViewer
    ? studentAcademicYearId ?? headerAcademicYearId ?? undefined
    : studentAcademicYearId ?? headerAcademicYearId ?? undefined;

  const { data: scheduleData, loading: scheduleLoading, error: scheduleError } = useClassSchedules({
    academicYearId: academicYearForSchedules,
    classId: classIdForSchedule ?? undefined,
    // Use scoped class fetch; this avoids hard failures when section id types differ (sections.id vs class_sections.id).
    sectionId: undefined,
    skip: !classIdForSchedule,
  });

  const filteredScheduleData = useMemo(() => {
    const list = Array.isArray(scheduleData) ? scheduleData : [];
    if (!classIdForSchedule) return [];
    return list.filter((item: any) => {
      const rowClassId = parsePositiveId(item?.originalData?.class_id);
      if (rowClassId !== classIdForSchedule) return false;
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
  }, [scheduleData, classIdForSchedule, sectionIdForSchedule, sectionNameForSchedule]);

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

                      {!headerAcademicYearId && studentAcademicYearId && !scheduleError ? (
                        <div className="alert alert-light border small mb-3" role="status">
                          Timetable is loaded using this student&apos;s academic year. Choose a year in the header to
                          switch when viewing as staff.
                        </div>
                      ) : null}

                      {scheduleLoading && (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading timetable...</span>
                        </div>
                      )}

                      {!scheduleLoading && totalClasses === 0 && (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No timetable is available for your class and section yet.</span>
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

