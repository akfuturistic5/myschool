import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useCurrentStudent } from "../../../core/hooks/useCurrentStudent";
import { useStudentAttendance } from "../../../core/hooks/useStudentAttendance";
import { useClassSchedules } from "../../../core/hooks/useClassSchedules";
import { useClassSyllabus } from "../../../core/hooks/useClassSyllabus";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";
import { useStudentFees } from "../../../core/hooks/useStudentFees";
import { useStudentExamResults } from "../../../core/hooks/useStudentExamResults";
import { useTodos } from "../../../core/hooks/useTodos";
import { useEvents } from "../../../core/hooks/useEvents";
import { useAcademicYears } from "../../../core/hooks/useAcademicYears";
import { EventsCard } from "../shared/EventsCard";
import { Calendar } from "primereact/calendar";
import type { Nullable } from "primereact/ts-helpers";
import dayjs from "dayjs";
import { DatePicker } from "antd";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const StudentDasboard = () => {
  const routes = all_routes;
  const { student, loading: studentLoading, error: studentError } = useCurrentStudent();
  const { data: attendanceData, loading: attendanceLoading, error: attendanceError } = useStudentAttendance(student?.id ?? null);
  const { data: allSchedules, loading: scheduleLoading } = useClassSchedules();
  const { data: syllabusData } = useClassSyllabus();
  const { leaveApplications: myLeaves, loading: leaveLoading } = useLeaveApplications({ studentOnly: true, limit: 50 });
  const { data: feeData } = useStudentFees(student?.id ?? null);
  const { data: examResultsData } = useStudentExamResults(student?.id ?? null);
  const { todos } = useTodos();
  const { upcomingEvents, completedEvents, loading: eventsLoading } = useEvents({ forDashboard: true, limit: 5 });
  const { academicYears } = useAcademicYears();

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const dayStr = String(today.getDate()).padStart(2, "0");
  const formattedDate = `${month}-${dayStr}-${year}`;
  const defaultValue = dayjs(formattedDate);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(defaultValue);
  const [date, setDate] = useState<Nullable<Date>>(null);

  // Filter states for dropdowns
  type AttendanceRangeKey = "thisWeek" | "lastWeek" | "lastMonth" | "allTime";
  const [attendanceRange, setAttendanceRange] = useState<AttendanceRangeKey>("thisWeek");
  type LeaveRangeKey = "thisMonth" | "thisYear" | "lastWeek" | "allTime";
  const [leaveRange, setLeaveRange] = useState<LeaveRangeKey>("thisMonth");
  type TodoRangeKey = "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime";
  const [todoRange, setTodoRange] = useState<TodoRangeKey>("today");
  const [homeWorkSubject, setHomeWorkSubject] = useState<string>("all");
  const [performanceYearId, setPerformanceYearId] = useState<string | null>(null);

  // Date range helpers
  const getDateRange = (key: AttendanceRangeKey | LeaveRangeKey | TodoRangeKey) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
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

    if (key === "today") return { start: startOfToday, end: endOfToday };
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
    if (key === "lastMonth") {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start: lastMonthStart, end: lastMonthEnd };
    }
    return { start: startOfToday, end: endOfToday };
  };

  const isDateInRange = (dateVal: string | Date | null | undefined, rangeKey: AttendanceRangeKey | LeaveRangeKey | TodoRangeKey) => {
    if (rangeKey === "allTime") return true;
    if (!dateVal) return false;
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return false;
    const { start, end } = getDateRange(rangeKey);
    return d >= start && d <= end;
  };

  // Filtered attendance by date range
  const filteredAttendanceData = useMemo(() => {
    if (!attendanceData?.records?.length) return { records: [], summary: { present: 0, absent: 0, halfDay: 0, late: 0 } };
    const filtered = attendanceData.records.filter((r: { attendanceDate?: string }) =>
      isDateInRange(r.attendanceDate, attendanceRange)
    );
    const present = filtered.filter((r: { status?: string }) => r.status === "present").length;
    const absent = filtered.filter((r: { status?: string }) => r.status === "absent").length;
    const halfDay = filtered.filter((r: { status?: string }) => (r.status || "").includes("half")).length;
    const late = filtered.filter((r: { status?: string }) => r.status === "late").length;
    return { records: filtered, summary: { present, absent, halfDay, late } };
  }, [attendanceData, attendanceRange]);

  // Filtered leaves by date range
  const filteredLeaves = useMemo(() => {
    if (!myLeaves?.length) return [];
    return myLeaves.filter((item: { startDate?: string }) =>
      isDateInRange(item.startDate, leaveRange)
    );
  }, [myLeaves, leaveRange]);

  // Filtered todos by date range
  const filteredTodos = useMemo(() => {
    if (!todos?.length) return [];
    return todos.filter((t: { due_date?: string }) =>
      isDateInRange(t.due_date, todoRange)
    );
  }, [todos, todoRange]);

  // Today's classes - filter schedules by student's class/section and selected date's day
  const todaysClasses = useMemo(() => {
    if (!student || !allSchedules?.length) return [];
    const classMatch = student.class_name || student.class;
    const sectionMatch = student.section_name || student.section;
    const dayName = selectedDate ? DAY_NAMES[selectedDate.day()] : DAY_NAMES[today.getDay()];
    return allSchedules.filter(
      (s: { class?: string; section?: string; day?: string }) =>
        (s.class === classMatch || !classMatch) &&
        (s.section === sectionMatch || !sectionMatch) &&
        s.day === dayName
    );
  }, [student, allSchedules, selectedDate, today.getDay()]);

  // Class faculties - unique teachers from schedules for student's class/section
  const classFaculties = useMemo(() => {
    if (!student || !allSchedules?.length) return [];
    const classMatch = student.class_name || student.class;
    const sectionMatch = student.section_name || student.section;
    const filtered = allSchedules.filter(
      (s: { class?: string; section?: string; teacher?: string }) =>
        (s.class === classMatch || !classMatch) &&
        (s.section === sectionMatch || !sectionMatch) &&
        s.teacher
    );
    const seen = new Set<string>();
    return filtered.filter((s: { teacher?: string; subject?: string }) => {
      const key = `${s.teacher}-${s.subject}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [student, allSchedules]);

  // Syllabus for student's class/section
  const mySyllabus = useMemo(() => {
    if (!student || !syllabusData?.length) return [];
    const classMatch = student.class_name || student.class;
    const sectionMatch = student.section_name || student.section;
    return syllabusData.filter(
      (s: { class?: string; section?: string }) =>
        (String(s.class || "").toLowerCase() === String(classMatch || "").toLowerCase() || !classMatch) &&
        (String(s.section || "").toLowerCase() === String(sectionMatch || "").toLowerCase() || !sectionMatch)
    );
  }, [student, syllabusData]);

  // Unique subjects from class schedules for Home Works filter
  const homeWorkSubjects = useMemo(() => {
    const subs = new Set<string>();
    classFaculties?.forEach((f: { subject?: string }) => {
      if (f.subject?.trim()) subs.add(f.subject.trim());
    });
    return Array.from(subs).sort();
  }, [classFaculties]);

  // Academic years for Performance dropdown
  const academicYearsList = (academicYears || []) as Array<{ id?: number; year_name?: string; is_current?: boolean }>;
  const currentAcademicYear = academicYearsList?.find((year: any) => year?.is_current) ?? null;
  const selectedPerformanceYear = performanceYearId
    ? academicYearsList.find((y) => String(y.id) === performanceYearId)
    : currentAcademicYear || academicYearsList[0];

  if (!academicYears || academicYears.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Student Dashboard</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.studentDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Student Dashboard
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          {/* /Page Header */}
          {studentLoading && (
            <div className="d-flex justify-content-center align-items-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="ms-2">Loading your profile...</span>
            </div>
          )}
          {studentError && (
            <div className="alert alert-warning mb-3" role="alert">
              <i className="ti ti-alert-circle me-2" />
              {studentError}
            </div>
          )}
          {!studentLoading && !student && !studentError && (
            <div className="alert alert-info mb-3" role="alert">
              Student profile not found. Please contact admin.
            </div>
          )}
          <div className="row">
            <div className="col-xxl-8 d-flex">
              <div className="row flex-fill">
                {/* Profile */}
                <div className="col-xl-6 d-flex">
                  <div className="flex-fill">
                    <div className="card bg-dark position-relative">
                      <div className="card-body">
                        <div className="d-flex align-items-center row-gap-3 mb-3">
                          <div className="avatar avatar-xxl rounded flex-shrink-0 me-3">
                            {student?.photo_url ? (
                              <img
                                src={student.photo_url}
                                alt="Profile"
                                className="img-fluid rounded"
                                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                              />
                            ) : (
                              <ImageWithBasePath
                                src="assets/img/students/student-13.jpg"
                                alt="Img"
                              />
                            )}
                          </div>
                          <div className="d-block">
                            <span className="badge bg-transparent-primary text-primary mb-1">
                              {student?.admission_number ? `#${student.admission_number}` : student?.id ? `#ST${student.id}` : "#ST—"}
                            </span>
                            <h3 className="text-truncate text-white mb-1">
                              {student ? [student.first_name, student.last_name].filter(Boolean).join(" ") || "—" : "—"}
                            </h3>
                            <div className="d-flex align-items-center flex-wrap row-gap-2 text-gray-2">
                              <span className="border-end me-2 pe-2">
                                Class : {student?.class_name && student?.section_name ? `${student.class_name}, ${student.section_name}` : student?.class_name || student?.section_name || "—"}
                              </span>
                              <span>Roll No : {student?.roll_number ?? "—"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between profile-footer flex-wrap row-gap-3 pt-4">
                          <div className="d-flex align-items-center">
                            <h6 className="text-white">Academic Status</h6>
                            <span className="badge bg-success d-inline-flex align-items-center ms-2">
                              <i className="ti ti-circle-filled fs-5 me-1" />
                              Active
                            </span>
                          </div>
                          <Link
                            to={student?.id ? `${routes.studentDetail}/${student.id}` : routes.studentDashboard}
                            state={student ? { student } : undefined}
                            className="btn btn-primary"
                          >
                            View Profile
                          </Link>
                        </div>
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
                    <div className="card flex-fill">
                      <div className="card-header d-flex align-items-center justify-content-between">
                        <h4 className="card-title">Today’s Class</h4>
                        <div className="d-inline-flex align-items-center class-datepick">
                          <DatePicker
                            className="form-control datetimepicker border-0"
                            format={{
                              format: "DD-MM-YYYY",
                              type: "mask",
                            }}
                            value={selectedDate}
                            onChange={(v) => setSelectedDate(v || defaultValue)}
                            placeholder="Select date"
                          />
                        </div>
                      </div>
                      <div className="card-body">
                        {scheduleLoading && (
                          <div className="text-center py-4">
                            <div className="spinner-border spinner-border-sm text-primary" role="status" />
                            <span className="ms-2">Loading schedule...</span>
                          </div>
                        )}
                        {!scheduleLoading && todaysClasses.length === 0 && (
                          <p className="text-muted mb-0">No classes scheduled for this day.</p>
                        )}
                        {!scheduleLoading && todaysClasses?.length > 0 && todaysClasses?.map((cls: { id?: string; subject?: string; startTime?: string; endTime?: string; teacher?: string; classRoom?: string }, idx: number) => (
                          <div key={cls.id ?? idx} className={`card ${idx < todaysClasses.length - 1 ? "mb-3" : "mb-0"}`}>
                            <div className="d-flex align-items-center justify-content-between flex-wrap p-3 pb-1">
                              <div className="d-flex align-items-center flex-wrap mb-2">
                                <span className="avatar avatar-lg flex-shrink-0 rounded me-2 bg-primary-transparent">
                                  <i className="ti ti-book fs-20 text-primary" />
                                </span>
                                <div>
                                  <h6 className="mb-1">{cls.subject || "—"}</h6>
                                  <span>
                                    <i className="ti ti-clock me-2" />
                                    {cls.startTime || "—"} - {cls.endTime || "—"}
                                  </span>
                                </div>
                              </div>
                              {cls.classRoom && (
                                <span className="badge badge-soft-primary shadow-none mb-2">Room: {cls.classRoom}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Profile */}
                {/* Attendance */}
                <div className="col-xl-6 d-flex">
                  <div className="card flex-fill">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h4 className="card-title">Attendance</h4>
                      <div className="dropdown">
                        <button
                          type="button"
                          className="btn btn-light dropdown-toggle"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <i className="ti ti-calendar-due me-2" />
                          {attendanceRange === "thisWeek" ? "This Week" : attendanceRange === "lastWeek" ? "Last Week" : attendanceRange === "allTime" ? "All Time" : "Last Month"}
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => setAttendanceRange("thisWeek")}>
                              This Week
                            </button>
                          </li>
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => setAttendanceRange("lastWeek")}>
                              Last Week
                            </button>
                          </li>
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => setAttendanceRange("lastMonth")}>
                              Last Month
                            </button>
                          </li>
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => setAttendanceRange("allTime")}>
                              All Time
                            </button>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="attendance-chart">
                        <p className="mb-3">
                          <i className="ti ti-calendar-heart text-primary me-2" />
                          Attendance data
                        </p>
                        {attendanceError && (
                          <div className="alert alert-warning mb-3 d-flex align-items-center" role="alert">
                            <i className="ti ti-alert-circle me-2 fs-18" />
                            <span>{attendanceError}</span>
                          </div>
                        )}
                        {attendanceLoading && (
                          <div className="text-center py-3">
                            <div className="spinner-border spinner-border-sm text-primary" role="status" />
                            <span className="ms-2">Loading attendance...</span>
                          </div>
                        )}
                        {!attendanceLoading && !attendanceError && filteredAttendanceData.records.length === 0 && (
                          <div className="alert alert-info mb-0 d-flex align-items-center" role="alert">
                            <i className="ti ti-info-circle me-2 fs-18" />
                            <span>No attendance data available. Attendance records will appear here once available.</span>
                          </div>
                        )}
                        {!attendanceLoading && !attendanceError && filteredAttendanceData.records.length > 0 && (
                          <div className="row g-2">
                            <div className="col-6 col-sm-3">
                              <div className="d-flex align-items-center rounded border p-2">
                                <span className="avatar avatar-sm bg-primary-transparent rounded me-2 flex-shrink-0 text-primary">
                                  <i className="ti ti-user-check fs-14" />
                                </span>
                                <div>
                                  <small className="text-muted d-block">Present</small>
                                  <strong>{filteredAttendanceData.summary?.present ?? 0}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="col-6 col-sm-3">
                              <div className="d-flex align-items-center rounded border p-2">
                                <span className="avatar avatar-sm bg-danger-transparent rounded me-2 flex-shrink-0 text-danger">
                                  <i className="ti ti-user-x fs-14" />
                                </span>
                                <div>
                                  <small className="text-muted d-block">Absent</small>
                                  <strong>{filteredAttendanceData.summary?.absent ?? 0}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="col-6 col-sm-3">
                              <div className="d-flex align-items-center rounded border p-2">
                                <span className="avatar avatar-sm bg-info-transparent rounded me-2 flex-shrink-0 text-info">
                                  <i className="ti ti-clock-half fs-14" />
                                </span>
                                <div>
                                  <small className="text-muted d-block">Half Day</small>
                                  <strong>{filteredAttendanceData.summary?.halfDay ?? 0}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="col-6 col-sm-3">
                              <div className="d-flex align-items-center rounded border p-2">
                                <span className="avatar avatar-sm bg-warning-transparent rounded me-2 flex-shrink-0 text-warning">
                                  <i className="ti ti-clock fs-14" />
                                </span>
                                <div>
                                  <small className="text-muted d-block">Late</small>
                                  <strong>{filteredAttendanceData.summary?.late ?? 0}</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Attendance */}
                {/* Fees */}
                <div className="col-xl-12 d-flex">
                  <div className="row flex-fill">
                    <div className="col-sm-6 col-xl-3 d-flex">
                      <Link
                        to={routes.studentFees}
                        state={student ? { studentId: student.id, student } : undefined}
                        className="card border-0 border-bottom border-primary border-2 flex-fill animate-card"
                      >
                        <div className="card-body">
                          <div className="d-flex align-items-center">
                            <span className="avatar avatar-md rounded bg-primary me-2">
                              <i className="ti ti-report-money fs-16" />
                            </span>
                            <h6>My Fees</h6>
                          </div>
                        </div>
                      </Link>
                    </div>
                    <div className="col-sm-6 col-xl-3 d-flex">
                      <Link
                        to={routes.studentResult}
                        state={student ? { studentId: student.id, student } : undefined}
                        className="card border-0 border-bottom border-success flex-fill animate-card"
                      >
                        <div className="card-body">
                          <div className="d-flex align-items-center">
                            <span className="avatar avatar-md rounded bg-success me-2">
                              <i className="ti ti-hexagonal-prism-plus fs-16" />
                            </span>
                            <h6>Exam Result</h6>
                          </div>
                        </div>
                      </Link>
                    </div>
                    <div className="col-sm-6 col-xl-3 d-flex">
                      <Link
                        to={routes.studentTimeTable}
                        state={student ? { studentId: student.id, student } : undefined}
                        className="card border-0 border-bottom border-warning flex-fill animate-card"
                      >
                        <div className="card-body">
                          <div className="d-flex align-items-center">
                            <span className="avatar avatar-md rounded bg-warning me-2">
                              <i className="ti ti-calendar fs-16" />
                            </span>
                            <h6>Time Table</h6>
                          </div>
                        </div>
                      </Link>
                    </div>
                    <div className="col-sm-6 col-xl-3 d-flex">
                      <Link
                        to={routes.studentLeaves}
                        state={student ? { studentId: student.id, student } : undefined}
                        className="card border-0 border-bottom border-dark border-2 flex-fill animate-card"
                      >
                        <div className="card-body">
                          <div className="d-flex align-items-center">
                            <span className="avatar avatar-md rounded bg-dark me-2">
                              <i className="ti ti-calendar-share fs-16" />
                            </span>
                            <h6>Leave &amp; Attendance</h6>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
                {/* /Fees */}
              </div>
            </div>
            {/* Schedules & Events */}
            <div className="col-xxl-4 d-flex flex-column">
              <div className="card flex-fill mb-3">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Schedules</h4>
                  <Link to={routes.studentTimeTable} className="link-primary fw-medium">
                    View All
                  </Link>
                </div>
                <div className="card-body pb-0">
                  <Calendar
                    className="datepickers mb-2 custom-cal-react"
                    value={date}
                    onChange={(e) => setDate(e.value)}
                    inline
                  />
                  <h5 className="mb-3">Exams</h5>
                  <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                    <i className="ti ti-info-circle me-2 fs-18" />
                    <span>No upcoming exam schedule available.</span>
                  </div>
                </div>
              </div>
              <EventsCard
                upcomingEvents={upcomingEvents}
                completedEvents={completedEvents}
                loading={eventsLoading}
                limit={5}
              />
            </div>
            {/* /Schedules & Events */}
          </div>
          <div className="row">
            {/* Performance */}
            <div className="col-xxl-7 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Performance</h4>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <i className="ti ti-calendar me-2" />
                      {performanceYearId === "allTime" ? "All Time" : selectedPerformanceYear?.year_name ?? "Select Year"}
                    </button>
                    <ul className="dropdown-menu mt-2 p-3">
                      {academicYearsList.map((y) => (
                        <li key={y.id}>
                          <button
                            type="button"
                            className="dropdown-item rounded-1"
                            onClick={() => setPerformanceYearId(String(y.id))}
                          >
                            {y.year_name}
                          </button>
                        </li>
                      ))}
                      <li>
                        <button
                          type="button"
                          className="dropdown-item rounded-1"
                          onClick={() => setPerformanceYearId("allTime")}
                        >
                          All Time
                        </button>
                      </li>
                      {academicYearsList.length === 0 && (
                        <li>
                          <span className="dropdown-item text-muted">No academic years</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="card-body pb-0">
                  <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                    <i className="ti ti-info-circle me-2 fs-18" />
                    <span>No performance data available. Exam scores and attendance trends will appear here.</span>
                  </div>
                </div>
              </div>
            </div>
            {/* /Performance */}
            {/* Home Works */}
            <div className="col-xxl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Home Works</h4>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <i className="ti ti-book-2 me-2" />
                      {homeWorkSubject === "allTime" ? "All Time" : homeWorkSubject === "all" ? "All Subject" : homeWorkSubject}
                    </button>
                    <ul className="dropdown-menu mt-2 p-3">
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setHomeWorkSubject("allTime")}>
                          All Time
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setHomeWorkSubject("all")}>
                          All Subject
                        </button>
                      </li>
                      {homeWorkSubjects.map((subj) => (
                        <li key={subj}>
                          <button
                            type="button"
                            className="dropdown-item rounded-1"
                            onClick={() => setHomeWorkSubject(subj)}
                          >
                            {subj}
                          </button>
                        </li>
                      ))}
                      {homeWorkSubjects.length === 0 && (
                        <li>
                          <span className="dropdown-item text-muted">No subjects in schedule</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="card-body py-1">
                  <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                    <i className="ti ti-info-circle me-2 fs-18" />
                    <span>No homework assigned. Homework will appear here once assigned.</span>
                  </div>
                </div>
              </div>
            </div>
            {/* /Home Works */}
          </div>
          <div className="row">
            {/* Class Faculties */}
            <div className="col-xl-12">
              <div className="card flex-fill">
                <div className="card-header">
                  <h4 className="card-title">Class Faculties</h4>
                </div>
                <div className="card-body">
                  {(!classFaculties || classFaculties.length === 0) && (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No class faculty data available.</span>
                    </div>
                  )}
                  {classFaculties?.length > 0 && (
                    <div className="row g-3">
                      {classFaculties?.map((fac: { teacher?: string; subject?: string }, idx: number) => (
                        <div key={idx} className="col-sm-6 col-md-4 col-xl-3">
                          <div className="card bg-light-100 mb-0 h-100">
                            <div className="card-body">
                              <div className="d-flex align-items-center mb-3">
                                <span className="avatar avatar-lg rounded me-2 bg-primary-transparent">
                                  <i className="ti ti-user fs-20 text-primary" />
                                </span>
                                <div className="overflow-hidden">
                                  <h6 className="mb-1 text-truncate">{fac.teacher || "—"}</h6>
                                  <p className="mb-0">{fac.subject || "—"}</p>
                                </div>
                              </div>
                              <div className="row gx-2">
                                <div className="col-6">
                                  <Link
                                    to="#"
                                    className="btn btn-outline-light bg-white d-flex align-items-center justify-content-center fw-semibold fs-12"
                                  >
                                    <i className="ti ti-mail me-2" />
                                    Email
                                  </Link>
                                </div>
                                <div className="col-6">
                                  <Link
                                    to="#"
                                    className="btn btn-outline-light bg-white d-flex align-items-center justify-content-center fw-semibold fs-12"
                                  >
                                    <i className="ti ti-message-chatbot me-2" />
                                    Chat
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Class Faculties */}
          </div>
          <div className="row">
            {/* Leave Status */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Leave Status</h4>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <i className="ti ti-calendar me-2" />
                      {leaveRange === "thisMonth" ? "This Month" : leaveRange === "thisYear" ? "This Year" : leaveRange === "allTime" ? "All Time" : "Last Week"}
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
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setLeaveRange("allTime")}>
                          All Time
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  {leaveLoading && (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                    </div>
                  )}
                  {!leaveLoading && filteredLeaves.length === 0 && (
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
            {/* Exam Result */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Exam Result</h4>
                  <Link to={routes.studentResult} state={student ? { studentId: student.id, student } : undefined} className="link-primary fw-medium">
                    View All
                  </Link>
                </div>
                <div className="card-body pb-0">
                  {examResultsData?.exams?.length ? (
                    <div>
                      {examResultsData.exams.slice(0, 3).map((exam: { examId?: number; examName?: string; examLabel?: string; subjects?: Array<{ subjectName?: string }>; summary?: { percentage?: number; overallResult?: string } }, idx: number) => {
                        const subjectNames = (exam.subjects || []).map((s: { subjectName?: string }) => s.subjectName).filter(Boolean).join(", ");
                        return (
                          <div key={exam.examId ?? idx} className="d-flex align-items-center justify-content-between mb-3">
                            <div>
                              <h6 className="mb-1">{exam.examLabel || exam.examName || `Exam ${idx + 1}`}</h6>
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
                      {examResultsData.exams.length > 3 && (
                        <p className="mb-0 small text-muted">+{examResultsData.exams.length - 3} more</p>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No exam results available. Results will appear here after exams.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Exam Result */}
            {/* Fees Reminder */}
            <div className="col-xxl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Fees Reminder</h4>
                  <Link to={routes.studentFees} state={student ? { studentId: student.id, student } : undefined} className="link-primary fw-medium">
                    View All
                  </Link>
                </div>
                <div className="card-body py-1">
                  {feeData ? (
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
                          Please pay outstanding amount.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No fees data available. Fee reminders will appear here.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Fees Reminder */}
          </div>
          <div className="row">
            {/* Notice Board */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header  d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Notice Board</h4>
                  <Link to={routes.noticeBoard} className="fw-medium">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {upcomingEvents?.length > 0 ? (
                    <div className="notice-widget">
                      {upcomingEvents.slice(0, 5).map((evt: { id?: number; title?: string; start_date?: string }) => (
                        <div key={evt.id} className="d-flex align-items-center justify-content-between mb-4">
                          <div className="d-flex align-items-center overflow-hidden me-2">
                            <span className="bg-primary-transparent avatar avatar-md me-2 rounded-circle flex-shrink-0">
                              <i className="ti ti-calendar fs-16" />
                            </span>
                            <div className="overflow-hidden">
                              <h6 className="text-truncate mb-1">{evt.title || "Event"}</h6>
                              <p className="mb-0">
                                <i className="ti ti-calendar me-2" />
                                {evt.start_date ? new Date(evt.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              </p>
                            </div>
                          </div>
                          <Link to={routes.events}>
                            <i className="ti ti-chevron-right fs-16" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No notices or events available.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Notice Board */}
            {/* Syllabus */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header  d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Syllabus</h4>
                </div>
                <div className="card-body">
                  {mySyllabus.length === 0 && (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No syllabus data available for your class.</span>
                    </div>
                  )}
                  {mySyllabus.length > 0 && (
                    <ul className="list-group">
                      {mySyllabus.map((s: { id?: string; subjectGroup?: string; subject_group?: string; status?: string; createdDate?: string; created_at?: string }, idx: number) => {
                        const subjGroup = s.subjectGroup || s.subject_group || "Syllabus";
                        const createdDate = s.createdDate || s.created_at;
                        return (
                          <li key={s.id ?? idx} className="list-group-item">
                            <div className="row align-items-center">
                              <div className="col-sm-6">
                                <p className="text-dark mb-0">{subjGroup}</p>
                                {createdDate && <small className="text-muted">{createdDate}</small>}
                              </div>
                              <div className="col-sm-6 text-end">
                                <span className={`badge ${s.status === "Active" ? "badge-soft-success" : "badge-soft-secondary"}`}>
                                  {s.status || "Active"}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            {/* /Syllabus */}
            {/* Todo */}
            <div className="col-xxl-4 col-xl-12 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Todo</h4>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <i className="ti ti-calendar me-2" />
                      {todoRange === "today" ? "Today" : todoRange === "thisWeek" ? "This Week" : todoRange === "thisMonth" ? "This Month" : todoRange === "allTime" ? "All Time" : "This Year"}
                    </button>
                    <ul className="dropdown-menu mt-2 p-3">
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setTodoRange("today")}>
                          Today
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setTodoRange("thisWeek")}>
                          This Week
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setTodoRange("thisMonth")}>
                          This Month
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setTodoRange("thisYear")}>
                          This Year
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item rounded-1" onClick={() => setTodoRange("allTime")}>
                          All Time
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  {!filteredTodos?.length && (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No todo items for selected period.</span>
                    </div>
                  )}
                  {filteredTodos?.length > 0 && (
                    <ul className="list-group list-group-flush todo-list">
                      {filteredTodos.slice(0, 8).map((todo: { id?: number; title?: string; due_date?: string; status?: string }) => {
                        const st = String(todo.status || "pending").toLowerCase();
                        const badgeClass =
                          st === "done" || st === "completed" ? "badge-soft-success" :
                            st === "in_progress" || st === "inprogress" ? "badge-soft-skyblue" :
                              "badge-soft-warning";
                        const badgeLabel =
                          st === "done" || st === "completed" ? "Completed" :
                            st === "in_progress" || st === "inprogress" ? "Inprogress" :
                              "Yet to Start";
                        const dueTime = todo.due_date ? new Date(todo.due_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
                        return (
                          <li key={todo.id} className="list-group-item py-3 px-0">
                            <div className="d-sm-flex align-items-center justify-content-between">
                              <div className={`d-flex align-items-center overflow-hidden me-2 ${st === "done" || st === "completed" ? "todo-strike-content" : ""}`}>
                                <div className="form-check form-check-md me-2">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    defaultChecked={st === "done" || st === "completed"}
                                    readOnly
                                  />
                                </div>
                                <div className="overflow-hidden">
                                  <h6 className="mb-1 text-truncate">{todo.title || "—"}</h6>
                                  {dueTime && <p className="mb-0 fs-12">{dueTime}</p>}
                                </div>
                              </div>
                              <span className={`badge ${badgeClass} mt-2 mt-sm-0`}>{badgeLabel}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            {/* /Todo */}
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default StudentDasboard;
