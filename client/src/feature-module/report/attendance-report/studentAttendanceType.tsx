import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker } from "antd";
import type { TableData } from "../../../core/data/interface";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useStudents } from "../../../core/hooks/useStudents";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const attendanceTypeOptions = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "half_day", label: "Half Day" },
  { value: "absent", label: "Absent" },
  { value: "holiday", label: "Holiday" },
];

const StudentAttendanceType = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections } = useClassesWithSections(academicYearId);
  const { students } = useStudents();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedAttendanceType, setSelectedAttendanceType] = useState<string>("present");
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

  const studentOptions = useMemo(() => {
    const base = [{ value: "", label: "All Students" }];
    const items = (Array.isArray(students) ? students : [])
      .filter((student: any) => !selectedClassId || String(student.class_id) === String(selectedClassId))
      .filter((student: any) => !selectedSectionId || String(student.section_id) === String(selectedSectionId))
      .map((student: any) => ({
        value: String(student.id),
        label: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student",
      }));
    return base.concat(items);
  }, [selectedClassId, selectedSectionId, students]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

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
          setError(err?.message || "Failed to fetch student attendance type report");
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

  const getModalContainer = () => {
    const modalElement = document.getElementById("modal-datepicker");
    return modalElement ? modalElement : document.body;
  };
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const studentMap = useMemo(() => {
    const map = new Map<string, any>();
    (Array.isArray(students) ? students : []).forEach((student: any) => {
      map.set(String(student.id), student);
    });
    return map;
  }, [students]);

  const data = useMemo(() => {
    return (Array.isArray(reportData.rows) ? reportData.rows : [])
      .filter((row: any) => !selectedStudentId || String(row.studentId) === selectedStudentId)
      .map((row: any, index: number) => {
        const student = studentMap.get(String(row.studentId)) || {};
        const count = Object.values(row.daily || {}).filter((status) => status === selectedAttendanceType).length;
        return {
          key: String(index + 1),
          admissionNo: row.admissionNo || "—",
          date: student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "—",
          name: row.name || "—",
          img: row.img || "",
          gender: row.gender || student.gender || "",
          class: student.class_name || "—",
          dob: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—",
          fatherName: student.father_name || student.mother_name || "—",
          count,
        };
      });
  }, [reportData.rows, selectedAttendanceType, selectedStudentId, studentMap]);

  const columns = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      render: (text: string) => (
        <>
          <Link to="#" className="link-primary">
            {text}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
    },
    {
      title: " Date of Admission",
      dataIndex: "date",
      sorter: (a: TableData, b: TableData) => compareText(a?.date, b?.date),
    },

    {
      title: "Student Name",
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
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText(a?.class, b?.class),
    },
    {
      title: "Date of Birth",
      dataIndex: "dob",
      sorter: (a: TableData, b: TableData) => compareText(a?.dob, b?.dob),
    },
    {
      title: "Father Name",
      dataIndex: "fatherName",
      sorter: (a: TableData, b: TableData) => compareText(a?.fatherName, b?.fatherName),
    },

    {
      title: "Count",
      dataIndex: "count",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.count, b?.count),
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
              <h3 className="page-title mb-1">Students Attendance Type</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Students Attendance Type
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
                  <Link to={routes.studentAttendanceType} className="active">
                    Students Attendance Type
                  </Link>
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
            {/* /List Tab */}
          </div>
          {/* /Filter Section */}
         
          {/* Attendance List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Students Attendance Type</h4>
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
                              <label className="form-label">Name</label>
                              <CommonSelect
                                className="select"
                                options={studentOptions}
                                value={selectedStudentId}
                                onChange={(value) => setSelectedStudentId(value ?? "")}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Attendance Type</label>
                              <CommonSelect
                                className="select"
                                options={attendanceTypeOptions}
                                value={selectedAttendanceType}
                                onChange={(value) => setSelectedAttendanceType(value || "present")}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Date of Admission</label>
                              <div className="date-pic">
                                <DatePicker
                                  className="form-control datetimepicker"
                                  format={{
                                    format: "DD-MM-YYYY",
                                    type: "mask",
                                  }}
                                  getPopupContainer={getModalContainer}
                                  value={dayjs(selectedDate)}
                                  onChange={(value: Dayjs | null) => setSelectedDate((value || dayjs()).format("YYYY-MM-DD"))}
                                  placeholder="16 May 2024"
                                  allowClear={false}
                                />
                                <span className="cal-icon">
                                  <i className="ti ti-calendar" />
                                </span>
                              </div>
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
                  <p className="mt-2 mb-0">Loading students attendance type report...</p>
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

export default StudentAttendanceType;
