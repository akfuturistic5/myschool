import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import StaffProfileForm from "../StaffProfileForm";
import {
  selectAuthChecked,
  selectUser,
} from "../../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import {
  resolveStaffEditPageId,
  staffDirectoryFriendlyError,
} from "../staffDirectoryErrors";

const EditStaff = () => {
  const routes = all_routes;
  const authChecked = useSelector(selectAuthChecked);
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const location = useLocation();
  const canManage = canManageStaffDirectory(user);

  const staffIdResolved = resolveStaffEditPageId({
    search: location.search,
    locationState: location.state,
  });

  const [staff, setStaff] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(!!staffIdResolved);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    if (staffIdResolved == null) {
      navigate(routes.staff, { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const res = (await apiService.getStaffById(staffIdResolved)) as {
          status?: string;
          data?: Record<string, unknown>;
          message?: string;
        };
        if (cancelled) return;
        if (res?.status === "SUCCESS" && res?.data) {
          setStaff(res.data);
        } else {
          setLoadError(res?.message || "Could not load staff.");
        }
      } catch (e: unknown) {
        if (!cancelled) setLoadError(staffDirectoryFriendlyError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage, staffIdResolved, navigate, routes.staff]);

  if (!authChecked) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <Navigate
        to={getDashboardForRole(user?.role, user?.user_role_id)}
        replace
      />
    );
  }

  return (
    <div>
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="mb-1">Edit Staff</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">HRM</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Edit Staff
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              {loading && (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              )}
              {loadError && (
                <div className="alert alert-danger" role="alert">
                  {loadError}
                </div>
              )}
              {!loading && !loadError && staff && (
                <StaffProfileForm mode="edit" initialStaff={staff} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditStaff;
