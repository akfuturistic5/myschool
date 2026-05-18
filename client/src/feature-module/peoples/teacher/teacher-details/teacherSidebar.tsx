
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import { ProfileTransportHostelTabs } from "../../../../core/common/profile/ProfileTransportHostelTabs";

interface TeacherSidebarProps {
  teacher?: {
    id?: number;
    employee_code?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string | null;
    joining_date?: string | null;
    class_name?: string | null;
    subject_name?: string | null;
    gender?: string | null;
    phone?: string | null;
    email?: string | null;
    blood_group?: string | null;
    pan_number?: string | null;
    id_number?: string | null;
    languages_known?: string | null;
    hostel_name?: string | null;
    hostel_room_number?: string | null;
    floor?: string | null;
    hostel_bed_number?: string | null;
    hostel_assigned_date?: string | null;
    hostel_academic_year_name?: string | null;
    route_name?: string | null;
    vehicle_number?: string | null;
    pickup_point_name?: string | null;
    route_id?: number | null;
    pickup_point_id?: number | null;
    vehicle_id?: number | null;
    transport_assigned_fee_id?: number | null;
    transport_fee_plan_name?: string | null;
    transport_assigned_fee_amount?: number | string | null;
    transport_is_free?: boolean | null;
  } | null;
}

const TeacherSidebar = ({ teacher }: TeacherSidebarProps) => {
  const displayName = teacher
    ? [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") || "N/A"
    : "N/A";
  const code = teacher?.employee_code ?? (teacher?.id != null ? `T${teacher.id}` : "N/A");
  const joinedText = teacher?.joining_date
    ? new Date(teacher.joining_date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "N/A";
  const photoSrc = teacher?.photo_url || "assets/img/teachers/teacher-01.jpg";
  const gender = teacher?.gender ?? "N/A";
  const bloodGroup = teacher?.blood_group ?? "N/A";
  const phone = teacher?.phone ?? "N/A";
  const email = teacher?.email ?? "N/A";
  const panOrId = teacher?.pan_number || teacher?.id_number || "N/A";
  const languages = teacher?.languages_known ?? "N/A";
  return (
    <div className="col-xxl-3 col-xl-4 theiaStickySidebar">
      <div className="stickytopbar pb-4">
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
              <div>
                <h5 className="mb-1 mb-1 text-truncate">{displayName}</h5>
                <p className="text-primary mb-1">{code}</p>
                <p>Joined : {joinedText}</p>
              </div>
            </div>
          </div>
          <div className="card-body">
            <h5 className="mb-3">Basic Information</h5>
            <dl className="row mb-0">
              <dt className="col-6 fw-medium text-dark mb-3">Gender</dt>
              <dd className="col-6  mb-3">{gender}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Blood Group</dt>
              <dd className="col-6  mb-3">{bloodGroup}</dd>
              <dt className="col-6 fw-medium text-dark mb-0">Language</dt>
              <dd className="col-6  mb-0">
                <span className="badge badge-light text-dark me-2">
                  {languages || "N/A"}
                </span>
              </dd>
            </dl>
          </div>
        </div>
        <div className="card border-white">
          <div className="card-body">
            <h5 className="mb-3 ">Primary Contact Info</h5>
            <div className="d-flex align-items-center mb-3">
              <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                <i className="ti ti-phone" />
              </span>
              <div>
                <span className=" text-dark fw-medium mb-1">Phone Number</span>
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
        <div className="card border-white">
          <div className="card-body pb-1">
            <h5 className="mb-3">PAN Number / ID Number</h5>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center mb-3">
                <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                  <i className="ti ti-id" />
                </span>
                <div>
                  <p className="text-dark">{panOrId}</p>
                </div>
              </div>
              <Link to="#" className="btn btn-primary btn-icon btn-sm mb-3">
                <i className="ti ti-copy" />
              </Link>
            </div>
          </div>
        </div>
        <ProfileTransportHostelTabs profile={teacher ?? {}} />
      </div>
    </div>
  );
};

export default TeacherSidebar;

