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
  isHolidayAttendanceCompound,
} from "../../../core/utils/attendanceReportStatus";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const getTodayLocalYMD = () => dayjs().format("YYYY-MM-DD");

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const normalizeStatusKey = (status: unknown): string =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_–—−]+/g, "_")
    .replace(/^halfday$/, "half_day");

const badgeClassForStatus = (status: string): string => {
  if (isHolidayAttendanceCompound(status)) return "badge-soft-info";
  if (status === "present") return "badge-soft-success";
  if (status === "late") return "badge-soft-warning";
  if (status === "absent") return "badge-soft-danger";
  if (status === "half_day" || status === "halfday") return "badge-soft-primary";
  if (status === "holiday" || status === "weekly_holiday") return "badge-soft-info";
  if (status === "leaved" || status === "on_leave") return "badge-soft-secondary";
  return "badge-soft-secondary";
};

const StaffDayWiseLive = () => {
  const routes = all_routes;
  const location = useLocation();
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { departments } = useDepartments();
  const { designations } = useDesignations();

  const today = getTodayLocalYMD();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedDesignationId, setSelectedDesignationId] = useState<string>("");
  const [appliedDate, setAppliedDate] = useState<string>(today);
  const [appliedDepartmentId, setAppliedDepartmentId] = useState<string>("");
  const [appliedDesignationId, setAppliedDesignationId] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
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
      const dateParam = appliedDate > today ? today : appliedDate;
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getEntityAttendanceDayWise("staff", {
          date: dateParam,
          departmentId: appliedDepartmentId ? Number(appliedDepartmentId) : null,
          designationId: appliedDesignationId ? Number(appliedDesignationId) : null,
        });
        if (!cancelled) {
          const payload = response?.data || {};
          setRows(Array.isArray(payload?.rows) ? payload.rows : []);
          setSummary(payload?.summary || null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch staff day-wise report");
          setRows([]);
          setSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [appliedDate, appliedDepartmentId, appliedDesignationId, refreshTick, today]);

  const data = useMemo(
    () =>
      rows.map((row, index) => {
        const status = normalizeStatusKey(row.status || "absent");
        const label = formatAttendanceDayHumanLabel(status);
        return {
          key: String(row.entity_id ?? index + 1),
          entityId: row.entity_id,
          name: row.entity_name || "—",
          attendance: label,
          badgeClass: badgeClassForStatus(status),
          remark: row.remark || "—",
        };
      }),
    [rows]
  );

  const exportColumns = useMemo(
    () => [
      { title: "S.No", dataKey: "key" },
      { title: "Staff", dataKey: "name" },
      { title: "Attendance", dataKey: "attendance" },
      { title: "Remark", dataKey: "remark" },
    ],
    []
  );

  const handleExportExcel = () => {
    const exportRows = data.map((row: any) => ({
      "S.No": row.key,
      Staff: row.name,
      Date: appliedDate,
      Attendance: row.attendance,
      Remark: row.remark,
    }));
    exportToExcel(exportRows, `StaffDayWise_${appliedDate}`);
  };

  const handleExportPDF = () => {
    exportToPDF(data, "Staff Day Wise Report", `StaffDayWise_${appliedDate}`, exportColumns);
  };

  const handlePrint = () => {
    printData("Staff Day Wise Report", exportColumns, data);
  };

  const handleApply = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    setAppliedDate(selectedDate > today ? today : selectedDate);
    setAppliedDepartmentId(selectedDepartmentId);
    setAppliedDesignationId(selectedDesignationId);
    dropdownMenuRef.current?.classList.remove("show");
  };

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    const resetToday = getTodayLocalYMD();
    setSelectedDate(resetToday);
    setSelectedDepartmentId("");
    setSelectedDesignationId("");
    setAppliedDate(resetToday);
    setAppliedDepartmentId("");
    setAppliedDesignationId("");
  };

  const handleRefresh = () => setRefreshTick((prev) => prev + 1);

  const columns = [
    {
      title: "S.No",
      dataIndex: "key",
      sorter: (a: TableData, b: TableData) => compareText(a?.key, b?.key),
    },
    {
      title: "Staff",
      dataIndex: "name",
      render: (text: string, record: any) => (
        <div>
          <p className="text-dark mb-0 fw-semibold">{text}</p>
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
    },
    {
      title: "Attendance",
      dataIndex: "attendance",
      render: (text: string, record: any) => (
        <span className={`badge ${record.badgeClass} d-inline-flex align-items-center`}>
          <i className="ti ti-circle-filled fs-5 me-1" />
          {text}
        </span>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.attendance, b?.attendance),
    },
    {
      title: "Remark",
      dataIndex: "remark",
      sorter: (a: any, b: any) => compareText(a?.remark, b?.remark),
    },
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Staff Day Wise Report</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to="#">Report</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Staff Day Wise Report
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
                <Link to={routes.staffDayWise} className="active">
                  Staff Day Wise
                </Link>
              </li>
              <li>
                <Link to={routes.staffReport} className={location.pathname === routes.staffReport ? "active" : ""}>
                  Staff Report
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
            <h4 className="mb-3">Staff Day Wise Report</h4>
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
                            <label className="form-label">Attendance Date</label>
                            <DatePicker
                              className="form-control datetimepicker"
                              value={dayjs(selectedDate)}
                              onChange={(value: Dayjs | null) => {
                                const next = (value || dayjs()).format("YYYY-MM-DD");
                                setSelectedDate(next > today ? today : next);
                              }}
                              disabledDate={(current) => current && current.isAfter(dayjs(), "day")}
                              allowClear={false}
                              format="DD-MM-YYYY"
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
                <p className="mt-2 mb-0">Loading staff day wise report...</p>
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

export default StaffDayWiseLive;
