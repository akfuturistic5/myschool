import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { setAuth } from '../../core/data/redux/authSlice';
import { apiService } from '../../core/services/apiService';
import { getDashboardForRole, normalizeAuthRole } from '../../core/utils/roleUtils';
import { all_routes } from '../router/all_routes';
import { superAdminToast } from './superAdminToast';
import '../../style/icon/tabler-icons/webfont/tabler-icons.css';

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
  plan_slug?: string | null;
}

interface PlanOpt {
  id: number;
  name: string;
  slug: string;
}

const statusBadge = (status: string) =>
  status === 'disabled' ? 'text-bg-danger-subtle text-danger' : 'text-bg-success-subtle text-success';

const SuperAdminSchoolView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);
  const schoolId = Number(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [planBusy, setPlanBusy] = useState(false);
  const [impersonateBusy, setImpersonateBusy] = useState(false);

  const loadSchool = async () => {
    const res = await superAdminApiService.getSchoolById(schoolId);
    if (res.status === 'SUCCESS' && res.data) {
      setSchool(res.data as School);
    } else {
      throw new Error(res.message || 'Failed to load school');
    }
  };

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    if (!schoolId) {
      setError('Invalid school id');
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [resSchool, resPlans] = await Promise.all([
          superAdminApiService.getSchoolById(schoolId),
          superAdminApiService.listPlans(),
        ]);
        if (cancelled) return;
        if (resPlans.status === 'SUCCESS' && Array.isArray(resPlans.data)) {
          setPlans(resPlans.data as PlanOpt[]);
        }
        if (resSchool.status === 'SUCCESS' && resSchool.data) {
          setSchool(resSchool.data as School);
        } else {
          setError(resSchool.message || 'Failed to load school');
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load school');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId, authChecked, isAuthenticated]);

  const handlePlanChange = async (next: string) => {
    const pid = next === '' ? null : Number(next);
    if (next !== '' && Number.isNaN(pid)) return;
    setPlanBusy(true);
    try {
      const res = await superAdminApiService.updateSchoolPlan(schoolId, pid);
      if (res.status === 'SUCCESS' && res.data) {
        const row = res.data as School;
        setSchool((s) =>
          s ? { ...s, plan_id: row.plan_id, plan_name: row.plan_name, plan_slug: row.plan_slug } : s
        );
        await loadSchool();
        superAdminToast.success('Plan updated. School permissions now follow the new plan.');
      } else {
        superAdminToast.error(res.message || 'Failed to update plan');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Failed to update plan');
    } finally {
      setPlanBusy(false);
    }
  };

  const handleImpersonate = async () => {
    if (!school || school.status === 'disabled') return;
    setImpersonateBusy(true);
    try {
      const res = await superAdminApiService.impersonateSchool(schoolId);
      if (res.status === 'SUCCESS' && res.data) {
        const d = res.data as {
          user: {
            id: number;
            username: string;
            displayName: string;
            role: string;
            role_id: number;
            staff_id?: number;
            accountDisabled?: boolean;
            school_name?: string;
            school_type?: string;
            school_logo?: string | null;
            institute_number?: string;
            saas_modules?: Record<string, { show_in_menu: boolean; route_accessible: boolean }>;
            avatar?: string | null;
          };
          accessToken?: string;
        };
        const canonicalRole = normalizeAuthRole(d.user?.role, d.user?.role_id);
        dispatch(
          setAuth({
            token: d.accessToken ?? undefined,
            user: {
              id: d.user.id,
              username: d.user.username,
              displayName: d.user.displayName,
              role: canonicalRole,
              avatar: d.user.avatar ?? null,
              user_role_id: d.user.role_id,
              staff_id: d.user.staff_id,
              accountDisabled: !!d.user.accountDisabled,
              school_name: d.user.school_name,
              school_type: d.user.school_type,
              school_logo: d.user.school_logo ?? null,
              institute_number: d.user.institute_number,
              saas_modules: d.user.saas_modules ?? undefined,
            },
          })
        );
        await apiService.ensureCsrfToken();
        superAdminToast.info('Opening school dashboard…');
        navigate(getDashboardForRole(canonicalRole, d.user.role_id));
      } else {
        superAdminToast.error(res.message || 'Could not start school session');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Could not start school session');
    } finally {
      setImpersonateBusy(false);
    }
  };

  return (
    <div className="super-admin-school-view">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <button
            type="button"
            className="btn btn-link btn-sm text-muted px-0 mb-1"
            onClick={() => navigate(all_routes.superAdminSchoolList)}
          >
            <i className="ti ti-arrow-left me-1" />
            Schools
          </button>
          <h3 className="mb-0 text-body">{school?.school_name || 'School'}</h3>
          {school && (
            <div className="small text-muted mt-1">
              Institute <code>{school.institute_number}</code>
              <span className="mx-2">·</span>
              <span className={`badge rounded-pill ${statusBadge(school.status)}`}>{school.status || 'active'}</span>
            </div>
          )}
        </div>
        {school && !loading && !error && (
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => navigate(`/super-admin/schools/${schoolId}/edit`)}
            >
              <i className="ti ti-edit me-1" />
              Edit
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => navigate(`${all_routes.superAdminSchoolPermissions}?school=${schoolId}`)}
            >
              <i className="ti ti-shield-check me-1" />
              Permissions
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={school.status === 'disabled' || impersonateBusy}
              onClick={handleImpersonate}
            >
              <i className="ti ti-login me-1" />
              {impersonateBusy ? 'Opening…' : 'Login'}
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-body-secondary">Loading school…</p>}
      {error && !loading && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && school && (
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card shadow-sm border-secondary bg-body">
              <div className="card-header bg-body fw-semibold">Overview</div>
              <div className="card-body">
                <dl className="row mb-0 sa-school-dl">
                  <dt className="col-sm-4 text-muted">School name</dt>
                  <dd className="col-sm-8">{school.school_name}</dd>
                  <dt className="col-sm-4 text-muted">School type</dt>
                  <dd className="col-sm-8">{school.type?.trim() || '—'}</dd>
                  <dt className="col-sm-4 text-muted">Institute number</dt>
                  <dd className="col-sm-8">
                    <code>{school.institute_number}</code>
                  </dd>
                  <dt className="col-sm-4 text-muted">Database</dt>
                  <dd className="col-sm-8">
                    <code>{school.db_name}</code>
                  </dd>
                  <dt className="col-sm-4 text-muted">Status</dt>
                  <dd className="col-sm-8">
                    <span className={`badge rounded-pill ${statusBadge(school.status)}`}>
                      {school.status || 'active'}
                    </span>
                  </dd>
                  <dt className="col-sm-4 text-muted">Created</dt>
                  <dd className="col-sm-8">
                    {school.created_at ? new Date(school.created_at).toLocaleString() : '—'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card shadow-sm border-secondary bg-body">
              <div className="card-header bg-body fw-semibold">Subscription</div>
              <div className="card-body">
                <label className="form-label small text-muted">Plan</label>
                <select
                  className="form-select"
                  disabled={planBusy}
                  value={school.plan_id != null ? String(school.plan_id) : ''}
                  onChange={(e) => void handlePlanChange(e.target.value)}
                >
                  <option value="">— None —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
                <p className="form-text small mb-3">
                  Changing the plan resets per-school module overrides so permissions match the plan.
                </p>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm w-100"
                  onClick={() => navigate(`/super-admin/schools/${schoolId}/modules`)}
                >
                  Module overrides
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSchoolView;