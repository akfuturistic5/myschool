import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import dayjs from "dayjs";
import type { TableData } from "../../../core/data/interface";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useStudents } from "../../../core/hooks/useStudents";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const StudentAttendanceType = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { students } = useStudents();
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([{ value: "all", label: "All Classes" }]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [appliedClassId, setAppliedClassId] = useState<string>("all");
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
        void sectionsResult;

        const nextClassOptions = [{ value: "all", label: "All Classes" }].concat(
          classes.map((item: any) => ({
            value: String(item.id),
            label: item.class_name || `Class ${item.id}`,
          }))
        );
        setClassOptions(nextClassOptions);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load class/section options");
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
          sectionId: null,
          academicYearId,
          month: dayjs().format("YYYY-MM"),
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
  }, [academicYearId, appliedClassId, refreshTick]);

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    setAppliedClassId(selectedClassId);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  const handleResetFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedClassId("all");
    setAppliedClassId("all");
  };
  const handleRefresh = () => setRefreshTick((prev) => prev + 1);

  const studentMap = useMemo(() => {
    const map = new Map<string, any>();
    (Array.isArray(students) ? students : []).forEach((student: any) => {
      map.set(String(student.id), student);
    });
    return map;
  }, [students]);

  const data = useMemo(() => {
    return (Array.isArray(reportData.rows) ? reportData.rows : [])
      .map((row: any, index: number) => {
        const student = studentMap.get(String(row.studentId)) || {};
        const counts = Object.values(row.daily || {}).reduce(
          (acc: Record<string, number>, status: any) => {
            const key = String(status || "");
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          },
          { present: 0, late: 0, half_day: 0, absent: 0, holiday: 0 }
        );
        return {
          key: String(index + 1),
          studentId: row.studentId,
          admissionNo: row.admissionNo || "—",
          date: student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "—",
          name: row.name || "—",
          img: row.img || "",
          gender: row.gender || student.gender || "",
          class: student.class_name || "—",
          dob: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—",
          fatherName: student.father_name || student.mother_name || "—",
          count: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
          presentCount: counts.present || 0,
          lateCount: counts.late || 0,
          halfDayCount: counts.half_day || 0,
          absentCount: counts.absent || 0,
          holidayCount: counts.holiday || 0,
        };
      });
  }, [reportData.rows, studentMap]);

  const exportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Date of Admission", dataKey: "date" },
      { title: "Student Name", dataKey: "name" },
      { title: "Class", dataKey: "class" },
      { title: "Date of Birth", dataKey: "dob" },
      { title: "Father Name", dataKey: "fatherName" },
      { title: "Count", dataKey: "count" },
      { title: "Present", dataKey: "presentCount" },
      { title: "Late", dataKey: "lateCount" },
      { title: "Half Day", dataKey: "halfDayCount" },
      { title: "Absent", dataKey: "absentCount" },
      { title: "Holiday", dataKey: "holidayCount" },
    ],
    []
  );
  const handleExportExcel = () => {
    const rows = data.map((row: any) => ({
      "Admission No": row.admissionNo,
      "Date of Admission": row.date,
      "Student Name": row.name,
      Class: row.class,
      "Date of Birth": row.dob,
      "Father Name": row.fatherName,
      Count: row.count,
      Present: row.presentCount,
      Late: row.lateCount,
      "Half Day": row.halfDayCount,
      Absent: row.absentCount,
      Holiday: row.holidayCount,
    }));
    exportToExcel(rows, `StudentAttendanceType_${dayjs().format("YYYY-MM-DD")}`);
  };
  const handleExportPDF = () => {
    exportToPDF(
      data,
      "Students Attendance Type",
      `StudentAttendanceType_${dayjs().format("YYYY-MM-DD")}`,
      exportColumns
    );
  };
  const handlePrint = () => {
    printData("Students Attendance Type", exportColumns, data);
  };

  const columns = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      render: (text: string, record: any) => (
        <>
          <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList} className="link-primary">
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
      sorter: (a: any, b: any) => compareText(a?.fatherName, b?.fatherName),
    },
    {
      title: "Count",
      dataIndex: "count",
      sorter: (a: any, b: any) => compareNumber(a?.count, b?.count),
    },

    {
      title: "Present",
      dataIndex: "presentCount",
      sorter: (a: any, b: any) => compareNumber(a?.presentCount, b?.presentCount),
    },
    {
      title: "Late",
      dataIndex: "lateCount",
      sorter: (a: any, b: any) => compareNumber(a?.lateCount, b?.lateCount),
    },
    {
      title: "Half Day",
      dataIndex: "halfDayCount",
      sorter: (a: any, b: any) => compareNumber(a?.halfDayCount, b?.halfDayCount),
    },
    {
      title: "Absent",
      dataIndex: "absentCount",
      sorter: (a: any, b: any) => compareNumber(a?.absentCount, b?.absentCount),
    },
    {
      title: "Holiday",
      dataIndex: "holidayCount",
      sorter: (a: any, b: any) => compareNumber(a?.holidayCount, b?.holidayCount),
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
                          <div className="col-md-12">
                            <div className="mb-0" />
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
