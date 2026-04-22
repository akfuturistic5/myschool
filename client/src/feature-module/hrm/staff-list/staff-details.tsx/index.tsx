import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import { useStaffProfileLoader } from "../useStaffProfileLoader";
import { StaffProfileSidebar } from "../StaffProfileSidebar";
import { StaffProfilePageHeader } from "../StaffProfilePageHeader";

const StaffDetails = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const canManageDirectory = canManageStaffDirectory(user);
  const { staffId, staff, loading, error, detailSearch, navState } =
    useStaffProfileLoader();

  if (staffId == null) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5 text-muted">
            Redirecting…
          </div>
        </div>
      </div>
    );
  }

  if (loading || (!staff && !error)) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading staff…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger" role="alert">
            {error || "Staff not found."}
          </div>
          <Link to={routes.staff} className="btn btn-primary">
            Back to staff list
          </Link>
        </div>
      </div>
    );
  }

  const editTo = {
    pathname: routes.editStaff,
    search: detailSearch,
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StaffProfilePageHeader
              routes={routes}
              canShowEdit={canManageDirectory}
              editTo={editTo}
              editState={navState}
            />
            <div className="col-xxl-3 col-lg-4 theiaStickySidebar">
              <div className="stickybar pb-4">
                <StaffProfileSidebar staff={staff} />
              </div>
            </div>
            <div className="col-xxl-9 col-lg-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffDetails,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link active"
                      >
                        <i className="ti ti-info-square-rounded me-2" />
                        Basic Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffPayroll,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-file-dollar me-2" />
                        Payroll
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffLeave,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leaves
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffsAttendance,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Attendance
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="row">
                <div className="col-xxl-12">
                  <div className="card">
                    <div className="card-header">
                      <h5>Address & emergency</h5>
                    </div>
                    <div className="card-body">
                      <p className="mb-2">
                        <span className="fw-medium text-dark">Address: </span>
                        {staff.address ? String(staff.address) : "—"}
                      </p>
                      <p className="mb-0">
                        <span className="fw-medium text-dark">Emergency: </span>
                        {staff.emergency_contact_name ||
                        staff.emergency_contact_phone
                          ? `${String(staff.emergency_contact_name ?? "")} ${
                              staff.emergency_contact_phone
                                ? `(${String(staff.emergency_contact_phone)})`
                                : ""
                            }`.trim()
                          : "—"}
                      </p>
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

export default StaffDetails;





