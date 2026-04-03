import { useRef, useState, useMemo } from "react";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  AdmissionNumber,
  classSection,
  RollNumber,
  studentclass,
  studentName,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { useStudents } from "../../../core/hooks/useStudents";
import { useSelector } from "react-redux";
import { selectUser } from "../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../core/utils/roleUtils";

const transformStudentToAttendanceRow = (student: Record<string, unknown>, index: number) => ({
  key: student.id ?? index,
  admissionNo: student.admission_number ?? "—",
  rollNo: student.roll_number ?? "—",
  name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "—",
  class: student.class_name ?? "—",
  section: student.section_name ?? "—",
  img: student.photo_url ?? "assets/img/students/student-01.jpg",
  notes: "",
  attendance: "",
  present: "true",
  Late: "",
  Absent: "",
  Holiday: "",
  Halfday: "",
});

const StudentAttendance = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const role = (user?.role || "").toLowerCase();
  const dashboardRoute = getDashboardForRole(role);
  const { students, loading, error, refetch } = useStudents();

  const data = useMemo(() => {
    return (students ?? []).map((s: Record<string, unknown>, i: number) =>
      transformStudentToAttendanceRow(s, i)
    );
  }, [students]);

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const columns = [
    {
      title: "AdmissionNo",
      dataIndex: "admissionNo",
      render: (_: unknown, record: Record<string, unknown>) => (
        <>
          <Link to="#" className="link-primary">
            {record.admissionNo}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) =>
        String(a.admissionNo ?? "").length - String(b.admissionNo ?? "").length,
    },
    {
      title: "Roll No",
      dataIndex: "rollNo",
      sorter: (a: TableData, b: TableData) =>
        String(a.rollNo ?? "").length - String(b.rollNo ?? "").length,
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (text: string, record: Record<string, unknown>) => (
        <div className="d-flex align-items-center">
          <Link to="#" className="avatar avatar-md">
            <ImageWithBasePath
              src={String(record.img ?? "")}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to="#">{text}</Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => String(a.name ?? "").length - String(b.name ?? "").length,
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) =>
        String(a.class ?? "").length - String(b.class ?? "").length,
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) =>
        String(a.section ?? "").length - String(b.section ?? "").length,
    },
    {
      title: "Attendance",
      dataIndex: "attendance",
      render: (record: Record<string, unknown>) => (
        <div className="d-flex align-items-center check-radio-group flex-nowrap">
          <label className="custom-radio">
            <input
              type="radio"
              name={`student${record.key}`}
              defaultChecked={record.present === "true"}
            />
            <span className="checkmark" />
            Present
          </label>
          <label className="custom-radio">
            <input
              type="radio"
              name={`student${record.key}`}
              defaultChecked={record.Late === "true"}
            />
            <span className="checkmark" />
            Late
          </label>
          <label className="custom-radio">
            <input
              type="radio"
              name={`student${record.key}`}
              defaultChecked={record.Absent === "true"}
            />
            <span className="checkmark" />
            Absent
          </label>
          <label className="custom-radio">
            <input
              type="radio"
              name={`student${record.key}`}
              defaultChecked={record.Holiday === "true"}
            />
            <span className="checkmark" />
            Holiday
          </label>
          <label className="custom-radio">
            <input
              type="radio"
              name={`student${record.key}`}
              defaultChecked={record.Halfday === "true"}
            />
            <span className="checkmark" />
            Halfday
          </label>
        </div>
      ),
      sorter: (a: TableData, b: TableData) =>
        String(a.attendance ?? "").length - String(b.attendance ?? "").length,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      render: () => (
        <div>
          <input
            type="text"
            className="form-control"
            placeholder="Enter Name"
          />
        </div>
      ),
      sorter: (a: TableData, b: TableData) => String(a.notes ?? "").length - String(b.notes ?? "").length,
    },
  ];

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Student Attendance</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={dashboardRoute}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Student Attendance
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
            </div>
          </div>
          {/* /Page Header */}

          {error && (
            <div className="alert alert-danger mb-3" role="alert">
              <i className="ti ti-alert-circle me-2" />
              {error}
              <button
                type="button"
                className="btn btn-sm btn-outline-danger ms-2"
                onClick={() => refetch()}
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="d-flex justify-content-center align-items-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="ms-2">Loading students...</span>
            </div>
          )}

          {!loading && (
            <>
              {/* Student List */}
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                  <h4 className="mb-3">Student Attendance List</h4>
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
                      >
                        <form>
                          <div className="d-flex align-items-center border-bottom p-3">
                            <h4>Filter</h4>
                          </div>
                          <div className="p-3 border-bottom">
                            <div className="row">
                              <div className="col-md-6">
                                <div className="mb-3">
                                  <label className="form-label">Admission No</label>
                                  <CommonSelect
                                    className="select"
                                    options={AdmissionNumber}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="mb-3">
                                  <label className="form-label">Roll No</label>
                                  <CommonSelect
                                    className="select"
                                    options={RollNumber}
                                  />
                                </div>
                              </div>
                              <div className="col-md-12">
                                <div className="mb-3">
                                  <label className="form-label">Name</label>
                                  <CommonSelect
                                    className="select"
                                    options={studentName}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="mb-0">
                                  <label className="form-label">Class</label>
                                  <CommonSelect
                                    className="select"
                                    options={studentclass}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="mb-0">
                                  <label className="form-label">Section</label>
                                  <CommonSelect
                                    className="select"
                                    options={classSection}
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
                  {data.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <p className="mb-0">No students found.</p>
                      <p className="mb-0 fs-14">Students will appear here when they are assigned to your classes.</p>
                    </div>
                  ) : (
                    <Table dataSource={data} columns={columns} Selection={true} />
                  )}
                </div>
              </div>
              {/* /Student List */}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAttendance;
