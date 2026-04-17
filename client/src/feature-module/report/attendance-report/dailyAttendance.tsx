import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../core/data/redux/authSlice";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const DailyAttendance = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const isTeacherRole = String(user?.role || "").trim().toLowerCase() === "teacher";
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([{ value: "all", label: "All Classes" }]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [appliedClassId, setAppliedClassId] = useState<string>("all");
  const [appliedDate, setAppliedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [refreshTick, setRefreshTick] = useState(0);
  const [reportData, setReportData] = useState<any>({ month: null, days: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchFilterOptions = async () => {
      try {
        const classesPromise = academicYearId ? apiService.getClassesByAcademicYear(academicYearId) : apiService.getClasses();
        const classesResult = await classesPromise.catch(() => null);
        if (cancelled) return;

        const fallbackClasses =
          academicYearId &&
          (!Array.isArray(classesResult?.data) || classesResult.data.length === 0)
            ? await apiService.getClasses().catch(() => null)
            : null;
        const classes = Array.isArray(classesResult?.data)
          ? classesResult.data
          : Array.isArray(fallbackClasses?.data)
            ? fallbackClasses.data
            : [];

        setClassOptions([
          { value: "all", label: "All Classes" },
          ...classes.map((item: any) => ({
            value: String(item.id),
            label: item.class_name || `Class ${item.id}`,
          })),
        ]);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load class options");
          setClassOptions([{ value: "all", label: "All Classes" }]);
        }
      }
    };

    fetchFilterOptions();
    return () => {
      cancelled = true;
    };
  }, [academicYearId]);

  useEffect(() => {
    let cancelled = false;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getAttendanceReport({
          classId: appliedClassId !== "all" ? appliedClassId : null,
          academicYearId,
          month: dayjs(appliedDate).format("YYYY-MM"),
        });
        if (!cancelled) {
          setReportData(res?.data || { month: null, days: [], rows: [] });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch daily attendance");
          setReportData({ month: null, days: [], rows: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [academicYearId, appliedClassId, appliedDate, refreshTick]);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setAppliedClassId(selectedClassId);
    setAppliedDate(selectedDate);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    const today = dayjs().format("YYYY-MM-DD");
    setSelectedClassId("all");
    setSelectedDate(today);
    setAppliedClassId("all");
    setAppliedDate(today);
  };

  const handleRefresh = () => setRefreshTick((prev) => prev + 1);

  const data = useMemo(() => {
    const dayKey = dayjs(appliedDate).format("YYYY-MM-DD");
    const grouped = new Map<string, any>();

    (Array.isArray(reportData.rows) ? reportData.rows : []).forEach((row: any) => {
      const status = row.daily?.[dayKey];
      const groupKey = row.sectionName || "N/A";
      const current = grouped.get(groupKey) || {
        key: groupKey,
        class: classOptions.find((item) => item.value === selectedClassId)?.label || "—",
        section: row.sectionName || "N/A",
        present: 0,
        absent: 0,
        total: 0,
      };

      if (status) {
        current.total += 1;
        if (status === "present" || status === "late") current.present += 1;
        if (status === "absent" || status === "half_day") current.absent += 1;
      }
      grouped.set(groupKey, current);
    });

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      percentage: item.total > 0 ? Number(((item.present / item.total) * 100).toFixed(2)) : 0,
      absentPercentage: item.total > 0 ? Number(((item.absent / item.total) * 100).toFixed(2)) : 0,
    }));
  }, [appliedDate, classOptions, reportData.rows, selectedClassId]);

  const exportColumns = useMemo(
    () => [
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Total Present", dataKey: "present" },
      { title: "Total Absent", dataKey: "absent" },
      { title: "Present %", dataKey: "percentageLabel" },
      { title: "Absent %", dataKey: "absentPercentageLabel" },
    ],
    []
  );

  const exportRows = useMemo(
    () =>
      data.map((row: any) => ({
        ...row,
        percentageLabel: `${Number(row.percentage ?? 0).toFixed(2)}%`,
        absentPercentageLabel: `${Number(row.absentPercentage ?? 0).toFixed(2)}%`,
      })),
    [data]
  );

  const handleExportExcel = () => {
    const rows = exportRows.map((row: any) => ({
      Class: row.class,
      Section: row.section,
      "Total Present": row.present,
      "Total Absent": row.absent,
      "Present %": row.percentageLabel,
      "Absent %": row.absentPercentageLabel,
    }));
    exportToExcel(rows, `DailyAttendance_${appliedDate}`);
  };

  const handleExportPDF = () => {
    exportToPDF(exportRows, "Daily Attendance", `DailyAttendance_${appliedDate}`, exportColumns);
  };

  const handlePrint = () => {
    printData("Daily Attendance", exportColumns, exportRows);
  };

  const columns = [
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText(a?.class, b?.class),
    },
    {
      title: " Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) => compareText(a?.section, b?.section),
    },
    {
      title: " Total Present",
      dataIndex: "present",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.present, b?.present),
    },
    {
      title: " Total Absent",
      dataIndex: "absent",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.absent, b?.absent),
    },
    {
      title: " Present %",
      dataIndex: "percentage",
      sorter: (a: any, b: any) => compareNumber(a?.percentage, b?.percentage),
      render: (value: number) => `${Number(value ?? 0).toFixed(2)}%`,
    },
    {
      title: " Absent %",
      dataIndex: "absentPercentage",
      sorter: (a: any, b: any) => compareNumber(a?.absentPercentage, b?.absentPercentage),
      render: (value: number) => `${Number(value ?? 0).toFixed(2)}%`,
    },
  ];
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Daily Attendance</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                  Daily Attendance
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
          {/* /Page Header */}
          {/* Filter Section */}
          <div className="filter-wrapper">
            {/* List Tab */}
            <div className="list-tab">
              <ul>
                <li>
                  <Link to={routes.attendanceReport}>Attendance Report</Link>
                </li>
                <li>
                  <Link to={routes.dailyAttendance} className="active">Daily Attendance</Link>
                </li>
                {!isTeacherRole && (
                  <>
                    <li>
                      <Link to={routes.staffDayWise}>Staff Day Wise</Link>
                    </li>
                    <li>
                      <Link to={routes.staffReport}>Staff Report</Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
            {/* /List Tab */}
          </div>
          {/* /Filter Section */}
         
          {/* Attendance List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Daily Attendance</h4>
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
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classOptions}
                                value={selectedClassId}
                                onChange={(value) => setSelectedClassId(String(value || "all"))}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Attendance Date</label>

                              <DatePicker
                                className="form-control datetimepicker"
                                value={dayjs(selectedDate)}
                                onChange={(value: Dayjs | null) => setSelectedDate((value || dayjs()).format("YYYY-MM-DD"))}
                                allowClear={false}
                                format="DD-MM-YYYY"
                                getPopupContainer={() => dropdownMenuRef.current || document.body}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={handleResetFilters}>
                          Reset
                        </Link>
                        <Link
                          to="#"
                          className="btn btn-primary"
                          onClick={handleApplyClick}
                        >
                          Apply
                        </Link>
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
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 mb-0">Loading daily attendance...</p>
                </div>
              ) : (
                <Table dataSource={data} columns={columns} Selection={false} />
              )}
            </div>
          </div>
          {/* /Attendance List */}
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default DailyAttendance;
