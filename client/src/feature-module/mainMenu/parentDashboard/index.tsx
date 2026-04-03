import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useParents } from "../../../core/hooks/useParents";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";
import { useStudentFees } from "../../../core/hooks/useStudentFees";
import { useStudentExamResults } from "../../../core/hooks/useStudentExamResults";
import { useStudentAttendance } from "../../../core/hooks/useStudentAttendance";
import { useClassSchedules } from "../../../core/hooks/useClassSchedules";
import { useEvents } from "../../../core/hooks/useEvents";
import { useNoticeBoard } from "../../../core/hooks/useNoticeBoard";
import { EventsCard } from "../shared/EventsCard";

type StatsRangeKey = "thisMonth" | "thisYear" | "lastWeek";
type LeaveRangeKey = "thisMonth" | "thisYear" | "lastWeek";

const getDateRange = (key: StatsRangeKey | LeaveRangeKey) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  if (key === "thisWeek") return { start: startOfWeek, end: endOfWeek };
  if (key === "lastWeek") {
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    lastWeekEnd.setHours(23, 59, 59, 999);
    return { start: lastWeekStart, end: lastWeekEnd };
  }
  if (key === "thisMonth") return { start: startOfMonth, end: endOfMonth };
  if (key === "thisYear") return { start: startOfYear, end: endOfYear };
  return { start: startOfMonth, end: endOfMonth };
};

const isDateInRange = (dateVal: string | Date | null | undefined, rangeKey: StatsRangeKey | LeaveRangeKey) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return false;
  const { start, end } = getDateRange(rangeKey);
  return d >= start && d <= end;
};

