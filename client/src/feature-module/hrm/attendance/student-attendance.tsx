import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { selectUser } from "../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { getDashboardForRole, isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import { useDepartments } from "../../../core/hooks/useDepartments";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import { exportAttendanceExcel, exportAttendancePdf } from "../../report/attendance-report/exportUtils";
import { printData } from "../../../core/utils/exportUtils";
import {
  formatAttendanceDayHumanLabel,
  formatAttendanceDayShort,
  getCompoundHolidayAttendancePart,
  isHolidayAttendanceCompound,
} from "../../../core/utils/attendanceReportStatus";
import {
  applyHolidayDatesToMonthlyGrid,
  normalizeMonthlyAttendanceGridRows,
} from "../../../core/utils/attendanceReportUtils";
import {
  buildClassOptionsFromSectionAssignments,
  buildSectionOptionsFromSectionAssignments,
  filterSectionTeacherAssignments,
} from "./sectionTeacherScope";

type RosterRow = {
  entity_id: number;
  entity_name: string;
  class_id: number | null;
  section_id: number | null;
  status?: string | null;
  remark?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  roll_number?: string | number | null;
  admission_number?: string | number | null;
};
type StaffReportRow = {
  entity_id: number;
  entity_name: string;
  attendance_date?: string | null;
  status?: string | null;
};

const STATUS_OPTIONS = ["present", "late", "absent", "half_day"];
const normalizeStatusKey = (status: unknown): string =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_–—−]+/g, "_")
    .replace(/^halfday$/, "half_day");
