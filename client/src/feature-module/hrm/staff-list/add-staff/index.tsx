import { Link, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import AddStaffForm from "../AddStaffForm";
import { selectAuthChecked, selectUser } from "../../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";

const AddStaff = () => {
  const routes = all_routes;
  const authChecked = useSelector(selectAuthChecked);
  const user = useSelector(selectUser);
  if (!authChecked) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  if (!canManageStaffDirectory(user)) {
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
              <h3 className="mb-1">Add Staff</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">HRM</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Add Staff
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <AddStaffForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStaff;





