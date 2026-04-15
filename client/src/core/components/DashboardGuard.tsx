import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { selectUser } from "../data/redux/authSlice";
import { getDashboardForRole } from "../utils/roleUtils";
import { all_routes } from "../../feature-module/router/all_routes";

const DASHBOARD_PATHS = [
  all_routes.adminDashboard,
  all_routes.administrativeDashboard,
  all_routes.teacherDashboard,
  all_routes.studentDashboard,
  all_routes.parentDashboard,
  all_routes.guardianDashboard,
];

/**
 * Redirects user to their role-specific dashboard if they try to access another role's dashboard.
 */
const DashboardGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const role = user?.role || "Admin";
  const userDashboard = getDashboardForRole(role);

  useEffect(() => {
    const path = location.pathname;
    if (DASHBOARD_PATHS.includes(path) && path !== userDashboard) {
      navigate(userDashboard, { replace: true });
    }
  }, [location.pathname, userDashboard, navigate]);

  return <>{children}</>;
};

export default DashboardGuard;
