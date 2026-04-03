import { Navigate, Outlet, useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import {
  selectSuperAdminIsAuthenticated,
  selectSuperAdminAuthChecked,
} from '../data/redux/superAdminAuthSlice';

const SuperAdminProtectedRoute = () => {
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);
  const authChecked = useSelector(selectSuperAdminAuthChecked);
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
    return <Navigate to="/super-admin/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default SuperAdminProtectedRoute;

