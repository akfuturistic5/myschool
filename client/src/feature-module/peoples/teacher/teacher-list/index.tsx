import  { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import CommonSelect from "../../../../core/common/commonSelect";
import {
  allClass,
  names,
  status,
} from "../../../../core/common/selectoption/selectoption";
import TeacherModal from "../teacherModal";
import PredefinedDateRanges from "../../../../core/common/datePicker";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useTeachers } from "../../../../core/hooks/useTeachers.js";
import { useCurrentTeacher } from "../../../../core/hooks/useCurrentTeacher.js";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";

const TeacherList = () => {
  const routes = all_routes;
  const location = useLocation();
  const user = useSelector(selectUser);
  const role = (user?.role || "").toLowerCase();
  const isTeacherRole = role === "teacher";

  const { teachers, loading, error, refetch } = useTeachers();
  const { teacher: currentTeacher, loading: currentTeacherLoading, error: currentTeacherError } = useCurrentTeacher();

  // For Teacher role: show only logged-in teacher's data; otherwise show all teachers
  const teachersToShow = isTeacherRole
    ? (currentTeacher ? [currentTeacher] : [])
    : teachers;

  const listLoading = isTeacherRole ? currentTeacherLoading : loading;
  const listError = isTeacherRole ? currentTeacherError : error;
  const backTo = isTeacherRole ? getDashboardForRole(role) : routes.teacherGrid;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Transform API data to match existing table structure
  const transformedData = teachersToShow.map((teacher: any) => ({
    key: teacher.id,
    teacherId: teacher.id,
    teacher,
    img: teacher.photo_url || `assets/img/teachers/teacher-0${(teacher.id % 8) + 1}.jpg`, // Fallback to default images
    id: teacher.id,
    name: `${teacher.first_name} ${teacher.last_name}`,
    class: teacher.class_name || 'N/A',
    subject: teacher.subject_name || 'N/A',
    email: teacher.email || 'N/A',
    phone: teacher.phone || 'N/A',
    dateofJoin: teacher.joining_date ? new Date(teacher.joining_date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) : 'N/A',
    status: teacher.status === 'Active' || teacher.is_active === true || teacher.is_active === 1 
      ? 'Active' 
      : 'Inactive',
    statusclass: (teacher.status === 'Active' || teacher.is_active === true || teacher.is_active === 1) 
      ? "badge badge-soft-success" 
      : "badge badge-soft-danger",
    action: ''
  }));

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: string, record: any) => (
        <Link
          to={routes.teacherDetails}
          state={{ teacherId: record.teacherId, teacher: record.teacher }}
          className="link-primary"
        >
          {text}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => (Number(a.id) || 0) - (Number(b.id) || 0),
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link
            to={routes.teacherDetails}
            state={{ teacherId: record.teacherId, teacher: record.teacher }}
            className="avatar avatar-md"
          >
            <ImageWithBasePath
              src={record.img}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link
                to={routes.teacherDetails}
                state={{ teacherId: record.teacherId, teacher: record.teacher }}
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
      title: "Subject",
      dataIndex: "subject",
      sorter: (a: TableData, b: TableData) =>
        a.subject.length - b.subject.length,
    },
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a: TableData, b: TableData) => a.email.length - b.email.length,
    },
    {
      title: "Phone",
      dataIndex: "phone",
      sorter: (a: TableData, b: TableData) => a.phone.length - b.phone.length,
    },
    {
      title: "Date Of Join",
      dataIndex: "dateofJoin",
      sorter: (a: TableData, b: TableData) =>
        a.dateofJoin.length - b.dateofJoin.length,
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
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <>
          <div className="d-flex align-items-center">
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
                    to={routes.teacherDetails}
                    state={{ teacherId: record.teacherId, teacher: record.teacher }}
                  >
                    <i className="ti ti-menu me-2" />
                    View Teacher
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to={routes.editTeacher}
                    state={{ teacherId: record.teacherId, teacher: record.teacher }}
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

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  // Show loading state
  if (listLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (listError) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger m-3" role="alert">
            <h4 className="alert-heading">Error Loading Teachers</h4>
            <p>{listError}</p>
            <hr />
            <p className="mb-0">Please try refreshing the page or contact support if the problem persists.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <Link
                to={backTo}
                className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
              >
                <i className="ti ti-arrow-left me-1" />
                Back
              </Link>
              <h3 className="page-title mb-1">Teacher List</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Peoples</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Teacher List
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              {!isTeacherRole && (
                <div className="mb-2">
                  <Link
                    to={routes.addTeacher}
                    className="btn btn-primary d-flex align-items-center"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Add Teacher
                  </Link>
                </div>
              )}
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Teachers List</h4>
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
                    className="dropdown-menu drop-width "
                    ref={dropdownMenuRef}
                  >
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom pb-0">
                        <div className="row">
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
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={allClass}
                                defaultValue={allClass[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
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
                <div className="d-flex align-items-center bg-white border rounded-2 p-1 mb-3 me-2">
                  <Link
                    to="#"
                    className="active btn btn-icon btn-sm me-1 primary-hover"
                  >
                    <i className="ti ti-list-tree" />
                  </Link>
                  <Link
                    to={routes.teacherGrid}
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

              <Table dataSource={transformedData} columns={columns} Selection={true} />
              {/* /Student List */}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <TeacherModal />
    </>
  );
};

export default TeacherList;
