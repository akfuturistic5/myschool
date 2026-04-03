import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { all_routes } from '../../../router/all_routes'
import { selectUser } from '../../../../core/data/redux/authSlice'
import { getDashboardForRole } from '../../../../core/utils/roleUtils'

interface TeacherBreadcrumbProps {
  teacherId?: number
  teacher?: any
}

const TeacherBreadcrumb = ({ teacherId, teacher }: TeacherBreadcrumbProps) => {
  const routes = all_routes
  const user = useSelector(selectUser)
  const role = (user?.role || '').toLowerCase()
  const isTeacherRole = role === 'teacher'
  const backTo = isTeacherRole ? getDashboardForRole(role) : routes.teacherList
  const editState = (teacherId != null || teacher?.id != null)
    ? { teacherId: teacherId ?? teacher?.id, teacher }
    : undefined

  return (
    <div className="col-md-12">
      <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
        <div className="my-auto mb-2">
          <Link
            to={backTo}
            className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
          >
            <i className="ti ti-arrow-left me-1" />
            Back
          </Link>
          <h3 className="page-title mb-1">Teacher Details</h3>
          <nav>
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <Link to={routes.adminDashboard}>Dashboard</Link>
              </li>
              <li className="breadcrumb-item">
                <Link to={routes.teacherList}>Teachers</Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Teacher Details
              </li>
            </ol>
          </nav>
        </div>
        <div className="d-flex my-xl-auto right-content align-items-center  flex-wrap">
          <Link
            to="#"
            className="btn btn-light me-2 mb-2"
            data-bs-toggle="modal"
            data-bs-target="#login_detail"
          >
            <i className="ti ti-lock me-2" />
            Login Details
          </Link>
          <Link
            to={routes.editTeacher}
            state={editState}
            className="btn btn-primary d-flex align-items-center mb-2"
          >
            <i className="ti ti-edit-circle me-2" />
            Edit Teacher
          </Link>
        </div>
      </div>
    </div>
  )
}

export default TeacherBreadcrumb