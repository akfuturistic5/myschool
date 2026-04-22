import { Link } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import AdministrativeSidebar from "./administrativeSidebar";
import AdministrativeBreadcrumb from "./administrativeBreadcrumb";
import { useAdministrativeStaffProfile } from "../../../../core/hooks/useAdministrativeStaffProfile";

const AdministrativeDetails = () => {
  const routes = all_routes;
  const { staff, loading, error } = useAdministrativeStaffProfile();

  const profileState = staff ? { staffId: staff.id, staff } : undefined;

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading your profile...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-warning m-3" role="alert">
            <i className="ti ti-alert-circle me-2" />
            {error ||
              "Administrative profile is not available. Use View details from your dashboard after your account is linked to staff."}
          </div>
        </div>
      </div>
    );
  }

  const salaryDisplay =
    staff.salary != null && staff.salary !== ""
      ? String(staff.salary)
      : "N/A";

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row">
          <AdministrativeBreadcrumb
            title="Administrative details"
            activeCrumb="Profile"
          />
        </div>
        <div className="row">
          <AdministrativeSidebar staff={staff} />
          <div className="col-xxl-9 col-xl-8">
            <div className="row">
              <div className="col-md-12">
                <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                  <li>
                    <Link
                      to={routes.administrativeDetails}
                      state={profileState}
                      className="nav-link active"
                    >
                      <i className="ti ti-user me-2" />
                      Administrative details
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={routes.administrativeLeaves}
                      state={profileState}
                      className="nav-link"
                    >
                      <i className="ti ti-calendar-due me-2" />
                      Leave
                    </Link>
                  </li>
                </ul>
                <div className="card">
                  <div className="card-header">
                    <h5>Employment &amp; contact</h5>
                  </div>
                  <div className="card-body">
                    <div className="border rounded p-3 pb-0">
                      <div className="row">
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">
                              Employee code
                            </p>
                            <p>{staff.employee_code ?? "N/A"}</p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">
                              Department
                            </p>
                            <p>
                              {staff.department_name ||
                                staff.department ||
                                "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">
                              Designation
                            </p>
                            <p>
                              {staff.designation_name ||
                                staff.designation ||
                                "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">
                              Joining date
                            </p>
                            <p>
                              {staff.joining_date
                                ? new Date(
                                    staff.joining_date
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">
                              Qualification
                            </p>
                            <p>{staff.qualification ?? "N/A"}</p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">
                              Experience (years)
                            </p>
                            <p>
                              {typeof staff.experience_years === "number"
                                ? staff.experience_years
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">
                              Salary (record)
                            </p>
                            <p>{salaryDisplay}</p>
                          </div>
                        </div>
                        <div className="col-sm-6 col-lg-4">
                          <div className="mb-3">
                            <p className="text-dark fw-medium mb-1">Status</p>
                            <p>
                              {staff.is_active === false ? "Inactive" : "Active"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card mt-4">
                  <div className="card-header">
                    <h5>Address &amp; emergency</h5>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-12 mb-3">
                        <p className="text-dark fw-medium mb-1">Address</p>
                        <p>{staff.address ?? "N/A"}</p>
                      </div>
                      <div className="col-md-6 mb-3">
                        <p className="text-dark fw-medium mb-1">
                          Emergency contact name
                        </p>
                        <p>{staff.emergency_contact_name ?? "N/A"}</p>
                      </div>
                      <div className="col-md-6 mb-3">
                        <p className="text-dark fw-medium mb-1">
                          Emergency contact phone
                        </p>
                        <p>{staff.emergency_contact_phone ?? "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeDetails;

