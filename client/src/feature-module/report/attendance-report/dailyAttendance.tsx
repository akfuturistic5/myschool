import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { apiService } from "../../../core/services/apiService";
import { getDailyAttendancePresentAbsentBucket } from "../../../core/utils/attendanceReportStatus";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../core/data/redux/authSlice";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const DailyAttendance = () => {
  const routes = all_routes;
  const location = useLocation();
  const user = useSelector(selectUser);
  const isTeacherRole = String(user?.role || "").trim().toLowerCase() === "teacher";
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "all", label: "All Classes" },
  ]);
  const [sectionLabelById, setSectionLabelById] = useState<Record<string, string>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [appliedClassId, setAppliedClassId] = useState<string>("all");
  const [appliedDate, setAppliedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [refreshTick, setRefreshTick] = useState(0);
  const [rosterRows, setRosterRows] = useState<any[]>([]);
  const [activeHoliday, setActiveHoliday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchFilterOptions = async () => {
      if (academicYearId == null) {
        setClassOptions([{ value: "all", label: "All Classes" }]);
        setSectionLabelById({});
        return;
      }
      try {
        const [classesResult, sectionsResult] = await Promise.allSettled([
          apiService.getClasses(academicYearId),
          apiService.getSections(),
        ]);
        if (cancelled) return;

        const classesResponse =
          classesResult.status === "fulfilled" && Array.isArray(classesResult.value?.data)
            ? classesResult.value
            : null;
        const classes =
          Array.isArray(classesResponse?.data) && classesResponse.data.length > 0
            ? classesResponse.data
            : [];

        const sections =
          sectionsResult.status === "fulfilled" && Array.isArray(sectionsResult.value?.data)
            ? sectionsResult.value.data
            : [];

        const nextSectionLabels: Record<string, string> = {};
        sections.forEach((section: any) => {
          nextSectionLabels[String(section.id)] =
            section.section_name || `Section ${section.id}`;
        });

        setClassOptions([
          { value: "all", label: "All Classes" },
          ...classes.map((item: any) => ({
            value: String(item.id),
            label: item.class_name || `Class ${item.id}`,
          })),
        ]);
        setSectionLabelById(nextSectionLabels);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load class options");
          setClassOptions([{ value: "all", label: "All Classes" }]);
          setSectionLabelById({});
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
      if (academicYearId == null) {
        setLoading(false);
        setError("Select an academic year from the header to load daily attendance.");
        setRosterRows([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getAttendanceMarkingRoster("student", {
          date: appliedDate,
          classId: appliedClassId !== "all" ? appliedClassId : null,
          academicYearId,
        });
        if (!cancelled) {
          setRosterRows(Array.isArray(res?.data) ? res.data : []);
          setActiveHoliday(res?.holiday || null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch daily attendance");
          setRosterRows([]);
          setActiveHoliday(null);
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

  const classLabelById = useMemo(() => {
    const map = new Map<string, string>();
    classOptions.forEach((opt) => {
      if (opt.value !== "all") map.set(opt.value, opt.label);
    });
    return map;
  }, [classOptions]);

  const resolveDayStatus = (rawStatus: unknown) => {
    const trimmed = String(rawStatus || "").trim();
    if (trimmed) return trimmed;
    if (activeHoliday) return String(activeHoliday).trim();
    return "absent";
  };

  const data = useMemo(() => {
    const grouped = new Map<string, any>();

    rosterRows.forEach((row: any) => {
      const classId = String(row.class_id ?? "");
      const sectionId = String(row.section_id ?? "");
      const groupKey = `${classId || "0"}-${sectionId || "0"}`;
      const status = resolveDayStatus(row.status);

      const current = grouped.get(groupKey) || {
        key: groupKey,
        classId,
        sectionId,
        class:
          classLabelById.get(classId) ||
          (classId ? `Class ${classId}` : "—"),
        section:
          sectionLabelById[sectionId] ||
          (sectionId ? `Section ${sectionId}` : "—"),
        present: 0,
        absent: 0,
        total: 0,
      };

      current.total += 1;
      const bucket = getDailyAttendancePresentAbsentBucket(status);
      if (bucket === "present_side") current.present += 1;
      else if (bucket === "absent_side") current.absent += 1;

      grouped.set(groupKey, current);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        percentage:
          item.total > 0 ? Number(((item.present / item.total) * 100).toFixed(2)) : 0,
        absentPercentage:
          item.total > 0 ? Number(((item.absent / item.total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => compareText(a.class, b.class) || compareText(a.section, b.section));
  }, [activeHoliday, classLabelById, rosterRows, sectionLabelById]);

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
      <div className="page-wrapper">
        <div className="content">
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

          <div className="filter-wrapper">
            <div className="list-tab">
              <ul>
                <li>
                  <Link to={routes.attendanceReport}>Attendance Report</Link>
                </li>
                <li>
                  <Link to={routes.studentAttendanceType}>Students Attendance Type</Link>
                </li>
                <li>
                  <Link to={routes.dailyAttendance} className="active">
                    Daily Attendance
                  </Link>
                </li>
                <li>
                  <Link to={routes.studentDayWise}>Student Day Wise</Link>
                </li>
                {!isTeacherRole && (
                  <>
                    <li>
                      <Link
                        to={routes.staffDayWise}
                        className={location.pathname === routes.staffDayWise ? "active" : ""}
                      >
                        Staff Day Wise
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.staffReport}
                        className={location.pathname === routes.staffReport ? "active" : ""}
                      >
                        Staff Report
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

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
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                                onChange={(value: Dayjs | null) =>
                                  setSelectedDate((value || dayjs()).format("YYYY-MM-DD"))
                                }
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
                        <Link to="#" className="btn btn-primary" onClick={handleApplyClick}>
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
              ) : data.length === 0 ? (
                <div className="text-center py-5 text-muted">No attendance data for this date.</div>
              ) : (
                <Table dataSource={data} columns={columns} Selection={false} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DailyAttendance;
