import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import type { TableData } from "../../../../core/data/interface";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import StudentModals from "../studentModals";
import Table from "../../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../../core/common/datePicker";
import {
  allClass,
  allSection,
  gender,
  names,
  status,
} from "../../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../../core/common/commonSelect";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useStudents } from "../../../../core/hooks/useStudents";
import { useCurrentStudent } from "../../../../core/hooks/useCurrentStudent";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";

const transformStudentToRow = (student: any) => ({
  key: student.admission_number || student.id,
  studentId: student.id,
  student,
  AdmissionNo: student.admission_number,
  RollNo: student.roll_number || "",
  name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
  imgSrc: student.photo_url || "",
  gender: student.gender || "",
  class: student.class_name || "N/A",
  section: student.section_name || "N/A",
  status: student.is_active ? "Active" : "Inactive",
  DateofJoin: student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "",
  DOB: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "",
  action: ""
});

const StudentList = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const role = (user?.role || "").toLowerCase();
  const isStudentRole = role === "student";

  const { students, loading, error } = useStudents();
  const { student: currentStudent, loading: currentStudentLoading, error: currentStudentError } = useCurrentStudent();

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  // For Student role: show only logged-in student's data; otherwise show all students
  const studentsToShow = isStudentRole
    ? currentStudent ? [currentStudent] : []
    : students;

  const listLoading = isStudentRole ? currentStudentLoading : loading;
  const listError = isStudentRole ? currentStudentError : error;
  const fallbackBackTo = getDashboardForRole(user || role);

  const handleBackClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackBackTo);
  };

  // Transform API data to match existing table structure
  const transformedData = studentsToShow.map((student: any) => transformStudentToRow(student));

  const columns = [
    {
      title: "Admission No",
      dataIndex: "AdmissionNo",
      render: (text: string, record: any) => (
        <Link
          to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
          state={record.student ? { student: record.student } : undefined}
          className="link-primary"
        >
          {text}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) =>
        a.AdmissionNo.length - b.AdmissionNo.length,
    },
    {
      title: "Roll No",
      dataIndex: "RollNo",
      sorter: (a: TableData, b: TableData) => a.RollNo.length - b.RollNo.length,
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link
            to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
            state={record.student ? { student: record.student } : undefined}
            className="avatar avatar-md"
          >
            <ImageWithBasePath
              src={record.imgSrc}
              className="img-fluid rounded-circle"
              alt="img"
              gender={record.gender}
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link
                to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
                state={record.student ? { student: record.student } : undefined}
              >
                {text}
              </Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => a.name.length - b.name.length,
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => a.class.length - b.class.length,
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) =>
        a.section.length - b.section.length,
    },
    {
      title: "Gender",
      dataIndex: "gender",
      sorter: (a: TableData, b: TableData) => a.gender.length - b.gender.length,
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
      sorter: (a: TableData, b: TableData) => a.status.length - b.status.length,
    },
    {
      title: "Date of Join",
      dataIndex: "DateofJoin",
      sorter: (a: TableData, b: TableData) =>
        a.DateofJoin.length - b.DateofJoin.length,
    },
    {
      title: "DOB",
      dataIndex: "DOB",
      sorter: (a: TableData, b: TableData) => a.DOB.length - b.DOB.length,
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_text: string, record: any) => (
        <>
          <div className="d-flex align-items-center">
            <Link
              to="#"
              className="btn btn-outline-light bg-white btn-icon d-flex align-items-center justify-content-center rounded-circle  p-0 me-2"
            >
              <i className="ti ti-brand-hipchat" />
            </Link>
            <Link
              to="#"
              className="btn btn-outline-light bg-white btn-icon d-flex align-items-center justify-content-center rounded-circle  p-0 me-2"
            >
              <i className="ti ti-phone" />
            </Link>
            <Link
              to="#"
              className="btn btn-outline-light bg-white btn-icon d-flex align-items-center justify-content-center rounded-circle p-0 me-3"
            >
              <i className="ti ti-mail" />
            </Link>
            <Link
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#add_fees_collect"
              className="btn btn-light fs-12 fw-semibold me-3"
            >
              Collect Fees
            </Link>
            <div className="dropdown">
              <Link
                to="#"
                className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="ti ti-dots-vertical fs-14" />
              </Link>
              <ul className="dropdown-menu dropdown-menu-right p-3">
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
                    state={record.student ? { student: record.student } : undefined}
                  >
                    <i className="ti ti-menu me-2" />
                    View Student
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to={`${routes.editStudent}/${record.studentId}`}
                  >
                    <i className="ti ti-edit-circle me-2" />
                    Edit
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#login_detail"
                  >
                    <i className="ti ti-lock me-2" />
                    Login Details
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item rounded-1" to="#">
                    <i className="ti ti-toggle-right me-2" />
                    Disable
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="student-promotion"
                  >
                    <i className="ti ti-arrow-ramp-right-2 me-2" />
                    Promote Student
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#delete-modal"
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </>
      ),
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
              <button
                type="button"
                className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
                onClick={handleBackClick}
              >
                <i className="ti ti-arrow-left me-1" />
                Back
              </button>
              <h3 className="page-title mb-1">Students List</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Students</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    All Students
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />

              <div className="mb-2">
                <Link
                  to={routes.addStudent}
                  className="btn btn-primary d-flex align-items-center"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Student
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Students List</h4>
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
                      <div className="p-3 pb-0 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={allClass}
                                defaultValue={allClass[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={allSection}
                                defaultValue={allSection[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Name</label>
                              <CommonSelect
                                className="select"
                                options={names}
                                defaultValue={names[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Gender</label>
                              <CommonSelect
                                className="select"
                                options={gender}
                                defaultValue={gender[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={status}
                                defaultValue={status[0]}
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
                          to={routes.studentGrid}
                          className="btn btn-primary"
                          onClick={handleApplyClick}
                        >
                          Apply
                        </Link>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="d-flex align-items-center bg-white border rounded-2 p-1 mb-3 me-2">
                  <Link
                    to={routes.studentList}
                    className="active btn btn-icon btn-sm me-1 primary-hover"
                  >
                    <i className="ti ti-list-tree" />
                  </Link>
                  <Link
                    to={routes.studentGrid}
                    className="btn btn-icon btn-sm bg-light primary-hover"
                  >
                    <i className="ti ti-grid-dots" />
                  </Link>
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
              {/* Student List */}
              {listLoading ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading students...</p>
                </div>
              ) : listError ? (
                <div className="text-center p-4">
                  <div className="alert alert-danger" role="alert">
                    <i className="ti ti-alert-circle me-2"></i>
                    {listError}
                  </div>
                </div>
              ) : (
                <Table dataSource={transformedData} columns={columns} Selection={true} />
              )}
              {/* /Student List */}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <StudentModals />
    </>
  );
};

export default StudentList;
