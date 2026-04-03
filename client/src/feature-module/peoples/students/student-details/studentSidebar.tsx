
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import { useSelector } from "react-redux";
import { selectUser } from "../../../../core/data/redux/authSlice";

interface StudentSidebarProps {
  student?: {
    id?: number;
    admission_number?: string;
    gr_number?: string | null;
    roll_number?: string | null;
    first_name?: string;
    last_name?: string;
    photo_url?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    phone?: string | null;
    email?: string | null;
    class_name?: string | null;
    section_name?: string | null;
    is_active?: boolean;
    blood_group_name?: string | null;
    religion_name?: string | null;
    cast_name?: string | null;
    mother_tongue_name?: string | null;
    sibiling_1?: string | null;
    sibiling_2?: string | null;
    sibiling_1_class?: string | null;
    sibiling_2_class?: string | null;
    unique_student_ids?: string | null;
    pen_number?: string | null;
    aadhaar_no?: string | null;
    hostel_id?: number | null;
    hostel_room_id?: number | null;
    hostel_name?: string | null;
    floor?: string | null;
    hostel_room_number?: string | null;
    route_id?: number | null;
    pickup_point_id?: number | null;
    route_name?: string | null;
    pickup_point_name?: string | null;
    vehicle_number?: string | null;
  } | null;
}

