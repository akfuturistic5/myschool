import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";

type Routes = typeof all_routes;

export function StaffProfilePageHeader(props: {
  routes: Routes;
  canShowEdit: boolean;
  editTo: { pathname: string; search: string };
  editState: unknown;
}) {
  const { routes, canShowEdit, editTo, editState } = props;
  return (
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
              <li className="breadcrumb-item active" aria-current="page">
                Staff Details
              </li>
            </ol>
          </nav>
        </div>
        <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
          {canShowEdit && (
            <Link
              to={editTo}
              state={editState}
              className="btn btn-primary d-flex align-items-center mb-2"
            >
              <i className="ti ti-edit-circle me-2" />
              Edit Staff
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
