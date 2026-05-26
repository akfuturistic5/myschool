import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import { useDepartments } from "../../../core/hooks/useDepartments";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { apiService } from "../../../core/services/apiService";
import {
  formatAttendanceDayHumanLabel,
  getCompoundHolidayAttendancePart,
  isHolidayAttendanceCompound,
} from "../../../core/utils/attendanceReportStatus";
import {
  capMonthlyReportDaysToToday,
  prepareMonthlyAttendanceGrid,
} from "../../../core/utils/attendanceReportUtils";
import { exportAttendanceExcel, exportAttendancePdf } from "./exportUtils";
import { printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

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
  absent: "A",
  late: "L",
  leaved: "LV",
  holiday: "H",
  weekly_holiday: "H",
  half_day: "HD",
  halfday: "HD",
};

const normalizeAttendanceStatusKey = (status: string | null | undefined) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_–—−]+/g, "_")
    .replace(/^halfday$/, "half_day");

const StaffReportLive = () => {
  const routes = all_routes;
  const location = useLocation();
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { departments } = useDepartments();
  const { designations } = useDesignations();

  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format("YYYY-MM"));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedDesignationId, setSelectedDesignationId] = useState<string>("");
  const [appliedMonth, setAppliedMonth] = useState<string>(dayjs().format("YYYY-MM"));
  const [appliedDepartmentId, setAppliedDepartmentId] = useState<string>("");
  const [appliedDesignationId, setAppliedDesignationId] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [reportData, setReportData] = useState<any>({ month: null, days: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const departmentOptions = useMemo(
    () => [
      { value: "", label: "All Departments" },
      ...(departments || []).map((d: any) => ({
        value: String(d.originalData?.id ?? d.key),
        label: d.department,
      })),
    ],
    [departments]
  );

  const designationOptions = useMemo(
    () => [
      { value: "", label: "All Designations" },
      ...(designations || []).map((d: any) => ({
        value: String(d.originalData?.id ?? d.key),
        label: d.designation,
      })),
    ],
    [designations]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getEntityAttendanceReport("staff", {
          month: appliedMonth,
          departmentId: appliedDepartmentId ? Number(appliedDepartmentId) : null,
          designationId: appliedDesignationId ? Number(appliedDesignationId) : null,
        });
        if (!cancelled) {
          setReportData(res?.data || { month: appliedMonth, days: [], rows: [] });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch staff report");
          setReportData({ month: appliedMonth, days: [], rows: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [appliedMonth, appliedDepartmentId, appliedDesignationId, refreshTick]);

  const reportDays = useMemo(
    () => capMonthlyReportDaysToToday(reportData?.days, reportData?.month || appliedMonth),
    [reportData?.days, reportData?.month, appliedMonth]
  );

  const data = useMemo(() => {
    const holidayDates = Array.isArray(reportData?.holiday_dates) ? reportData.holiday_dates : [];
    return prepareMonthlyAttendanceGrid(reportData?.rows, reportDays, holidayDates).map((row) => ({
      ...row,
      key: row.entityId ?? row.key,
    }));
  }, [reportData, reportDays]);

  const dayColumns = useMemo(
    () =>
      reportDays.map((day: any) => ({
        title: (
          <div className="text-center">
            <span className="day-num d-block">{String(day.day).padStart(2, "0")}</span>
            <span>{String(day.weekdayShort || "").charAt(0)}</span>
          </div>
        ),
        key: day.date,
        render: (_text: any, record: any) => {
          const rawStatus = record.daily?.[day.date];
          const status = normalizeAttendanceStatusKey(rawStatus);
          const hasStatus = Boolean(String(rawStatus || "").trim());
          const pillStyle = {
            display: "inline-flex" as const,
            width: 22,
            height: 22,
            borderRadius: 999,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            color: "#fff",
            fontWeight: 700 as const,
            fontSize: 11,
            lineHeight: 1,
          };
          if (status === "leaved") {
            return (
              <span
                className="attendance-range"
                style={{ display: "inline-flex", width: 22, height: 22 }}
                title={`${day.date}: Leaved`}
              />
            );
          }
          if (!hasStatus) {
            return (
              <span
                className="attendance-range bg-danger"
                style={pillStyle}
                title={`${day.date}: Absent`}
              >
                A
              </span>
            );
          }
          if (isHolidayAttendanceCompound(status)) {
            const rest = getCompoundHolidayAttendancePart(status);
            const subText = statusTextMap[rest] || "?";
            const subCls = statusClassMap[rest] || "bg-light";
            const isHalfDaySub = rest === "half_day" || rest === "halfday";
            return (
              <span
                style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
                title={`${day.date}: ${formatAttendanceDayHumanLabel(status)}`}
              >
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
          const isHalfDay = status === "half_day" || status === "halfday";
          return (
            <span
              className={`attendance-range ${cls}`.trim()}
              style={isHalfDay ? { ...pillStyle, backgroundColor: "#7b2cbf" } : pillStyle}
              title={`${day.date}: ${formatAttendanceDayHumanLabel(rawStatus)}`}
            >
              {statusTextMap[status] || "-"}
            </span>
          );
        },
      })),
    [reportDays]
  );

  const columns = useMemo(
    () => [
      {
        title: "Staff/Date",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <div>
            <p className="text-dark mb-0 fw-semibold">{text || "—"}</p>
            {record.entityId ? (
              <Link
                to={{ pathname: routes.staffDetails, search: `?id=${record.entityId}` }}
                state={{ staffId: record.entityId }}
                className="fs-12"
              >
                View profile
              </Link>
            ) : null}
          </div>
        ),
        sorter: (a: TableData, b: TableData) => compareText(a?.name, b?.name),
        fixed: "left" as const,
      },
      {
        title: "%",
        key: "percentage",
        render: (_text: any, record: any) => (
          <span className={Number(record.summary?.percentage ?? 0) >= 75 ? "text-success" : "text-danger"}>
            {record.summary?.percentage ?? 0}%
          </span>
        ),
        sorter: (a: any, b: any) => compareNumber(a?.summary?.percentage, b?.summary?.percentage),
      },
      { title: "P", key: "present", render: (_: any, record: any) => record.summary?.present ?? 0 },
      { title: "L", key: "late", render: (_: any, record: any) => record.summary?.late ?? 0 },
      { title: "A", key: "absent", render: (_: any, record: any) => record.summary?.absent ?? 0 },
      { title: "H", key: "holiday", render: (_: any, record: any) => record.summary?.holiday ?? 0 },
      { title: "HD", key: "halfDay", render: (_: any, record: any) => record.summary?.halfDay ?? 0 },
      ...dayColumns,
    ],
    [dayColumns, routes.staffDetails]
  );

  const printColumns = useMemo(
    () => [
      { title: "Staff", dataKey: "name" },
      { title: "Attendance %", dataKey: "attendancePercentage" },
      { title: "Present", dataKey: "presentCount" },
      { title: "Late", dataKey: "lateCount" },
      { title: "Absent", dataKey: "absentCount" },
      { title: "Holiday", dataKey: "holidayCount" },
      { title: "Half Day", dataKey: "halfDayCount" },
    ],
    []
  );

  const printRows = useMemo(
    () =>
      data.map((row: any) => ({
        name: row.name || "—",
        attendancePercentage: `${row.summary?.percentage ?? 0}%`,
        presentCount: row.summary?.present ?? 0,
        lateCount: row.summary?.late ?? 0,
        absentCount: row.summary?.absent ?? 0,
        holidayCount: row.summary?.holiday ?? 0,
        halfDayCount: row.summary?.halfDay ?? 0,
      })),
    [data]
  );

  const exportRows = useMemo(() => {
    return data.map((row: any) => {
      const out: Record<string, string | number> = {
        Staff: row.name || "—",
        "Attendance %": `${row.summary?.percentage ?? 0}%`,
        Present: row.summary?.present ?? 0,
        Late: row.summary?.late ?? 0,
        Absent: row.summary?.absent ?? 0,
        Holiday: row.summary?.holiday ?? 0,
        "Half Day": row.summary?.halfDay ?? 0,
      };
      reportDays.forEach((d: any) => {
        const status = row.daily?.[d.date];
        out[String(d.date)] = status ? formatAttendanceDayHumanLabel(status) : "Absent";
      });
      return out;
    });
  }, [data, reportDays]);

  const handleApply = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    setAppliedMonth(selectedMonth);
    setAppliedDepartmentId(selectedDepartmentId);
    setAppliedDesignationId(selectedDesignationId);
    dropdownMenuRef.current?.classList.remove("show");
  };

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    const month = dayjs().format("YYYY-MM");
    setSelectedMonth(month);
    setSelectedDepartmentId("");
    setSelectedDesignationId("");
    setAppliedMonth(month);
    setAppliedDepartmentId("");
    setAppliedDesignationId("");
  };

  const handleRefresh = () => setRefreshTick((prev) => prev + 1);

  const handleExportExcel = () => {
    try {
      exportAttendanceExcel(`staff-report-${appliedMonth}`, exportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  const handleExportPDF = () => {
    try {
      exportAttendancePdf("Staff Attendance Report", `staff-report-${appliedMonth}`, exportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  const handlePrint = () => {
    printData("Staff Attendance Report", printColumns, printRows);
  };

  const summary = reportData?.summary;

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Staff Report</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to="#">Report</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Staff Report
                </li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption
              onRefresh={handleRefresh}
              onPrint={handlePrint}
              onExportExcel={handleExportExcel}
              onExportPdf={handleExportPDF}
            />
          </div>
        </div>

        <div className="filter-wrapper">
          <div className="list-tab">
            <ul>
              <li>
                <Link to={routes.attendanceReport} className={location.pathname === routes.attendanceReport ? "active" : ""}>
                  Attendance Report
                </Link>
              </li>
              <li>
                <Link to={routes.studentAttendanceType} className={location.pathname === routes.studentAttendanceType ? "active" : ""}>
                  Students Attendance Type
                </Link>
              </li>
              <li>
                <Link to={routes.dailyAttendance} className={location.pathname === routes.dailyAttendance ? "active" : ""}>
                  Daily Attendance
                </Link>
              </li>
              <li>
                <Link to={routes.studentDayWise} className={location.pathname === routes.studentDayWise ? "active" : ""}>
                  Student Day Wise
                </Link>
              </li>
              <li>
                <Link to={routes.staffDayWise} className={location.pathname === routes.staffDayWise ? "active" : ""}>
                  Staff Day Wise
                </Link>
              </li>
              <li>
                <Link to={routes.staffReport} className="active">
                  Staff Report
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
            <h4 className="mb-3">Staff Attendance Report</h4>
            <div className="d-flex align-items-center flex-wrap">
              <div className="dropdown mb-3 me-2">
                <Link
                  to="#"
                  className="btn btn-outline-light bg-white dropdown-toggle"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="outside"
                >
                  <i className="ti ti-filter me-2" />
                  Filter
                </Link>
                <div className="dropdown-menu drop-width" ref={dropdownMenuRef} onClick={(e) => e.stopPropagation()}>
                  <form onSubmit={handleApply}>
                    <div className="d-flex align-items-center border-bottom p-3">
                      <h4>Filter</h4>
                    </div>
                    <div className="p-3 border-bottom">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Month</label>
                            <DatePicker
                              className="form-control datetimepicker"
                              picker="month"
                              value={dayjs(`${selectedMonth}-01`)}
                              onChange={(value: Dayjs | null) =>
                                setSelectedMonth((value || dayjs()).format("YYYY-MM"))
                              }
                              allowClear={false}
                              format="MMMM YYYY"
                              getPopupContainer={() => dropdownMenuRef.current || document.body}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Department</label>
                            <CommonSelect
                              className="select"
                              options={departmentOptions}
                              value={selectedDepartmentId}
                              onChange={(value) => setSelectedDepartmentId(String(value ?? ""))}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Designation</label>
                            <CommonSelect
                              className="select"
                              options={designationOptions}
                              value={selectedDesignationId}
                              onChange={(value) => setSelectedDesignationId(String(value ?? ""))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 d-flex align-items-center justify-content-end">
                      <Link to="#" className="btn btn-light me-3" onClick={handleReset}>
                        Reset
                      </Link>
                      <button type="submit" className="btn btn-primary">
                        Apply
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="card-body p-0 py-3">
            {error && (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {error}
              </div>
            )}
            {summary && !loading && (
              <div className="alert alert-info mx-3 mt-3 mb-0" role="status">
                Marked: {summary.total_marked ?? 0} | Present: {summary.present ?? 0} | Late: {summary.late ?? 0} | Half
                Day: {summary.half_day ?? 0} | Absent: {summary.absent ?? 0} | Attendance %:{" "}
                {summary.attendance_percentage ?? 0}
              </div>
            )}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2 mb-0">Loading staff report...</p>
              </div>
            ) : (
              <Table dataSource={data} columns={columns} Selection={false} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffReportLive;
