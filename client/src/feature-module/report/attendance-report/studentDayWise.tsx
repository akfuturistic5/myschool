import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const StudentDayWise = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections } = useClassesWithSections(academicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
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
          sectionId: selectedSectionId || null,
          academicYearId,
          month: dayjs(selectedDate).format("YYYY-MM"),
        });
        if (!cancelled) {
          setReportData(res?.data || { month: null, days: [], rows: [] });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch student day wise report");
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
  }, [academicYearId, selectedClassId, selectedSectionId, selectedDate]);

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const data = useMemo(() => {
    const dayKey = dayjs(selectedDate).format("YYYY-MM-DD");
    return (Array.isArray(reportData.rows) ? reportData.rows : [])
      .map((row: any, index: number) => {
        const status = row.daily?.[dayKey];
        if (!status) return null;
        const label =
          status === "present" ? "Present" :
          status === "late" ? "Late" :
          status === "absent" ? "Absent" :
          status === "half_day" ? "Half Day" :
          status === "holiday" ? "Holiday" : "—";
        const badgeClass =
          status === "present" ? "badge-soft-success" :
          status === "late" ? "badge-soft-warning" :
          status === "absent" ? "badge-soft-danger" :
          status === "half_day" ? "badge-soft-primary" :
          "badge-soft-info";

        return {
          key: String(index + 1),
          admissionNo: row.admissionNo || "—",
          rollNo: row.rollNo || "—",
          name: row.name || "—",
          img: row.img || "",
          gender: row.gender || "",
          attendance: label,
          badgeClass,
        };
      })
      .filter(Boolean);
  }, [reportData.rows, selectedDate]);

  const columns = [
    {
      title: "S.No",
      dataIndex: "key",
      sorter: (a: TableData, b: TableData) => compareText(a?.key, b?.key),
    },
    {
      title: " Adminssion No",
      dataIndex: "admissionNo",
      sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
    },
    {
      title: " Roll No",
      dataIndex: "rollNo",
      sorter: (a: TableData, b: TableData) => compareText(a?.rollNo, b?.rollNo),
    },
    {
      title: " Name",
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
              <Link to="#">{text}</Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.name, b?.name),
    },
    {
      title: " Attendance",
      dataIndex: "attendance",
      render: (text: string, record: any) => (
        <span className={`badge ${record.badgeClass} d-inline-flex align-items-center`}>
          <i className="ti ti-circle-filled fs-5 me-1"></i>{text}
        </span>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.attendance, b?.attendance),
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
              <h3 className="page-title mb-1">Student Day Wise Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Student Day Wise Report
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
                  <Link to={routes.studentAttendanceType}>
                    Students Attendance Type
                  </Link>
                </li>
                <li>
                  <Link to={routes.dailyAttendance}>Daily Attendance</Link>
                </li>
                <li>
                  <Link to={routes.studentDayWise} className="active">
                    Student Day Wise
                  </Link>
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
            {/* /List Tab */}
          </div>
          {/* /Filter Section */}

          {/* Attendance List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Student Day Wise Report</h4>
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
                            <div className="mb-3">
                              <label className="form-label">
                                Attendance Date
                              </label>
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
                  <p className="mt-2 mb-0">Loading student day wise report...</p>
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

export default StudentDayWise;
