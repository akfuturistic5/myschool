import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { selectUser } from "../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { getDashboardForRole, isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import { formatRosterHolidayStatus } from "./rosterHolidayLabels";
import { exportAttendanceExcel, exportAttendancePdf } from "../../report/attendance-report/exportUtils";
import {
  formatAttendanceDayHumanLabel,
  formatAttendanceDayShort,
  getCompoundHolidayAttendancePart,
  isHolidayAttendanceCompound,
} from "../../../core/utils/attendanceReportStatus";

const statusClassMap: Record<string, string> = {
  present: "bg-success",
  late: "bg-pending",
  half_day: "bg-purple",
  halfday: "bg-purple",
  absent: "bg-danger",
  leaved: "bg-secondary",
  holiday: "bg-info",
  weekly_holiday: "bg-info",
};
const statusTextMap: Record<string, string> = {
  present: "P",
  late: "L",
  absent: "A",
  leaved: "LV",
  holiday: "H",
  weekly_holiday: "H",
  half_day: "HD",
  halfday: "HD",
};

const normalizeStatusKey = (status: unknown): string =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_–—−]+/g, "_")
    .replace(/^halfday$/, "half_day");

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
  const roleId = Number(user?.user_role_id);
  const isHeadmaster = isHeadmasterRole(user);
  const isAdministrative = isAdministrativeRole(user);
  const isTeacher = !isHeadmaster && !isAdministrative && (role === "teacher" || roleId === 2);
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

  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);

  const { classes } = useClasses(academicYearId);
  const { sections } = useSections(isTeacher ? null : classId, {
    fetchAllWhenNoClass: false,
    academicYearId,
  });

  useEffect(() => {
    let cancelled = false;
    const loadTeacherScope = async () => {
      if (!isTeacher) {
        setTeacherScopeRows([]);
        return;
      }
      try {
        const response = await (apiService as any).getTeacherStudents(academicYearId);
        const scoped = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) setTeacherScopeRows(scoped);
      } catch {
        if (!cancelled) setTeacherScopeRows([]);
      }
    };
    loadTeacherScope();

    const loadTeacherAssignments = async () => {
      if (!isTeacher || !user) return;
      try {
        const response = await (apiService as any).getClassTeacherAssignments({ 
          teacherId: user.staff_id,
          academicYearId 
        });
        if (!cancelled && response?.success) {
          setTeacherAssignments(response.data || []);
        }
      } catch (err) {
        console.error("Failed to load teacher assignments:", err);
      }
    };
    loadTeacherAssignments();

    return () => {
      cancelled = true;
    };
  }, [isTeacher, academicYearId, user?.staff_id]);

  const classOptions = useMemo(() => {
    if (!isTeacher) return classes || [];
    const map = new Map<number, any>();
    
    // Add classes from students
    (teacherScopeRows || []).forEach((row: any) => {
      const cid = Number(row?.class_id);
      if (!Number.isFinite(cid) || map.has(cid)) return;
      map.set(cid, {
        id: cid,
        class_name: row?.class_name || `Class ${cid}`,
        class_code: row?.class_code || "",
      });
    });

    // Add classes from direct assignments
    (teacherAssignments || []).forEach((a: any) => {
      const cid = Number(a?.classId);
      if (!Number.isFinite(cid) || map.has(cid)) return;
      map.set(cid, {
        id: cid,
        class_name: a?.className || `Class ${cid}`,
        class_code: "",
      });
    });

    return Array.from(map.values());
  }, [isTeacher, classes, teacherScopeRows, teacherAssignments]);

  const sectionOptions = useMemo(() => {
    if (!isTeacher) return sections || [];
    const map = new Map<number, any>();
    
    // From students
    (teacherScopeRows || [])
      .filter((row: any) => (classId == null ? true : Number(row?.class_id) === Number(classId)))
      .forEach((row: any) => {
        const sid = Number(row?.section_id);
        if (!Number.isFinite(sid) || map.has(sid)) return;
        map.set(sid, { id: sid, section_name: row?.section_name || `Section ${sid}` });
      });

    // From direct assignments
    (teacherAssignments || [])
      .filter((a: any) => (classId == null ? true : Number(a?.classId) === Number(classId)))
      .forEach((a: any) => {
        const sid = Number(a?.sectionId);
        if (!Number.isFinite(sid) || map.has(sid)) return;
        map.set(sid, { id: sid, section_name: a?.sectionName || `Section ${sid}` });
      });

    return Array.from(map.values());
  }, [isTeacher, sections, teacherScopeRows, teacherAssignments, classId]);

  const shouldEnableSectionSelect = classId != null;

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

        const res = await apiService.getEntityAttendanceReport("student", {
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

  const getStudentInitials = (name: string) => {
    if (!name) return "S";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const dayTableData = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = (dayRows || []).map((r: any) => ({
      key: r.entity_id,
      studentId: r.entity_id,
      name: r.entity_name,
      roll_number: r.roll_number,
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
        title: "Student Name",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <div className="d-flex align-items-center">
            <div className="avatar avatar-md rounded-circle bg-soft-primary text-primary border-0 me-2 d-flex align-items-center justify-content-center fw-bold">
              {getStudentInitials(text)}
            </div>
            <div>
              <Link
                to={`${all_routes.studentLeaves}?studentId=${record.studentId}`}
                state={{ studentId: record.studentId, activeTab: "attendance", returnTo: reportReturnTo }}
                className="fw-bold text-dark d-block"
              >
                {text || "—"}
              </Link>
              <span className="fs-12 text-muted">Roll No: {record.roll_number || "—"}</span>
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (s: string) => {
          const label = formatRosterHolidayStatus(s) || formatAttendanceDayHumanLabel(s);
          const status = normalizeStatusKey(s);
          const theme = status === 'present' ? 'success' : status === 'absent' ? 'danger' : status === 'late' ? 'warning' : status === 'holiday' ? 'info' : status === 'half_day' ? 'purple' : 'secondary';
          
          return (
            <span className={`badge rounded-pill bg-soft-${theme} text-${theme} px-3 py-2 fw-bold`}>
              {label?.toUpperCase()}
            </span>
          );
        },
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
          key: row.entity_id ?? `attendance-report-${index}`,
          ...row,
        }))
        .filter((row: any) =>
          studentSearch.trim()
            ? String(row.entity_name || "").toLowerCase().includes(studentSearch.trim().toLowerCase())
            : true
        ),
    [reportData, studentSearch]
  );

  const reportDayColumns = useMemo(
    () =>
      (Array.isArray(reportData?.days) ? reportData.days : []).map((day: any) => ({
        title: (
          <div className="text-center p-1">
            <span className="fs-10 d-block text-muted text-uppercase">{day.weekdayShort?.charAt(0)}</span>
            <span className="fw-bold">{String(day.day).padStart(2, "0")}</span>
          </div>
        ),
        key: day.date,
        width: 40,
        render: (_text: any, record: any) => {
          const rawStatus = record.daily?.[day.date];
          const status = normalizeStatusKey(rawStatus);
          if (status === "leaved") {
            return (
              <div className="d-flex justify-content-center">
                <span className="dot bg-secondary" style={{ width: 6, height: 6, borderRadius: '50%' }} />
              </div>
            );
          }
          if (!rawStatus) return <div className="text-center text-light">-</div>;
          
          const theme = status === 'present' ? 'success' : status === 'absent' ? 'danger' : status === 'late' ? 'warning' : status === 'holiday' ? 'info' : status === 'half_day' ? 'purple' : 'secondary';
          const short = formatAttendanceDayShort(status);
          
          return (
            <div className="text-center">
              <span 
                className={`badge bg-soft-${theme} text-${theme} border-0`} 
                style={{ 
                  width: 22, 
                  height: 22, 
                  padding: 0, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '9px', 
                  borderRadius: '4px',
                  backgroundColor: theme === 'purple' ? 'rgba(123, 44, 191, 0.1)' : undefined,
                  color: theme === 'purple' ? '#7b2cbf' : undefined
                }}
                title={formatAttendanceDayHumanLabel(rawStatus)}
              >
                {short}
              </span>
            </div>
          );
        },
      })),
    [reportData]
  );

  const reportColumns = useMemo(
    () => [
      {
        title: "Student Details",
        dataIndex: "entity_name",
        fixed: "left" as const,
        width: 220,
        render: (text: string, record: any) => (
          <div className="d-flex align-items-center">
            <div className="avatar avatar-sm rounded-circle bg-soft-primary text-primary border-0 me-2 d-flex align-items-center justify-content-center fw-bold" style={{ width: 32, height: 32, fontSize: '11px' }}>
              {getStudentInitials(text)}
            </div>
            <div style={{ lineHeight: '1.2' }}>
              <Link
                to={`${all_routes.studentLeaves}?studentId=${record.entity_id}`}
                state={{ studentId: record.entity_id, activeTab: "attendance", returnTo: reportReturnTo }}
                className="fw-bold text-dark d-block fs-13"
              >
                {text || "—"}
              </Link>
              <span className="fs-11 text-muted">Roll No: {record.roll_number || "—"}</span>
            </div>
          </div>
        ),
      },
      {
        title: "Stats",
        key: "stats",
        width: 180,
        render: (_: any, record: any) => {
          const isGood = Number(record.summary?.attendance_percentage ?? 0) >= 75;
          return (
            <div className="d-flex gap-2 align-items-center">
              <span className={`badge bg-soft-${isGood ? 'success' : 'danger'} text-${isGood ? 'success' : 'danger'} fw-bold`}>
                {record.summary?.attendance_percentage ?? 0}%
              </span>
              <div className="fs-11 text-muted">
                P:{record.summary?.present || 0} A:{record.summary?.absent || 0}
              </div>
            </div>
          );
        },
      },
      ...reportDayColumns,
    ],
    [reportDayColumns, reportReturnTo]
  );

  const reportExportRows = useMemo(() => {
    const dayKeys = (Array.isArray(reportData?.days) ? reportData.days : []).map((d: any) => d?.date).filter(Boolean);
    return reportRows.map((row: any) => {
      const base: Record<string, any> = {
        Student: row.entity_name || "",
        RollNo: row.roll_number || "",
        Percentage: row.summary?.percentage ?? 0,
        Present: row.summary?.present ?? 0,
        Late: row.summary?.late ?? 0,
        Absent: row.summary?.absent ?? 0,
      };
      dayKeys.forEach((day) => {
        base[day] = formatAttendanceDayHumanLabel(row.daily?.[day]);
      });
      return base;
    });
  }, [reportData, reportRows]);

  const dayExportRows = useMemo(
    () =>
      dayTableData.map((row: any) => ({
        Student: row.name || "",
        Status: formatRosterHolidayStatus(row.status) || formatAttendanceDayHumanLabel(row.status),
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
        <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1 fw-bold">Student Attendance Report</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={dashboardRoute}>Dashboard</Link></li>
                <li className="breadcrumb-item active" aria-current="page">Attendance Analytics</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4 overflow-hidden" style={{ borderRadius: '15px' }}>
          <div className="card-body p-0">
            <div className="p-4" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
              <div className="row g-3 align-items-end">
                <div className="col-md-2">
                  <label className="form-label fs-12 fw-bold text-uppercase text-muted mb-2">View Mode</label>
                  <div className="btn-group w-100" role="group">
                    <button 
                      type="button" 
                      className={`btn btn-sm ${mode === 'month' ? 'btn-primary shadow-sm' : 'btn-outline-primary'}`}
                      onClick={() => setMode('month')}
                    >Monthly</button>
                    <button 
                      type="button" 
                      className={`btn btn-sm ${mode === 'day' ? 'btn-primary shadow-sm' : 'btn-outline-primary'}`}
                      onClick={() => setMode('day')}
                    >Daily</button>
                  </div>
                </div>
                <div className="col-md-2">
                  <label className="form-label fs-12 fw-bold text-uppercase text-muted mb-2">{mode === "day" ? "Select Date" : "Select Month"}</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0"><i className="ti ti-calendar text-primary"></i></span>
                    {mode === "day" ? (
                      <input type="date" className="form-control border-start-0 ps-0" value={attendanceDate} max={today} onChange={(e) => setAttendanceDate(e.target.value)} />
                    ) : (
                      <input type="month" className="form-control border-start-0 ps-0" value={attendanceMonth} onChange={(e) => setAttendanceMonth(e.target.value)} />
                    )}
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label fs-12 fw-bold text-uppercase text-muted mb-2">Academic Class</label>
                  <select className="form-select form-select-sm border-0 shadow-sm" value={classId ?? ""} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}>
                    {!isTeacher && <option value="">Global Overview</option>}
                    {classOptions.map((c: any) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label fs-12 fw-bold text-uppercase text-muted mb-2">Section</label>
                  <select className="form-select form-select-sm border-0 shadow-sm" value={sectionId ?? ""} disabled={!shouldEnableSectionSelect} onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">{shouldEnableSectionSelect ? "All Sections" : "Select class"}</option>
                    {sectionOptions.map((s: any) => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fs-12 fw-bold text-uppercase text-muted mb-2">Filter Students</label>
                  <div className="input-group input-group-sm shadow-sm rounded">
                    <span className="input-group-text bg-white border-0"><i className="ti ti-search text-muted"></i></span>
                    <input type="text" className="form-control border-0" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Student name..." />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm" style={{ borderRadius: '15px' }}>
          <div className="card-body p-0">
            <div className="px-4 pt-4 pb-2 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex flex-wrap gap-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-soft-success text-success d-flex align-items-center justify-content-center fw-bold" style={{ width: 24, height: 24, borderRadius: '6px' }}>P</span>
                  <span className="fs-12 fw-bold text-muted text-uppercase">Present</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-soft-danger text-danger d-flex align-items-center justify-content-center fw-bold" style={{ width: 24, height: 24, borderRadius: '6px' }}>A</span>
                  <span className="fs-12 fw-bold text-muted text-uppercase">Absent</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-soft-warning text-warning d-flex align-items-center justify-content-center fw-bold" style={{ width: 24, height: 24, borderRadius: '6px' }}>L</span>
                  <span className="fs-12 fw-bold text-muted text-uppercase">Late</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-soft-info text-info d-flex align-items-center justify-content-center fw-bold" style={{ width: 24, height: 24, borderRadius: '6px' }}>H</span>
                  <span className="fs-12 fw-bold text-muted text-uppercase">Holiday</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge d-flex align-items-center justify-content-center fw-bold text-white" style={{ width: 24, height: 24, borderRadius: '6px', backgroundColor: '#7b2cbf' }}>HD</span>
                  <span className="fs-12 fw-bold text-muted text-uppercase">Half Day</span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="dot bg-secondary" style={{ width: 8, height: 8, borderRadius: '50%' }}></span>
                <span className="fs-12 fw-bold text-muted text-uppercase">Leaved Student</span>
              </div>
            </div>
            {error && <div className="alert alert-danger m-3">{error}</div>}
            {loading ? (
              <div className="p-5 text-center">
                <div className="spinner-border text-primary mb-3" role="status" />
                <p className="text-muted">Synthesizing attendance data...</p>
              </div>
            ) : (
                <div className="attendance-report-table custom-scrollbar" style={{ overflowX: 'auto' }}>
                  <Table 
                    dataSource={mode === "day" ? dayTableData : reportRows} 
                    columns={(mode === "day" ? dayColumns : reportColumns) as any} 
                    Selection={false} 
                    pagination={{ pageSize: 15 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <style>{`
          .bg-soft-primary { background-color: rgba(62, 121, 247, 0.1); }
          .bg-soft-success { background-color: rgba(26, 188, 156, 0.1); }
          .bg-soft-danger { background-color: rgba(231, 76, 60, 0.1); }
          .bg-soft-warning { background-color: rgba(243, 156, 18, 0.1); }
          .bg-soft-info { background-color: rgba(52, 152, 219, 0.1); }
          .bg-soft-purple { background-color: rgba(123, 44, 191, 0.1); }
          .text-success { color: #16a34a !important; }
          .text-danger { color: #dc2626 !important; }
          .text-warning { color: #ca8a04 !important; }
          .text-info { color: #0284c7 !important; }
          .text-purple { color: #7b2cbf !important; }
          .attendance-report-table .ant-table { background: transparent; }
          .attendance-report-table .ant-table-thead > tr > th { background: #f8f9fa; font-weight: 700; color: #4b5563; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; white-space: nowrap; }
          .attendance-report-table .ant-table-tbody > tr > td { padding: 12px 8px; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
          .attendance-report-table .ant-table-tbody > tr:hover > td { background: #f9fafb !important; }
          .custom-scrollbar::-webkit-scrollbar { height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #999; }
        `}</style>
    </div>
  );
};

export default StudentAttendanceReport;