const ParentDashboard = () => {
  const routes = all_routes;
  const { parents, loading: parentLoading, error: parentError } = useParents({ forCurrentUser: true });
  const { upcomingEvents, completedEvents, loading: eventsLoading } = useEvents({ forDashboard: true, limit: 5 });

  const children = useMemo(() => parents || [], [parents]);
  const firstParent = children[0];
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const activeStudent = activeStudentId
    ? children.find((c: { student_id?: number }) => String(c.student_id) === activeStudentId)
    : firstParent;
  const selectedChild = activeStudent || firstParent;

  const [statisticsRange, setStatisticsRange] = useState<StatsRangeKey>("thisMonth");
  const [leaveRange, setLeaveRange] = useState<LeaveRangeKey>("thisMonth");
  const { leaveApplications: myLeaves, loading: leaveLoading, error: leaveError } = useLeaveApplications({
    parentChildren: true,
    limit: 50,
    studentId: selectedChild?.student_id ?? null,
  });
  const { data: feeData } = useStudentFees(selectedChild?.student_id ?? null);
  const { data: examResultsData } = useStudentExamResults(selectedChild?.student_id ?? null);
  const { data: attendanceData } = useStudentAttendance(selectedChild?.student_id ?? null);
  const { data: allSchedules } = useClassSchedules();
  const { notices, loading: noticeLoading } = useNoticeBoard({ limit: 6 });

  // Filtered leaves by date range
  const filteredLeaves = useMemo(() => {
    if (!myLeaves?.length) return [];
    return myLeaves.filter((item: { startDate?: string }) => isDateInRange(item.startDate, leaveRange));
  }, [myLeaves, leaveRange]);

  // Filtered attendance by date range for Statistics
  const filteredAttendanceStats = useMemo(() => {
    if (!attendanceData?.records?.length) return { present: 0, absent: 0, halfDay: 0, late: 0 };
    const filtered = attendanceData.records.filter((r: { attendanceDate?: string }) =>
      isDateInRange(r.attendanceDate, statisticsRange)
    );
    const present = filtered.filter((r: { status?: string }) => r.status === "present").length;
    const absent = filtered.filter((r: { status?: string }) => r.status === "absent").length;
    const halfDay = filtered.filter((r: { status?: string }) => (r.status || "").includes("half")).length;
    const late = filtered.filter((r: { status?: string }) => r.status === "late").length;
    return { present, absent, halfDay, late };
  }, [attendanceData, statisticsRange]);

  // Filtered exam results by date range for Statistics
  const filteredExamStats = useMemo(() => {
    if (!examResultsData?.exams?.length) return null;
    const examsInRange = examResultsData.exams.filter((exam: { examDate?: string; exam_date?: string; date?: string }) => {
      const d = exam.examDate || exam.exam_date || exam.date;
      return !d || isDateInRange(d, statisticsRange);
    });
    if (examsInRange.length === 0) return null;
    const totalPct = examsInRange.reduce(
      (sum: number, e: { summary?: { percentage?: number } }) => sum + (e.summary?.percentage ?? 0),
      0
    );
    const avgPct = totalPct / examsInRange.length;
    const passCount = examsInRange.filter(
      (e: { summary?: { overallResult?: string } }) =>
        String(e.summary?.overallResult || "").toLowerCase() === "pass"
    ).length;
    return { avgPercentage: avgPct, passCount, totalExams: examsInRange.length };
  }, [examResultsData, statisticsRange]);

  const todaysSchedule = useMemo(() => {
    if (!selectedChild || !allSchedules?.length) return [];
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    return allSchedules.filter((item: { class?: string; section?: string; day?: string }) => {
      const classOk = String(item.class || "").trim().toLowerCase() === String(selectedChild.class_name || "").trim().toLowerCase();
      const sectionOk = String(item.section || "").trim().toLowerCase() === String(selectedChild.section_name || "").trim().toLowerCase();
      const dayOk = String(item.day || "").trim().toLowerCase() === todayName;
      return classOk && sectionOk && dayOk;
    });
  }, [selectedChild, allSchedules]);

  // Leave counts by type (from real leave data - use filtered for selected child)
  const leaveCounts = useMemo(() => {
    const t = (s: string) => String(s || "").toLowerCase();
    const medical = myLeaves.filter((l: { leaveType?: string }) => {
      const lt = t(l.leaveType);
      return lt.includes("medical") || lt.includes("sick");
    });
    const casual = myLeaves.filter((l: { leaveType?: string }) => {
      const lt = t(l.leaveType);
      return lt.includes("casual") || lt.includes("casual leave");
    });
    return { medical: medical.length, casual: casual.length, total: myLeaves.length };
  }, [myLeaves]);

  useEffect(() => {
    if (children.length > 0 && !activeStudentId) {
      setActiveStudentId(String(children[0].student_id));
    }
  }, [children, activeStudentId]);
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Parent Dashboard</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.parentDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Parent Dashboard
                  </li>
                </ol>
              </nav>
            </div>
            {children.length > 1 && (
              <div className="dash-select-student d-flex align-items-center mb-2">
                <h6 className="mb-0">Select Student</h6>
                <div className="student-active d-flex align-items-center ms-2">
                  {children.map((child: { student_id?: number; Child?: string; ChildImage?: string }) => (
                    <Link
                      key={child.student_id}
                      to="#"
                      onClick={() => setActiveStudentId(String(child.student_id))}
                      className={`avatar avatar-lg p-1 me-2 ${activeStudentId === String(child.student_id) && "active"}`}
                    >
                      <ImageWithBasePath
                        src={child.ChildImage || "assets/img/students/student-01.jpg"}
                        alt={child.Child || "Child"}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* /Page Header */}
          <div className="row">
            {/* Profile */}
            <div className="col-xxl-5 col-xl-12 d-flex">
              <div className="card bg-dark position-relative flex-fill">
                <div className="card-body">
                  {parentLoading && (
                    <div className="d-flex align-items-center justify-content-center p-4">
                      <div className="spinner-border text-light" role="status" />
                    </div>
                  )}
                  {parentError && (
                    <div className="alert alert-warning mb-0" role="alert">
                      <i className="ti ti-alert-circle me-2" />
                      {parentError}
                    </div>
                  )}
                  {!parentLoading && !parentError && firstParent && (
                    <div className="d-flex align-items-center row-gap-3">
                      <div className="avatar avatar-xxl rounded flex-shrink-0 me-3">
                        <ImageWithBasePath
                          src={firstParent.ParentImage || "assets/img/parents/parent-01.jpg"}
                          alt="Parent"
                        />
                      </div>
                      <div className="d-block">
                        <span className="badge bg-transparent-primary text-primary mb-1">
                          {firstParent.id ? `#P${firstParent.id}` : "#P—"}
                        </span>
                        <h4 className="text-truncate text-white mb-1">
                          {firstParent.name || "—"}
                        </h4>
                        <div className="d-flex align-items-center flex-wrap row-gap-2 class-info">
                          <span>{firstParent.Addedon || "—"}</span>
                          <span>Child : {selectedChild?.Child || firstParent.Child || "—"}</span>
                        </div>
                        {selectedChild?.student_id && (
                          <Link
                            to={`${routes.studentDetail}/${selectedChild.student_id}`}
                            state={{ returnTo: routes.parentDashboard }}
                            className="btn btn-primary btn-sm mt-2"
                          >
                            View Child Profile
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                  {!parentLoading && !parentError && !firstParent && (
                    <div className="alert alert-info mb-0" role="alert">
                      Parent profile not found. Please contact admin.
                    </div>
                  )}
                  <div className="student-card-bg">
                    <ImageWithBasePath
                      src="assets/img/bg/circle-shape.png"
                      alt="Bg"
                    />
                    <ImageWithBasePath
                      src="assets/img/bg/shape-02.png"
                      alt="Bg"
                    />
                    <ImageWithBasePath
                      src="assets/img/bg/shape-04.png"
                      alt="Bg"
                    />
                    <ImageWithBasePath
                      src="assets/img/bg/blue-polygon.png"
                      alt="Bg"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* /Profile */}
            {/* Leave */}
            <div className="col-xxl-7 d-flex">
              <div className="row flex-fill">
                <div className="col-xl-4 d-flex flex-column">
                  <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-2 animate-card">
                    <div className="d-flex align-items-center">
                      <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                        <i className="ti ti-calendar-event text-dark fs-16" />
                      </span>
                      <h6>Apply Leave</h6>
                    </div>
                    <Link
                      to={routes.studentLeaves}
                      state={
                        selectedChild?.student_id
                          ? { studentId: selectedChild.student_id, returnTo: routes.parentDashboard }
                          : undefined
                      }
                      className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                    >
                      <i className="ti ti-chevron-right fs-14" />
                    </Link>
                  </div>
                  {selectedChild?.student_id && (
                    <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-2 animate-card">
                      <div className="d-flex align-items-center">
                        <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                          <i className="ti ti-report-money text-dark fs-16" />
                        </span>
                        <h6>View Child Fees</h6>
                      </div>
                      <Link
                        to={routes.studentFees}
                        state={{ studentId: selectedChild.student_id }}
                        className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                      >
                        <i className="ti ti-chevron-right fs-14" />
                      </Link>
                    </div>
                  )}
                  {selectedChild?.student_id && (
                    <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-4 animate-card">
                      <div className="d-flex align-items-center">
                        <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                          <i className="ti ti-table text-dark fs-16" />
                        </span>
                        <h6>View Time Table</h6>
                      </div>
                      <Link
                        to={routes.studentTimeTable}
                        state={{ studentId: selectedChild.student_id, returnTo: routes.parentDashboard }}
                        className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                      >
                        <i className="ti ti-chevron-right fs-14" />
                      </Link>
                    </div>
                  )}
                </div>
                <div className="col-xl-4 col-md-6">
                  <div className="card bg-success-transparent border-3 border-white text-center p-3">
                    <span className="avatar avatar-sm rounded bg-success mx-auto mb-3">
                      <i className="ti ti-calendar-share fs-15" />
                    </span>
                    <h6 className="mb-2">Medical Leaves</h6>
                    <div className="d-flex align-items-center justify-content-between text-default">
                      <p className="border-end mb-0">Used : {leaveCounts.medical}</p>
                      <p className="mb-0">—</p>
                    </div>
                  </div>
                </div>
                <div className="col-xl-4 col-md-6">
                  <div className="card bg-primary-transparent border-3 border-white text-center p-3">
                    <span className="avatar avatar-sm rounded bg-primary mx-auto mb-3">
                      <i className="ti ti-hexagonal-prism-plus fs-15" />
                    </span>
                    <h6 className="mb-2">Casual Leaves</h6>
                    <div className="d-flex align-items-center justify-content-between text-default">
                      <p className="border-end mb-0">Used : {leaveCounts.casual}</p>
                      <p className="mb-0">—</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Leave */}
          </div>
          <div className="row">
            {/* Events */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <EventsCard
                upcomingEvents={upcomingEvents}
                completedEvents={completedEvents}
                loading={eventsLoading}
                limit={5}
              />
            </div>
            {/* /Events */}
            {/* Statistics */}
            <div className="col-xxl-8 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Statistics</h4>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <i className="ti ti-calendar me-2" />
                      {statisticsRange === "thisMonth" ? "This Month" : statisticsRange === "thisYear" ? "This Year" : "Last Week"}
                    </button>
                    <ul className="dropdown-menu mt-2 p-3">
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setStatisticsRange("thisMonth")}>
                          This Month
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setStatisticsRange("thisYear")}>
                          This Year
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setStatisticsRange("lastWeek")}>
                          Last Week
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body pb-0">
                  {!selectedChild?.student_id ? (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>Select a child to view statistics.</span>
                    </div>
                  ) : filteredExamStats || filteredAttendanceStats.present + filteredAttendanceStats.absent + filteredAttendanceStats.halfDay + filteredAttendanceStats.late > 0 ? (
                    <div className="row g-3">
                      {filteredAttendanceStats.present + filteredAttendanceStats.absent + filteredAttendanceStats.halfDay + filteredAttendanceStats.late > 0 && (
                        <div className="col-6 col-md-3">
                          <div className="d-flex align-items-center p-2 bg-light-100 rounded">
                            <span className="avatar avatar-sm bg-success-transparent me-2">
                              <i className="ti ti-check text-success" />
                            </span>
                            <div>
                              <p className="mb-0 small text-muted">Present</p>
                              <h6 className="mb-0">{filteredAttendanceStats.present}</h6>
                            </div>
                          </div>
                        </div>
                      )}
                      {filteredAttendanceStats.absent > 0 && (
                        <div className="col-6 col-md-3">
                          <div className="d-flex align-items-center p-2 bg-light-100 rounded">
                            <span className="avatar avatar-sm bg-danger-transparent me-2">
                              <i className="ti ti-x text-danger" />
                            </span>
                            <div>
                              <p className="mb-0 small text-muted">Absent</p>
                              <h6 className="mb-0">{filteredAttendanceStats.absent}</h6>
                            </div>
                          </div>
                        </div>
                      )}
                      {filteredExamStats && (
                        <div className="col-6 col-md-3">
                          <div className="d-flex align-items-center p-2 bg-light-100 rounded">
                            <span className="avatar avatar-sm bg-primary-transparent me-2">
                              <i className="ti ti-report-analytics text-primary" />
                            </span>
                            <div>
                              <p className="mb-0 small text-muted">Avg Score</p>
                              <h6 className="mb-0">{filteredExamStats.avgPercentage.toFixed(1)}%</h6>
                            </div>
                          </div>
                        </div>
                      )}
                      {filteredExamStats && filteredExamStats.totalExams > 0 && (
                        <div className="col-6 col-md-3">
                          <div className="d-flex align-items-center p-2 bg-light-100 rounded">
                            <span className="avatar avatar-sm bg-info-transparent me-2">
                              <i className="ti ti-certificate text-info" />
                            </span>
                            <div>
                              <p className="mb-0 small text-muted">Exams</p>
                              <h6 className="mb-0">{filteredExamStats.passCount}/{filteredExamStats.totalExams}</h6>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>Statistics (exam score &amp; attendance) will appear here once data is available.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Statistics */}
          </div>
          <div className="row">
            {/* Leave Status */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Leave Status</h4>
                  <div className="d-flex align-items-center gap-2">
                    {selectedChild?.student_id && (
                      <Link
                        to={routes.studentLeaves}
                        state={{ studentId: selectedChild.student_id, returnTo: routes.parentDashboard }}
                        className="fw-medium"
                      >
                        View All
                      </Link>
                    )}
                    <div className="dropdown">
                      <button
                        type="button"
                        className="btn btn-light dropdown-toggle"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        <i className="ti ti-calendar me-2" />
                        {leaveRange === "thisMonth" ? "This Month" : leaveRange === "thisYear" ? "This Year" : "Last Week"}
                      </button>
                      <ul className="dropdown-menu mt-2 p-3">
                        <li>
                          <button type="button" className="dropdown-item rounded-1" onClick={() => setLeaveRange("thisMonth")}>
                            This Month
                          </button>
                        </li>
                        <li>
                          <button type="button" className="dropdown-item rounded-1" onClick={() => setLeaveRange("thisYear")}>
                            This Year
                          </button>
                        </li>
                        <li>
                          <button type="button" className="dropdown-item rounded-1" onClick={() => setLeaveRange("lastWeek")}>
                            Last Week
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {leaveError && (
                    <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
                      <i className="ti ti-alert-circle me-2 fs-18" />
                      <span>{leaveError}</span>
                    </div>
                  )}
                  {leaveLoading && (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                    </div>
                  )}
                  {!leaveLoading && !leaveError && filteredLeaves.length === 0 && (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No leave applications.</span>
                    </div>
                  )}
                  {!leaveLoading && filteredLeaves.length > 0 && filteredLeaves.map((item: { key?: string; leaveType?: string; leaveRange?: string; statusBadgeClass?: string; status?: string }, idx: number) => (
                    <div key={item.key} className={`bg-light-300 d-sm-flex align-items-center justify-content-between p-3 ${idx < filteredLeaves.length - 1 ? "mb-3" : "mb-0"}`}>
                      <div className="d-flex align-items-center mb-2 mb-sm-0">
                        <div className="avatar avatar-lg bg-info-transparent flex-shrink-0 me-2">
                          <i className="ti ti-calendar-off" />
                        </div>
                        <div>
                          <h6 className="mb-1">{item.leaveType || "Leave"}</h6>
                          <p className="mb-0">Date : {item.leaveRange || "—"}</p>
                        </div>
                      </div>
                      <span className={`badge ${item.statusBadgeClass || "bg-skyblue"} d-inline-flex align-items-center`}>
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        {item.status || "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* /Leave Status */}
            {/* Today's Schedule */}
            <div className="col-xxl-4  col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-titile">Today's Time Table</h4>
                  {selectedChild?.student_id && (
                    <Link
                      to={routes.studentTimeTable}
                      state={{ studentId: selectedChild.student_id, returnTo: routes.parentDashboard }}
                      className="fw-medium"
                    >
                      View All
                    </Link>
                  )}
                </div>
                <div className="card-body py-1">
                  {!selectedChild?.student_id || todaysSchedule.length === 0 ? (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>
                        {selectedChild?.student_id
                          ? "No timetable entries are available for today."
                          : "Select a child to view today's timetable."}
                      </span>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {todaysSchedule.slice(0, 4).map((item: { id?: number; subject?: string; startTime?: string; endTime?: string; teacher?: string }, idx: number) => (
                        <div key={item.id ?? idx} className="border rounded p-3">
                          <h6 className="mb-1">{item.subject || "Subject"}</h6>
                          <p className="mb-1 text-muted">
                            {item.startTime || "—"} - {item.endTime || "—"}
                          </p>
                          <p className="mb-0 small">{item.teacher || "Teacher not assigned"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Today's Schedule */}
            {/* Fees Reminder */}
            <div className="col-xxl-4 col-xl-12 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-titile">Child Fees</h4>
                  {selectedChild?.student_id && (
                    <Link
                      to={routes.studentFees}
                      state={{ studentId: selectedChild.student_id }}
                      className="link-primary fw-medium"
                    >
                      View Fees
                    </Link>
                  )}
                </div>
                <div className="card-body py-1">
                  {selectedChild?.student_id ? (
                    feeData ? (
                      <div>
                        <p className="mb-2">
                          <strong>Total Due:</strong> ${(feeData.totalDue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="mb-2">
                          <strong>Total Paid:</strong> ${(feeData.totalPaid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="mb-0">
                          <strong>Outstanding:</strong>{" "}
                          <span className={feeData.totalOutstanding > 0 ? "text-danger" : "text-success"}>
                            ${(feeData.totalOutstanding ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </p>
                        {feeData.totalOutstanding > 0 && (
                          <div className="alert alert-warning mt-2 mb-0 py-2" role="alert">
                            <i className="ti ti-alert-circle me-2" />
                            Please pay outstanding amount for {selectedChild?.Child || "your child"}.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                        <i className="ti ti-info-circle me-2 fs-18" />
                        <span>Loading fee data...</span>
                      </div>
                    )
                  ) : (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>Select a child to view fee details.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Fees Reminder */}
          </div>
          <div className="row">
            {/* Exam Result */}
            <div className="col-xxl-8 col-xl-7 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                  <h4 className="card-title mb-3">Exam Result</h4>
                  {selectedChild?.student_id && (
                    <Link
                      to={routes.studentResult}
                      state={{ studentId: selectedChild.student_id, student: selectedChild }}
                      className="link-primary fw-medium mb-3"
                    >
                      View All
                    </Link>
                  )}
                </div>
                <div className="card-body px-0">
                  {!selectedChild?.student_id ? (
                    <div className="alert alert-info d-flex align-items-center mx-3 mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>Select a child to view exam results.</span>
                    </div>
                  ) : examResultsData?.exams?.length ? (
                    <div className="px-3">
                      {examResultsData.exams.slice(0, 5).map((exam: { examId?: number; examName?: string; examLabel?: string; subjects?: Array<{ subjectName?: string }>; summary?: { percentage?: number; overallResult?: string } }, idx: number) => {
                        const subjectNames = (exam.subjects || []).map((s: { subjectName?: string }) => s.subjectName).filter(Boolean).join(", ");
                        return (
                          <div key={exam.examId ?? idx} className="d-flex align-items-center justify-content-between py-2 border-bottom border-light">
                            <div>
                              <h6 className="mb-0">{exam.examLabel || exam.examName || `Exam ${idx + 1}`}</h6>
                              {subjectNames ? (
                                <p className="mb-0 text-muted small">
                                  {subjectNames}
                                </p>
                              ) : null}
                              <p className="mb-0 text-muted small">
                                {exam.summary?.percentage != null ? `${exam.summary.percentage.toFixed(1)}%` : ""} — {exam.summary?.overallResult ?? "—"}
                              </p>
                            </div>
                            <span className={`badge ${(exam.summary?.overallResult || "").toLowerCase() === "pass" ? "badge-soft-success" : "badge-soft-danger"} d-inline-flex align-items-center`}>
                              {exam.summary?.overallResult ?? "—"}
                            </span>
                          </div>
                        );
                      })}
                      {examResultsData.exams.length > 5 && (
                        <p className="mb-0 small text-muted mt-2">+{examResultsData.exams.length - 5} more</p>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-info d-flex align-items-center mx-3 mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No exam results available. Results will appear here after exams.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Exam Result */}
            {/* Notice Board */}
            <div className="col-xxl-4 col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header  d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Notice Board</h4>
                  <Link to={routes.noticeBoard} className="fw-medium">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {noticeLoading ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                    </div>
                  ) : !notices?.length ? (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No notices available.</span>
                    </div>
                  ) : (
                    <div className="notice-widget">
                      {notices.slice(0, 6).map((notice: { id?: number; title?: string; addedOn?: string; created_at?: string }) => (
                        <div key={notice.id} className="d-flex align-items-center justify-content-between mb-4">
                          <div className="d-flex align-items-center overflow-hidden me-2">
                            <span className="bg-primary-transparent avatar avatar-md me-2 rounded-circle flex-shrink-0">
                              <i className="ti ti-calendar fs-16" />
                            </span>
                            <div className="overflow-hidden">
                              <h6 className="text-truncate mb-1">{notice.title || "Notice"}</h6>
                              <p className="mb-0">
                                <i className="ti ti-calendar me-2" />
                                Added on : {notice.addedOn || (notice.created_at ? new Date(notice.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—")}
                              </p>
                            </div>
                          </div>
                          <Link to={routes.noticeBoard}>
                            <i className="ti ti-chevron-right fs-16" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Notice Board */}
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default ParentDashboard;
