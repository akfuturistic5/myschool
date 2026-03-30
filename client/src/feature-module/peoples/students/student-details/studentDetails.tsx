import { Link, useLocation, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ImageWithBasePath from '../../../../core/common/imageWithBasePath'
import { all_routes } from '../../../router/all_routes'
import StudentModals from '../studentModals'
import StudentSidebar from './studentSidebar'
import StudentBreadcrumb from './studentBreadcrumb'
import { apiService } from '../../../../core/services/apiService'
import { useCurrentStudent } from '../../../../core/hooks/useCurrentStudent'
import { useCurrentUser } from '../../../../core/hooks/useCurrentUser'

interface StudentDetailsLocationState {
  studentId?: number
  student?: any
}

const StudentDetails = () => {
  const routes = all_routes
  const { id: paramId } = useParams<{ id: string }>()
  const location = useLocation()
  const state = location.state as StudentDetailsLocationState | null
  const { user: currentUser } = useCurrentUser()
  const { student: currentStudent, loading: currentStudentLoading } = useCurrentStudent()
  const cu = currentUser as { role?: string } | null
  const cs = currentStudent as { id?: number } | null
  const role = (cu?.role || '').toString().toLowerCase()
  const isStudentRole = role === 'student'

  const studentId = paramId != null ? (Number(paramId) || null) : state?.studentId ?? state?.student?.id ?? (isStudentRole && cs ? cs.id : null)
  const [student, setStudent] = useState<any>(state?.student ?? (isStudentRole ? currentStudent : null))
  const [loading, setLoading] = useState(
    (!!studentId && !state?.student && !(isStudentRole && currentStudent)) ||
    (isStudentRole && !studentId && currentStudentLoading)
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) {
      if (state?.student) setStudent(state.student)
      else if (isStudentRole && currentStudent) setStudent(currentStudent)
      return
    }
    if (isStudentRole && cs && cs.id === studentId) {
      setStudent(currentStudent)
      setLoading(false)
      return
    }
    // Use state.student for immediate display, but always fetch full details from API
    if (state?.student && state.student.id === studentId) {
      setStudent(state.student)
    }
    setLoading(true)
    setLoadError(null)
    apiService
      .getStudentById(studentId)
      .then((res: any) => {
        const studentData = res?.data ?? res?.data?.student ?? null
        if (studentData && typeof studentData === 'object') setStudent(studentData)
        else if (!state?.student || state.student.id !== studentId) setStudent(null)
      })
      .catch((err: unknown) => {
        setLoadError((err as Error)?.message ?? 'Failed to load student')
        if (!state?.student || state.student.id !== studentId) setStudent(null)
      })
      .finally(() => setLoading(false))
  }, [studentId, state?.student, isStudentRole, currentStudent])

  const showLoading = loading || (isStudentRole && !student && !state?.student && currentStudentLoading)
  if (showLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading student...</span>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger m-3" role="alert">
            <i className="ti ti-alert-circle me-2" />
            {loadError}
          </div>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-warning m-3" role="alert">
            Student information is not available. Please open this page from the Students List or Students Grid.
          </div>
        </div>
      </div>
    )
  }

  const fatherName = student.father_name ?? 'N/A'
  const motherName = student.mother_name ?? 'N/A'
  const guardianName =
    student.guardian_first_name || student.guardian_last_name
      ? [student.guardian_first_name, student.guardian_last_name].filter(Boolean).join(' ') || 'N/A'
      : null
  const currentAddress = student.current_address ?? student.address ?? 'N/A'
  const permanentAddress = student.permanent_address ?? 'N/A'
  const previousSchool = student.previous_school ?? 'N/A'
  const previousSchoolAddress = student.previous_school_address ?? 'N/A'

  return (
    <>
  {/* Page Wrapper */}
  <div className="page-wrapper">
    <div className="content">
      <div className="row">
        {/* Page Header */}
        <StudentBreadcrumb studentId={student.id} />
        {/* /Page Header */}
      </div>
      <div className="row">
        {/* Student Information */}
        <StudentSidebar student={student} />
        {/* /Student Information */}
        <div className="col-xxl-9 col-xl-8">
          <div className="row">
            <div className="col-md-12">
              {/* List */}
              <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                <li>
                  <Link to={studentId ? `${routes.studentDetail}/${studentId}` : routes.studentDetail} className="nav-link active">
                    <i className="ti ti-school me-2" />
                    Student Details
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.studentTimeTable}
                    className="nav-link"
                    state={{ studentId: student.id, student }}
                  >
                    <i className="ti ti-table-options me-2" />
                    Time Table
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.studentLeaves}
                    className="nav-link"
                    state={{ studentId: student.id, student }}
                  >
                    <i className="ti ti-calendar-due me-2" />
                    Leave &amp; Attendance
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.studentFees}
                    className="nav-link"
                    state={{ studentId: student.id, student }}
                  >
                    <i className="ti ti-report-money me-2" />
                    Fees
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.studentResult}
                    className="nav-link"
                    state={{ studentId: student.id, student }}
                  >
                    <i className="ti ti-bookmark-edit me-2" />
                    Exam &amp; Results
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.studentLibrary}
                    className="nav-link"
                    state={{ studentId: student.id, student }}
                  >
                    <i className="ti ti-books me-2" />
                    Library
                  </Link>
                </li>
              </ul>
              {/* /List */}
              {/* Parents Information */}
              <div className="card">
                <div className="card-header">
                  <h5>Parents Information</h5>
                </div>
                <div className="card-body">
                  {(fatherName !== 'N/A' || student.father_phone || student.father_email) && (
                    <div className="border rounded p-3 pb-0 mb-3">
                      <div className="row">
                        <div className="col-sm-6 col-lg-4">
                          <div className="d-flex align-items-center mb-3">
                            <span className="avatar avatar-lg flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/parents/parent-13.jpg"
                                className="img-fluid rounded"
                                alt="img"
                              />
                            </span>
                            <div className="ms-2 overflow-hidden">
                              <h6 className="text-truncate">{fatherName}</h6>
                              <p className="text-primary">Father</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">Phone</p>
                            <p>{student.father_phone ?? 'N/A'}</p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="mb-3 overflow-hidden me-3">
                              <p className="text-dark fw-medium mb-1">Email</p>
                              <p className="text-truncate">{student.father_email ?? 'N/A'}</p>
                            </div>
                            <Link
                              to="#"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              aria-label="Print"
                              data-bs-original-title="Reset Password"
                              className="btn btn-dark btn-icon btn-sm mb-3"
                            >
                              <i className="ti ti-lock-x" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {(motherName !== 'N/A' || student.mother_phone || student.mother_email) && (
                    <div className="border rounded p-3 pb-0 mb-3">
                      <div className="row">
                        <div className="col-lg-4 col-sm-6 ">
                          <div className="d-flex align-items-center mb-3">
                            <span className="avatar avatar-lg flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/parents/parent-14.jpg"
                                className="img-fluid rounded"
                                alt="img"
                              />
                            </span>
                            <div className="ms-2 overflow-hidden">
                              <h6 className="text-truncate">{motherName}</h6>
                              <p className="text-primary">Mother</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-4 col-sm-6 ">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">Phone</p>
                            <p>{student.mother_phone ?? 'N/A'}</p>
                          </div>
                        </div>
                        <div className="col-lg-4 col-sm-6">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="mb-3 overflow-hidden me-3">
                              <p className="text-dark fw-medium mb-1">Email</p>
                              <p className="text-truncate">{student.mother_email ?? 'N/A'}</p>
                            </div>
                            <Link
                              to="#"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              aria-label="Print"
                              data-bs-original-title="Reset Password"
                              className="btn btn-dark btn-icon btn-sm mb-3"
                            >
                              <i className="ti ti-lock-x" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {guardianName && (
                    <div className="border rounded p-3 pb-0">
                      <div className="row">
                        <div className="col-lg-4 col-sm-6">
                          <div className="d-flex align-items-center mb-3">
                            <span className="avatar avatar-lg flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/parents/parent-13.jpg"
                                className="img-fluid rounded"
                                alt="img"
                              />
                            </span>
                            <div className="ms-2 overflow-hidden">
                              <h6 className="text-truncate">{guardianName}</h6>
                              <p className="text-primary">Guardian {student.guardian_relation ? `(${student.guardian_relation})` : ''}</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-4 col-sm-6">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">Phone</p>
                            <p>{student.guardian_phone ?? 'N/A'}</p>
                          </div>
                        </div>
                        <div className="col-lg-4 col-sm-6">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="mb-3 overflow-hidden me-3">
                              <p className="text-dark fw-medium mb-1">Email</p>
                              <p className="text-truncate">{student.guardian_email ?? 'N/A'}</p>
                            </div>
                            <Link
                              to="#"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              aria-label="Print"
                              data-bs-original-title="Reset Password"
                              className="btn btn-dark btn-icon btn-sm mb-3"
                            >
                              <i className="ti ti-lock-x" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {fatherName === 'N/A' && !student.father_phone && !student.father_email &&
                   motherName === 'N/A' && !student.mother_phone && !student.mother_email && !guardianName && (
                    <p className="text-muted mb-0">No parent or guardian information available.</p>
                  )}
                </div>
              </div>
              {/* /Parents Information */}
            </div>
            {/* Documents */}
            <div className="col-xxl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <h5>Documents</h5>
                </div>
                <div className="card-body">
                  <div className="bg-light-300 border rounded d-flex align-items-center justify-content-between mb-3 p-2">
                    <div className="d-flex align-items-center overflow-hidden">
                      <span className="avatar avatar-md bg-white rounded flex-shrink-0 text-default">
                        <i className="ti ti-pdf fs-15" />
                      </span>
                      <div className="ms-2">
                        <p className="text-truncate fw-medium text-dark">
                          BirthCertificate.pdf
                        </p>
                      </div>
                    </div>
                    <Link to="#" className="btn btn-dark btn-icon btn-sm">
                      <i className="ti ti-download" />
                    </Link>
                  </div>
                  <div className="bg-light-300 border rounded d-flex align-items-center justify-content-between p-2">
                    <div className="d-flex align-items-center overflow-hidden">
                      <span className="avatar avatar-md bg-white rounded flex-shrink-0 text-default">
                        <i className="ti ti-pdf fs-15" />
                      </span>
                      <div className="ms-2">
                        <p className="text-truncate fw-medium text-dark">
                          Transfer Certificate.pdf
                        </p>
                      </div>
                    </div>
                    <Link to="#" className="btn btn-dark btn-icon btn-sm">
                      <i className="ti ti-download" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            {/* /Documents */}
            {/* Address */}
            <div className="col-xxl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <h5>Address</h5>
                </div>
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                      <i className="ti ti-map-pin-up" />
                    </span>
                    <div>
                      <p className="text-dark fw-medium mb-1">
                        Current Address
                      </p>
                      <p>{currentAddress}</p>
                    </div>
                  </div>
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                      <i className="ti ti-map-pins" />
                    </span>
                    <div>
                      <p className="text-dark fw-medium mb-1">
                        Permanent Address
                      </p>
                      <p>{permanentAddress}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Address */}
            {/* Previous School Details */}
            <div className="col-xxl-12">
              <div className="card">
                <div className="card-header">
                  <h5>Previous School Details</h5>
                </div>
                <div className="card-body pb-1">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">
                          Previous School Name
                        </p>
                        <p>{previousSchool}</p>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">
                          School Address
                        </p>
                        <p>{previousSchoolAddress}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Previous School Details */}
            {/* Bank Details */}
            <div className="col-xxl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <h5>Bank Details</h5>
                </div>
                <div className="card-body pb-1">
                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">Bank Name</p>
                        <p>{(student.bank_name ?? student.bankName) ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">Branch</p>
                        <p>{(student.branch ?? student.branchName) ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">IFSC</p>
                        <p>{(student.ifsc ?? student.ifscCode) ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Bank Details */}
            {/* Medical History */}
            <div className="col-xxl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <h5>Medical History</h5>
                </div>
                <div className="card-body pb-1">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">
                          Known Allergies
                        </p>
                        {(student.known_allergies ?? student.knownAllergies) ? (
                          <span className="badge bg-light text-dark">{student.known_allergies ?? student.knownAllergies}</span>
                        ) : (
                          <p className="mb-0">N/A</p>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">Medications</p>
                        <p>{(student.medications ?? student.medicationsList) ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Medical History */}
            {/* Other Info */}
            <div className="col-xxl-12">
              <div className="card">
                <div className="card-header">
                  <h5>Other Info</h5>
                </div>
                <div className="card-body">
                  <p>
                    Depending on the specific needs of your organization or
                    system, additional information may be collected or tracked.
                    It's important to ensure that any data collected complies
                    with privacy regulations and policies to protect students'
                    sensitive information.
                  </p>
                </div>
              </div>
            </div>
            {/* /Other Info */}
          </div>
        </div>
      </div>
    </div>
  </div>
  {/* /Page Wrapper */}
  <StudentModals studentId={student?.id} student={student} feeData={null} onFeeCollected={() => window.location.reload()} />
</>

  )
}

export default StudentDetails