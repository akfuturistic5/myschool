import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ImageWithBasePath from '../../../../core/common/imageWithBasePath'
import { all_routes } from '../../../router/all_routes'
import StudentModals from '../studentModals'
import StudentSidebar from './studentSidebar'
import StudentBreadcrumb from './studentBreadcrumb'
import { useLinkedStudentContext } from '../../../../core/hooks/useLinkedStudentContext'
import { apiService } from '../../../../core/services/apiService'

interface StudentDetailsLocationState {
  studentId?: number
  student?: any
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'N/A'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const StudentDetails = () => {
  const routes = all_routes
  const { id: paramId } = useParams<{ id: string }>()
  const location = useLocation()
  const state = location.state as StudentDetailsLocationState | null
  const { role, studentId, student, loading, loadError } = useLinkedStudentContext({
    locationState: state,
    routeStudentId: paramId,
  })
  const [promotionRows, setPromotionRows] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [parentImageUrls, setParentImageUrls] = useState<{
    father: string | null
    mother: string | null
    guardian: string | null
  }>({
    father: null,
    mother: null,
    guardian: null,
  })

  useEffect(() => {
    if (!student?.id) {
      setPromotionRows([])
      setHistoryError(null)
      return
    }
    const canAccessPromotionHistory =
      role === 'admin' || role === 'headmaster' || role === 'administrative' || role === 'teacher'
    if (!canAccessPromotionHistory) {
      // Only admin/administrative/teacher scopes can access full promotions endpoint.
      setPromotionRows([])
      setHistoryError(null)
      setHistoryLoading(false)
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    apiService
      .getStudentPromotions(500, student.id)
      .then((res: any) => {
        if (cancelled) return
        if (res?.status === 'SUCCESS' && Array.isArray(res?.data)) {
          setPromotionRows(res.data)
          return
        }
        setPromotionRows([])
      })
      .catch((err: any) => {
        if (cancelled) return
        setHistoryError(err?.message || 'Failed to load promotion history')
        setPromotionRows([])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [student?.id, role])

  useEffect(() => {
    let cancelled = false

    const resolveParentImages = async () => {
      const fatherRaw = student?.father_image_url
      const motherRaw = student?.mother_image_url
      const guardianRaw = student?.guardian_image_url

      if (!fatherRaw && !motherRaw && !guardianRaw) {
        setParentImageUrls({ father: null, mother: null, guardian: null })
        return
      }

      const [father, mother, guardian] = await Promise.all([
        fatherRaw ? apiService.resolveAvatarUrl(fatherRaw) : Promise.resolve(''),
        motherRaw ? apiService.resolveAvatarUrl(motherRaw) : Promise.resolve(''),
        guardianRaw ? apiService.resolveAvatarUrl(guardianRaw) : Promise.resolve(''),
      ])

      if (!cancelled) {
        setParentImageUrls({
          father: father || null,
          mother: mother || null,
          guardian: guardian || null,
        })
      }
    }

    resolveParentImages().catch(() => {
      if (!cancelled) {
        setParentImageUrls({ father: null, mother: null, guardian: null })
      }
    })

    return () => {
      cancelled = true
    }
  }, [student?.father_image_url, student?.mother_image_url, student?.guardian_image_url])
  const historyTableRows = useMemo(
    () =>
      promotionRows.map((row: any) => ({
        key: String(row.id),
        date: formatDate(row.promotion_date),
        fromClass: row.from_class_name || (row.from_class_id != null ? `Class #${row.from_class_id}` : 'N/A'),
        fromSection: row.from_section_name || (row.from_section_id != null ? `Section #${row.from_section_id}` : 'N/A'),
        fromYear: row.from_academic_year_name || (row.from_academic_year_id != null ? `Year #${row.from_academic_year_id}` : 'N/A'),
        toClass: row.to_class_name || (row.to_class_id != null ? `Class #${row.to_class_id}` : 'N/A'),
        toSection: row.to_section_name || (row.to_section_id != null ? `Section #${row.to_section_id}` : 'N/A'),
        toYear: row.to_academic_year_name || (row.to_academic_year_id != null ? `Year #${row.to_academic_year_id}` : 'N/A'),
      })),
    [promotionRows]
  )
  const showLoading = loading
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

  const showFatherBlock = fatherName !== 'N/A' || !!student.father_phone || !!student.father_email
  const showMotherBlock = motherName !== 'N/A' || !!student.mother_phone || !!student.mother_email
  const showGuardianBlock = !!guardianName
  const hasParentsInformation = showFatherBlock || showMotherBlock || showGuardianBlock

  const currentAddress = student.current_address ?? student.address ?? 'N/A'
  const permanentAddress = student.permanent_address ?? 'N/A'
  const previousSchool = student.previous_school ?? 'N/A'
  const previousSchoolAddress = student.previous_school_address ?? 'N/A'
  const bankName = (student.bank_name ?? student.bankName) ?? 'N/A'
  const branchName = (student.branch ?? student.branchName) ?? 'N/A'
  const ifscCode = (student.ifsc ?? student.ifscCode) ?? 'N/A'
  const knownAllergies = student.known_allergies ?? student.knownAllergies ?? null
  const medications = student.medications ?? student.medicationsList ?? null
  const medicalCondition = student.medical_condition ?? student.medicalCondition ?? null
  const otherInformation = student.other_information ?? student.otherInformation ?? null
  const currentClass = student.class_name ?? 'N/A'
  const currentSection = student.section_name ?? 'N/A'
  const currentSectionTeacher = [student.section_teacher_first_name, student.section_teacher_last_name]
    .filter(Boolean)
    .join(' ') || [student.class_teacher_first_name, student.class_teacher_last_name]
    .filter(Boolean)
    .join(' ') || 'N/A'
  const currentSectionTeacherPhone = student.section_teacher_phone ?? student.class_teacher_phone ?? 'N/A'
  const currentSectionTeacherEmail = student.section_teacher_email ?? student.class_teacher_email ?? 'N/A'
  const currentSectionTeacherAddress = student.section_teacher_address ?? student.class_teacher_address ?? 'N/A'
  const hasClassTeacherInfo =
    currentSectionTeacher !== 'N/A' ||
    currentSectionTeacherPhone !== 'N/A' ||
    currentSectionTeacherEmail !== 'N/A' ||
    currentSectionTeacherAddress !== 'N/A'
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
                    to={student?.id ? `${routes.studentLeaves}?studentId=${student.id}` : routes.studentLeaves}
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
                    to={student?.id ? `${routes.studentLibrary}?studentId=${student.id}` : routes.studentLibrary}
                    className="nav-link"
                    state={{ studentId: student.id, student }}
                  >
                    <i className="ti ti-books me-2" />
                    Library
                  </Link>
                </li>
              </ul>
              {/* /List */}
              {/* Parents Information — only when at least father, mother, or guardian data exists */}
              {hasParentsInformation && (
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
                              {parentImageUrls.father ? (
                                <img
                                  src={parentImageUrls.father}
                                  className="img-fluid rounded"
                                  alt="Father"
                                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                />
                              ) : (
                                <ImageWithBasePath
                                  src="assets/img/profiles/avatar-27.jpg"
                                  className="img-fluid rounded"
                                  alt="Father"
                                />
                              )}
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
                          <div className="mb-3 overflow-hidden me-3">
                            <p className="text-dark fw-medium mb-1">Email</p>
                            <p className="text-truncate">{student.father_email ?? 'N/A'}</p>
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
                              {parentImageUrls.mother ? (
                                <img
                                  src={parentImageUrls.mother}
                                  className="img-fluid rounded"
                                  alt="Mother"
                                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                />
                              ) : (
                                <ImageWithBasePath
                                  src="assets/img/profiles/avatar-27.jpg"
                                  className="img-fluid rounded"
                                  alt="Mother"
                                />
                              )}
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
                          <div className="mb-3 overflow-hidden me-3">
                            <p className="text-dark fw-medium mb-1">Email</p>
                            <p className="text-truncate">{student.mother_email ?? 'N/A'}</p>
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
                              {parentImageUrls.guardian ? (
                                <img
                                  src={parentImageUrls.guardian}
                                  className="img-fluid rounded"
                                  alt="Guardian"
                                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                />
                              ) : (
                                <ImageWithBasePath
                                  src="assets/img/profiles/avatar-27.jpg"
                                  className="img-fluid rounded"
                                  alt="Guardian"
                                />
                              )}
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
                          <div className="mb-3 overflow-hidden me-3">
                            <p className="text-dark fw-medium mb-1">Email</p>
                            <p className="text-truncate">{student.guardian_email ?? 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
              {/* /Parents Information */}

              {/* Section Teacher Information */}
              <div className="card">
                <div className="card-header">
                  <h5>Section Teacher Information</h5>
                </div>
                <div className="card-body">
                  {hasClassTeacherInfo ? (
                    <div className="border rounded p-3 pb-0">
                      <div className="row">
                        <div className="col-md-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">Teacher Name</p>
                            <p>{currentSectionTeacher}</p>
                          </div>
                        </div>
                        <div className="col-md-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">Class &amp; Section</p>
                            <p>{currentClass} {currentSection !== 'N/A' ? `- ${currentSection}` : ''}</p>
                          </div>
                        </div>
                        <div className="col-md-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">Phone</p>
                            <p>{currentSectionTeacherPhone}</p>
                          </div>
                        </div>
                        <div className="col-md-6 col-lg-4">
                          <div className="mb-3 overflow-hidden me-3">
                            <p className="text-dark fw-medium mb-1">Email</p>
                            <p className="text-truncate">{currentSectionTeacherEmail}</p>
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="mb-3 mb-md-0">
                            <p className="text-dark fw-medium mb-1">Address</p>
                            <p>{currentSectionTeacherAddress}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted mb-0">Section teacher details are not available for this student.</p>
                  )}
                </div>
              </div>
              {/* /Section Teacher Information */}

              {/* Promotion History */}
              <div className="card">
                <div className="card-header">
                  <h5>Promotion History</h5>
                </div>
                <div className="card-body">
                  {historyLoading && <p className="text-muted mb-0">Loading promotion history...</p>}
                  {historyError && <div className="alert alert-danger mb-0">{historyError}</div>}
                  {!historyLoading && !historyError && historyTableRows.length === 0 && (
                    <p className="text-muted mb-0">No promotion history available for this student.</p>
                  )}
                  {!historyLoading && !historyError && historyTableRows.length > 0 && (
                    <div className="table-responsive">
                      <table className="table table-bordered align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>From Class</th>
                            <th>From Section</th>
                            <th>From Academic Year</th>
                            <th>To Class</th>
                            <th>To Section</th>
                            <th>To Academic Year</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyTableRows.map((r) => (
                            <tr key={r.key}>
                              <td>{r.date}</td>
                              <td>{r.fromClass}</td>
                              <td>{r.fromSection}</td>
                              <td>{r.fromYear}</td>
                              <td>{r.toClass}</td>
                              <td>{r.toSection}</td>
                              <td>{r.toYear}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              {/* /Promotion History */}
            </div>
            {/* Address */}
            <div className="col-xxl-12 d-flex">
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
                        <p>{bankName}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">Branch</p>
                        <p>{branchName}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">IFSC</p>
                        <p>{ifscCode}</p>
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
                        {knownAllergies ? (
                          <span className="badge bg-light text-dark">{knownAllergies}</span>
                        ) : (
                          <p className="mb-0">N/A</p>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">Medications</p>
                        <p>{medications ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <p className="text-dark fw-medium mb-1">Medical Condition</p>
                        <p>{medicalCondition ?? 'N/A'}</p>
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
                  <p className="mb-0">{otherInformation ?? 'No additional student information available.'}</p>
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
