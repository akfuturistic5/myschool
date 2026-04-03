import  { useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { all_routes } from '../../../router/all_routes'
import ImageWithBasePath from '../../../../core/common/imageWithBasePath'
import PredefinedDateRanges from '../../../../core/common/datePicker'
import { allClass, names } from '../../../../core/common/selectoption/selectoption'
import TeacherModal from '../teacherModal'
import CommonSelect from '../../../../core/common/commonSelect'
import TooltipOption from '../../../../core/common/tooltipOption'
import { useTeachers } from '../../../../core/hooks/useTeachers.js'
import { useCurrentTeacher } from '../../../../core/hooks/useCurrentTeacher.js'
import { selectUser } from '../../../../core/data/redux/authSlice'
import { getDashboardForRole } from '../../../../core/utils/roleUtils'

const TeacherGrid = () => {
    const routes = all_routes
    const location = useLocation();
    const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
    const user = useSelector(selectUser);
    const role = (user?.role || '').toLowerCase();
    const isTeacherRole = role === 'teacher';

    const { teachers, loading, error } = useTeachers();
    const { teacher: currentTeacher, loading: currentTeacherLoading, error: currentTeacherError } = useCurrentTeacher();

    // For Teacher role: show only logged-in teacher's data; otherwise show all teachers
    const teachersToShow = isTeacherRole
      ? (currentTeacher ? [currentTeacher] : [])
      : teachers;

    const listLoading = isTeacherRole ? currentTeacherLoading : loading;
    const listError = isTeacherRole ? currentTeacherError : error;
    const backTo = isTeacherRole ? getDashboardForRole(role) : routes.teacherList;

    const handleApplyClick = () => {
      if (dropdownMenuRef.current) {
        dropdownMenuRef.current.classList.remove('show');
      }
    };

    // Show loading state
    if (listLoading) {
      return (
        <div className="page-wrapper">
          <div className="content content-two">
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
          <div className="content content-two">
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
    <div className="content content-two">
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
          <h3 className="page-title mb-1">Teachers </h3>
          <nav>
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <Link to={routes.adminDashboard}>Dashboard</Link>
              </li>
              <li className="breadcrumb-item">Peoples</li>
              <li className="breadcrumb-item active" aria-current="page">
                Teachers{" "}
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
      <div className="bg-white p-3 border rounded-1 d-flex align-items-center justify-content-between flex-wrap mb-4 pb-0">
        <h4 className="mb-3">Teachers Grid</h4>
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
            <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
              <form >
                <div className="d-flex align-items-center border-bottom p-3">
                  <h4>Filter</h4>
                </div>
                <div className="p-3 pb-0 border-bottom">
                  <div className="row">
                    <div className="col-md-6">
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
                        <label className="form-label">Class</label>
                        <CommonSelect
                        className="select"
                        options={allClass}
                        defaultValue={allClass[0]}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 d-flex align-items-center justify-content-end">
                  <Link to="#" className="btn btn-light me-3">
                    Reset
                  </Link>
                  <Link to={routes.teacherGrid} onClick={handleApplyClick} className="btn btn-primary">
                    Apply
                  </Link>
                </div>
              </form>
            </div>
          </div>
          <div className="d-flex align-items-center bg-white border rounded-2 p-1 mb-3 me-2">
            <Link
              to={routes.teacherList}
              className=" btn btn-icon btn-sm me-1 bg-light primary-hover"
            >
              <i className="ti ti-list-tree" />
            </Link>
            <Link
              to={routes.teacherGrid}
              className=" active btn btn-icon btn-sm  primary-hover"
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
              Sort by A-Z{" "}
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
      <div className="row">
        {/* Teacher Grid */}
        {teachersToShow.map((teacher: any, index: number) => (
          <div key={teacher.id} className="col-xxl-3 col-xl-4 col-md-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header d-flex align-items-center justify-content-between">
              <Link
                to={routes.teacherDetails}
                state={{ teacherId: teacher.id, teacher }}
                className="link-primary"
              >
                  {teacher.employee_code || `T${teacher.id}`}
                </Link>
                <div className="d-flex align-items-center">
                  <span className={`badge ${(teacher.status === 'Active' || teacher.is_active === true || teacher.is_active === 1) ? 'badge-soft-success' : 'badge-soft-danger'} d-inline-flex align-items-center me-1`}>
                    <i className="ti ti-circle-filled fs-5 me-1" />
                    {(teacher.status === 'Active' || teacher.is_active === true || teacher.is_active === 1) ? 'Active' : 'Inactive'}
                  </span>
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
                          to={routes.editTeacher}
                          state={{ teacherId: teacher.id, teacher }}
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
                          data-bs-target="#delete-modal"
                        >
                          <i className="ti ti-trash-x me-2" />
                          Delete
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <div className="bg-light-300 rounded-2 p-3 mb-3">
                  <div className="d-flex align-items-center">
                    <Link
                      to={routes.teacherDetails}
                      state={{ teacherId: teacher.id, teacher }}
                      className="avatar avatar-lg flex-shrink-0"
                    >
                      <ImageWithBasePath
                        src={teacher.photo_url || `assets/img/teachers/teacher-0${(index % 8) + 1}.jpg`}
                        className="img-fluid rounded-circle"
                        alt="img"
                      />
                    </Link>
                    <div className="ms-2">
                      <h6 className="text-dark text-truncate mb-0">
                        <Link
                          to={routes.teacherDetails}
                          state={{ teacherId: teacher.id, teacher }}
                        >{`${teacher.first_name} ${teacher.last_name}`}</Link>
                      </h6>
                      <p>{teacher.class_name || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-2">
                    <p className="mb-0">Email</p>
                    <p className="text-dark">{teacher.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="mb-0">Phone</p>
                    <p className="text-dark">{teacher.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="card-footer d-flex align-items-center justify-content-between">
                <span className="badge badge-soft-danger">{teacher.subject_name || 'N/A'}</span>
                <Link
                  to={routes.teacherDetails}
                  state={{ teacherId: teacher.id, teacher }}
                  className="btn btn-light btn-sm"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ))}
        {/* /Teacher Grid */}
        <div className="text-center">
          <Link
            to="#"
            className="btn btn-primary d-inline-flex align-items-center"
          >
            <i className="ti ti-loader-3 me-2" />
            Load More
          </Link>
        </div>
      </div>
    </div>
  </div>
  {/* /Page Wrapper */}
  <TeacherModal/>
</>

  )
}

export default TeacherGrid