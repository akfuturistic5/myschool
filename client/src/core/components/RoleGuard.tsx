import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { selectUser } from "../data/redux/authSlice";
import { canAccessPath, getDashboardForRole } from "../utils/roleUtils";

/**
 * Redirects users who access routes they are not allowed to visit.
 * Works with canAccessPath in roleUtils (admin-only paths, dashboard paths).
 */
const RoleGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const role = user?.role ?? "";
  const path = location.pathname;

  useEffect(() => {
    if (!user) return;
    const allowed = canAccessPath(path, role);
    if (!allowed) {
      const dashboard = getDashboardForRole(role);
      navigate(dashboard, { replace: true });
    }
  }, [path, role, user, navigate]);

  return <>{children}</>;
};

export default RoleGuard;
