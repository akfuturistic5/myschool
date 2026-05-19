import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { SAAS_MODULE_CATALOG, type SaasModulesMap } from '../../core/utils/saasModuleKeys';
import { all_routes } from '../router/all_routes';
import '../../style/icon/tabler-icons/webfont/tabler-icons.css';
import './superAdminShell.css';

interface School {
  id: number;
  school_name: string;
  type?: string | null;
  institute_number: string;
  db_name: string;
  status: string;
  created_at: string;
  plan_id?: number | null;
  plan_name?: string | null;
}

interface SchoolDetail extends School {
  saas_plan?: { id: number; name: string; slug: string } | null;
  saas_modules?: SaasModulesMap | null;
  saas_module_overrides?: { module_key: string; show_in_menu: boolean; route_accessible: boolean }[];
}

const r = all_routes;

const SuperAdminSchoolPermissions = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const [schools, setSchools] = useState<School[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');

  const schoolParam = searchParams.get('school');
  const selectedId = schoolParam ? parseInt(schoolParam, 10) : NaN;
  const validSelectedId = Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null;

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [schoolDetail, setSchoolDetail] = useState<SchoolDetail | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedListSearch(listSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [listSearch]);

  const loadSchools = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await superAdminApiService.listSchools(undefined, debouncedListSearch || undefined);
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setSchools(res.data as School[]);
      } else {
        setListError(res.message || 'Failed to load schools');
      }
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Failed to load schools');
    } finally {
      setListLoading(false);
    }
  }, [debouncedListSearch, authChecked, isAuthenticated]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    loadSchools();
  }, [loadSchools, authChecked, isAuthenticated]);

  useEffect(() => {
    if (!validSelectedId) {
      setSchoolDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await superAdminApiService.getSchoolById(validSelectedId);
        if (cancelled) return;
        if (res.status === 'SUCCESS' && res.data) {
          setSchoolDetail(res.data as SchoolDetail);
        } else {
          setDetailError(res.message || 'Could not load school');
          setSchoolDetail(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : 'Could not load school');
          setSchoolDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validSelectedId]);

  const selectSchool = (id: number) => {
    setSearchParams({ school: String(id) });
  };

  const modules = schoolDetail?.saas_modules;

  return (
    <div className="super-admin-school-permissions">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold mb-2" style={{ letterSpacing: '0.08em', color: 'var(--sa-muted)' }}>
            Manage schools
          </p>
          <h1 className="h3 fw-bold mb-1 text-body">School permissions</h1>
          <p className="text-body-secondary mb-0 small">
            Pick a school to inspect effective SaaS modules (plan + overrides).{' '}
            <Link to={r.superAdminSchoolList} className="fw-semibold">
              School list
            </Link>{' '}
            for full table actions.
          </p>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-5 col-xl-4">
          <div className="sa-glass-card p-3 h-100">
            <label className="form-label small fw-semibold text-muted mb-2">Find school</label>
            <div className="input-group input-group-sm mb-3">
              <span className="input-group-text bg-body border-end-0 rounded-start-3">
                <i className="ti ti-search" />
              </span>
              <input
                type="search"
                className="form-control border-start-0 rounded-end-3"
                placeholder="Filter by name, institute, DB…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            {listLoading && (
              <div className="d-flex align-items-center gap-2 text-muted small py-3">
                <div className="spinner-border spinner-border-sm" />
                Loading…
              </div>
            )}
            {listError && !listLoading && <div className="alert alert-danger py-2 small">{listError}</div>}
            {!listLoading && !listError && (
              <div className="list-group list-group-flush rounded-3 border" style={{ maxHeight: 'min(70vh, 520px)', overflowY: 'auto' }}>
                {schools.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`list-group-item list-group-item-action text-start border-0 border-bottom py-3 ${
                      validSelectedId === s.id ? 'sa-list-item--selected' : ''
                    }`}
                    onClick={() => selectSchool(s.id)}
                  >
                    <div className="fw-semibold">{s.school_name}</div>
                    <div className="small opacity-75">{s.institute_number}</div>
                    <div className="small mt-1">
                      <span
                        className={`badge rounded-pill ${
                          s.status === 'disabled' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'
                        }`}
                      >
                        {s.status || 'active'}
                      </span>
                      {s.plan_name && <span className="ms-1 text-muted">{s.plan_name}</span>}
                    </div>
                  </button>
                ))}
                {schools.length === 0 && <div className="p-4 text-muted small text-center">No schools found.</div>}
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-7 col-xl-8">
          <div className="sa-glass-card sa-perm-panel p-3 p-md-4 h-100">
            {!validSelectedId && (
              <div className="text-center py-5 text-muted">
                <i className="ti ti-shield-search fs-1 d-block mb-3 opacity-50" />
                <p className="mb-0 fw-medium">Choose a school</p>
                <p className="small mb-0">Select a school from the list to view its effective module permissions.</p>
              </div>
            )}

            {validSelectedId && detailLoading && (
              <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2 text-muted">
                <div className="spinner-border spinner-border-sm" />
                Loading permissions…
              </div>
            )}

            {validSelectedId && !detailLoading && detailError && (
              <div className="alert alert-warning border-0 rounded-3 small">{detailError}</div>
            )}

            {validSelectedId && !detailLoading && schoolDetail && !detailError && (
              <>
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h2 className="h5 fw-bold mb-1 text-body">{schoolDetail.school_name}</h2>
                    <div className="small text-muted">
                      Institute <strong>{schoolDetail.institute_number}</strong>
                      {schoolDetail.saas_plan?.name && (
                        <>
                          {' · '}
                          Plan <strong>{schoolDetail.saas_plan.name}</strong>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={`badge rounded-pill ${
                      schoolDetail.status === 'disabled' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'
                    }`}
                  >
                    {schoolDetail.status || 'active'}
                  </span>
                </div>

                <div className="d-flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill"
                    onClick={() => navigate(`/super-admin/schools/${schoolDetail.id}`)}
                  >
                    <i className="ti ti-eye me-1" />
                    View school
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill"
                    onClick={() => navigate(`/super-admin/schools/${schoolDetail.id}/edit`)}
                  >
                    <i className="ti ti-edit me-1" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill"
                    onClick={() => navigate(`/super-admin/schools/${schoolDetail.id}/modules`)}
                  >
                    <i className="ti ti-edit me-1" />
                    Edit overrides
                  </button>
                </div>

                <div className="small text-uppercase fw-semibold text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
                  Effective permissions
                </div>
                <p className="small text-muted mb-3">
                  <strong>Menu</strong> = sidebar visibility. <strong>Access</strong> = stored route flag.
                  {Array.isArray(schoolDetail.saas_module_overrides) && schoolDetail.saas_module_overrides.length > 0 && (
                    <span className="d-block mt-1 text-primary">
                      <i className="ti ti-adjustments-horizontal me-1" />
                      {schoolDetail.saas_module_overrides.length} override(s) for this school.
                    </span>
                  )}
                </p>

                {!modules && (
                  <p className="small text-warning mb-0">Module data unavailable (apply master DB SaaS migration).</p>
                )}

                {modules && (
                  <div className="table-responsive rounded-3 border" style={{ borderColor: 'var(--sa-border)' }}>
                    <table className="table table-sm mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-2">Module</th>
                          <th className="text-center">Menu</th>
                          <th className="text-center pe-2">Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAAS_MODULE_CATALOG.map(({ key, label }) => {
                          const m = modules[key];
                          const menuOn = m?.show_in_menu !== false;
                          const accOn = m?.route_accessible !== false;
                          return (
                            <tr key={key}>
                              <td className="ps-2 small">
                                <span className="fw-medium">{label}</span>
                                <code className="d-block text-muted" style={{ fontSize: '0.7rem' }}>
                                  {key}
                                </code>
                              </td>
                              <td className="text-center">
                                <span
                                  className={`sa-perm-dot ${menuOn ? 'bg-success' : 'bg-secondary'}`}
                                  title={menuOn ? 'Visible in menu' : 'Hidden from menu'}
                                />
                              </td>
                              <td className="text-center pe-2">
                                <span
                                  className={`sa-perm-dot ${accOn ? 'bg-primary' : 'bg-secondary'}`}
                                  title={accOn ? 'Route accessible' : 'Route locked (flag)'}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSchoolPermissions;
