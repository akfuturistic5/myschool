
import TeacherModal from '../teacherModal';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { all_routes } from '../../../router/all_routes';
import TeacherSidebar from './teacherSidebar';
import TeacherBreadcrumb from './teacherBreadcrumb';
import { apiService } from '../../../../core/services/apiService';

interface TeacherDetailsLocationState {
  teacherId?: number;
  teacher?: any;
}

const TeacherDetails = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as TeacherDetailsLocationState | null;
  const teacherId = state?.teacherId ?? state?.teacher?.id;
  const [teacher, setTeacher] = useState<any>(state?.teacher ?? null);
  const [loading, setLoading] = useState(!!teacherId);

  // Redirect to Teacher List if no teacherId is provided (e.g., clicked from sidebar)
  // MUST be before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (!teacherId && !loading) {
      navigate(routes.teacherList, { replace: true });
    }
  }, [teacherId, loading, navigate, routes.teacherList]);

  // Always fetch full teacher by ID when teacherId is available to ensure we have complete data
  // This works whether coming from grid (partial teacher) or list (full teacher)
  useEffect(() => {
    if (teacherId) {
      setLoading(true);
      apiService
        .getTeacherById(teacherId)
        .then((res: any) => {
          if (res?.data) setTeacher(res.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [teacherId]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading teacher...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!teacher && !teacherId) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Redirecting to Teacher List...</span>
          </div>
        </div>
      </div>
    );
  }

  const formattedDob = teacher.date_of_birth
    ? new Date(teacher.date_of_birth).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'N/A';

  const experienceText =
    typeof teacher.experience_years === 'number'
      ? `${teacher.experience_years} Years`
      : 'N/A';

  return (
    <>
  {/* Page Wrapper */}
  <div className="page-wrapper">
    <div className="content">
      <div className="row">
        {/* Page Header */}
        <TeacherBreadcrumb teacherId={teacher.id} teacher={teacher} />
        {/* /Page Header */}
        {/* Teacher Information */}
        <TeacherSidebar teacher={teacher} />
        {/* /Student Information */}
        <div className="col-xxl-9 col-xl-8">
          <div className="row">
            <div className="col-md-12">
              {/* List */}
              <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                <li>
                  <Link to={routes.teacherDetails} className="nav-link active">
                    <i className="ti ti-school me-2" />
                    Teacher Details
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.teachersRoutine}
                    className="nav-link"
                    state={{ teacherId: teacher.id, teacher }}
                  >
                    <i className="ti ti-table-options me-2" />
                    Routine
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.teacherLeaves}
                    className="nav-link"
                    state={{ teacherId: teacher.id, teacher }}
                  >
                    <i className="ti ti-calendar-due me-2" />
                    Leave &amp; Attendance
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.teacherSalary}
                    className="nav-link"
                    state={{ teacherId: teacher.id, teacher }}
                  >
                    <i className="ti ti-report-money me-2" />
                    Salary
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.teacherLibrary}
                    className="nav-link"
                    state={{ teacherId: teacher.id, teacher }}
                  >
                    <i className="ti ti-bookmark-edit me-2" />
                    Library
                  </Link>
                </li>
              </ul>
              {/* /List */}
              {/* Parents Information */}
              <div className="card">
                <div className="card-header">
                  <h5>Profile Details</h5>
                </div>
                <div className="card-body">
                  <div className="border rounded p-3 pb-0">
                    <div className="row">
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">
                            Father’s Name
                          </p>
                          <p>{teacher.father_name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">
                            Mother Name
                          </p>
                          <p>{teacher.mother_name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">DOB</p>
                          <p>{formattedDob}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">
                            Martial Status
                          </p>
                          <p>{teacher.marital_status || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">
                            Qualification
                          </p>
                          <p>{teacher.qualification || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">Experience</p>
                          <p>{experienceText}</p>
                        </div>
                      </div>
                    </div>
                  </div>
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
                          Resume.pdf
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
                          Joining Letter.pdf
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
                      <p>{teacher.current_address || 'N/A'}</p>
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
                      <p>{teacher.permanent_address || 'N/A'}</p>
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
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">
                          Previous School Name
                        </p>
                        <p>{teacher.previous_school_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">
                          School Address
                        </p>
                        <p>{teacher.previous_school_address || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Phone Number</p>
                        <p>{teacher.previous_school_phone || 'N/A'}</p>
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
                        <p className="mb-1 text-dark fw-medium">Bank Name</p>
                        <p>{teacher.bank_name ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Branch</p>
                        <p>{teacher.branch ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">IFSC</p>
                        <p>{teacher.ifsc ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Bank Details */}
            {/* Work Details */}
            <div className="col-xxl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <h5>Work Details</h5>
                </div>
                <div className="card-body pb-1">
                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">
                          Contract Type
                        </p>
                        <p>{teacher.contract_type ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Shift</p>
                        <p>{teacher.shift ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">
                          Work Location
                        </p>
                        <p>{teacher.work_location ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Work Details */}
            {/* Social Media */}
            <div className="col-xxl-12 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <h5>Social Media</h5>
                </div>
                <div className="card-body pb-1">
                  <div className="row row-cols-xxl-5 row-cols-xl-3">
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Facebook</p>
                        <p>{teacher.facebook ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Twitter</p>
                        <p>{teacher.twitter ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Linkedin</p>
                        <p>{teacher.linkedin ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Youtube</p>
                        <p>{teacher.youtube ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Instagram</p>
                        <p>{teacher.instagram ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Social Media */}
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
  <TeacherModal />
</>

  )
}

export default TeacherDetails