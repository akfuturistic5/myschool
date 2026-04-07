import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";

interface AdministrativeBreadcrumbProps {
  title: string;
  activeCrumb: string;
}

const AdministrativeBreadcrumb = ({
  title,
  activeCrumb,
}: AdministrativeBreadcrumbProps) => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const role = user?.role || "";
  const dashboardPath = getDashboardForRole(role);

  return (
    <div className="col-md-12">
      <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
        <div className="my-auto mb-2">
          <Link
            to={dashboardPath}
            className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
          >
            <i className="ti ti-arrow-left me-1" />
            Back
          </Link>
          <h3 className="page-title mb-1">{title}</h3>
          <nav>
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <Link to={dashboardPath}>Dashboard</Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                {activeCrumb}
              </li>
            </ol>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeBreadcrumb;
