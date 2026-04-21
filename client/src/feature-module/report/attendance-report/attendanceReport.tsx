import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import type { TableData } from "../../../core/data/interface";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../core/data/redux/authSlice";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import {
  formatAttendanceDayHumanLabel,
  getCompoundHolidayAttendancePart,
  isHolidayAttendanceCompound,
} from "../../../core/utils/attendanceReportStatus";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const statusClassMap: Record<string, string> = {
  present: "bg-success",
  late: "bg-pending",
  half_day: "bg-dark",
  absent: "bg-danger",
  holiday: "bg-info",
};
const statusTextMap: Record<string, string> = {
  present: "P",
  absent: "A",
  late: "L",
  holiday: "H",
  half_day: "HD",
};

const formatStatusLabel = (status: string | null | undefined) => formatAttendanceDayHumanLabel(status);

const AttendanceReport = () => {
  const routes = all_routes;
  const location = useLocation();
  const user = useSelector(selectUser);
  const isTeacherRole = String(user?.role || "").trim().toLowerCase() === "teacher";
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [sectionsByClassId, setSectionsByClassId] = useState<Record<string, Array<{ value: string; label: string }>>>(
    {}
  );
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format("YYYY-MM"));
  const [appliedClassId, setAppliedClassId] = useState<string>("all");
  const [appliedSectionId, setAppliedSectionId] = useState<string>("");
  const [appliedMonth, setAppliedMonth] = useState<string>(dayjs().format("YYYY-MM"));
  const [refreshTick, setRefreshTick] = useState(0);
  const [reportData, setReportData] = useState<any>({ month: null, days: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchFilterOptions = async () => {
      try {
        const classesPromise = academicYearId ? apiService.getClassesByAcademicYear(academicYearId) : apiService.getClasses();
        const [classesResult, sectionsResult] = await Promise.allSettled([
          classesPromise,
          apiService.getSections(academicYearId ? { academic_year_id: academicYearId } : {}),
        ]);

        if (cancelled) return;

        const classesResponse =
          classesResult.status === "fulfilled" && Array.isArray(classesResult.value?.data) ? classesResult.value : null;
        const classesFallbackResponse =
          academicYearId &&
          (!classesResponse || (Array.isArray(classesResponse.data) && classesResponse.data.length === 0))
            ? await apiService.getClasses().catch(() => null)
            : null;
        const classes = Array.isArray(classesResponse?.data)
          ? classesResponse.data
          : Array.isArray(classesFallbackResponse?.data)
            ? classesFallbackResponse.data
            : [];
        const sections =
          sectionsResult.status === "fulfilled" && Array.isArray(sectionsResult.value?.data) ? sectionsResult.value.data : [];
        const nextClassOptions = [{ value: "all", label: "All Classes" }, ...classes.map((item: any) => ({
          value: String(item.id),
          label: item.class_code
            ? `${item.class_name || `Class ${item.id}`} (${item.class_code})`
            : (item.class_name || `Class ${item.id}`),
        }))];

        const nextSectionsByClassId: Record<string, Array<{ value: string; label: string }>> = {};
        sections.forEach((section: any) => {
          const classKey = String(section.class_id);
          if (!nextSectionsByClassId[classKey]) {
            nextSectionsByClassId[classKey] = [];
          }
          nextSectionsByClassId[classKey].push({
            value: String(section.id),
            label: section.section_name || `Section ${section.id}`,
          });
        });

        setClassOptions(nextClassOptions);
        setSectionsByClassId(nextSectionsByClassId);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load class/section options");
          setClassOptions([{ value: "all", label: "All Classes" }]);
          setSectionsByClassId({});
        }
      }
    };

    fetchFilterOptions();
    return () => {
      cancelled = true;
    };
  }, [academicYearId]);

  const sectionOptions = useMemo(() => {
    if (selectedClassId === "all") {
      return [{ value: "", label: "Select class first" }];
    }
    const classKey = String(selectedClassId || "");
    const rows = Array.isArray(sectionsByClassId[classKey]) ? sectionsByClassId[classKey] : [];
    return [{ value: "", label: "All Sections" }, ...rows];
  }, [sectionsByClassId, selectedClassId]);

  useEffect(() => {
    if (selectedSectionId && !sectionOptions.some((option) => option.value === selectedSectionId)) {
      setSelectedSectionId("");
    }
  }, [sectionOptions, selectedSectionId]);

  useEffect(() => {
    let cancelled = false;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getAttendanceReport({
          classId: appliedClassId !== "all" ? appliedClassId : null,
          sectionId: appliedSectionId || null,
          academicYearId,
          month: appliedMonth,
        });
        if (!cancelled) {
          setReportData(res?.data || { month: appliedMonth, days: [], rows: [] });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch attendance report");
          setReportData({ month: appliedMonth, days: [], rows: [] });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [academicYearId, appliedClassId, appliedSectionId, appliedMonth, refreshTick]);

  const data = useMemo(
    () =>
      (Array.isArray(reportData.rows) ? reportData.rows : []).map((row: any, index: number) => ({
        key: row.studentId ?? `attendance-report-${index}`,
        ...row,
      })),
    [reportData.rows]
  );

  const dayColumns = useMemo(
    () =>
      (Array.isArray(reportData.days) ? reportData.days : []).map((day: any) => ({
        title: (
          <div className="text-center">
            <span className="day-num d-block">{String(day.day).padStart(2, "0")}</span>
            <span>{String(day.weekdayShort || "").charAt(0)}</span>
          </div>
        ),
        key: day.date,
        render: (_text: any, record: any) => {
          const status = record.daily?.[day.date];
          const hasStatus = Boolean(status);
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
          if (!hasStatus) {
            return (
              <span
                className="attendance-range"
                style={{
                  display: "inline-flex",
                  minWidth: 14,
                  justifyContent: "center",
                  color: "#6c757d",
                  fontWeight: 600,
                }}
                title={`${day.date}: Not Marked`}
              >
                -
              </span>
            );
          }
          if (isHolidayAttendanceCompound(status)) {
            const rest = getCompoundHolidayAttendancePart(status);
            const subText = statusTextMap[rest] || "?";
            const subCls = statusClassMap[rest] || "bg-light";
            return (
              <span
                style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
                title={`${day.date}: ${formatAttendanceDayHumanLabel(status)}`}
              >
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
          return (
            <span
              className={`attendance-range ${cls}`.trim()}
              style={pillStyle}
              title={`${day.date}: ${formatAttendanceDayHumanLabel(status)}`}
            >
              {statusTextMap[status] || "-"}
            </span>
          );
        },
      })),
    [reportData.days]
  );

  const columns = useMemo(
    () => [
      {
        title: "Student/Date",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <div className="d-flex align-items-center">
            <Link
              to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
              className="avatar avatar-md"
            >
              <ImageWithBasePath
                src={record.img}
                className="img-fluid rounded-circle"
                alt="img"
                gender={record.gender}
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}>
                  {text || "—"}
                </Link>
              </p>
              <span className="fs-12">Roll No : {record.rollNo || "—"}</span>
            </div>
          </div>
        ),
        sorter: (a: TableData, b: TableData) => compareText(a?.name, b?.name),
        fixed: "left",
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
      {
        title: "P",
        key: "present",
        render: (_text: any, record: any) => record.summary?.present ?? 0,
      },
      {
        title: "L",
        key: "late",
        render: (_text: any, record: any) => record.summary?.late ?? 0,
      },
      {
        title: "A",
        key: "absent",
        render: (_text: any, record: any) => record.summary?.absent ?? 0,
      },
      {
        title: "H",
        key: "holiday",
        render: (_text: any, record: any) => record.summary?.holiday ?? 0,
      },
      {
        title: "HD",
        key: "halfDay",
        render: (_text: any, record: any) => record.summary?.halfDay ?? 0,
      },
      ...dayColumns,
    ],
    [dayColumns]
  );

  // Export rows/columns are defined further down (including day-wise columns).

  const handleApply = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    setAppliedClassId(selectedClassId);
    setAppliedSectionId(selectedSectionId);
    setAppliedMonth(selectedMonth);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    const fallbackClass = "all";
    setSelectedClassId(fallbackClass);
    setSelectedSectionId("");
    setSelectedMonth(dayjs().format("YYYY-MM"));
    setAppliedClassId(fallbackClass);
    setAppliedSectionId("");
    setAppliedMonth(dayjs().format("YYYY-MM"));
  };

  const exportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Student", dataKey: "name" },
      { title: "Section", dataKey: "sectionName" },
      { title: "Attendance %", dataKey: "attendancePercentage" },
      { title: "Present", dataKey: "presentCount" },
      { title: "Late", dataKey: "lateCount" },
      { title: "Absent", dataKey: "absentCount" },
      { title: "Holiday", dataKey: "holidayCount" },
      { title: "Half Day", dataKey: "halfDayCount" },
    ],
    []
  );

  const exportRows = useMemo(
    () =>
      data.map((row: any) => ({
        admissionNo: row.admissionNo || "—",
        rollNo: row.rollNo || "—",
        name: row.name || "—",
        sectionName: row.sectionName || "—",
        attendancePercentage: `${row.summary?.percentage ?? 0}%`,
        presentCount: row.summary?.present ?? 0,
        lateCount: row.summary?.late ?? 0,
        absentCount: row.summary?.absent ?? 0,
        holidayCount: row.summary?.holiday ?? 0,
        halfDayCount: row.summary?.halfDay ?? 0,
        daily: row.daily || {},
      })),
    [data]
  );

  const handleExportExcel = () => {
    const dayExportColumns = (Array.isArray(reportData.days) ? reportData.days : []).map((day: any) => ({
      key: String(day.date),
      label: `${String(day.day).padStart(2, "0")} ${String(day.weekdayShort || "").toUpperCase()}`,
    }));
    const rows = exportRows.map((item) => {
      const baseRow: Record<string, string | number> = {
        "Admission No": item.admissionNo,
        "Roll No": item.rollNo,
        Student: item.name,
        Section: item.sectionName,
        "Attendance %": item.attendancePercentage,
        Present: item.presentCount,
        Late: item.lateCount,
        Absent: item.absentCount,
        Holiday: item.holidayCount,
        "Half Day": item.halfDayCount,
      };
      dayExportColumns.forEach((col) => {
        const status = item.daily?.[col.key];
        baseRow[col.label] = status ? formatAttendanceDayHumanLabel(status) : "-";
      });
      return baseRow;
    });
    exportToExcel(rows, `AttendanceReport_${appliedMonth}`);
  };

  const handleExportPDF = () => {
    exportToPDF(exportRows, "Attendance Report", `AttendanceReport_${appliedMonth}`, exportColumns);
  };

  const handlePrint = () => {
    printData("Attendance Report", exportColumns, exportRows);
  };

  const handleRefresh = () => {
    setRefreshTick((prev) => prev + 1);
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Attendance Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Attendance Report
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
                  <Link to={routes.attendanceReport} className="active">
                    Attendance Report
                  </Link>
                </li>
                <li>
                  <Link to={routes.studentAttendanceType}>Students Attendance Type</Link>
                </li>
                <li>
                  <Link to={routes.dailyAttendance}>Daily Attendance</Link>
                </li>
                <li>
                  <Link to={routes.studentDayWise}>Student Day Wise</Link>
                </li>
                {!isTeacherRole && (
                  <li>
                    <Link to={routes.staffDayWise} className={location.pathname === routes.staffDayWise ? "active" : ""}>
                      Staff Day Wise
                    </Link>
                  </li>
                )}
                {!isTeacherRole && (
                  <li>
                    <Link to={routes.staffReport} className={location.pathname === routes.staffReport ? "active" : ""}>
                      Staff Report
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="attendance-types page-header justify-content-end">
            <ul className="attendance-type-list">
              <li>
                <span className="attendance-icon bg-success">
                  <i className="ti ti-checks" />
                </span>
                Present
              </li>
              <li>
                <span className="attendance-icon bg-danger">
                  <i className="ti ti-x" />
                </span>
                Absent
              </li>
              <li>
                <span className="attendance-icon bg-pending">
                  <i className="ti ti-clock-x" />
                </span>
                Late
              </li>
              <li>
                <span className="attendance-icon bg-dark">
                  <i className="ti ti-calendar-event" />
                </span>
                Halfday
              </li>
              <li>
                <span className="attendance-icon bg-info">
                  <i className="ti ti-clock-up" />
                </span>
                Holiday
              </li>
            </ul>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <div className="mb-3">
                <h4 className="mb-1">Attendance Report</h4>
                <p className="text-muted mb-0">{reportData.month || selectedMonth}</p>
              </div>
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
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classOptions}
                                value={selectedClassId}
                                onChange={(value) => {
                                  const nextClassId = String(value || "all");
                                  setSelectedClassId(nextClassId);
                                  if (nextClassId === "all") {
                                    setSelectedSectionId("");
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionOptions}
                                value={selectedSectionId ?? ""}
                                disabled={selectedClassId === "all"}
                                onChange={(value) => setSelectedSectionId(value ?? "")}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Month</label>
                              <DatePicker
                                picker="month"
                                className="form-control datetimepicker"
                                value={dayjs(`${selectedMonth}-01`)}
                                onChange={(value: Dayjs | null) => setSelectedMonth((value || dayjs()).format("YYYY-MM"))}
                                allowClear={false}
                                getPopupContainer={() => dropdownMenuRef.current || document.body}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link
                          to="#"
                          className="btn btn-light me-3"
                          onClick={handleReset}
                        >
                          Reset
                        </Link>
                        <Link to="#" className="btn btn-primary" onClick={handleApply}>
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
                  <p className="mt-2 mb-0">Loading attendance report...</p>
                </div>
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

export default AttendanceReport;
