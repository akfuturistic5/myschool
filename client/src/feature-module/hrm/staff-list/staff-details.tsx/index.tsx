import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import { useStaffProfileLoader } from "../useStaffProfileLoader";
import { StaffProfileSidebar } from "../StaffProfileSidebar";
import { StaffProfilePageHeader } from "../StaffProfilePageHeader";
import { apiService } from "../../../../core/services/apiService";

function formatShortDate(raw: string | undefined): string {
  if (!raw) return "N/A";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const StaffDetails = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const canManageDirectory = canManageStaffDirectory(user);
  const { staffId, staff, loading, error, detailSearch, navState } =
    useStaffProfileLoader();

  const downloadStaffPdf = async (docType: "resume" | "joining-letter") => {
    if (!staffId || !staff) return;
    try {
      const blob = await apiService.fetchStaffDocumentBlob(staffId, docType);
      const objectUrl = URL.createObjectURL(blob);

      const storedPath =
        docType === "resume"
          ? (staff.resume as string)
          : (staff.joining_letter as string);
      const filename =
        (storedPath && String(storedPath).split("/").pop()) ||
        `${docType.replace("-", "_")}.pdf`;

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.rel = "noopener noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err: unknown) {
      console.error("Download error:", err);
    }
  };

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

              {/* Profile Details */}
              <div className="card">
                <div className="card-header">
                  <h5>Profile Details</h5>
                </div>
                <div className="card-body">
                  <div className="border rounded p-3 pb-0">
                    <div className="row">
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">Father’s Name</p>
                          <p>{String(staff.father_name || "N/A")}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">Mother Name</p>
                          <p>{String(staff.mother_name || "N/A")}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">DOB</p>
                          <p>{formatShortDate(staff.date_of_birth as string)}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">Marital Status</p>
                          <p>{String(staff.marital_status || "N/A")}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">Qualification</p>
                          <p>{String(staff.qualification || "N/A")}</p>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-4">
                        <div className="mb-3">
                          <p className="text-dark fw-medium mb-1">Experience</p>
                          <p>
                            {staff.experience_years != null
                              ? `${staff.experience_years} Years`
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
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
                            <p className="text-truncate fw-medium text-dark">Resume.pdf</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-dark btn-icon btn-sm"
                          disabled={!staff.resume}
                          onClick={() => downloadStaffPdf("resume")}
                          title={staff.resume ? "Download resume" : "Resume not uploaded"}
                        >
                          <i className="ti ti-download" />
                        </button>
                      </div>
                      <div className="bg-light-300 border rounded d-flex align-items-center justify-content-between p-2">
                        <div className="d-flex align-items-center overflow-hidden">
                          <span className="avatar avatar-md bg-white rounded flex-shrink-0 text-default">
                            <i className="ti ti-pdf fs-15" />
                          </span>
                          <div className="ms-2">
                            <p className="text-truncate fw-medium text-dark">Joining Letter.pdf</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-dark btn-icon btn-sm"
                          disabled={!staff.joining_letter}
                          onClick={() => downloadStaffPdf("joining-letter")}
                          title={staff.joining_letter ? "Download joining letter" : "Joining letter not uploaded"}
                        >
                          <i className="ti ti-download" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address & Emergency */}
                <div className="col-xxl-6 d-flex">
                  <div className="card flex-fill">
                    <div className="card-header">
                      <h5>Address & Emergency</h5>
                    </div>
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-3">
                        <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                          <i className="ti ti-map-pin-up" />
                        </span>
                        <div>
                          <p className="text-dark fw-medium mb-1">Current Address</p>
                          <p>{String(staff.current_address || staff.address || "N/A")}</p>
                        </div>
                      </div>
                      <div className="d-flex align-items-center mb-3">
                        <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                          <i className="ti ti-map-pins" />
                        </span>
                        <div>
                          <p className="text-dark fw-medium mb-1">Permanent Address</p>
                          <p>{String(staff.permanent_address || "N/A")}</p>
                        </div>
                      </div>
                      <div className="d-flex align-items-center">
                        <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                          <i className="ti ti-phone-calling" />
                        </span>
                        <div>
                          <p className="text-dark fw-medium mb-1">Emergency Contact</p>
                          <p>
                            {staff.emergency_contact_name || staff.emergency_contact_phone
                              ? `${String(staff.emergency_contact_name ?? "")} ${
                                  staff.emergency_contact_phone
                                    ? `(${String(staff.emergency_contact_phone)})`
                                    : ""
                                }`.trim()
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
                {/* Bank Details */}
                <div className="col-xxl-6 d-flex">
                  <div className="card flex-fill">
                    <div className="card-header">
                      <h5>Bank Details</h5>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">Bank Name</p>
                            <p>{String(staff.bank_name ?? "N/A")}</p>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">Branch</p>
                            <p>{String(staff.branch ?? "N/A")}</p>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">Account Name</p>
                            <p>{String(staff.account_name ?? "N/A")}</p>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">Account Number</p>
                            <p>{String(staff.account_number ?? "N/A")}</p>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">IFSC</p>
                            <p>{String(staff.ifsc ?? "N/A")}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Work Details */}
                <div className="col-xxl-6 d-flex">
                  <div className="card flex-fill">
                    <div className="card-header">
                      <h5>Work Details</h5>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">Contract Type</p>
                            <p>{String(staff.contract_type ?? "N/A")}</p>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">Shift</p>
                            <p>{String(staff.shift ?? "N/A")}</p>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">Work Location</p>
                            <p>{String(staff.work_location ?? "N/A")}</p>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <p className="mb-1 text-dark fw-medium">EPF Number</p>
                            <p>{String(staff.epf_no ?? "N/A")}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="card">
                <div className="card-header">
                  <h5>Social Media</h5>
                </div>
                <div className="card-body pb-1">
                  <div className="row row-cols-xxl-5 row-cols-xl-3 row-cols-sm-2 row-cols-1">
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Facebook</p>
                        <p>{String(staff.facebook || "N/A")}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Twitter</p>
                        <p>{String(staff.twitter || "N/A")}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Linkedin</p>
                        <p>{String(staff.linkedin || "N/A")}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Youtube</p>
                        <p>{String(staff.youtube || "N/A")}</p>
                      </div>
                    </div>
                    <div className="col">
                      <div className="mb-3">
                        <p className="mb-1 text-dark fw-medium">Instagram</p>
                        <p>{String(staff.instagram || "N/A")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Info */}
              <div className="card">
                <div className="card-header">
                  <h5>Other Info</h5>
                </div>
                <div className="card-body">
                  <p className="mb-0">{String(staff.other_info || "N/A")}</p>
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





