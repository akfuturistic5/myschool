import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { selectUser } from "../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { getDashboardForRole } from "../../../core/utils/roleUtils";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import { formatRosterHolidayStatus } from "./rosterHolidayLabels";
import { exportAttendanceExcel, exportAttendancePdf } from "../../report/attendance-report/exportUtils";

const statusClassMap: Record<string, string> = {
  present: "bg-success",
  late: "bg-pending",
  half_day: "bg-dark",
  absent: "bg-danger",
  holiday: "bg-info",
  weekly_holiday: "bg-info",
};
const statusShortLabel = (status: string | null | undefined) => {
  const s = String(status || "").trim().toLowerCase();
  if (s === "present") return "P";
  if (s === "late") return "L";
  if (s === "absent") return "A";
  if (s === "holiday" || s === "weekly_holiday") return "H";
  if (s === "half_day" || s === "halfday") return "F";
  return "";
};
const formatStatusLabel = (status: string | null | undefined) => {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "Not Marked";
  if (s === "weekly_holiday") return "Weekly holiday";
  if (s === "holiday") return "Holiday";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
};

const getTodayLocalYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const StudentAttendanceReport = () => {
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const role = (user?.role || "").toLowerCase();
  const roleId = Number(user?.user_role_id ?? user?.role_id);
  const isTeacher = role === "teacher" || roleId === 2;
  const dashboardRoute = getDashboardForRole(role);
  const today = getTodayLocalYMD();

  const [mode, setMode] = useState<"month" | "day">("month");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [attendanceMonth, setAttendanceMonth] = useState(today.slice(0, 7));
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [teacherScopeRows, setTeacherScopeRows] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  const [reportData, setReportData] = useState<any>({ month: attendanceMonth, days: [], rows: [] });
  const [dayRows, setDayRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { classes } = useClasses(academicYearId);
  const { sections } = useSections(isTeacher ? null : classId);

  useEffect(() => {
    let cancelled = false;
    const loadTeacherScope = async () => {
      if (!isTeacher) {
        setTeacherScopeRows([]);
        return;
      }
      try {
        const response = await apiService.getTeacherStudents(academicYearId);
        const scoped = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) setTeacherScopeRows(scoped);
      } catch {
        if (!cancelled) setTeacherScopeRows([]);
      }
    };
    loadTeacherScope();
    return () => {
      cancelled = true;
    };
  }, [isTeacher, academicYearId]);

  const classOptions = useMemo(() => {
    if (!isTeacher) return classes || [];
    const map = new Map<number, any>();
    (teacherScopeRows || []).forEach((row: any) => {
      const cid = Number(row?.class_id);
      if (!Number.isFinite(cid) || map.has(cid)) return;
      map.set(cid, { id: cid, class_name: row?.class_name || `Class ${cid}` });
    });
    return Array.from(map.values());
  }, [isTeacher, classes, teacherScopeRows]);

  const sectionOptions = useMemo(() => {
    if (!isTeacher) return sections || [];
    const map = new Map<number, any>();
    (teacherScopeRows || [])
      .filter((row: any) => (classId == null ? true : Number(row?.class_id) === Number(classId)))
      .forEach((row: any) => {
        const sid = Number(row?.section_id);
        if (!Number.isFinite(sid) || map.has(sid)) return;
        map.set(sid, { id: sid, section_name: row?.section_name || `Section ${sid}` });
      });
    return Array.from(map.values());
  }, [isTeacher, sections, teacherScopeRows, classId]);

  useEffect(() => {
    if (!isTeacher) return;
    if (classId == null && classOptions.length > 0) {
      setClassId(Number(classOptions[0].id));
    }
  }, [isTeacher, classId, classOptions]);

  useEffect(() => {
    if (!isTeacher) return;
    if (sectionId != null && !sectionOptions.some((s: any) => Number(s.id) === Number(sectionId))) {
      setSectionId(null);
    }
  }, [isTeacher, sectionOptions, sectionId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (mode === "day") {
          const res = await apiService.getAttendanceMarkingRoster("student", {
            date: attendanceDate,
            classId,
            sectionId,
            academicYearId,
          });
          if (!cancelled) {
            const rows = Array.isArray(res?.data) ? res.data : [];
            setDayRows(rows);
          }
          return;
        }

        const res = await apiService.getAttendanceReport({
          classId,
          sectionId,
          academicYearId,
          month: attendanceMonth,
        });
        if (!cancelled) {
          setReportData(res?.data || { month: attendanceMonth, days: [], rows: [] });
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to load attendance report");
        setDayRows([]);
        setReportData({ month: attendanceMonth, days: [], rows: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mode, attendanceDate, attendanceMonth, classId, sectionId, academicYearId]);

  const reportReturnTo = useMemo(() => {
    const search = new URLSearchParams();
    search.set("mode", mode);
    if (mode === "day") search.set("date", attendanceDate);
    if (mode === "month") search.set("month", attendanceMonth);
    if (classId != null) search.set("classId", String(classId));
    if (sectionId != null) search.set("sectionId", String(sectionId));
    if (academicYearId != null) search.set("academicYearId", String(academicYearId));
    return `${all_routes.studentAttendanceReport}?${search.toString()}`;
  }, [mode, attendanceDate, attendanceMonth, classId, sectionId, academicYearId]);

  const dayTableData = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = (dayRows || []).map((r: any) => ({
      key: r.entity_id,
      studentId: r.entity_id,
      name: r.entity_name,
      status: r.status || "",
      checkInTime: r.check_in_time,
      checkOutTime: r.check_out_time,
      remark: r.remark || "",
    }));
    if (!q) return list;
    return list.filter((r: any) => String(r.name || "").toLowerCase().includes(q));
  }, [dayRows, studentSearch]);

  const dayColumns = useMemo(
    () => [
      {
        title: "Student",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <Link
            to={`${all_routes.studentLeaves}?studentId=${record.studentId}`}
            state={{ studentId: record.studentId, activeTab: "attendance", returnTo: reportReturnTo }}
            className="fw-semibold"
          >
            {text || "—"}
          </Link>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (s: string) => formatRosterHolidayStatus(s) || formatStatusLabel(s),
      },
      { title: "Check In", dataIndex: "checkInTime", render: (v: string) => (v ? String(v).slice(0, 5) : "—") },
      { title: "Check Out", dataIndex: "checkOutTime", render: (v: string) => (v ? String(v).slice(0, 5) : "—") },
      { title: "Remark", dataIndex: "remark", render: (v: string) => (v && v.trim() ? v : "—") },
    ],
    [reportReturnTo]
  );

  const reportRows = useMemo(
    () =>
      (Array.isArray(reportData?.rows) ? reportData.rows : [])
        .map((row: any, index: number) => ({
          key: row.studentId ?? `attendance-report-${index}`,
          ...row,
        }))
        .filter((row: any) =>
          studentSearch.trim()
            ? String(row.name || "").toLowerCase().includes(studentSearch.trim().toLowerCase())
            : true
        ),
    [reportData, studentSearch]
  );

  const reportDayColumns = useMemo(
    () =>
      (Array.isArray(reportData?.days) ? reportData.days : []).map((day: any) => ({
        title: (
          <div className="text-center">
            <span className="day-num d-block">{String(day.day).padStart(2, "0")}</span>
            <span>{String(day.weekdayShort || "").charAt(0)}</span>
          </div>
        ),
        key: day.date,
        render: (_text: any, record: any) => {
          const status = record.daily?.[day.date];
          const cls = status ? statusClassMap[status] || "bg-light" : "";
          const short = statusShortLabel(status);
          return (
            <span
              className={`attendance-range ${cls}`.trim()}
              style={
                !status
                  ? { opacity: 0.15, width: 22, height: 18, display: "inline-flex" }
                  : {
                      width: 22,
                      height: 18,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                    }
              }
              title={status ? `${day.date}: ${formatStatusLabel(status)}` : `${day.date}: Not Marked`}
            >
              {short}
            </span>
          );
        },
      })),
    [reportData]
  );

  const reportColumns = useMemo(
    () => [
      {
        title: "Student/Date",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <div>
            <p className="text-dark mb-0">
              <Link
                to={`${all_routes.studentLeaves}?studentId=${record.studentId}`}
                state={{
                  studentId: record.studentId,
                  activeTab: "attendance",
                  returnTo: reportReturnTo,
                }}
                className="fw-semibold"
              >
                {text || "—"}
              </Link>
            </p>
            <span className="fs-12">Roll No : {record.rollNo || "—"}</span>
          </div>
        ),
      },
      {
        title: "%",
        key: "percentage",
        render: (_: any, record: any) => (
          <span className={Number(record.summary?.percentage ?? 0) >= 75 ? "text-success" : "text-danger"}>
            {record.summary?.percentage ?? 0}%
          </span>
        ),
      },
      { title: "P", key: "present", render: (_: any, record: any) => record.summary?.present ?? 0 },
      { title: "L", key: "late", render: (_: any, record: any) => record.summary?.late ?? 0 },
      { title: "A", key: "absent", render: (_: any, record: any) => record.summary?.absent ?? 0 },
      { title: "H", key: "holiday", render: (_: any, record: any) => record.summary?.holiday ?? 0 },
      { title: "F", key: "halfDay", render: (_: any, record: any) => record.summary?.halfDay ?? 0 },
      ...reportDayColumns,
    ],
    [reportDayColumns, reportReturnTo]
  );

  const reportExportRows = useMemo(() => {
    const dayKeys = (Array.isArray(reportData?.days) ? reportData.days : []).map((d: any) => d?.date).filter(Boolean);
    return reportRows.map((row: any) => {
      const base: Record<string, any> = {
        Student: row.name || "",
        RollNo: row.rollNo || "",
        Percentage: row.summary?.percentage ?? 0,
        Present: row.summary?.present ?? 0,
        Late: row.summary?.late ?? 0,
        Absent: row.summary?.absent ?? 0,
        Holiday: row.summary?.holiday ?? 0,
        HalfDay: row.summary?.halfDay ?? 0,
      };
      dayKeys.forEach((day) => {
        base[day] = formatStatusLabel(row.daily?.[day]);
      });
      return base;
    });
  }, [reportData, reportRows]);

  const dayExportRows = useMemo(
    () =>
      dayTableData.map((row: any) => ({
        Student: row.name || "",
        Status: formatRosterHolidayStatus(row.status) || formatStatusLabel(row.status),
        CheckIn: row.checkInTime ? String(row.checkInTime).slice(0, 5) : "",
        CheckOut: row.checkOutTime ? String(row.checkOutTime).slice(0, 5) : "",
        Remark: row.remark || "",
      })),
    [dayTableData]
  );

  const handleExportPdf = () => {
    try {
      if (mode === "day") {
        exportAttendancePdf(`Student Attendance Report (${attendanceDate})`, `student-attendance-day-${attendanceDate}`, dayExportRows);
        return;
      }
      exportAttendancePdf(`Student Attendance Report (${attendanceMonth})`, `student-attendance-month-${attendanceMonth}`, reportExportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  const handleExportExcel = () => {
    try {
      if (mode === "day") {
        exportAttendanceExcel(`student-attendance-day-${attendanceDate}`, dayExportRows);
        return;
      }
      exportAttendanceExcel(`student-attendance-month-${attendanceMonth}`, reportExportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Student Attendance Report</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={dashboardRoute}>Dashboard</Link></li>
                <li className="breadcrumb-item active" aria-current="page">Student Attendance Report</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="row g-2">
              <div className="col-md-2">
                <label className="form-label">Mode</label>
                <select className="form-select" value={mode} onChange={(e) => setMode((e.target.value as "day" | "month") || "month")}>
                  <option value="month">Monthly</option>
                  <option value="day">Particular Day</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">{mode === "day" ? "Date" : "Month"}</label>
                {mode === "day" ? (
                  <input
                    type="date"
                    className="form-control"
                    value={attendanceDate}
                    max={today}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAttendanceDate(next && next > today ? today : next);
                    }}
                  />
                ) : (
                  <input
                    type="month"
                    className="form-control"
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value || today.slice(0, 7))}
                  />
                )}
              </div>
              <div className="col-md-3">
                <label className="form-label">Class</label>
                <select className="form-select" value={classId ?? ""} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}>
                  {!isTeacher && <option value="">All Classes</option>}
                  {classOptions.map((c: any) => <option key={c.id} value={c.id}>{c.class_name || c.name || `Class ${c.id}`}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Section</label>
                <select className="form-select" value={sectionId ?? ""} onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">All Sections</option>
                  {sectionOptions.map((s: any) => <option key={s.id} value={s.id}>{s.section_name || s.name || `Section ${s.id}`}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Student name"
                />
              </div>
            </div>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {loading ? (
              <div className="text-muted">Loading attendance report...</div>
            ) : mode === "day" ? (
              <Table dataSource={dayTableData} columns={dayColumns as any} Selection={false} />
            ) : (
              <Table dataSource={reportRows} columns={reportColumns as any} Selection={false} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAttendanceReport;
