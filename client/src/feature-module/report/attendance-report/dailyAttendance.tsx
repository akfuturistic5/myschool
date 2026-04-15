import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../core/data/redux/authSlice";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const DailyAttendance = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const isTeacherRole = String(user?.role || "").trim().toLowerCase() === "teacher";
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections } = useClassesWithSections(academicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [teacherScopeRows, setTeacherScopeRows] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [reportData, setReportData] = useState<any>({ month: null, days: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const classOptions = useMemo(() => {
    if (isTeacherRole) {
      const seen = new Map<string, { value: string; label: string }>();
      (Array.isArray(teacherScopeRows) ? teacherScopeRows : []).forEach((row: any) => {
        const classId = row?.class_id;
        if (classId == null || seen.has(String(classId))) return;
        seen.set(String(classId), {
          value: String(classId),
          label: row?.class_name || `Class ${classId}`,
        });
      });
      return Array.from(seen.values());
    }
    const seen = new Map<string, { value: string; label: string }>();
    (Array.isArray(classesWithSections) ? classesWithSections : []).forEach((row: any) => {
      if (row?.classId == null || seen.has(String(row.classId))) return;
      seen.set(String(row.classId), {
        value: String(row.classId),
        label: row.className || `Class ${row.classId}`,
      });
    });
    return Array.from(seen.values());
  }, [classesWithSections, isTeacherRole, teacherScopeRows]);

  useEffect(() => {
    if (!isTeacherRole) {
      setTeacherScopeRows([]);
      return;
    }
    let cancelled = false;
    const loadTeacherScope = async () => {
      try {
        const response = await apiService.getTeacherStudents(academicYearId);
        if (!cancelled && response?.status === "SUCCESS") {
          setTeacherScopeRows(Array.isArray(response.data) ? response.data : []);
        }
      } catch (_) {
        if (!cancelled) setTeacherScopeRows([]);
      }
    };
    loadTeacherScope();
    return () => {
      cancelled = true;
    };
  }, [isTeacherRole, academicYearId]);

  useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].value);
    }
  }, [classOptions, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setReportData({ month: null, days: [], rows: [] });
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
          academicYearId,
          month: dayjs(selectedDate).format("YYYY-MM"),
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
  }, [academicYearId, selectedClassId, selectedDate]);

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const data = useMemo(() => {
    const dayKey = dayjs(selectedDate).format("YYYY-MM-DD");
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
      percentange: item.total > 0 ? Number(((item.present / item.total) * 100).toFixed(2)) : 0,
      absentPercentange: item.total > 0 ? Number(((item.absent / item.total) * 100).toFixed(2)) : 0,
    }));
  }, [classOptions, reportData.rows, selectedClassId, selectedDate]);

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
      dataIndex: "percentange",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.percentange, b?.percentange),
      render: (value: number) => `${Number(value ?? 0).toFixed(2)}%`,
    },
    {
      title: " Absent %",
      dataIndex: "absentPercentange",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.absentPercentange, b?.absentPercentange),
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
                <ul className="dropdown-menu  dropdown-menu-end p-3">
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      <i className="ti ti-file-type-pdf me-1" />
                      Export as PDF
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      <i className="ti ti-file-type-xls me-1" />
                      Export as Excel{" "}
                    </Link>
                  </li>
                </ul>
              </div>
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
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
                </div>
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
                    id="modal-datepicker"
                  >
                    <form>
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
                                onChange={(value: Dayjs | null) => setSelectedDate((value || dayjs()).format("YYYY-MM-DD"))}
                                allowClear={false}
                                format="DD-MM-YYYY"
                              />
                            </div>
                          </div>
                          
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3">
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
                <div className="dropdown mb-3">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-sort-ascending-2 me-2" />
                    Sort by A-Z
                  </Link>
                  <ul className="dropdown-menu p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1 active">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Descending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Viewed
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                  </ul>
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
