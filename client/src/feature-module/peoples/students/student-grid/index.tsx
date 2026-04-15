import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { all_routes } from '../../../router/all_routes'
import ImageWithBasePath from '../../../../core/common/imageWithBasePath'
import { allClass, allSection, gender, names, status } from '../../../../core/common/selectoption/selectoption'
import StudentModals from '../studentModals'
import CommonSelect from '../../../../core/common/commonSelect'
import TooltipOption from '../../../../core/common/tooltipOption'
import PredefinedDateRanges from '../../../../core/common/datePicker'
import { useStudents } from '../../../../core/hooks/useStudents'
import { useCurrentStudent } from '../../../../core/hooks/useCurrentStudent'
import { selectUser } from '../../../../core/data/redux/authSlice'
import { getDashboardForRole } from '../../../../core/utils/roleUtils'

const StudentGrid = () => {
  const routes = all_routes
  const navigate = useNavigate()
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null)
  const user = useSelector(selectUser)
  const role = (user?.role || '').toLowerCase()
  const isStudentRole = role === 'student'

  const { students, loading, error } = useStudents()
  const { student: currentStudent, loading: currentStudentLoading, error: currentStudentError } = useCurrentStudent()

  const studentsToShow = isStudentRole ? (currentStudent ? [currentStudent] : []) : students
  const gridLoading = isStudentRole ? currentStudentLoading : loading
  const gridError = isStudentRole ? currentStudentError : error
  const fallbackBackTo = getDashboardForRole(user || role)

  const handleBackClick = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(fallbackBackTo)
  }

  const transformStudent = (student: any) => ({
        id: student.id,
        admission_number: student.admission_number,
        first_name: student.first_name,
        last_name: student.last_name,
        full_name: `${student.first_name} ${student.last_name}`,
        roll_number: student.roll_number,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        admission_date: student.admission_date,
        photo_url: student.photo_url,
        class_name: student.class_name,
        section_name: student.section_name,
        class_section: `${student.class_name || 'N/A'}, ${student.section_name || 'N/A'}`,
    status: student.is_active ? 'Active' : 'Inactive',
    student
  })

  const transformedData = studentsToShow.map((student: any) => transformStudent(student))

  const handleApplyClick = () => {
      if (dropdownMenuRef.current) {
        dropdownMenuRef.current.classList.remove('show');
      }
    };
  return (
    <>
  {/* Page Wrapper */}
  <div className="page-wrapper">
    <div className="content content-two">
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
          <h3 className="page-title mb-1">Students</h3>
          <nav>
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <Link to={routes.adminDashboard}>Dashboard</Link>
              </li>
              <li className="breadcrumb-item">Peoples</li>
              <li className="breadcrumb-item active" aria-current="page">
                Students Grid
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
      {/* Filter */}
      <div className="bg-white p-3 border rounded-1 d-flex align-items-center justify-content-between flex-wrap mb-4 pb-0">
        <h4 className="mb-3">Students Grid</h4>
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
                  <Link to={routes.studentGrid} className="btn btn-primary" onClick={handleApplyClick}>
                    Apply
                  </Link>
                </div>
              </form>
            </div>
          </div>
          <div className="d-flex align-items-center bg-white border rounded-2 p-1 mb-3 me-2">
            <Link
              to={routes.studentList}
              className="btn btn-icon btn-sm me-1 bg-light primary-hover"
            >
              <i className="ti ti-list-tree" />
            </Link>
            <Link
              to={routes.studentGrid}
              className="active btn btn-icon btn-sm primary-hover"
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
      {/* /Filter */}
      <div className="row">
        {gridLoading ? (
          <div className="col-12 text-center">
            <div className="d-flex align-items-center justify-content-center">
              <i className="ti ti-loader ti-spin fs-24 me-2"></i>
              <span>Loading students...</span>
            </div>
          </div>
        ) : gridError ? (
          <div className="col-12 text-center">
            <div className="alert alert-danger">
              <i className="ti ti-alert-circle me-2"></i>
              Error: {gridError}
            </div>
          </div>
        ) : transformedData.length === 0 ? (
          <div className="col-12 text-center">
            <div className="alert alert-info">
              <i className="ti ti-info-circle me-2"></i>
              No students found.
            </div>
          </div>
        ) : (
          transformedData.map((student: any, idx: number) => (
            <div key={`student-${idx}-${student.id ?? 'u'}`} className="col-xxl-3 col-xl-4 col-md-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <Link
                    to={student.id ? `${routes.studentDetail}/${student.id}` : routes.studentList}
                    state={student.student ? { student: student.student } : undefined}
                    className="link-primary"
                  >
                    {student.admission_number}
                  </Link>
                  <div className="d-flex align-items-center">
                    <span className={`badge badge-soft-${student.status === 'Active' ? 'success' : 'danger'} d-inline-flex align-items-center me-1`}>
                      <i className="ti ti-circle-filled fs-5 me-1" />
                      {student.status}
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
                            to={student.id ? `${routes.studentDetail}/${student.id}` : routes.studentList}
                            state={student.student ? { student: student.student } : undefined}
                          >
                            <i className="ti ti-menu me-2" />
                            View Student
                          </Link>
                        </li>
                        <li>
                          <Link
                            className="dropdown-item rounded-1"
                            to={`${routes.editStudent}/${student.id}`}
                          >
                            <i className="ti ti-edit-circle me-2" />
                            Edit
                          </Link>
                        </li>
                        <li>
                          <Link
                            className="dropdown-item rounded-1"
                            to={routes.studentPromotion}
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
                </div>
                <div className="card-body">
                  <div className="bg-light-300 rounded-2 p-3 mb-3">
                    <div className="d-flex align-items-center">
                      <Link
                        to={student.id ? `${routes.studentDetail}/${student.id}` : routes.studentList}
                        state={student.student ? { student: student.student } : undefined}
                        className="avatar avatar-lg flex-shrink-0"
                      >
                        <ImageWithBasePath
                          src={student.photo_url || "assets/img/students/student-01.jpg"}
                          className="img-fluid rounded-circle"
                          alt="img"
                          gender={student.gender}
                        />
                      </Link>
                      <div className="ms-2">
                        <h5 className="mb-0">
                          <Link
                            to={student.id ? `${routes.studentDetail}/${student.id}` : routes.studentList}
                            state={student.student ? { student: student.student } : undefined}
                          >
                            {student.full_name}
                          </Link>
                        </h5>
                        <p>{student.class_section}</p>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between gx-2">
                    <div>
                      <p className="mb-0">Roll No</p>
                      <p className="text-dark">{student.roll_number}</p>
                    </div>
                    <div>
                      <p className="mb-0">Gender</p>
                      <p className="text-dark">{student.gender}</p>
                    </div>
                    <div>
                      <p className="mb-0">Joined On</p>
                      <p className="text-dark">{student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="card-footer d-flex align-items-center justify-content-between">
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
                  </div>
                  <Link
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#add_fees_collect"
                    className="btn btn-light btn-sm fw-semibold"
                  >
                    Add Fees
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
        <div className="col-md-12 text-center">
          <Link to="#" className="btn btn-primary">
            <i className="ti ti-loader-3 me-2" />
            Load More
          </Link>
        </div>
      </div>
    </div>
  </div>
  {/* /Page Wrapper */}
  <StudentModals />
</>

  )
}

export default StudentGrid