const StudentSidebar = ({ student }: StudentSidebarProps) => {
  const currentUser = useSelector(selectUser);
  const role = String(currentUser?.role || "").trim().toLowerCase();
  const canCollectFees = role === "admin" || role === "administrative";
  const displayName = student
    ? [student.first_name, student.last_name].filter(Boolean).join(" ") || "N/A"
    : "N/A";
  const admissionNo = student?.admission_number ?? "N/A";
  const rollNo = student?.roll_number ?? "N/A";
  const gender = student?.gender ?? "N/A";
  const dob = student?.date_of_birth
    ? new Date(student.date_of_birth).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";
  const phone = student?.phone ?? "N/A";
  const email = student?.email ?? "N/A";
  const classSection = student?.class_name && student?.section_name
    ? `${student.class_name}, ${student.section_name}`
    : student?.class_name || student?.section_name || "N/A";
  const photoSrc = student?.photo_url || "assets/img/students/student-01.jpg";
  const statusLabel = student?.is_active !== false ? "Active" : "Inactive";
  const bloodGroup = student?.blood_group_name ?? "N/A";
  const religion = student?.religion_name ?? "N/A";
  const caste = student?.cast_name ?? "N/A";
  const motherTongue = student?.mother_tongue_name ?? "N/A";
  const sibling1 = student?.sibiling_1;
  const sibling2 = student?.sibiling_2;
  const sibling1Class = student?.sibiling_1_class;
  const sibling2Class = student?.sibiling_2_class;
  const hostelName = student?.hostel_name && String(student.hostel_name).trim() ? String(student.hostel_name).trim() : null;
  const hostelFloor = student?.floor && String(student.floor).trim() ? String(student.floor).trim() : null;
  const hostelRoomNumber = student?.hostel_room_number && String(student.hostel_room_number).trim() ? String(student.hostel_room_number).trim() : null;

  return (
    <div className="col-xxl-3 col-xl-4 theiaStickySidebar">
      <div className="stickybar pb-4">
        <div className="card border-white">
          <div className="card-header">
            <div className="d-flex align-items-center flex-wrap row-gap-3">
              <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                <ImageWithBasePath
                  src={photoSrc}
                  className="img-fluid"
                  alt="img"
                />
              </div>
              <div className="overflow-hidden">
                <span className={`badge badge-soft-${student?.is_active !== false ? "success" : "danger"} d-inline-flex align-items-center mb-1`}>
                  <i className="ti ti-circle-filled fs-5 me-1" />
                  {statusLabel}
                </span>
                <h5 className="mb-1 text-truncate">{displayName}</h5>
                <p className="text-primary">{admissionNo}</p>
              </div>
            </div>
          </div>
          {/* Basic Information */}
          <div className="card-body">
            <h5 className="mb-3">Basic Information</h5>
            <dl className="row mb-0">
              <dt className="col-6 fw-medium text-dark mb-3">GR Number</dt>
              <dd className="col-6 mb-3">{student?.gr_number && String(student.gr_number).trim() ? String(student.gr_number).trim() : 'N/A'}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Roll No</dt>
              <dd className="col-6 mb-3">{rollNo}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Gender</dt>
              <dd className="col-6 mb-3">{gender}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Date Of Birth</dt>
              <dd className="col-6 mb-3">{dob}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Blood Group</dt>
              <dd className="col-6 mb-3">{bloodGroup}</dd>
              {/* House removed as per requirements; address section already shows location */}
              <dt className="col-6 fw-medium text-dark mb-3">Religion</dt>
              <dd className="col-6 mb-3">{religion}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Caste</dt>
              <dd className="col-6 mb-3">{caste}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Category</dt>
              <dd className="col-6 mb-3">{caste}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Mother tongue</dt>
              <dd className="col-6 mb-3">{motherTongue}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Unique Student ID (Saral)</dt>
              <dd className="col-6 mb-3">{student?.unique_student_ids ?? 'N/A'}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Pen Number (UDISE)</dt>
              <dd className="col-6 mb-3">{student?.pen_number ?? 'N/A'}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Aadhar Number</dt>
              <dd className="col-6 mb-3">{student?.aadhaar_no ?? 'N/A'}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Class &amp; Section</dt>
              <dd className="col-6 mb-3">{classSection}</dd>
            </dl>
            {canCollectFees && (
              <Link
                to="#"
                data-bs-toggle="modal"
                data-bs-target="#add_fees_collect"
                className="btn btn-primary btn-sm w-100"
              >
                Add Fees
              </Link>
            )}
          </div>
          {/* /Basic Information */}
        </div>
        {/* Primary Contact Info */}
        <div className="card border-white">
          <div className="card-body">
            <h5 className="mb-3">Primary Contact Info</h5>
            <div className="d-flex align-items-center mb-3">
              <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                <i className="ti ti-phone" />
              </span>
              <div>
                <span className="text-dark fw-medium mb-1">Phone Number</span>
                <p>{phone}</p>
              </div>
            </div>
            <div className="d-flex align-items-center">
              <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                <i className="ti ti-mail" />
              </span>
              <div>
                <span className="text-dark fw-medium mb-1">Email Address</span>
                <p>{email}</p>
              </div>
            </div>
          </div>
        </div>
        {/* /Primary Contact Info */}
        {/* Sibiling Information */}
        <div className="card border-white">
          <div className="card-body">
            <h5 className="mb-3">Sibiling Information</h5>
            {sibling1 ? (
              <div className="d-flex align-items-center bg-light-300 rounded p-3 mb-3">
                <span className="avatar avatar-lg">
                  <ImageWithBasePath
                    src="assets/img/students/student-06.jpg"
                    className="img-fluid rounded"
                    alt="img"
                  />
                </span>
                <div className="ms-2">
                  <h5 className="fs-14">{sibling1}</h5>
                  <p>{sibling1Class ?? 'N/A'}</p>
                </div>
              </div>
            ) : null}
            {sibling2 ? (
              <div className="d-flex align-items-center bg-light-300 rounded p-3">
                <span className="avatar avatar-lg">
                  <ImageWithBasePath
                    src="assets/img/students/student-07.jpg"
                    className="img-fluid rounded"
                    alt="img"
                  />
                </span>
                <div className="ms-2">
                  <h5 className="fs-14">{sibling2}</h5>
                  <p>{sibling2Class ?? 'N/A'}</p>
                </div>
              </div>
            ) : null}
            {!sibling1 && !sibling2 && (
              <p className="text-muted mb-0">No sibling information available</p>
            )}
          </div>
        </div>
        {/* /Sibiling Information */}
        {/* Transport Information */}
        <div className="card border-white mb-0">
          <div className="card-body pb-1">
            <ul className="nav nav-tabs nav-tabs-bottom mb-3">
              <li className="nav-item">
                <Link
                  className="nav-link active"
                  to="#hostel"
                  data-bs-toggle="tab"
                >
                  Hostel
                </Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="#transport" data-bs-toggle="tab">
                  Transportation
                </Link>
              </li>
            </ul>
            <div className="tab-content">
              <div className="tab-pane fade show active" id="hostel">
                {(hostelName || hostelRoomNumber || student?.hostel_id || student?.hostel_room_id) ? (
                  <div className="d-flex align-items-center mb-3">
                    <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                      <i className="ti ti-building-fortress fs-16" />
                    </span>
                    <div>
                      <h6 className="fs-14 mb-1">
                        {hostelName ? `${hostelName}${hostelFloor ? `, ${hostelFloor}` : ''}` : (student?.hostel_id ? 'Hostel assigned' : 'N/A')}
                      </h6>
                      <p className="text-primary">
                        {hostelRoomNumber ? `Room No : ${hostelRoomNumber}` : (student?.hostel_room_id ? 'Room assigned' : 'Room No : N/A')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted mb-0">No hostel information available</p>
                )}
              </div>
              <div className="tab-pane fade" id="transport">
                {(student?.route_name || student?.pickup_point_name || student?.vehicle_number || student?.route_id || student?.pickup_point_id) ? (
                  <>
                    <div className="d-flex align-items-center mb-3">
                      <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                        <i className="ti ti-bus fs-16" />
                      </span>
                      <div>
                        <span className="fs-12 mb-1">Route</span>
                        <p className="text-dark">{student.route_name ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-sm-6">
                        <div className="mb-3">
                          <span className="fs-12 mb-1">Bus Number</span>
                          <p className="text-dark">{student.vehicle_number ?? 'N/A'}</p>
                        </div>
                      </div>
                      <div className="col-sm-6">
                        <div className="mb-3">
                          <span className="fs-12 mb-1">Pickup Point</span>
                          <p className="text-dark">{student.pickup_point_name ?? 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted mb-0">No transport information available</p>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* /Transport Information */}
      </div>
    </div>
  );
};

export default StudentSidebar;
