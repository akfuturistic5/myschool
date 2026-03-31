import { useEffect, useMemo, useRef, useState } from "react";
import Table from "../../../core/common/dataTable/index";

import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import type { TableData } from "../../../core/data/interface";
import PredefinedDateRanges from "../../../core/common/datePicker";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import { classSection, classSylabus, studentsnumber } from "../../../core/common/selectoption/selectoption";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const ClassReport = () => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections, loading, error } = useClassesWithSections(academicYearId);
  const [selectedClassRow, setSelectedClassRow] = useState<any | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const data = useMemo(
    () =>
      (Array.isArray(classesWithSections) ? classesWithSections : []).map((row: any, index: number) => ({
        key: row.sectionId ?? `${row.classId}-${index}`,
        id: row.classCode || row.classId || "—",
        class: row.className || "—",
        section: row.sectionName || "—",
        noOfStudents: Number(row.noOfStudents ?? 0),
        action: "View Details",
        classId: row.classId,
        sectionId: row.sectionId,
        status: row.status || "Inactive",
      })),
    [classesWithSections]
  );
  const data2 = useMemo(
    () =>
      classStudents.map((student: any, index: number) => ({
        key: student.admission_number || student.id || `class-student-report-${index}`,
        admissionNo: student.admission_number || "—",
        rollNo: student.roll_number || "—",
        name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "—",
        class: student.class_name || selectedClassRow?.class || "—",
        section: student.section_name || "—",
        gender: student.gender || "—",
        parent:
          student.father_name ||
          student.mother_name ||
          [student.guardian_first_name, student.guardian_last_name].filter(Boolean).join(" ") ||
          "—",
        dob: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—",
        status: student.is_active ? "Active" : "Inactive",
        imgSrc: student.photo_url || "",
        parentImgSrc: "",
      })),
    [classStudents, selectedClassRow]
  );
  const routes = all_routes;

  useEffect(() => {
    if (!selectedClassRow?.classId) {
      setClassStudents([]);
      setStudentsError(null);
      return;
    }

    let cancelled = false;

    const fetchStudents = async () => {
      try {
        setStudentsLoading(true);
        setStudentsError(null);
        const response = await apiService.getStudentsByClass(selectedClassRow.classId);
        const rows = Array.isArray(response?.data) ? response.data : [];
        const filteredRows = selectedClassRow.sectionId
          ? rows.filter((student: any) => Number(student.section_id) === Number(selectedClassRow.sectionId))
          : rows;
        if (!cancelled) {
          setClassStudents(filteredRows);
        }
      } catch (err: any) {
        if (!cancelled) {
          setStudentsError(err?.message || "Failed to fetch class students");
          setClassStudents([]);
        }
      } finally {
        if (!cancelled) {
          setStudentsLoading(false);
        }
      }
    };

    fetchStudents();

    return () => {
      cancelled = true;
    };
  }, [selectedClassRow]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (id: string) => (
        <>
          <Link to="#" className="link-primary">
            {id}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.id, b?.id),
    },

    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText(a?.class, b?.class),
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) => compareText(a?.section, b?.section),
    },
    {
      title: "No Of Students",
      dataIndex: "noOfStudents",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.noOfStudents, b?.noOfStudents),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_text: string, record: any) => (
        <>
        <Link
          to="#"
          className="btn btn-light view details"
          data-bs-toggle="modal"
          data-bs-target="#view_class_report"
          onClick={() => setSelectedClassRow(record)}
        >
          View Details
        </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.action, b?.action),
    },
   
  ];
  const columns2 = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      render: (admissionNo: string) => (
        <>
          <Link to="#" className="link-primary">
            {admissionNo}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
    },

    {
      title: "Roll No",
      dataIndex: "rollNo",
      sorter: (a: TableData, b: TableData) => compareText(a?.rollNo, b?.rollNo),
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (_text: string, record: any) => (
        <>
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md">
              <ImageWithBasePath
                src={record.img}
                className="img-fluid rounded-circle"
                alt="img"
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to="#">{record.name}</Link>
              </p>
            </div>
          </div>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.name, b?.name),
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText(a?.class, b?.class),
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) => compareText(a?.section, b?.section),
    },
    {
      title: "Gender",
      dataIndex: "gender",
      sorter: (a: TableData, b: TableData) => compareText(a?.gender, b?.gender),
    },
    {
      title: "Parent",
      dataIndex: "parent",
      render: (_text: string, record: any) => (
        <>
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md">
              <ImageWithBasePath
                src={record.parentimg}
                className="img-fluid rounded-circle"
                alt="img"
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to="#">{record.parent}</Link>
              </p>
            </div>
          </div>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.parent, b?.parent),
    },
    {
      title: "DOB",
      dataIndex: "dob",
      sorter: (a: TableData, b: TableData) => compareText(a?.dob, b?.dob),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : (
            <span className="badge badge-soft-danger d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          )}
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.status, b?.status),
    },
  ];
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Class Report</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Report</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Class Report
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              </div>
            </div>
            {/* /Page Header */}
            {/* Student List */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Class Report List</h4>
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
                    <div className="dropdown-menu drop-width"  ref={dropdownMenuRef}>
                      <form >
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
                                  options={classSylabus}
                                />
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Section</label>
                                <CommonSelect
                                  className="select"
                                  options={classSection}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-0">
                                <label className="form-label">
                                  No Of Students
                                </label>
                                <CommonSelect
                                  className="select"
                                  options={studentsnumber}
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
                        <Link
                          to="#"
                          className="dropdown-item rounded-1 active"
                        >
                          Ascending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Descending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Viewed
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
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
                    <p className="mt-2 mb-0">Loading class report...</p>
                  </div>
                ) : (
                  <>
                    {/* Student List */}
                    <Table columns={columns} dataSource={data} Selection={true} />
                    {/* /Student List */}
                  </>
                )}
              </div>
            </div>
            {/* /Student List */}
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Add Expenses Category */}
        <div className="modal fade" id="view_class_report">
          <div className="modal-dialog modal-dialog-centered  modal-xl">
            <div className="modal-content">
              <div className="modal-wrapper">
                <div className="modal-body">
                  {/* Student List */}
                  {studentsError && (
                    <div className="alert alert-danger mb-3" role="alert">
                      {studentsError}
                    </div>
                  )}
                  {studentsLoading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-2 mb-0">Loading class students...</p>
                    </div>
                  ) : (
                    <Table columns={columns2} dataSource={data2} Selection={true} />
                  )}
                  {/* /Student List */}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* /Add Expenses Category */}
      </>
    </div>
  );
};

export default ClassReport;
