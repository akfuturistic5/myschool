import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import type { TableData } from "../../../core/data/interface";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

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

const AttendanceReport = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections } = useClassesWithSections(academicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format("YYYY-MM"));
  const [reportData, setReportData] = useState<any>({ month: null, days: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const classOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    (Array.isArray(classesWithSections) ? classesWithSections : []).forEach((row: any) => {
      if (row?.classId == null || seen.has(String(row.classId))) return;
      seen.set(String(row.classId), {
        value: String(row.classId),
        label: row.className || `Class ${row.classId}`,
      });
    });
    return Array.from(seen.values());
  }, [classesWithSections]);

  const sectionOptions = useMemo(() => {
    const base = [{ value: "", label: "All Sections" }];
    const items = (Array.isArray(classesWithSections) ? classesWithSections : [])
      .filter((row: any) => String(row.classId) === String(selectedClassId || ""))
      .filter((row: any) => row?.sectionId != null)
      .map((row: any) => ({
        value: String(row.sectionId),
        label: row.sectionName || `Section ${row.sectionId}`,
      }));
    const seen = new Set<string>();
    return base.concat(
      items.filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      })
    );
  }, [classesWithSections, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].value);
    }
  }, [classOptions, selectedClassId]);

  useEffect(() => {
    if (selectedSectionId && !sectionOptions.some((option) => option.value === selectedSectionId)) {
      setSelectedSectionId("");
    }
  }, [sectionOptions, selectedSectionId]);

  useEffect(() => {
    if (!selectedClassId) {
      setReportData({ month: selectedMonth, days: [], rows: [] });
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getAttendanceReport({
          classId: selectedClassId,
          sectionId: selectedSectionId || null,
          academicYearId,
          month: selectedMonth,
        });
        if (!cancelled) {
          setReportData(res?.data || { month: selectedMonth, days: [], rows: [] });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch attendance report");
          setReportData({ month: selectedMonth, days: [], rows: [] });
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
  }, [academicYearId, selectedClassId, selectedSectionId, selectedMonth]);

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
          const cls = status ? statusClassMap[status] || "bg-light" : "";
          return <span className={`attendance-range ${cls}`.trim()} style={!status ? { opacity: 0.15 } : undefined}></span>;
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
            <Link to="#" className="avatar avatar-md">
              <ImageWithBasePath
                src={record.img}
                className="img-fluid rounded-circle"
                alt="img"
                gender={record.gender}
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to="#">{text || "—"}</Link>
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
        title: "F",
        key: "halfDay",
        render: (_text: any, record: any) => record.summary?.halfDay ?? 0,
      },
      ...dayColumns,
    ],
    [dayColumns]
  );

  const handleApply = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
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
              <TooltipOption />
              <div className="dropdown me-2 mb-2">
                <Link
                  to="#"
                  className="dropdown-toggle btn btn-light fw-medium d-inline-flex align-items-center"
                  data-bs-toggle="dropdown"
                >
                  <i className="ti ti-file-export me-2" />
                  Export
                </Link>
                <ul className="dropdown-menu dropdown-menu-end p-3">
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      <i className="ti ti-file-type-pdf me-1" />
                      Export as PDF
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      <i className="ti ti-file-type-xls me-1" />
                      Export as Excel
                    </Link>
                  </li>
                </ul>
              </div>
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
                <li>
                  <Link to={routes.teacherDayWise}>Teacher Day Wise</Link>
                </li>
                <li>
                  <Link to={routes.teacherReport}>Teacher Report</Link>
                </li>
                <li>
                  <Link to={routes.staffDayWise}>Staff Day Wise</Link>
                </li>
                <li>
                  <Link to={routes.staffReport}>Staff Report</Link>
                </li>
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
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
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
                                onChange={(value) => setSelectedClassId(value)}
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
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link
                          to="#"
                          className="btn btn-light me-3"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedSectionId("");
                            setSelectedMonth(dayjs().format("YYYY-MM"));
                          }}
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
