import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { selectUser } from "../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../core/utils/roleUtils";
import { apiService } from "../../../core/services/apiService";

type AcademicYearRow = {
  id: number;
  year_name: string;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
  is_active?: boolean;
  created_at?: string;
  modified_at?: string;
};

function formatDisplayDate(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const s = String(value).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const AcademicYearsList = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const dashboard = getDashboardForRole(user);
  const [rows, setRows] = useState<AcademicYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getAcademicYearsManage();
      const data = Array.isArray(res?.data) ? res.data : [];
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load academic years");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Academic Years</h3>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={dashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to="#">Academic</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Academic Years
                </li>
              </ol>
            </nav>
            <p className="text-muted small mb-0 mt-2">
              View every session for your school. Open a year for full statistics, and set the official end date when
              the session closes.
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2 my-xl-auto right-content align-items-center">
            <Link to={routes.academicYearNew} className="btn btn-primary d-inline-flex align-items-center">
              <i className="ti ti-square-rounded-plus me-2" />
              Create new academic year
            </Link>
          </div>
        </div>

        {loading && (
          <div className="card">
            <div className="card-body d-flex align-items-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
              Loading academic years…
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="alert alert-danger" role="alert">
            <strong>Could not load data.</strong> {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <i className="ti ti-calendar-off text-muted fs-1 d-block mb-3" />
              <h5 className="mb-2">No academic years yet</h5>
              <p className="text-muted mb-4">Create your first academic year to start recording classes and students.</p>
              <Link to={routes.academicYearNew} className="btn btn-primary">
                Create academic year
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-4">Year</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                      <th className="text-end pe-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((y) => (
                      <tr key={y.id}>
                        <td className="ps-4">
                          <span className="fw-semibold">{y.year_name}</span>
                          <div className="small text-muted">ID #{y.id}</div>
                        </td>
                        <td>{formatDisplayDate(y.start_date)}</td>
                        <td>
                          {y.end_date ? (
                            formatDisplayDate(y.end_date)
                          ) : (
                            <span className="text-muted fst-italic">Not set</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {y.is_current && (
                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                Current
                              </span>
                            )}
                            {y.is_active === false ? (
                              <span className="badge bg-secondary-subtle text-secondary border">Inactive</span>
                            ) : (
                              <span className="badge bg-success-subtle text-success border border-success-subtle">
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-end pe-4">
                          <Link
                            to={`/academic/academic-years/${y.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            View details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademicYearsList;
