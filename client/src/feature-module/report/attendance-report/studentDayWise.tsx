import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { apiService } from "../../../core/services/apiService";
import {
  formatAttendanceDayHumanLabel,
  isHolidayAttendanceCompound,
} from "../../../core/utils/attendanceReportStatus";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const StudentDayWise = () => {
  const routes = all_routes;
  const location = useLocation();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([{ value: "all", label: "All Classes" }]);
  const [sectionsByClassId, setSectionsByClassId] = useState<Record<string, Array<{ value: string; label: string }>>>(
    {}
  );
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [appliedClassId, setAppliedClassId] = useState<string>("all");
  const [appliedSectionId, setAppliedSectionId] = useState<string>("");
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
        const [classesResult, sectionsResult] = await Promise.allSettled([classesPromise, apiService.getSections()]);
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

        const nextClassOptions = [{ value: "all", label: "All Classes" }].concat(
          classes.map((item: any) => ({
            value: String(item.id),
            label: item.class_name || `Class ${item.id}`,
          }))
        );
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
      const allRows = Object.values(sectionsByClassId).flat();
      const seen = new Set<string>();
      const uniqueRows = allRows.filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      });
      return [{ value: "", label: "All Sections" }, ...uniqueRows];
    }
    const rows = Array.isArray(sectionsByClassId[String(selectedClassId)]) ? sectionsByClassId[String(selectedClassId)] : [];
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
          month: dayjs(appliedDate).format("YYYY-MM"),
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
  }, [academicYearId, appliedClassId, appliedSectionId, appliedDate, refreshTick]);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setAppliedClassId(selectedClassId);
    setAppliedSectionId(selectedSectionId);
    setAppliedDate(selectedDate);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    const today = dayjs().format("YYYY-MM-DD");
    setSelectedClassId("all");
    setSelectedSectionId("");
    setSelectedDate(today);
    setAppliedClassId("all");
    setAppliedSectionId("");
    setAppliedDate(today);
  };

  const handleRefresh = () => setRefreshTick((prev) => prev + 1);

  const data = useMemo(() => {
    const dayKey = dayjs(appliedDate).format("YYYY-MM-DD");
    return (Array.isArray(reportData.rows) ? reportData.rows : [])
      .map((row: any, index: number) => {
        const status = row.daily?.[dayKey];
        if (!status) return null;
        const label = formatAttendanceDayHumanLabel(status);
        let badgeClass = "badge-soft-secondary";
        if (isHolidayAttendanceCompound(status)) {
          badgeClass = "badge-soft-info";
        } else if (status === "present") {
          badgeClass = "badge-soft-success";
        } else if (status === "late") {
          badgeClass = "badge-soft-warning";
        } else if (status === "absent") {
          badgeClass = "badge-soft-danger";
        } else if (status === "half_day") {
          badgeClass = "badge-soft-primary";
        } else if (status === "holiday") {
          badgeClass = "badge-soft-info";
        }

        return {
          key: String(index + 1),
          studentId: row.studentId,
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
  }, [appliedDate, reportData.rows]);

  const exportColumns = useMemo(
    () => [
      { title: "S.No", dataKey: "key" },
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Name", dataKey: "name" },
      { title: "Attendance", dataKey: "attendance" },
    ],
    []
  );

  const handleExportExcel = () => {
    const rows = data.map((row: any) => ({
      "S.No": row.key,
      "Admission No": row.admissionNo,
      "Roll No": row.rollNo,
      Name: row.name,
      Attendance: row.attendance,
    }));
    exportToExcel(rows, `StudentDayWise_${appliedDate}`);
  };

  const handleExportPDF = () => {
    exportToPDF(data, "Student Day Wise Report", `StudentDayWise_${appliedDate}`, exportColumns);
  };

  const handlePrint = () => {
    printData("Student Day Wise Report", exportColumns, data);
  };

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
          <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList} className="avatar avatar-md">
            <ImageWithBasePath
              src={record.img}
              className="img-fluid rounded-circle"
              alt="img"
              gender={record.gender}
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}>{text}</Link>
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
                  <Link to={routes.staffDayWise} className={location.pathname === routes.staffDayWise ? "active" : ""}>
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
            {/* /List Tab */}
          </div>
          {/* /Filter Section */}

          {/* Attendance List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Student Day Wise Report</h4>
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
                                onChange={(value) => setSelectedClassId(String(value || "all"))}
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
