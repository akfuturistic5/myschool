import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import { all_routes } from "../../../router/all_routes";

interface AdministrativeSidebarProps {
  staff?: {
    id?: number;
    employee_code?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string | null;
    joining_date?: string | null;
    gender?: string | null;
    phone?: string | null;
    email?: string | null;
    designation_name?: string | null;
    designation?: string | null;
    department_name?: string | null;
    department?: string | null;
    qualification?: string | null;
    experience_years?: number | null;
  } | null;
}

const AdministrativeSidebar = ({ staff }: AdministrativeSidebarProps) => {
  const routes = all_routes;
  const displayName = staff
    ? [staff.first_name, staff.last_name].filter(Boolean).join(" ") || "N/A"
    : "N/A";
  const code = staff?.employee_code ?? (staff?.id != null ? `EMP${staff.id}` : "N/A");
  const joinedText = staff?.joining_date
    ? new Date(staff.joining_date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "N/A";
  const photoSrc = staff?.photo_url || "assets/img/profiles/avatar-14.jpg";
  const designation =
    staff?.designation_name || staff?.designation || "N/A";
  const department =
    staff?.department_name || staff?.department || "N/A";
  const gender = staff?.gender ?? "N/A";
  const phone = staff?.phone ?? "N/A";
  const email = staff?.email ?? "N/A";
  const qualification = staff?.qualification ?? "N/A";
  const experienceText =
    typeof staff?.experience_years === "number"
      ? `${staff.experience_years} Years`
      : "N/A";

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
                <h5 className="mb-1 text-truncate">{displayName}</h5>
                <p className="text-primary mb-1">{code}</p>
                <p className="mb-0">Joined : {joinedText}</p>
              </div>
            </div>
          </div>
          <div className="card-body">
            <h5 className="mb-3">Basic Information</h5>
            <dl className="row mb-0">
              <dt className="col-6 fw-medium text-dark mb-3">Department</dt>
              <dd className="col-6 mb-3">{department}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Designation</dt>
              <dd className="col-6 mb-3">{designation}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Gender</dt>
              <dd className="col-6 mb-3">{gender}</dd>
              <dt className="col-6 fw-medium text-dark mb-3">Qualification</dt>
              <dd className="col-6 mb-3">{qualification}</dd>
              <dt className="col-6 fw-medium text-dark mb-0">Experience</dt>
              <dd className="col-6 mb-0">{experienceText}</dd>
            </dl>
          </div>
        </div>
        <div className="card border-white">
          <div className="card-body">
            <h5 className="mb-3">Primary Contact</h5>
            <div className="d-flex align-items-center mb-3">
              <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                <i className="ti ti-phone" />
              </span>
              <div>
                <span className="text-dark fw-medium mb-1 d-block">Phone</span>
                <p className="mb-0">{phone}</p>
              </div>
            </div>
            <div className="d-flex align-items-center">
              <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                <i className="ti ti-mail" />
              </span>
              <div>
                <span className="text-dark fw-medium mb-1 d-block">Email</span>
                <p className="mb-0 text-break">{email}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card border-white mb-0">
          <div className="card-body pb-1">
            <h6 className="mb-2 text-muted">Quick link</h6>
            <Link
              to={routes.listLeaves}
              className="btn btn-outline-primary btn-sm w-100"
            >
              <i className="ti ti-calendar-event me-1" />
              HRM — List leaves
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeSidebar;
