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
import { useDepartments } from "../../../core/hooks/useDepartments";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import { exportAttendanceExcel, exportAttendancePdf } from "../../report/attendance-report/exportUtils";
import {
  formatAttendanceDayHumanLabel,
  formatAttendanceDayShort,
  getCompoundHolidayAttendancePart,
  isHolidayAttendanceCompound,
} from "../../../core/utils/attendanceReportStatus";

type RosterRow = {
  entity_id: number;
  entity_name: string;
  class_id: number | null;
  section_id: number | null;
  status?: string | null;
  remark?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
};
type StaffReportRow = {
  entity_id: number;
  entity_name: string;
  attendance_date?: string | null;
  status?: string | null;
};

const STATUS_OPTIONS = ["present", "late", "absent", "half_day"];
const statusClassMap: Record<string, string> = {
  present: "bg-success",
  late: "bg-pending",
  half_day: "bg-dark",
  absent: "bg-danger",
  holiday: "bg-info",
  weekly_holiday: "bg-info",
};
const statusTextMapDay: Record<string, string> = {
  present: "P",
  late: "L",
  absent: "A",
  half_day: "F",
  halfday: "F",
  holiday: "H",
  weekly_holiday: "H",
};
const statusShortLabel = (status: string | null | undefined) => {
  const s = String(status || "").trim().toLowerCase();
  if (s === "half_day" || s === "halfday") return "F";
  return formatAttendanceDayShort(status);
};
const formatStatusLabel = (status: string | null | undefined) => formatAttendanceDayHumanLabel(status);
const toDateKey = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getTodayLocalYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const StudentAttendance = () => {
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const role = (user?.role || "").toLowerCase();
  const roleId = Number(user?.user_role_id ?? user?.role_id);
  const isTeacher = role === "teacher" || roleId === 2;
  const canEditStudentAttendance = isTeacher;
  const isReadOnlyViewer = !canEditStudentAttendance;
  const dashboardRoute = getDashboardForRole(role);
  const today = getTodayLocalYMD();

  const [attendanceDate, setAttendanceDate] = useState(today);
  const [attendanceMonth, setAttendanceMonth] = useState(today.slice(0, 7));
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [rowState, setRowState] = useState<Record<number, { status: string; remark: string; checkInTime: string; checkOutTime: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [teacherScopeRows, setTeacherScopeRows] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [reportData, setReportData] = useState<any>({ month: attendanceMonth, days: [], rows: [] });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [staffReportRows, setStaffReportRows] = useState<StaffReportRow[]>([]);
  const [staffHolidayDates, setStaffHolidayDates] = useState<string[]>([]);
  const [reportViewType, setReportViewType] = useState<"staff" | "student">("staff");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [designationId, setDesignationId] = useState<number | null>(null);
  const [activeHoliday, setActiveHoliday] = useState<any>(null);
  /** Past dates: view-only until Edit, then Save changes (server upserts). */
  const [pastDateEditMode, setPastDateEditMode] = useState(false);
  const isPastMarkingDate = attendanceDate < today;
  const markingFieldsLocked = !!activeHoliday || (isPastMarkingDate && !pastDateEditMode);

  useEffect(() => {
    setPastDateEditMode(attendanceDate >= getTodayLocalYMD());
  }, [attendanceDate]);

  const markingReturnTo = useMemo(() => {
    const search = new URLSearchParams();
    if (classId != null) search.set("classId", String(classId));
    if (sectionId != null) search.set("sectionId", String(sectionId));
    if (academicYearId != null) search.set("academicYearId", String(academicYearId));
    if (attendanceDate) search.set("date", String(attendanceDate));
    const qs = search.toString();
    return `${all_routes.studentAttendance}${qs ? `?${qs}` : ""}`;
  }, [classId, sectionId, academicYearId, attendanceDate]);

  const { classes } = useClasses(academicYearId);
  const { sections } = useSections(isTeacher ? null : classId, {
    fetchAllWhenNoClass: false,
    academicYearId,
  });
  const { departments } = useDepartments();
  const { designations } = useDesignations();

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

  const fetchRoster = async () => {
    if (!canEditStudentAttendance) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAttendanceMarkingRoster("student", {
        date: attendanceDate,
        classId,
        sectionId,
        academicYearId,
      });
      const roster = Array.isArray(response?.data) ? response.data : [];
      setActiveHoliday(response?.holiday || null);
      setRows(roster);
      const nextState: Record<number, { status: string; remark: string; checkInTime: string; checkOutTime: string }> = {};
      roster.forEach((r: RosterRow) => {
        nextState[r.entity_id] = {
          status: r.status || "",
          remark: r.remark || "",
          checkInTime: r.check_in_time ? String(r.check_in_time).slice(0, 5) : "",
          checkOutTime: r.check_out_time ? String(r.check_out_time).slice(0, 5) : "",
        };
      });
      setRowState(nextState);
    } catch (err: any) {
      setError(err?.message || "Failed to load student attendance roster");
      setRows([]);
      setActiveHoliday(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canEditStudentAttendance) return;
    fetchRoster();
  }, [attendanceDate, classId, sectionId, academicYearId, canEditStudentAttendance]);

  useEffect(() => {
    if (!canEditStudentAttendance && reportViewType !== "student") return;
    let cancelled = false;
    const fetchReport = async () => {
      try {
        setReportLoading(true);
        setReportError(null);
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
        if (!cancelled) {
          setReportData({ month: attendanceMonth, days: [], rows: [] });
          setReportError(err?.message || "Failed to load attendance report");
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };
    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [canEditStudentAttendance, reportViewType, classId, sectionId, academicYearId, attendanceMonth]);

  useEffect(() => {
    if (canEditStudentAttendance || reportViewType !== "staff") return;
    let cancelled = false;
    const fetchStaffReport = async () => {
      try {
        setReportLoading(true);
        setReportError(null);
        const res = await apiService.getEntityAttendanceReport("staff", {
          month: attendanceMonth,
          departmentId,
          designationId,
          academicYearId,
        });
        if (!cancelled) {
          const nextRows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
          setStaffReportRows(nextRows);
          setStaffHolidayDates(Array.isArray(res?.data?.holiday_dates) ? res.data.holiday_dates : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setStaffReportRows([]);
          setStaffHolidayDates([]);
          setReportError(err?.message || "Failed to load staff attendance report");
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };
    fetchStaffReport();
    return () => {
      cancelled = true;
    };
  }, [canEditStudentAttendance, reportViewType, attendanceMonth, departmentId, designationId, academicYearId]);

  const departmentOptions = useMemo(
    () => (departments || []).map((d: any) => ({ id: d.originalData?.id ?? d.key, label: d.department })),
    [departments]
  );
  const designationOptions = useMemo(
    () => (designations || []).map((d: any) => ({ id: d.originalData?.id ?? d.key, label: d.designation })),
    [designations]
  );

  const classOptions = useMemo(() => {
    if (!isTeacher) return classes || [];
    const map = new Map<number, any>();
    (teacherScopeRows || []).forEach((row: any) => {
      const cid = Number(row?.class_id);
      if (!Number.isFinite(cid) || map.has(cid)) return;
      map.set(cid, {
        id: cid,
        class_name: row?.class_name || `Class ${cid}`,
        class_code: row?.class_code || "",
      });
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

  const shouldEnableSectionSelect = classId != null;

  const visibleRows = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.entity_name || "").toLowerCase().includes(q));
  }, [rows, studentSearch]);

  const reportRows = useMemo(
    () =>
      (Array.isArray(reportData?.rows) ? reportData.rows : []).map((row: any, index: number) => ({
        key: row.studentId ?? `attendance-report-${index}`,
        ...row,
      })),
    [reportData]
  );

  const staffReportData = useMemo(() => {
    const safeMonth = /^\d{4}-\d{2}$/.test(attendanceMonth) ? attendanceMonth : getTodayLocalYMD().slice(0, 7);
    const monthStart = new Date(`${safeMonth}-01T00:00:00.000Z`);
    if (Number.isNaN(monthStart.getTime())) return { days: [], rows: [] as any[] };
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const days: Array<{ day: number; date: string; weekdayShort: string }> = [];
    const cursor = new Date(monthStart);
    while (cursor < monthEnd) {
      days.push({
        day: cursor.getUTCDate(),
        date: cursor.toISOString().slice(0, 10),
        weekdayShort: cursor.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const grouped = new Map<number, any>();
    (Array.isArray(staffReportRows) ? staffReportRows : []).forEach((row: StaffReportRow) => {
      const id = Number(row.entity_id);
      if (!Number.isFinite(id)) return;
      if (!grouped.has(id)) {
        grouped.set(id, {
          key: id,
          entityId: id,
          name: row.entity_name || "Staff",
          summary: { present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0, percentage: 0 },
          daily: {} as Record<string, string>,
        });
      }
      const attendanceDate = toDateKey(row.attendance_date);
      if (!attendanceDate) return;
      grouped.get(id).daily[attendanceDate] = String(row.status || "").trim().toLowerCase();
    });

    const holidaySet = new Set((Array.isArray(staffHolidayDates) ? staffHolidayDates : []).map((d) => toDateKey(d)));
    const rows = Array.from(grouped.values()).map((row) => {
      days.forEach((d) => {
        if (!row.daily[d.date] && holidaySet.has(d.date)) {
          row.daily[d.date] = "holiday";
        }
      });
      days.forEach((d) => {
        const status = row.daily[d.date];
        if (status === "present") row.summary.present += 1;
        else if (status === "late") row.summary.late += 1;
        else if (status === "absent") row.summary.absent += 1;
        else if (status === "half_day" || status === "halfday") row.summary.halfDay += 1;
        else if (status === "holiday") row.summary.holiday += 1;
      });
      const workedDays = row.summary.present + row.summary.late + row.summary.absent + row.summary.halfDay;
      const effectivePresent = row.summary.present + row.summary.late + row.summary.halfDay * 0.5;
      row.summary.percentage = workedDays > 0 ? Number(((effectivePresent / workedDays) * 100).toFixed(2)) : 0;
      return row;
    });

    return { days, rows };
  }, [attendanceMonth, staffReportRows, staffHolidayDates]);

  const activeReportDays = !canEditStudentAttendance && reportViewType === "staff"
    ? staffReportData.days
    : (Array.isArray(reportData?.days) ? reportData.days : []);

  const activeReportDayColumns = useMemo(
    () =>
      activeReportDays.map((day: any) => ({
        title: (
          <div className="text-center">
            <span className="day-num d-block">{String(day.day).padStart(2, "0")}</span>
            <span>{String(day.weekdayShort || "").charAt(0)}</span>
          </div>
        ),
        key: day.date,
        render: (_text: any, record: any) => {
          const status = record.daily?.[day.date];
          const pillStyle = {
            width: 20,
            height: 16,
            display: "inline-flex" as const,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            borderRadius: 6,
            fontSize: 9,
            fontWeight: 700 as const,
            color: "#fff",
          };
          if (!status) {
            return (
              <span
                className="attendance-range"
                style={{ opacity: 0.15, width: 22, height: 18, display: "inline-flex" }}
                title={`${day.date}: Not Marked`}
              />
            );
          }
          if (isHolidayAttendanceCompound(status)) {
            const rest = getCompoundHolidayAttendancePart(status);
            const subText = statusTextMapDay[rest] || "?";
            const subCls = statusClassMap[rest] || "bg-light";
            return (
              <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }} title={`${day.date}: ${formatAttendanceDayHumanLabel(status)}`}>
                <span className={`attendance-range ${statusClassMap.holiday}`.trim()} style={pillStyle}>
                  H
                </span>
                <span className={`attendance-range ${subCls}`.trim()} style={pillStyle}>
                  {subText}
                </span>
              </span>
            );
          }
          const cls = statusClassMap[status] || "bg-light";
          const short = statusShortLabel(status);
          return (
            <span
              className={`attendance-range ${cls}`.trim()}
              style={{
                width: 22,
                height: 18,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                color: "#fff",
              }}
              title={`${day.date}: ${formatAttendanceDayHumanLabel(status)}`}
            >
              {short}
            </span>
          );
        },
      })),
    [activeReportDays]
  );

  const reportColumns = useMemo(
    () => [
      {
        title: (!canEditStudentAttendance && reportViewType === "staff") ? "Staff/Date" : "Student/Date",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <div>
            <p className="text-dark mb-0">
              {!canEditStudentAttendance && reportViewType === "staff" ? (
                <span className="fw-semibold">{text || "—"}</span>
              ) : (
                <Link
                  to={`${all_routes.studentLeaves}?studentId=${record.studentId}`}
                  state={{
                    studentId: record.studentId,
                    activeTab: "attendance",
                    returnTo: all_routes.studentAttendanceReport,
                  }}
                  className="fw-semibold"
                >
                  {text || "—"}
                </Link>
              )}
            </p>
            {!canEditStudentAttendance && reportViewType === "staff" ? null : (
              <span className="fs-12">Roll No : {record.rollNo || "—"}</span>
            )}
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
      ...activeReportDayColumns,
    ],
    [activeReportDayColumns, canEditStudentAttendance, reportViewType]
  );

  const exportRows = useMemo(() => {
    const dayKeys = (Array.isArray(activeReportDays) ? activeReportDays : []).map((d: any) => d?.date).filter(Boolean);
    const sourceRows =
      !canEditStudentAttendance && reportViewType === "staff"
        ? staffReportData.rows
        : reportRows;

    return (Array.isArray(sourceRows) ? sourceRows : []).map((row: any) => {
      const base: Record<string, any> = {
        Name: row.name || "",
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
  }, [activeReportDays, canEditStudentAttendance, reportViewType, staffReportData.rows, reportRows]);

  const handleExportPdf = () => {
    try {
      const typeLabel = (!canEditStudentAttendance && reportViewType === "staff") ? "Staff" : "Student";
      exportAttendancePdf(
        `${typeLabel} Attendance Report (${attendanceMonth})`,
        `${typeLabel.toLowerCase()}-attendance-report-${attendanceMonth}`,
        exportRows
      );
    } catch (err: any) {
      setReportError(err?.message || "Export failed");
    }
  };

  const handleExportExcel = () => {
    try {
      const typeLabel = (!canEditStudentAttendance && reportViewType === "staff") ? "Staff" : "Student";
      exportAttendanceExcel(`${typeLabel.toLowerCase()}-attendance-report-${attendanceMonth}`, exportRows);
    } catch (err: any) {
      setReportError(err?.message || "Export failed");
    }
  };

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

  const handleSave = async () => {
    if (!canEditStudentAttendance) return;
    if (rows.length === 0) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await apiService.saveAttendance({
        entityType: "student",
        attendanceDate,
        academicYearId,
        records: rows.map((r) => ({
          entityId: r.entity_id,
          status: rowState[r.entity_id]?.status || "present",
          remark: rowState[r.entity_id]?.remark || "",
          checkInTime: rowState[r.entity_id]?.checkInTime || "",
          checkOutTime: rowState[r.entity_id]?.checkOutTime || "",
          classId: r.class_id || classId,
          sectionId: r.section_id || sectionId,
        })),
      });
      setMessage(isPastMarkingDate ? "Student attendance updated successfully." : "Student attendance saved successfully.");
      if (isPastMarkingDate) setPastDateEditMode(false);
      await fetchRoster();
    } catch (err: any) {
      setError(err?.message || "Failed to save student attendance");
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryMarkingAction = () => {
    if (!canEditStudentAttendance) return;
    if (isPastMarkingDate && !pastDateEditMode) {
      setPastDateEditMode(true);
      setMessage(null);
      setError(null);
      return;
    }
    void handleSave();
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">{canEditStudentAttendance ? "Student Attendance" : "Attendance Report"}</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={dashboardRoute}>Dashboard</Link></li>
                <li className="breadcrumb-item active" aria-current="page">{canEditStudentAttendance ? "Student Attendance" : "Attendance Report"}</li>
              </ol>
            </nav>
          </div>
          <TooltipOption onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
        </div>

        <div className="card">
          <div className="card-header">
            {!canEditStudentAttendance && (
              <div className="d-flex justify-content-center mb-3">
                <div className="border rounded-3 px-3 py-2 bg-light">
                  <label className="form-label d-block text-center mb-2">Report Type</label>
                  <div className="btn-group" role="group" aria-label="Attendance report type">
                    <button
                      type="button"
                      className={`btn ${reportViewType === "staff" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setReportViewType("staff")}
                    >
                      Staff Attendance
                    </button>
                    <button
                      type="button"
                      className={`btn ${reportViewType === "student" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setReportViewType("student")}
                    >
                      Student Attendance
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label">{canEditStudentAttendance ? "Date" : "Month"}</label>
                {canEditStudentAttendance ? (
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
              {!canEditStudentAttendance && reportViewType === "staff" && (
                <div className="col-md-3">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={departmentId ?? ""}
                    onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">All Departments</option>
                    {departmentOptions.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!canEditStudentAttendance && reportViewType === "staff" && (
                <div className="col-md-3">
                  <label className="form-label">Designation</label>
                  <select
                    className="form-select"
                    value={designationId ?? ""}
                    onChange={(e) => setDesignationId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">All Designations</option>
                    {designationOptions.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(canEditStudentAttendance || reportViewType === "student") && (
                <div className="col-md-3">
                  <label className="form-label">Class</label>
                  <select
                    className="form-select"
                    value={classId ?? ""}
                    onChange={(e) => {
                      const nextClassId = e.target.value ? Number(e.target.value) : null;
                      setClassId(nextClassId);
                      if (nextClassId == null) {
                        setSectionId(null);
                      }
                    }}
                  >
                    {!isTeacher && <option value="">All Classes</option>}
                    {classOptions.map((c: any) => {
                      const className = c.class_name || c.name || `Class ${c.id}`;
                      const classCode = String(c.class_code || "").trim();
                      const label = classCode ? `${className} (${classCode})` : className;
                      return (
                        <option key={c.id} value={c.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              {(canEditStudentAttendance || reportViewType === "student") && (
                <div className="col-md-3">
                  <label className="form-label">Section</label>
                  <select
                    className="form-select"
                    value={sectionId ?? ""}
                    disabled={!shouldEnableSectionSelect}
                    onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">{shouldEnableSectionSelect ? "All Sections" : "Select class first"}</option>
                    {sectionOptions.map((s: any) => <option key={s.id} value={s.id}>{s.section_name || s.name || `Section ${s.id}`}</option>)}
                  </select>
                </div>
              )}
              <div className="col-md-3 d-flex align-items-end">
                {canEditStudentAttendance ? (
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    onClick={handlePrimaryMarkingAction}
                    disabled={saving || loading || rows.length === 0 || !!activeHoliday}
                  >
                    {saving
                      ? "Saving..."
                      : isPastMarkingDate && !pastDateEditMode
                        ? "Edit Attendance"
                        : isPastMarkingDate
                          ? "Save changes"
                          : "Save Attendance"}
                  </button>
                ) : (
                  <div className="w-100 alert alert-info py-2 px-3 mb-0">
                    View only. Student attendance is marked by teachers.
                  </div>
                )}
              </div>
              {isReadOnlyViewer && reportViewType === "student" && (
                <div className="col-md-3">
                  <label className="form-label">Student Search</label>
                  <input
                    type="text"
                    className="form-control"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search student name"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}
            {activeHoliday && (
              <div className="alert alert-info">
                Holiday (auto): {activeHoliday.title}. Manual attendance marking is disabled for this date.
              </div>
            )}
            {canEditStudentAttendance ? (
              loading ? (
                <div className="text-muted">Loading roster...</div>
              ) : visibleRows.length === 0 ? (
                <div className="text-muted">No students found for selected filters.</div>
              ) : (
              <div className="table-responsive">
                <table className="table table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => (
                      <tr key={r.entity_id}>
                        <td>
                          <Link
                            to={`${all_routes.studentLeaves}?studentId=${r.entity_id}`}
                            state={{
                              studentId: r.entity_id,
                              activeTab: "attendance",
                              returnTo: markingReturnTo,
                            }}
                            className="fw-semibold"
                          >
                            {r.entity_name}
                          </Link>
                        </td>
                        <td>
                          {canEditStudentAttendance && !activeHoliday ? (
                            <select
                              className="form-select"
                              disabled={markingFieldsLocked}
                              value={rowState[r.entity_id]?.status || "present"}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    status: e.target.value,
                                    remark: prev[r.entity_id]?.remark || "",
                                    checkInTime: prev[r.entity_id]?.checkInTime || "",
                                    checkOutTime: prev[r.entity_id]?.checkOutTime || "",
                                  },
                                }))
                              }
                            >
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                            </select>
                          ) : (
                            <span className="fw-medium">{formatStatusLabel(rowState[r.entity_id]?.status)}</span>
                          )}
                        </td>
                        <td>
                          {canEditStudentAttendance ? (
                            <input
                              type="time"
                              className="form-control"
                              disabled={markingFieldsLocked}
                              value={rowState[r.entity_id]?.checkInTime || ""}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    status: prev[r.entity_id]?.status || "present",
                                    remark: prev[r.entity_id]?.remark || "",
                                    checkInTime: e.target.value,
                                    checkOutTime: prev[r.entity_id]?.checkOutTime || "",
                                  },
                                }))
                              }
                              placeholder="Optional"
                            />
                          ) : (
                            <span>{rowState[r.entity_id]?.checkInTime || "—"}</span>
                          )}
                        </td>
                        <td>
                          {canEditStudentAttendance ? (
                            <input
                              type="time"
                              className="form-control"
                              disabled={markingFieldsLocked}
                              value={rowState[r.entity_id]?.checkOutTime || ""}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    status: prev[r.entity_id]?.status || "present",
                                    remark: prev[r.entity_id]?.remark || "",
                                    checkInTime: prev[r.entity_id]?.checkInTime || "",
                                    checkOutTime: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Optional"
                            />
                          ) : (
                            <span>{rowState[r.entity_id]?.checkOutTime || "—"}</span>
                          )}
                        </td>
                        <td>
                          {canEditStudentAttendance ? (
                            <input
                              type="text"
                              className="form-control"
                              disabled={markingFieldsLocked}
                              value={rowState[r.entity_id]?.remark || ""}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    status: prev[r.entity_id]?.status || "present",
                                    remark: e.target.value,
                                    checkInTime: prev[r.entity_id]?.checkInTime || "",
                                    checkOutTime: prev[r.entity_id]?.checkOutTime || "",
                                  },
                                }))
                              }
                              placeholder="Optional note"
                            />
                          ) : (
                            <span>{rowState[r.entity_id]?.remark || "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )
            ) : reportLoading ? (
              <div className="text-muted">Loading attendance report...</div>
            ) : reportError ? (
              <div className="alert alert-danger mb-0">{reportError}</div>
            ) : (
              <Table
                dataSource={!canEditStudentAttendance && reportViewType === "staff" ? staffReportData.rows : reportRows}
                columns={reportColumns as any}
                Selection={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAttendance;

