import { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import AdminDashboardModal from "../adminDashboard/adminDashboardModal";
import ReactApexChart from "react-apexcharts";
import { Calendar } from "primereact/calendar";
import type { Nullable } from "primereact/ts-helpers";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import { useCurrentTeacher } from "../../../core/hooks/useCurrentTeacher";
import { useTeacherRoutine } from "../../../core/hooks/useTeacherRoutine";
import { useTeacherClassAttendance } from "../../../core/hooks/useTeacherClassAttendance";
import { useClassSyllabus } from "../../../core/hooks/useClassSyllabus";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";
import { useEvents } from "../../../core/hooks/useEvents";
import { useDashboardStarStudents } from "../../../core/hooks/useDashboardData";
import { useAuthAvatar } from "../../../core/hooks/useAuthAvatar";
import HolidayDashboardCard from "../shared/HolidayDashboardCard";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const normalizeText = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeClassName = (value?: string | null) =>
  normalizeText(value)
    .replace(/^class\s*/i, "")
    .replace(/[^a-z0-9]/g, "");

const normalizeSectionName = (value?: string | null) =>
  normalizeText(value)
    .replace(/^section\s*/i, "")
    .replace(/[^a-z0-9]/g, "");

const buildClassSectionKey = (className?: string | null, sectionName?: string | null) =>
  `${normalizeClassName(className)}|${normalizeSectionName(sectionName)}`;

const normalizeSubjectToken = (value?: string | null) =>
  normalizeText(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitSubjectTokens = (value?: string | null) => {
  const normalized = normalizeSubjectToken(value);
  if (!normalized) return [];
  return normalized
    .split(/,|\/| and /)
    .map((token) => token.trim())
    .filter(Boolean);
};

type TeacherProfile = {
  id?: number;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  employee_code?: string;
  class_name?: string;
  section_name?: string;
};

type AttendanceSummary = {
  present?: number;
  absent?: number;
  halfDay?: number;
  late?: number;
};

type AttendancePayload = {
  records?: any[];
  summary?: AttendanceSummary;
};

const TeacherDashboard = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [date, setDate] = useState<Nullable<Date>>(null);

  const [selectedClass, setSelectedClass] = useState<string>("All Classes");
  const [selectedSection, setSelectedSection] = useState<string>("All Sections");
  const [leaveTimeRange, setLeaveTimeRange] = useState<string>("This Month");

  const [attendanceRange, setAttendanceRange] = useState<"thisWeek" | "lastWeek" | "lastMonth" | "allTime">("thisWeek");
  const attendanceOptions = {
    thisWeek: { days: 7, offset: 0, label: "This Week" },
    lastWeek: { days: 7, offset: 7, label: "Last Week" },
    lastMonth: { days: 30, offset: 0, label: "Last Month" },
    allTime: { days: 0, offset: 0, label: "All Time" },
  } as const;

  const { teacher, loading: teacherLoading, error: teacherError } = useCurrentTeacher() as {
    teacher: TeacherProfile | null;
    loading: boolean;
    error: string | null;
  };
  const { avatarSrc: authAvatarSrc, hasAvatar: hasAuthAvatar } = useAuthAvatar();
  const { routine, loading: routineLoading } = useTeacherRoutine(teacher?.id ?? null, { academicYearId });
  const selectedAttendanceRange = attendanceOptions[attendanceRange];
  const { data: attendanceData, loading: attendanceLoading, error: attendanceError } = useTeacherClassAttendance(
    teacher?.id ?? null,
    { days: selectedAttendanceRange.days, offset: selectedAttendanceRange.offset, academicYearId } as any
  ) as { data: AttendancePayload | null; loading: boolean; error: string | null };
  const { data: syllabusData, loading: syllabusLoading } = useClassSyllabus({ academicYearId }) as {
    data: any[];
    loading: boolean;
  };
  const { leaveApplications: myLeaves, loading: leaveLoading } = useLeaveApplications({ studentOnly: true, limit: 10 });
  const { upcomingEvents, completedEvents, loading: eventsLoading, refetch: refetchEvents } = useEvents({ forDashboard: true, limit: 5 }) as {
    upcomingEvents: any[];
    completedEvents: any[];
    loading: boolean;
    refetch: () => void;
  };
  const { students: topStudents, loading: topStudentsLoading, error: topStudentsError } = useDashboardStarStudents({
    limit: 3,
    academicYearId,
  }) as { students: any[]; loading: boolean; error: string | null };
  const {
    students: marksStudents,
    loading: marksStudentsLoading,
    error: marksStudentsError,
  } = useDashboardStarStudents({
    limit: 100,
    academicYearId,
    className: selectedClass !== "All Classes" ? selectedClass : undefined,
    sectionName: selectedSection !== "All Sections" ? selectedSection : undefined,
  }) as { students: any[]; loading: boolean; error: string | null };

  const uniqueClasses = useMemo(() => {
    if (!routine?.length) return [];
    return [...new Set(routine.map((r: any) => r.class?.trim()).filter(Boolean))];
  }, [routine]);

  const uniqueSections = useMemo(() => {
    if (!routine?.length) return [];
    let filtered = routine;
    if (selectedClass !== "All Classes") {
      filtered = routine.filter((r: any) => r.class?.trim() === selectedClass);
    }
    return [...new Set(filtered.map((r: any) => r.section?.trim()).filter(Boolean))];
  }, [routine, selectedClass]);

  const filteredLeaves = useMemo(() => {
    if (!myLeaves?.length) return [];
    if (leaveTimeRange === "All Time") return myLeaves;

    const now = new Date();
    return myLeaves.filter((leave: any) => {
      const d = leave.startDate ? new Date(leave.startDate) : (leave.applyOn ? new Date(leave.applyOn) : null);
      if (!d || isNaN(d.getTime())) return true;

      if (leaveTimeRange === "This Month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (leaveTimeRange === "This Year") {
        return d.getFullYear() === now.getFullYear();
      }
      if (leaveTimeRange === "Last Week") {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= lastWeek && d <= now;
      }
      return true;
    });
  }, [myLeaves, leaveTimeRange]);

  // Teacher's class IDs from routine (unique class+section combos they teach)
  const teacherClassSectionKeys = useMemo(() => {
    if (!routine?.length) return new Set<string>();
    const keys = new Set<string>();
    routine.forEach((r: { class?: string; section?: string }) => {
      const key = buildClassSectionKey(r.class, r.section);
      if (key !== "|") keys.add(key);
    });
    return keys;
  }, [routine]);

  const teacherSubjects = useMemo(() => {
    if (!routine?.length) return new Set<string>();
    const subjects = new Set<string>();
    routine.forEach((r: { subject?: string }) => {
      splitSubjectTokens(r.subject).forEach((token) => subjects.add(token));
    });
    return subjects;
  }, [routine]);

  // Syllabus for teacher's classes
  const mySyllabus = useMemo(() => {
    if (!syllabusData?.length) return [];
    return syllabusData.filter(
      (s: { class?: string; section?: string; subjectGroup?: string }) => {
        const classSectionMatch = teacherClassSectionKeys.has(buildClassSectionKey(s.class, s.section));
        if (!classSectionMatch) return false;
        if (!teacherSubjects.size) return true;
        const syllabusTokens = splitSubjectTokens(s.subjectGroup);
        if (!syllabusTokens.length) return true;
        return syllabusTokens.some((token) => teacherSubjects.has(token));
      }
    );
  }, [syllabusData, teacherClassSectionKeys, teacherSubjects]);

  // Syllabus chart: completed vs pending (status=Active = completed-ish, or use a computed %)
  const syllabusChartData = useMemo(() => {
    if (!mySyllabus.length) return { completed: 0, pending: 100 };
    const completed = mySyllabus.filter((s: { status?: string }) => (s.status || "").toLowerCase() === "active").length;
    const pending = mySyllabus.length - completed;
    const total = mySyllabus.length;
    const pctComplete = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed: pctComplete, pending: 100 - pctComplete };
  }, [mySyllabus]);

  // Today's classes - filter routine by selected date's day
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const dayStr = String(today.getDate()).padStart(2, "0");
  const formattedDate = `${month}-${dayStr}-${year}`;
  const defaultValue = dayjs(formattedDate);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(defaultValue);

  const todaysClasses = useMemo(() => {
    if (!routine?.length) return [];
    const dayName = selectedDate ? DAY_NAMES[selectedDate.day()] : DAY_NAMES[today.getDay()];
    return routine.filter((r: { day?: string }) => (r.day || "").toLowerCase() === (dayName || "").toLowerCase());
  }, [routine, selectedDate]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const teacherDisplayName = teacher
    ? [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") || "Teacher"
    : "Teacher";
  const noticeText = upcomingEvents?.[0]?.title
    ? String(upcomingEvents[0].title).trim()
    : null;
  const Syllabus = {
    dots: false,
    autoplay: false,
    arrows: false,
    slidesToShow: 4,
    margin: 24,
    speed: 500,
    responsive: [
      {
        breakpoint: 1500,
        settings: {
          slidesToShow: 4,
        },
      },
      {
        breakpoint: 1400,
        settings: {
          slidesToShow: 4,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 4,
        },
      },
      {
        breakpoint: 800,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 776,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 567,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };
  const studentDonutChart = useMemo(() => ({
    chart: {
      height: 90,
      type: "donut" as const,
      toolbar: { show: false },
      sparkline: { enabled: true },
    },
    grid: { show: false, padding: { left: 0, right: 0 } },
    plotOptions: { bar: { horizontal: false, columnWidth: "50%" } },
    dataLabels: { enabled: false },
    series: [syllabusChartData.completed, syllabusChartData.pending],
    labels: ["Completed", "Pending"],
    legend: { show: false },
    colors: ["#1ABE17", "#E82646"],
    responsive: [
      {
        breakpoint: 480,
        options: { chart: { width: 100 }, legend: { position: "bottom" } },
      },
    ],
  }), [syllabusChartData]);
  const attendanceRecords = attendanceData?.records ?? [];
  const attendanceSummary = attendanceData?.summary ?? {};

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Teacher Dashboard</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.teacherDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Dashboard</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Teacher Dashboard
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          {/* /Page Header */}
          <div className="row">
            <HolidayDashboardCard />
          </div>
          {teacherLoading && (
            <div className="d-flex justify-content-center align-items-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="ms-2">Loading your profile...</span>
            </div>
          )}
          {teacherError && (
            <div className="alert alert-warning mb-3" role="alert">
              <i className="ti ti-alert-circle me-2" />
              {teacherError}
            </div>
          )}
          {!teacherLoading && !teacher && !teacherError && (
            <div className="alert alert-info mb-3" role="alert">
              Teacher profile not found. Please contact admin.
            </div>
          )}
          {/* Greeting Section */}
          <div className="row">
            <div className="col-md-12 d-flex">
              <div className="card flex-fill bg-info bg-03">
                <div className="card-body">
                  <h1 className="text-white mb-1">{greeting} {teacherDisplayName}</h1>
                  <p className="text-white mb-3">Have a good day at work</p>
                  <p className="text-light">
                    {noticeText ? `Notice: ${noticeText}` : "No upcoming notices."}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* /Greeting Section */}
          {/* Teacher-Profile */}
          <div className="row">
            <div className="col-xxl-8 col-xl-12">
              <div className="row">
                <div className="col-xxl-7 col-xl-8 d-flex">
                  <div className="card bg-dark position-relative flex-fill">
                    <div className="card-body pb-1">
                      <div className="d-sm-flex align-items-center justify-content-between row-gap-3">
                        <div className="d-flex align-items-center overflow-hidden mb-3">
                          <div className="avatar avatar-xxl rounded flex-shrink-0 border border-2 border-white me-3">
                            {(hasAuthAvatar || teacher?.photo_url) ? (
                              <img
                                src={hasAuthAvatar ? authAvatarSrc : teacher?.photo_url}
                                alt="Profile"
                                className="img-fluid rounded"
                                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                              />
                            ) : (
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-27.jpg"
                                alt="Default avatar"
                              />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <span className="badge bg-transparent-primary text-primary mb-1">
                              {teacher?.employee_code ? `#${teacher.employee_code}` : teacher?.id ? `#T${teacher.id}` : "#—"}
                            </span>
                            <h3 className="text-white mb-1 text-truncate">
                              {teacherDisplayName}
                            </h3>
                            <div className="d-flex align-items-center flex-wrap text-light row-gap-2">
                              <span className="me-2">
                                Classes : {routine?.length
                                  ? [...new Set(routine.map((r: { class?: string; section?: string }) => `${r.class || ""}-${r.section || ""}`.replace(/^-|-$/g, "")))].filter(Boolean).join(", ") || "—"
                                  : teacher?.class_name ? `${teacher.class_name}${teacher.section_name ? `-${teacher.section_name}` : ""}` : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Link
                          to={routes.teacherDetails}
                          state={teacher?.id ? { teacherId: teacher.id, teacher } : undefined}
                          className="btn btn-primary flex-shrink-0 mb-3"
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
                </div>
                <div className="col-xxl-5 col-xl-4 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body" style={{ minHeight: "170px" }}>
                      <div className="row align-items-center justify-content-between">
                        <div className="col-sm-5">
                          <div
                            id="plan_chart"
                            className="mb-3 mb-sm-0 text-center text-sm-start"
                          ></div>
                          <ReactApexChart
                            id="plan_chart"
                            className="mb-3 mb-sm-0 text-center text-sm-start"
                            options={studentDonutChart}
                            series={studentDonutChart.series}
                            type="donut"
                            height={90}
                          />
                        </div>
                        <div className="col-sm-7">
                          <div className=" text-center text-sm-start">
                            <h4 className="mb-3">Syllabus</h4>
                            <p className="mb-2">
                              <i className="ti ti-circle-filled text-success me-1" />
                              Completed :{" "}
                              <span className="fw-semibold">{syllabusChartData.completed}%</span>
                            </p>
                            <p>
                              <i className="ti ti-circle-filled text-danger me-1" />
                              Pending : <span className="fw-semibold">{syllabusChartData.pending}%</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Today's Class */}
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <h4 className="me-2">Today's Class</h4>
                    <div className="owl-nav slide-nav2 text-end nav-control" />
                  </div>
                  <div className="d-inline-flex align-items-center class-datepick">
                    <span className="icon">
                      <i className="ti ti-chevron-left" />
                    </span>
                    {/* <input
                      type="text"
                      className="form-control datetimepicker border-0"
                      placeholder="16 May 2024"
                    /> */}
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
                    <span className="icon">
                      <i className="ti ti-chevron-right" />
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  {routineLoading && (
                    <div className="text-center py-4">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                      <span className="ms-2">Loading schedule...</span>
                    </div>
                  )}
                  {!routineLoading && todaysClasses.length === 0 && (
                    <p className="text-muted mb-0">No classes scheduled for this day.</p>
                  )}
                  {!routineLoading && todaysClasses.length > 0 && (
                    <div className="row g-3">
                      {todaysClasses.map(
                        (
                          cls: {
                            id?: number;
                            class?: string;
                            section?: string;
                            startTime?: string;
                            endTime?: string;
                          },
                          idx: number
                        ) => (
                          <div key={cls.id ?? idx} className="col-md-4 col-sm-6">
                            <div className="bg-light-400 rounded p-3 h-100 d-flex flex-column">
                              <span className="badge badge-primary badge-lg mb-2">
                                <i className="ti ti-clock me-1" />
                                {cls.startTime} - {cls.endTime}
                              </span>
                              <p className="text-dark mb-0">
                                Class {cls.class}
                                {cls.section ? `, ${cls.section}` : ""}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* /Today's Class */}
              <div className="row">
                {/* Attendance */}
                <div className="col-xxl-6 col-xl-6 col-md-6 d-flex">
                  <div className="card flex-fill">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h4 className="card-title">Attendance</h4>
                      <div className="card-dropdown dropdown">
                        <Link
                          to="#"
                          className="dropdown-toggle p-2"
                          data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                          aria-expanded="false"
                          onClick={(e) => e.preventDefault()}
                        >
                          <i className="ti ti-calendar-due" />
                          {selectedAttendanceRange.label}
                        </Link>
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li>
                            <button
                              type="button"
                              className={`dropdown-item ${attendanceRange === "thisWeek" ? "active" : ""}`}
                              onClick={() => setAttendanceRange("thisWeek")}
                            >
                              This Week
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={`dropdown-item ${attendanceRange === "lastWeek" ? "active" : ""}`}
                              onClick={() => setAttendanceRange("lastWeek")}
                            >
                              Last Week
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={`dropdown-item ${attendanceRange === "lastMonth" ? "active" : ""}`}
                              onClick={() => setAttendanceRange("lastMonth")}
                            >
                              Last Month
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={`dropdown-item ${attendanceRange === "allTime" ? "active" : ""}`}
                              onClick={() => setAttendanceRange("allTime")}
                            >
                              All Time
                            </button>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="card-body pb-0">
                      <div className="attendance-chart">
                        <p className="mb-3">
                          <i className="ti ti-calendar-heart text-primary me-2" />
                          Attendance data ({selectedAttendanceRange.label})
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
                        {!attendanceLoading && !attendanceError && attendanceRecords.length === 0 && (
                          <div className="alert alert-info mb-0 d-flex align-items-center" role="alert">
                            <i className="ti ti-info-circle me-2 fs-18" />
                            <span>No attendance data available. Attendance records will appear here once available.</span>
                          </div>
                        )}
                        {!attendanceLoading && !attendanceError && attendanceRecords.length > 0 && (
                          <div className="row g-2">
                            <div className="col-6 col-sm-3">
                              <div className="d-flex align-items-center rounded border p-2">
                                <span className="avatar avatar-sm bg-primary-transparent rounded me-2 flex-shrink-0 text-primary">
                                  <i className="ti ti-user-check fs-14" />
                                </span>
                                <div>
                                  <small className="text-muted d-block">Present</small>
                                  <strong>{attendanceSummary.present ?? 0}</strong>
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
                                  <strong>{attendanceSummary.absent ?? 0}</strong>
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
                                  <strong>{attendanceSummary.halfDay ?? 0}</strong>
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
                                  <strong>{attendanceSummary.late ?? 0}</strong>
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
                {/* Best Performers */}
                <div className="col-xxl-6 col-xl-6 col-md-6 d-flex flex-column">
                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h4 className="card-title">Best Performers</h4>
                      <Link to={routes.examTopPerformers} className="link-primary fw-medium">
                        View All
                      </Link>
                    </div>
                    <div className="card-body pb-1">
                      {topStudentsLoading && (
                        <div className="text-center py-3">
                          <div className="spinner-border spinner-border-sm text-primary" role="status" />
                          <span className="ms-2">Loading best performers...</span>
                        </div>
                      )}
                      {!topStudentsLoading && topStudentsError && (
                        <div className="alert alert-warning mb-0 d-flex align-items-center" role="alert">
                          <i className="ti ti-alert-circle me-2 fs-18" />
                          <span>{topStudentsError}</span>
                        </div>
                      )}
                      {!topStudentsLoading && !topStudentsError && (!topStudents?.length || topStudents.length === 0) && (
                        <div className="alert alert-info mb-0 d-flex align-items-center" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No exam/performance data available. Data will appear once exam results are recorded.</span>
                        </div>
                      )}
                      {!topStudentsLoading && !topStudentsError && topStudents?.length > 0 && (
                        <div>
                          <div className="mb-3 pb-2 border-bottom">
                            <h6 className="mb-1 text-truncate">{topStudents[0].examName || "Latest Exam"}</h6>
                            <p className="text-muted mb-0 small">
                              <i className="ti ti-calendar-event me-1" />
                              {topStudents[0].examDate
                                ? new Date(topStudents[0].examDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                                : "Date unavailable"}
                            </p>
                          </div>
                          {topStudents.map((student: any, idx: number) => (
                            <div key={student.id ?? idx} className="d-flex align-items-center justify-content-between mb-3">
                              <div className="d-flex align-items-center overflow-hidden">
                                <span className="badge bg-primary me-2 flex-shrink-0">#{idx + 1}</span>
                                <div className="avatar avatar-md rounded-circle flex-shrink-0 me-2">
                                  {student.photoUrl ? (
                                    <img
                                      src={student.photoUrl}
                                      alt={student.name || "Student"}
                                      className="img-fluid rounded-circle"
                                      style={{ objectFit: "cover", width: "100%", height: "100%" }}
                                    />
                                  ) : (
                                    <ImageWithBasePath src="assets/img/students/student-01.jpg" alt="Student" />
                                  )}
                                </div>
                                <div className="overflow-hidden">
                                  <h6 className="mb-0 text-truncate">{student.name || "Student"}</h6>
                                  <small className="text-muted text-truncate d-block">{student.classSection || "Class unavailable"}</small>
                                </div>
                              </div>
                              <div className="text-end ms-2">
                                <h6 className="mb-0">{student.percentage != null ? `${student.percentage}%` : "--"}</h6>
                                <small className="text-muted">
                                  {student.marksObtained != null && student.totalMarks != null
                                    ? `${student.marksObtained}/${student.totalMarks}`
                                    : "Marks unavailable"}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* /Best Performers */}
              </div>
              {/* Syllabus */}
              <div className="row">
                <div className="col-md-12">
                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h4 className="card-title">Syllabus / Lesson Plan</h4>
                      <Link
                        to={routes.classSyllabus}
                        className="link-primary fw-medium"
                      >
                        View All
                      </Link>
                    </div>
                    <div className="card-body">
                      {syllabusLoading ? (
                        <div className="alert alert-secondary d-flex align-items-center mb-0" role="status" aria-live="polite">
                          <i className="ti ti-loader-2 me-2 fs-18" />
                          <span>Loading syllabus for your classes...</span>
                        </div>
                      ) : !mySyllabus?.length ? (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No syllabus data for your classes. Syllabus will appear once assigned.</span>
                        </div>
                      ) : (
                        <Slider
                          {...Syllabus}
                          className="owl-carousel owl-theme lesson"
                        >
                          {mySyllabus.map((s: { id?: number; class?: string; section?: string; subjectGroup?: string; status?: string; originalData?: { description?: string } }, idx: number) => {
                            const isActive = (s.status || "").toLowerCase() === "active";
                            const pct = isActive ? 80 : 40;
                            const bgCls = isActive ? "bg-success-transparent" : "bg-warning-transparent";
                            const barCls = isActive ? "bg-success" : "bg-warning";
                            return (
                              <div key={s.id ?? idx} className="item">
                                <div className="card mb-0">
                                  <div className="card-body">
                                    <div className={`${bgCls} rounded p-2 fw-semibold mb-3 text-center`}>
                                      Class {s.class || "—"}, {s.section || "—"}
                                    </div>
                                    <div className="border-bottom mb-3">
                                      <h5 className="mb-3">
                                        {s.subjectGroup || s.originalData?.description || "Syllabus"}
                                      </h5>
                                      <div className="progress progress-xs mb-3">
                                        <div
                                          className={`progress-bar ${barCls}`}
                                          role="progressbar"
                                          style={{ width: `${pct}%` }}
                                          aria-valuenow={pct}
                                          aria-valuemin={0}
                                          aria-valuemax={100}
                                        />
                                      </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                      <Link to={routes.sheduleClasses} className="fw-medium">
                                        <i className="ti ti-edit me-1" />
                                        Reschedule
                                      </Link>
                                      <Link to={routes.classSyllabus} className="link-primary">
                                        <i className="ti ti-share-3 me-1" />
                                        View All
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </Slider>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* /Syllabus */}
            </div>
            {/* Schedules */}
            <div className="col-xxl-4 col-xl-12 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <h4 className="card-title">Schedules</h4>
                </div>
                <div className="card-body">
                  {/* <div className="datepic mb-4" /> */}
                  <Calendar
                    className="datepickers mb-4 custom-cal-react"
                    value={date}
                    onChange={(e) => setDate(e.value)}
                    inline
                  />
                  {/* <DatePicker
                        selected={startDate}
                        onChange={(date:any) => setStartDate(date)}
                        inline
                        /> */}
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h4 className="mb-0">Upcoming Events</h4>
                    <div className="d-flex align-items-center gap-2">
                      <Link to={routes.events} className="link-primary fw-medium">
                        View All
                      </Link>
                    </div>
                  </div>
                  <div className="event-scroll">
                    {eventsLoading && (
                      <div className="text-center py-2">
                        <div className="spinner-border spinner-border-sm text-primary" role="status" />
                        <span className="ms-2">Loading...</span>
                      </div>
                    )}
                    {!eventsLoading && !upcomingEvents?.length && (
                      <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                        <i className="ti ti-info-circle me-2 fs-18" />
                        <span>No upcoming events.</span>
                      </div>
                    )}
                    {!eventsLoading && (upcomingEvents || []).slice(0, 5).map((evt: { id?: number; title?: string; start_date?: string; end_date?: string; event_color?: string; is_all_day?: boolean }, idx: number) => {
                      const start = evt.start_date ? new Date(evt.start_date) : null;
                      const end = evt.end_date ? new Date(evt.end_date) : null;
                      const dateStr = start ? start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                      const endStr = end ? end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
                      const timeStr = evt.is_all_day ? "All day" : start ? start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
                      const borderCls = evt.event_color === "bg-danger" ? "border-danger" : evt.event_color === "bg-success" ? "border-success" : evt.event_color === "bg-info" ? "border-info" : "border-primary";
                      return (
                        <div key={evt.id ?? idx} className={`border-start ${borderCls} border-3 shadow-sm p-3 mb-3`}>
                          <div className="d-flex align-items-center mb-2 pb-2 border-bottom">
                            <span className="avatar p-1 me-2 bg-primary-transparent flex-shrink-0">
                              <i className="ti ti-calendar-event fs-20 text-primary" />
                            </span>
                            <div className="flex-fill">
                              <h6 className="mb-1">{evt.title || "Event"}</h6>
                              <p className="mb-0 d-flex align-items-center">
                                <i className="ti ti-calendar me-1" />
                                {dateStr}{endStr && endStr !== dateStr ? ` - ${endStr}` : ""}
                              </p>
                            </div>
                          </div>
                          {timeStr && (
                            <p className="mb-0">
                              <i className="ti ti-clock me-1" />
                              {timeStr}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {!eventsLoading && (completedEvents || []).length > 0 && (
                    <>
                      <h4 className="mb-3 mt-4">Completed Events</h4>
                      <div className="event-scroll">
                        {(completedEvents || []).slice(0, 3).map((evt: { id?: number; title?: string; start_date?: string; end_date?: string; event_color?: string; is_all_day?: boolean }, idx: number) => {
                          const start = evt.start_date ? new Date(evt.start_date) : null;
                          const end = evt.end_date ? new Date(evt.end_date) : null;
                          const dateStr = start ? start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                          const borderCls = evt.event_color === "bg-danger" ? "border-danger" : evt.event_color === "bg-success" ? "border-success" : "border-secondary";
                          return (
                            <div key={evt.id ?? idx} className={`border-start ${borderCls} border-3 shadow-sm p-3 mb-3 opacity-75`}>
                              <div className="d-flex align-items-center">
                                <span className="avatar p-1 me-2 bg-secondary-transparent flex-shrink-0">
                                  <i className="ti ti-calendar-check fs-20 text-secondary" />
                                </span>
                                <div className="flex-fill">
                                  <h6 className="mb-1">{evt.title || "Event"}</h6>
                                  <p className="mb-0 d-flex align-items-center small">
                                    <i className="ti ti-calendar me-1" />
                                    {dateStr}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* /Schedules */}
          </div>
          {/* Teacher-profile */}
          <div className="row">
            {/* Student Marks */}
            <div className="col-xxl-8 col-xl-7 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap">
                  <h4 className="card-title ">Student Marks</h4>
                  <div className="d-flex align-items-center">
                    <div className="dropdown me-2 ">
                      <Link
                        to="#"
                        className="bg-white dropdown-toggle"
                        data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                      >
                        <i className="ti ti-calendar me-2" />
                        {selectedClass}
                      </Link>
                      <ul className="dropdown-menu mt-2 p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setSelectedClass("All Classes"); }}>
                            All Classes
                          </Link>
                        </li>
                        {uniqueClasses.map((cls, idx) => (
                          <li key={idx}>
                            <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setSelectedClass(String(cls)); }}>
                              {String(cls)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="dropdown me-2">
                      <Link
                        to="#"
                        className="bg-white dropdown-toggle"
                        data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                      >
                        <i className="ti ti-calendar me-2" />
                        {selectedSection}
                      </Link>
                      <ul className="dropdown-menu mt-2 p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setSelectedSection("All Sections"); }}>
                            All Sections
                          </Link>
                        </li>
                        {uniqueSections.map((sec, idx) => (
                          <li key={idx}>
                            <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setSelectedSection(String(sec)); }}>
                              {String(sec)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body px-0">
                  {marksStudentsLoading && (
                    <div className="text-center py-4">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                      <span className="ms-2">Loading marks...</span>
                    </div>
                  )}
                  {!marksStudentsLoading && marksStudentsError && (
                    <div className="alert alert-warning m-3 d-flex align-items-center" role="alert">
                      <i className="ti ti-alert-circle me-2 fs-18" />
                      <span>{marksStudentsError}</span>
                    </div>
                  )}
                  {!marksStudentsLoading && !marksStudentsError && (!marksStudents || marksStudents.length === 0) && (
                    <div className="alert alert-info m-3 d-flex align-items-center" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No student marks data available for selected filters.</span>
                    </div>
                  )}
                  {!marksStudentsLoading && !marksStudentsError && marksStudents?.length > 0 && (
                    <div className="px-3 pb-3">
                      <div className="mb-3 pb-2 border-bottom">
                        <h6 className="mb-1 text-truncate">{marksStudents[0].examName || "Latest Exam"}</h6>
                        <p className="text-muted mb-0 small">
                          <i className="ti ti-calendar-event me-1" />
                          {marksStudents[0].examDate
                            ? new Date(marksStudents[0].examDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                            : "Date unavailable"}
                        </p>
                      </div>
                      <div className="table-responsive">
                        <table className="table mb-0">
                          <thead>
                            <tr>
                              <th style={{ minWidth: "220px" }}>Student</th>
                              <th>Class</th>
                              <th className="text-end">Marks</th>
                              <th className="text-end">Percentage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {marksStudents.map((student: any, idx: number) => (
                              <tr key={student.id ?? idx}>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <span className="badge bg-primary me-2">#{idx + 1}</span>
                                    <span className="text-truncate">{student.name || "Student"}</span>
                                  </div>
                                </td>
                                <td>{student.classSection || "Class unavailable"}</td>
                                <td className="text-end">
                                  {student.marksObtained != null && student.totalMarks != null
                                    ? `${student.marksObtained}/${student.totalMarks}`
                                    : "--"}
                                </td>
                                <td className="text-end">{student.percentage != null ? `${student.percentage}%` : "--"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Student Marks */}
            {/* Leave Status */}
            <div className="col-xxl-4 col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Leave Status</h4>
                  <div className="dropdown">
                    <Link
                      to="#"
                      className="bg-white dropdown-toggle"
                      data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                    >
                      <i className="ti ti-calendar me-2" />
                      {leaveTimeRange}
                    </Link>
                    <ul className="dropdown-menu mt-2 p-3">
                      <li>
                        <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setLeaveTimeRange("This Month"); }}>
                          This Month
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setLeaveTimeRange("This Year"); }}>
                          This Year
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setLeaveTimeRange("Last Week"); }}>
                          Last Week
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1" onClick={(e) => { e.preventDefault(); setLeaveTimeRange("All Time"); }}>
                          All Time
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  {leaveLoading ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                      <span className="ms-2">Loading...</span>
                    </div>
                  ) : !filteredLeaves?.length ? (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No leave applications. Your leave requests will appear here.</span>
                    </div>
                  ) : (
                    filteredLeaves.map((leave: { id?: number; leaveType?: string; leaveRange?: string; status?: string; statusBadgeClass?: string }) => (
                      <div key={leave.id} className="bg-light-300 d-sm-flex align-items-center justify-content-between p-3 mb-3">
                        <div className="d-flex align-items-center mb-2 mb-sm-0">
                          <div className="avatar avatar-lg bg-primary-transparent flex-shrink-0 me-2">
                            <i className="ti ti-calendar-event" />
                          </div>
                          <div>
                            <h6 className="mb-1">{leave.leaveType || "Leave"}</h6>
                            <p className="mb-0">Date : {leave.leaveRange || "—"}</p>
                          </div>
                        </div>
                        <span className={`badge ${leave.statusBadgeClass || "bg-skyblue"} d-inline-flex align-items-center`}>
                          <i className="ti ti-circle-filled fs-5 me-1" />
                          {leave.status || "Pending"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            {/* /Leave Status */}
          </div>
        </div>
      </div>
      <AdminDashboardModal refetchEvents={refetchEvents} />
      {/* /Page Wrapper */}
    </>
  );
};

export default TeacherDashboard;





