import { Navigate, Outlet, useLocation } from "react-router";
import { useSelector } from "react-redux";
import { selectIsAuthenticated, selectAuthChecked } from "../data/redux/authSlice";
import { all_routes } from "../../feature-module/router/all_routes";

const ProtectedRoute = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authChecked = useSelector(selectAuthChecked);
  const location = useLocation();

  if (!authChecked) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={all_routes.login} state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