const statusClassMap: Record<string, string> = {
  present: "bg-success",
  late: "bg-pending",
  half_day: "bg-purple",
  halfday: "bg-purple",
  absent: "bg-danger",
  holiday: "bg-info",
  weekly_holiday: "bg-info",
};
const statusTextMapDay: Record<string, string> = {
  present: "P",
  late: "L",
  absent: "A",
  half_day: "HD",
  halfday: "HD",
  holiday: "H",
  weekly_holiday: "H",
};
const statusShortLabel = (status: string | null | undefined) => {
  const s = String(status || "").trim().toLowerCase();
  if (s === "half_day" || s === "halfday") return "HD";
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
  const roleId = Number(user?.user_role_id);
  const isHeadmaster = isHeadmasterRole(user);
  const isAdministrative = isAdministrativeRole(user);
  const isTeacher = !isHeadmaster && !isAdministrative && (role === "teacher" || roleId === 2);
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
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0, half_day: 0 });
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
  }, [isTeacher, academicYearId]);



  const fetchRoster = async () => {
    if (!canEditStudentAttendance) return;
    if (isTeacher && (classId == null || sectionId == null)) {
      setRows([]);
      setRowState({});
      return;
    }
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


  const loadStudentReport = useCallback(async () => {
    if (canEditStudentAttendance) return;
    try {
      setReportLoading(true);
      setReportError(null);
      const res = await apiService.getEntityAttendanceReport("student", {
        classId,
        sectionId,
        academicYearId,
        month: attendanceMonth,
      });
      setReportData(res?.data || { month: attendanceMonth, days: [], rows: [] });
    } catch (err: any) {
      setReportData({ month: attendanceMonth, days: [], rows: [] });
      setReportError(err?.message || "Failed to load attendance report");
    } finally {
      setReportLoading(false);
    }
  }, [canEditStudentAttendance, classId, sectionId, academicYearId, attendanceMonth]);

  const loadStaffReport = useCallback(async () => {
    if (canEditStudentAttendance) return;
    try {
      setReportLoading(true);
      setReportError(null);
      const res = await apiService.getEntityAttendanceReport("staff", {
        month: attendanceMonth,
        departmentId,
        designationId,
        academicYearId,
      });
      const nextRows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setStaffReportRows(nextRows);
      setStaffHolidayDates(Array.isArray(res?.data?.holiday_dates) ? res.data.holiday_dates : []);
    } catch (err: any) {
      setStaffReportRows([]);
      setStaffHolidayDates([]);
      setReportError(err?.message || "Failed to load staff attendance report");
    } finally {
      setReportLoading(false);
    }
  }, [canEditStudentAttendance, attendanceMonth, departmentId, designationId, academicYearId]);

  useEffect(() => {
    if (!canEditStudentAttendance && reportViewType === "student") {
      void loadStudentReport();
    }
  }, [canEditStudentAttendance, reportViewType, loadStudentReport]);

  useEffect(() => {
    if (!canEditStudentAttendance && reportViewType === "staff") {
      void loadStaffReport();
    }
  }, [canEditStudentAttendance, reportViewType, loadStaffReport]);

  const departmentOptions = useMemo(
    () => (departments || []).map((d: any) => ({ id: d.originalData?.id ?? d.key, label: d.department })),
    [departments]
  );
  const designationOptions = useMemo(
    () => (designations || []).map((d: any) => ({ id: d.originalData?.id ?? d.key, label: d.designation })),
    [designations]
  );

  const sectionTeacherAssignments = useMemo(
    () => filterSectionTeacherAssignments(teacherAssignments),
    [teacherAssignments]
  );

  const classOptions = useMemo(() => {
    if (!isTeacher) return classes || [];
    return buildClassOptionsFromSectionAssignments(sectionTeacherAssignments);
  }, [isTeacher, classes, sectionTeacherAssignments]);

  const sectionOptions = useMemo(() => {
    if (!isTeacher) return sections || [];
    return buildSectionOptionsFromSectionAssignments(sectionTeacherAssignments, classId);
  }, [isTeacher, sections, sectionTeacherAssignments, classId]);

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
    if (!isTeacher) return;
    if (sectionId == null && sectionOptions.length > 0) {
      setSectionId(Number(sectionOptions[0].id));
    }
  }, [isTeacher, sectionId, sectionOptions]);

  const shouldEnableSectionSelect = classId != null;

  const visibleRows = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.entity_name || "").toLowerCase().includes(q));
  }, [rows, studentSearch]);

  useEffect(() => {
    const s = { total: visibleRows.length, present: 0, absent: 0, late: 0, half_day: 0 };
    visibleRows.forEach(r => {
      const status = rowState[r.entity_id]?.status || "present";
      if (status === 'present') s.present++;
      else if (status === 'absent') s.absent++;
      else if (status === 'late') s.late++;
      else if (status === 'half_day') s.half_day++;
    });
    setStats(s);
  }, [visibleRows, rowState]);

  const studentReportData = useMemo(() => {
    const days = Array.isArray(reportData?.days) ? reportData.days : [];
    const holidayDates = Array.isArray(reportData?.holiday_dates) ? reportData.holiday_dates : [];
    const rows = applyHolidayDatesToMonthlyGrid(
      normalizeMonthlyAttendanceGridRows(reportData?.rows),
      days,
      holidayDates
    );
    return { days, rows };
  }, [reportData]);

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

    const holidaySet = new Set((Array.isArray(staffHolidayDates) ? staffHolidayDates : []).map((d) => toDateKey(d)));
    const rows = normalizeMonthlyAttendanceGridRows(staffReportRows).map((row) => {
      const daily = { ...row.daily };
      days.forEach((d) => {
        if (!daily[d.date] && holidaySet.has(d.date)) {
          daily[d.date] = "holiday";
        }
      });
      const summary = { ...row.summary, present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0, percentage: 0 };
      days.forEach((d) => {
        const status = normalizeStatusKey(daily[d.date]);
        if (status === "present") summary.present += 1;
        else if (status === "late") summary.late += 1;
        else if (status === "absent") summary.absent += 1;
        else if (status === "half_day") summary.halfDay += 1;
        else if (status === "holiday" || status === "weekly_holiday") summary.holiday += 1;
      });
      const workedDays = summary.present + summary.late + summary.absent + summary.halfDay;
      const effectivePresent = summary.present + summary.late + summary.halfDay * 0.5;
      summary.percentage = workedDays > 0 ? Number(((effectivePresent / workedDays) * 100).toFixed(2)) : 0;
      return { ...row, daily, summary };
    });

    return { days, rows };
  }, [attendanceMonth, staffReportRows, staffHolidayDates]);

  const activeReportRows =
    !canEditStudentAttendance && reportViewType === "staff"
      ? staffReportData.rows
      : studentReportData.rows;

  const activeReportDays =
    !canEditStudentAttendance && reportViewType === "staff"
      ? staffReportData.days
      : studentReportData.days;

  const displayStats = useMemo(() => {
    if (canEditStudentAttendance) return stats;
    let present = 0;
    let absent = 0;
    let late = 0;
    let half_day = 0;
    activeReportRows.forEach((row) => {
      present += row.summary?.present ?? 0;
      absent += row.summary?.absent ?? 0;
      late += row.summary?.late ?? 0;
      half_day += row.summary?.halfDay ?? 0;
    });
    return { total: activeReportRows.length, present, absent, late, half_day };
  }, [canEditStudentAttendance, stats, activeReportRows]);

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
          const rawStatus = record.daily?.[day.date];
          const status = normalizeStatusKey(rawStatus);
          if (status === "leaved") {
            return (
              <span
                className="attendance-range"
                style={{ opacity: 0.15, width: 22, height: 18, display: "inline-flex" }}
                title={`${day.date}: Leaved`}
              />
            );
          }
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
          if (!rawStatus) {
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
            const isHalfDaySub = rest === "half_day" || rest === "halfday";
            return (
              <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }} title={`${day.date}: ${formatAttendanceDayHumanLabel(status)}`}>
                <span className={`attendance-range ${statusClassMap.holiday}`.trim()} style={pillStyle}>
                  H
                </span>
                <span
                  className={`attendance-range ${subCls}`.trim()}
                  style={isHalfDaySub ? { ...pillStyle, backgroundColor: "#7b2cbf" } : pillStyle}
                >
                  {subText}
                </span>
              </span>
            );
          }
          const cls = statusClassMap[status] || "bg-light";
          const short = statusShortLabel(status);
          const isHalfDay = status === "half_day" || status === "halfday";
          return (
            <span
              className={`attendance-range ${cls}`.trim()}
              style={
                isHalfDay
                  ? {
                      width: 22,
                      height: 18,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                      backgroundColor: "#7b2cbf",
                    }
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
              title={`${day.date}: ${formatAttendanceDayHumanLabel(rawStatus)}`}
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
      { title: "HD", key: "halfDay", render: (_: any, record: any) => record.summary?.halfDay ?? 0 },
      ...activeReportDayColumns,
    ],
    [activeReportDayColumns, canEditStudentAttendance, reportViewType]
  );

  const exportRows = useMemo(() => {
    const dayKeys = (Array.isArray(activeReportDays) ? activeReportDays : []).map((d: any) => d?.date).filter(Boolean);
    const sourceRows =
      !canEditStudentAttendance && reportViewType === "staff"
        ? staffReportData.rows
        : studentReportData.rows;

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
  }, [activeReportDays, canEditStudentAttendance, reportViewType, staffReportData.rows, studentReportData.rows]);

  const handleRefresh = () => {
    if (!isReadOnlyViewer) return;
    if (reportViewType === "staff") {
      void loadStaffReport();
      return;
    }
    void loadStudentReport();
  };

  const handleExportPdf = () => {
    try {
      if (!exportRows.length) {
        setReportError("No data available for PDF export.");
        return;
      }
      const typeLabel = reportViewType === "staff" ? "Staff" : "Student";
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
      if (!exportRows.length) {
        setReportError("No data available for Excel export.");
        return;
      }
      const typeLabel = reportViewType === "staff" ? "Staff" : "Student";
      exportAttendanceExcel(`${typeLabel.toLowerCase()}-attendance-report-${attendanceMonth}`, exportRows);
    } catch (err: any) {
      setReportError(err?.message || "Export failed");
    }
  };

  const handlePrint = () => {
    try {
      if (!exportRows.length) {
        setReportError("No data available to print.");
        return;
      }
      const typeLabel = reportViewType === "staff" ? "Staff" : "Student";
      const keys = Object.keys(exportRows[0]);
      const columns = keys.map((key) => ({ title: key, dataKey: key }));
      printData(
        `${typeLabel} Attendance Report (${attendanceMonth})`,
        columns,
        exportRows,
        { singleHeaderOnPrint: true }
      );
    } catch (err: any) {
      setReportError(err?.message || "Print failed");
    }
  };

  const markingExportRows = useMemo(() => {
    const list = studentSearch.trim() ? visibleRows : rows;
    return list.map((r) => {
      const state = rowState[r.entity_id];
      const statusRaw = state?.status || r.status || "";
      return {
        Name: r.entity_name || "",
        RollNo: r.roll_number || "",
        Status: formatStatusLabel(statusRaw) || "—",
        CheckIn: state?.checkInTime || "—",
        CheckOut: state?.checkOutTime || "—",
        Remark: state?.remark || "—",
      };
    });
  }, [visibleRows, rows, rowState, studentSearch]);

  const markingPrintColumns = useMemo(
    () => [
      { title: "Name", dataKey: "Name" },
      { title: "Roll No", dataKey: "RollNo" },
      { title: "Status", dataKey: "Status" },
      { title: "Check In", dataKey: "CheckIn" },
      { title: "Check Out", dataKey: "CheckOut" },
      { title: "Remark", dataKey: "Remark" },
    ],
    []
  );

  const handleMarkingRefresh = () => {
    void fetchRoster();
  };

  const handleMarkingExportPdf = () => {
    try {
      if (!markingExportRows.length) {
        setError("No data available for PDF export.");
        return;
      }
      exportAttendancePdf(
        `Student Attendance (${attendanceDate})`,
        `student-attendance-marking-${attendanceDate}`,
        markingExportRows
      );
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  const handleMarkingExportExcel = () => {
    try {
      if (!markingExportRows.length) {
        setError("No data available for Excel export.");
        return;
      }
      exportAttendanceExcel(`student-attendance-marking-${attendanceDate}`, markingExportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  const handleMarkingPrint = () => {
    try {
      if (!markingExportRows.length) {
        setError("No data available to print.");
        return;
      }
      printData(`Student Attendance (${attendanceDate})`, markingPrintColumns, markingExportRows);
    } catch (err: any) {
      setError(err?.message || "Print failed");
    }
  };

  const handleSave = async () => {
    if (!canEditStudentAttendance) return;
    if (rows.length === 0) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const rowsToSave = studentSearch.trim() ? visibleRows : rows;
      await apiService.saveAttendance({
        entityType: "student",
        attendanceDate,
        academicYearId,
        records: rowsToSave.map((r) => ({
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
          <TooltipOption
            onRefresh={canEditStudentAttendance ? handleMarkingRefresh : handleRefresh}
            onPrint={canEditStudentAttendance ? handleMarkingPrint : handlePrint}
            onExportPdf={canEditStudentAttendance ? handleMarkingExportPdf : handleExportPdf}
            onExportExcel={canEditStudentAttendance ? handleMarkingExportExcel : handleExportExcel}
          />
        </div>

        <div className="row mb-4">
          <div className="col-md-3 col-sm-6 mb-3">
            <div className="card border-0 shadow-sm overflow-hidden h-100" style={{ borderRadius: '16px' }}>
              <div className="card-body p-3 d-flex align-items-center">
                <div className="bg-primary-light rounded-3 p-3 me-3" style={{ background: 'rgba(78, 115, 223, 0.1)' }}>
                  <i className="ti ti-users text-primary fs-3"></i>
                </div>
                <div>
                  <p className="text-muted mb-0 small fw-bold text-uppercase" style={{ letterSpacing: '0.5px' }}>
                    {!canEditStudentAttendance && reportViewType === "staff" ? "Staff" : "Students"}
                  </p>
                  <h4 className="mb-0 fw-bold">{displayStats.total}</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6 mb-3">
            <div className="card border-0 shadow-sm overflow-hidden h-100" style={{ borderRadius: '16px' }}>
              <div className="card-body p-3 d-flex align-items-center">
                <div className="bg-success-light rounded-3 p-3 me-3" style={{ background: 'rgba(28, 200, 138, 0.1)' }}>
                  <i className="ti ti-circle-check text-success fs-3"></i>
                </div>
                <div>
                  <p className="text-muted mb-0 small fw-bold text-uppercase" style={{ letterSpacing: '0.5px' }}>Present</p>
                  <h4 className="mb-0 fw-bold text-success">{displayStats.present}</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6 mb-3">
            <div className="card border-0 shadow-sm overflow-hidden h-100" style={{ borderRadius: '16px' }}>
              <div className="card-body p-3 d-flex align-items-center">
                <div className="bg-danger-light rounded-3 p-3 me-3" style={{ background: 'rgba(231, 74, 59, 0.1)' }}>
                  <i className="ti ti-circle-x text-danger fs-3"></i>
                </div>
                <div>
                  <p className="text-muted mb-0 small fw-bold text-uppercase" style={{ letterSpacing: '0.5px' }}>Absent</p>
                  <h4 className="mb-0 fw-bold text-danger">{displayStats.absent}</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6 mb-3">
            <div className="card border-0 shadow-sm overflow-hidden h-100" style={{ borderRadius: '16px' }}>
              <div className="card-body p-3 d-flex align-items-center">
                <div className="bg-warning-light rounded-3 p-3 me-3" style={{ background: 'rgba(246, 194, 62, 0.1)' }}>
                  <i className="ti ti-clock text-warning fs-3"></i>
                </div>
                <div>
                  <p className="text-muted mb-0 small fw-bold text-uppercase" style={{ letterSpacing: '0.5px' }}>Others</p>
                  <h4 className="mb-0 fw-bold text-warning">{displayStats.late + displayStats.half_day}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px' }}>
          <div className="card-header bg-transparent border-0 pt-4 px-4">
            {!canEditStudentAttendance && (
              <div className="d-flex justify-content-center mb-3">
                <div className="border-0 rounded-3 px-3 py-2 bg-light shadow-none">
                  <div className="btn-group" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm ${reportViewType === "staff" ? "btn-primary shadow-sm" : "btn-light text-muted"}`}
                      onClick={() => setReportViewType("staff")}
                      style={{ borderRadius: '8px 0 0 8px' }}
                    >
                      Staff Report
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${reportViewType === "student" ? "btn-primary shadow-sm" : "btn-light text-muted"}`}
                      onClick={() => setReportViewType("student")}
                      style={{ borderRadius: '0 8px 8px 0' }}
                    >
                      Student Report
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label small fw-bold text-muted text-uppercase mb-1">
                  {canEditStudentAttendance ? "Date" : "Month"}
                </label>
                <div className="input-group input-group-merge border rounded-3">
                  <span className="input-group-text border-0 bg-transparent text-muted"><i className="ti ti-calendar"></i></span>
                  {canEditStudentAttendance ? (
                    <input
                      type="date"
                      className="form-control border-0 ps-0"
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
                      className="form-control border-0 ps-0"
                      value={attendanceMonth}
                      onChange={(e) => setAttendanceMonth(e.target.value || today.slice(0, 7))}
                    />
                  )}
                </div>
              </div>
              {!canEditStudentAttendance && reportViewType === "staff" && (
                <div className="col-md-3">
                  <label className="form-label small fw-bold text-muted text-uppercase mb-1">Department</label>
                  <select
                    className="form-select border rounded-3 py-2"
                    value={departmentId ?? ""}
                    onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">All Departments</option>
                    {(departmentOptions || []).map((d: any) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              )}
              {!canEditStudentAttendance && reportViewType === "staff" && (
                <div className="col-md-3">
                  <label className="form-label small fw-bold text-muted text-uppercase mb-1">Designation</label>
                  <select
                    className="form-select border rounded-3 py-2"
                    value={designationId ?? ""}
                    onChange={(e) => setDesignationId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">All Designations</option>
                    {(designationOptions || []).map((d: any) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              )}
              {(canEditStudentAttendance || reportViewType === "student") && (
                <div className="col-md-3">
                  <label className="form-label small fw-bold text-muted text-uppercase mb-1">Class</label>
                  <select
                    className="form-select border rounded-3 py-2"
                    value={classId ?? ""}
                    onChange={(e) => {
                      const nextClassId = e.target.value ? Number(e.target.value) : null;
                      setClassId(nextClassId);
                      if (nextClassId == null) setSectionId(null);
                    }}
                  >
                    {!isTeacher && <option value="">All Classes</option>}
                    {classOptions.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name || c.name || `Class ${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(canEditStudentAttendance || reportViewType === "student") && (
                <div className="col-md-3">
                  <label className="form-label small fw-bold text-muted text-uppercase mb-1">Section</label>
                  <select
                    className="form-select border rounded-3 py-2"
                    value={sectionId ?? ""}
                    disabled={!shouldEnableSectionSelect}
                    onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}
                  >
                    {!isTeacher && (
                      <option value="">{shouldEnableSectionSelect ? "All Sections" : "Select class first"}</option>
                    )}
                    {isTeacher && !shouldEnableSectionSelect && <option value="">Select class first</option>}
                    {isTeacher && shouldEnableSectionSelect && sectionOptions.length === 0 && (
                      <option value="">No section assigned</option>
                    )}
                    {sectionOptions.map((s: any) => <option key={s.id} value={s.id}>{s.section_name || s.name || `Section ${s.id}`}</option>)}
                  </select>
                </div>
              )}
              <div className="col-md-3 d-flex align-items-end pb-1">
                {canEditStudentAttendance ? (
                  <button
                    type="button"
                    className={`btn ${visibleRows.length > 0 ? 'btn-primary' : 'btn-outline-primary'} w-100 py-2 fw-bold shadow-sm transition-all`}
                    onClick={handlePrimaryMarkingAction}
                    disabled={saving || loading || visibleRows.length === 0 || !!activeHoliday}
                    style={{ borderRadius: '10px' }}
                  >
                    {saving ? (
                      <><i className="ti ti-loader animate-spin me-2"></i>Saving...</>
                    ) : (
                      <><i className="ti ti-device-floppy me-2"></i>{isPastMarkingDate && !pastDateEditMode ? "Edit Attendance" : "Save Attendance"}</>
                    )}
                  </button>
                ) : (
                  <div className="w-100 badge bg-soft-info text-info p-3 text-wrap text-start border-0 shadow-none rounded-3 d-flex align-items-center h-100">
                    <i className="ti ti-info-circle me-2 fs-5"></i> View Only
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card-body p-0 mt-3">
            {error && <div className="mx-4 mb-3 alert alert-danger border-0 shadow-sm">{error}</div>}
            {message && <div className="mx-4 mb-3 alert alert-success border-0 shadow-sm">{message}</div>}
            {activeHoliday && (
              <div className="mx-4 mb-3 alert alert-info border-0 shadow-sm d-flex align-items-center">
                <i className="ti ti-calendar-event fs-4 me-2"></i>
                <span>Holiday: <strong>{activeHoliday.title}</strong>. Manual marking is disabled.</span>
              </div>
            )}

            {canEditStudentAttendance ? (
              loading ? (
              <div className="p-5 text-center">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted mt-2">Loading roster...</p>
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="p-5 text-center">
                <i className="ti ti-database-off fs-1 text-muted mb-3 d-block"></i>
                <p className="text-muted h6">No students found.</p>
                <p className="text-muted small">Select a class and section to load students.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 custom-attendance-table">
                  <thead className="bg-light">
                    <tr>
                      <th className="ps-4 py-3 border-0">Student Name</th>
                      <th className="py-3 border-0 text-center">Status</th>
                      <th className="pe-4 py-3 border-0">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => {
                      const status = rowState[r.entity_id]?.status || "present";
                      const statusTheme = status === 'present' ? 'success' : status === 'absent' ? 'danger' : 'warning';
                      
                      return (
                        <tr key={r.entity_id} className="border-bottom">
                          <td className="ps-4 py-3">
                            <div className="d-flex align-items-center">
                              <div className={`avatar avatar-sm bg-soft-${statusTheme} text-${statusTheme} rounded-circle me-3 fw-bold d-flex align-items-center justify-content-center`} style={{ width: '38px', height: '38px' }}>
                                {r.entity_name?.charAt(0)}
                              </div>
                              <div>
                                <Link
                                  to={`${all_routes.studentLeaves}?studentId=${r.entity_id}`}
                                  state={{ studentId: r.entity_id, activeTab: "attendance", returnTo: markingReturnTo }}
                                  className="fw-bold text-dark d-block mb-0 h6 mb-0"
                                >
                                  {r.entity_name}
                                </Link>
                                <span className="text-muted small">Roll No: {r.roll_number || '—'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-center" style={{ minWidth: '160px' }}>
                            {!activeHoliday ? (
                              <div className="d-inline-flex align-items-center position-relative" style={{ minWidth: '120px' }}>
                                <select
                                  className={`form-select form-select-sm border-0 fw-bold shadow-none rounded-pill ps-3 pe-4 bg-soft-${statusTheme} text-${statusTheme} status-pill-select w-100`}
                                  style={{ cursor: 'pointer', appearance: 'none', textAlign: 'center', height: '32px', fontSize: '12px' }}
                                  disabled={markingFieldsLocked}
                                  value={status}
                                  onChange={(e) =>
                                    setRowState((prev) => ({
                                      ...prev,
                                      [r.entity_id]: {
                                        ...prev[r.entity_id],
                                        status: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s} className="bg-white text-dark">
                                      {s.toUpperCase().replace("_", " ")}
                                    </option>
                                  ))}
                                </select>
                                <i className={`ti ti-chevron-down position-absolute text-${statusTheme}`} style={{ right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '11px' }}></i>
                              </div>
                            ) : (
                              <span className={`badge rounded-pill bg-soft-${statusTheme} text-${statusTheme} px-3 py-2 fw-bold`} style={{ minWidth: '100px' }}>
                                {formatStatusLabel(status)?.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="pe-4 py-3">
                            <input
                              type="text"
                              className="form-control form-control-sm border-0 bg-light rounded-pill px-3"
                              disabled={markingFieldsLocked}
                              placeholder="Add a remark..."
                              value={rowState[r.entity_id]?.remark || ""}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    ...prev[r.entity_id],
                                    remark: e.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
            ) : reportLoading ? (
              <div className="p-5 text-center">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted mt-2">Loading attendance report...</p>
              </div>
            ) : reportError ? (
              <div className="p-5 text-center">
                <i className="ti ti-alert-circle fs-1 text-danger mb-3 d-block"></i>
                <p className="text-muted h6">{reportError}</p>
              </div>
            ) : activeReportRows.length === 0 ? (
              <div className="p-5 text-center">
                <i className="ti ti-database-off fs-1 text-muted mb-3 d-block"></i>
                <p className="text-muted h6">
                  {reportViewType === "staff" ? "No staff found." : "No students found."}
                </p>
                <p className="text-muted small">
                  {reportViewType === "staff"
                    ? "Try another month or clear department/designation filters."
                    : "Select a class and section, or try another month."}
                </p>
              </div>
            ) : (
              <div className="p-4">
                <Table
                  dataSource={activeReportRows}
                  columns={reportColumns as any}
                  Selection={false}
                />
              </div>
            )}
          </div>
        </div>

        <style>{`
          .bg-soft-primary { background-color: rgba(78, 115, 223, 0.1); }
          .bg-soft-success { background-color: rgba(28, 200, 138, 0.1); }
          .bg-soft-danger { background-color: rgba(231, 74, 59, 0.1); }
          .bg-soft-warning { background-color: rgba(246, 194, 62, 0.1); }
          .bg-soft-info { background-color: rgba(54, 185, 204, 0.1); }
          
          .transition-all { transition: all 0.2s ease-in-out; }
          .custom-attendance-table tr:hover { background-color: rgba(78, 115, 223, 0.02); }
          .animate-spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          
          .form-select-sm:focus { box-shadow: none !important; }
          .card-header .form-control:focus, .card-header .form-select:focus { 
            border-color: var(--primary-color) !important;
            box-shadow: 0 0 0 0.2rem rgba(78, 115, 223, 0.1) !important;
          }
          .status-pill-select { transition: all 0.2s ease; min-width: 110px; }
          .status-pill-select:hover { transform: scale(1.05); filter: brightness(0.95); }
        `}</style>
      </div>
    </div>
  );
};

export default StudentAttendance;

