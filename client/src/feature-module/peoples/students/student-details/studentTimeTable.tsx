import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import { useClassSchedules } from "../../../../core/hooks/useClassSchedules";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const StudentTimeTable = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const { data: scheduleData, loading: scheduleLoading, error: scheduleError } = useClassSchedules();
  const { student, loading } = useLinkedStudentContext({
    locationState: state,
  });

  const weeklySchedule = useMemo(() => {
    const className = String(student?.class_name || student?.class || "").trim().toLowerCase();
    const sectionName = String(student?.section_name || student?.section || "").trim().toLowerCase();

    if (!className || !sectionName || !Array.isArray(scheduleData)) {
      return DAY_ORDER.map((day) => ({ day, classes: [] as any[] }));
    }

    const filtered = scheduleData.filter((item: any) => {
      const itemClass = String(item.class || "").trim().toLowerCase();
      const itemSection = String(item.section || "").trim().toLowerCase();
      return itemClass === className && itemSection === sectionName;
    });

    return DAY_ORDER.map((day) => ({
      day,
      classes: filtered.filter((item: any) => String(item.day || "").trim().toLowerCase() === day.toLowerCase()),
    }));
  }, [scheduleData, student]);

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
                        to={routes.studentDetail}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-school me-2" />
                        Student Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentTimeTable}
                        className="nav-link active"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-table-options me-2" />
                        Time Table
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentLeaves}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentFees}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-report-money me-2" />
                        Fees
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentResult}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Exam &amp; Results
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
                                    <div className="d-flex flex-column gap-3">
                                      {entry.classes.map((cls: any) => (
                                        <div key={cls.id} className="bg-light rounded p-3">
                                          <div className="d-flex align-items-start justify-content-between gap-3">
                                            <div>
                                              <h6 className="mb-1">{cls.subject || "Subject"}</h6>
                                              <p className="mb-1 text-dark">
                                                <i className="ti ti-clock me-1" />
                                                {cls.startTime || "N/A"} - {cls.endTime || "N/A"}
                                              </p>
                                              <p className="mb-0 text-muted">
                                                <i className="ti ti-user me-1" />
                                                {cls.teacher || "Teacher not assigned"}
                                              </p>
                                            </div>
                                            <span className="badge badge-soft-secondary">
                                              {cls.classRoom && cls.classRoom !== "N/A" ? `Room ${cls.classRoom}` : "Room TBA"}
                                            </span>
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
