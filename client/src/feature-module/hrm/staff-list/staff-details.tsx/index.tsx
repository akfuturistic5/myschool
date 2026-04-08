import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import {
  resolveStaffNumericId,
  staffDirectoryFriendlyError,
} from "../staffDirectoryErrors";

interface StaffDetailsLocationState {
  staffId?: number;
  staff?: Record<string, unknown>;
}

const StaffDetails = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const canManageDirectory = canManageStaffDirectory(user);
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  const state = location.state as StaffDetailsLocationState | null;

  const staffId = useMemo(
    () =>
      resolveStaffNumericId({
        search: location.search,
        stateStaffId: state?.staffId,
        stateStaffRecord: state?.staff ?? null,
      }),
    [location.search, state?.staffId, state?.staff]
  );

  const [staff, setStaff] = useState<Record<string, unknown> | null>(
    state?.staff ?? null
  );
  const [loading, setLoading] = useState(!!staffId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!staffId) {
      navigate(routes.staff, { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = (await apiService.getStaffById(staffId)) as {
          status?: string;
          data?: Record<string, unknown>;
          message?: string;
        };
        if (cancelled) return;
        if (res?.status === "SUCCESS" && res?.data) {
          setStaff(res.data);
          const pk = Number(res.data.id);
          if (Number.isFinite(pk) && pk > 0) {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.set("id", String(pk));
                return next;
              },
              { replace: true }
            );
          }
        } else {
          setError(res?.message || "Could not load staff.");
        }
      } catch (e: unknown) {
        if (!cancelled) setError(staffDirectoryFriendlyError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staffId, navigate, routes.staff, setSearchParams]);

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

  const name =
    `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim() || "Staff";
  const img =
    (staff.photo_url as string) || "assets/img/profiles/avatar-27.jpg";
  const code = String(staff.employee_code ?? staff.id ?? "");
  const dept = String(staff.department_name ?? staff.department ?? "—");
  const desig = String(staff.designation_name ?? staff.designation ?? "—");
  const joinRaw = staff.joining_date as string | undefined;
  const joinText = joinRaw
    ? new Date(joinRaw).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const dobRaw = staff.date_of_birth as string | undefined;
  const dobText = dobRaw
    ? new Date(dobRaw).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const blood = String(staff.blood_group_label ?? "") || "—";
  const active =
    staff.is_active === true ||
    staff.is_active === "t" ||
    staff.is_active === 1;

  const pk = Number(staff.id);
  const detailSearch = Number.isFinite(pk) && pk > 0 ? `?id=${pk}` : "";
  const navState = { staffId: pk, staff };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <div className="col-md-12">
              <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
                <div className="my-auto mb-2">
                  <h3 className="page-title mb-1">Staff Details</h3>
                  <nav>
                    <ol className="breadcrumb mb-0">
                      <li className="breadcrumb-item">
                        <Link to={routes.adminDashboard}>Dashboard</Link>
                      </li>
                      <li className="breadcrumb-item">
                        <Link to={routes.staff}>HRM</Link>
                      </li>
                      <li
                        className="breadcrumb-item active"
                        aria-current="page"
                      >
                        Staff Details
                      </li>
                    </ol>
                  </nav>
                </div>
                <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
                  {canManageDirectory && (
                    <Link
                      to={{
                        pathname: routes.editStaff,
                        search: detailSearch,
                      }}
                      state={{
                        staffId: pk,
                        staff,
                      }}
                      className="btn btn-primary d-flex align-items-center mb-2"
                    >
                      <i className="ti ti-edit-circle me-2" />
                      Edit Staff
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="col-xxl-3 col-lg-4 theiaStickySidebar">
              <div className="stickybar pb-4">
                <div className="card border-white">
                  <div className="card-header">
                    <div className="d-flex align-items-center row-gap-3">
                      <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                        <ImageWithBasePath
                          src={img}
                          className="img-fluid rounded-circle"
                          alt=""
                        />
                      </div>
                      <div>
                        <span
                          className={`badge d-inline-flex align-items-center mb-1 ${
                            active ? "badge-soft-success" : "badge-soft-danger"
                          }`}
                        >
                          <i className="ti ti-circle-filled fs-5 me-1" />
                          {active ? "Active" : "Inactive"}
                        </span>
                        <h5 className="mb-1">{name}</h5>
                        <p className="text-primary m-0">{code}</p>
                        <p className="p-0 mb-0">Joined: {joinText}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <h5 className="mb-3">Basic Information</h5>
                    <dl className="row mb-0">
                      <dt className="col-6 fw-medium text-dark mb-3">Staff ID</dt>
                      <dd className="col-6 mb-3">{String(staff.id ?? "—")}</dd>
                      <dt className="col-6 fw-medium text-dark mb-3">Gender</dt>
                      <dd className="col-6 mb-3">
                        {staff.gender
                          ? String(staff.gender).charAt(0).toUpperCase() +
                            String(staff.gender).slice(1)
                          : "—"}
                      </dd>
                      <dt className="col-6 fw-medium text-dark mb-3">
                        Designation
                      </dt>
                      <dd className="col-6 mb-3">{desig}</dd>
                      <dt className="col-6 fw-medium text-dark mb-3">
                        Department
                      </dt>
                      <dd className="col-6 mb-3">{dept}</dd>
                      <dt className="col-6 fw-medium text-dark mb-3">
                        Date Of Birth
                      </dt>
                      <dd className="col-6 mb-3">{dobText}</dd>
                      <dt className="col-6 fw-medium text-dark mb-3">
                        Blood Group
                      </dt>
                      <dd className="col-6 mb-3">{blood}</dd>
                      <dt className="col-6 fw-medium text-dark mb-0">
                        Qualification
                      </dt>
                      <dd className="col-6 text-dark mb-0">
                        {staff.qualification
                          ? String(staff.qualification)
                          : "—"}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="card border-white mb-0">
                  <div className="card-body">
                    <h5 className="mb-3">Primary Contact</h5>
                    <div className="d-flex align-items-center mb-3">
                      <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                        <i className="ti ti-phone" />
                      </span>
                      <div>
                        <span className="mb-1 fw-medium text-dark d-block">
                          Phone
                        </span>
                        <p className="mb-0">{String(staff.phone ?? "—")}</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                        <i className="ti ti-mail" />
                      </span>
                      <div>
                        <span className="mb-1 fw-medium text-dark d-block">
                          Email
                        </span>
                        <p className="mb-0">{String(staff.email ?? "—")}</p>
                      </div>
                    </div>
                  </div>
                </div>
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
                        to={routes.staffPayroll}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-file-dollar me-2" />
                        Payroll
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.staffLeave}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leaves
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.staffsAttendance}
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
