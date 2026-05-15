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

const SuperAdminSchoolEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);
  const schoolId = Number(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [original, setOriginal] = useState<School | null>(null);
  const [form, setForm] = useState({
    school_name: '',
    type: '',
    institute_number: '',
    db_name: '',
    status: 'active',
    plan_id: '' as string | number,
  });

  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [impersonateBusy, setImpersonateBusy] = useState(false);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    if (!schoolId) {
      setError('Invalid school id');
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
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
          const s = resSchool.data as School;
          setOriginal(s);
          setForm({
            school_name: s.school_name,
            type: s.type ?? '',
            institute_number: s.institute_number,
            db_name: s.db_name,
            status: s.status || 'active',
            plan_id: s.plan_id != null ? s.plan_id : '',
          });
        } else {
          setError(resSchool.message || 'Failed to load school');
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load school');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [schoolId, authChecked, isAuthenticated]);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePlanChange = async (next: string) => {
    const pid = next === '' ? null : Number(next);
    if (next !== '' && Number.isNaN(pid)) return;
    setSaveError(null);
    try {
      const res = await superAdminApiService.updateSchoolPlan(schoolId, pid);
      if (res.status === 'SUCCESS' && res.data) {
        const row = res.data as School;
        setOriginal((o) => (o ? { ...o, plan_id: row.plan_id } : o));
        setForm((f) => ({ ...f, plan_id: row.plan_id != null ? row.plan_id : '' }));
        setSaveSuccess('Plan updated');
        setTimeout(() => setSaveSuccess(null), 2000);
      } else {
        setSaveError(res.message || 'Failed to update plan');
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update plan');
    }
  };

  const handleImpersonate = async () => {
    if (!original || original.status === 'disabled') return;
    setImpersonateBusy(true);
    setSaveError(null);
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
        const dash = getDashboardForRole(canonicalRole, d.user.role_id);
        navigate(dash);
      } else {
        setSaveError(res.message || 'Could not start school session');
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Could not start school session');
    } finally {
      setImpersonateBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!original) return;

    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);

    try {
      const metadataPayload: {
        school_name?: string;
        institute_number?: string;
        type?: string | null;
      } = {};
      if (form.school_name.trim() !== original.school_name) {
        metadataPayload.school_name = form.school_name.trim();
      }
      if (form.institute_number.trim() !== original.institute_number) {
        metadataPayload.institute_number = form.institute_number.trim();
      }
      const origType = (original.type ?? '').trim();
      const nextType = form.type.trim();
      if (nextType !== origType) {
        metadataPayload.type = nextType === '' ? null : nextType;
      }

      if (Object.keys(metadataPayload).length > 0) {
        const resMeta = await superAdminApiService.updateSchool(schoolId, metadataPayload);
        if (resMeta.status !== 'SUCCESS') {
          throw new Error(resMeta.message || 'Failed to update school details');
        }
      }

      if (form.status !== (original.status || 'active')) {
        const resStatus = await superAdminApiService.updateSchoolStatus(
          schoolId,
          form.status as 'active' | 'disabled'
        );
        if (resStatus.status !== 'SUCCESS') {
          throw new Error(resStatus.message || 'Failed to update school status');
        }
      }

      setSaveSuccess('Changes saved successfully');
      const refreshed = await superAdminApiService.getSchoolById(schoolId);
      if (refreshed.status === 'SUCCESS' && refreshed.data) {
        const s = refreshed.data as School;
        setOriginal(s);
        setForm({
          school_name: s.school_name,
          type: s.type ?? '',
          institute_number: s.institute_number,
          db_name: s.db_name,
          status: s.status || 'active',
          plan_id: s.plan_id != null ? s.plan_id : '',
        });
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="super-admin-school-edit">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="mb-0 text-body">School details</h3>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(all_routes.superAdminSchoolList)}>
            Back to list
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => navigate(`/super-admin/schools/${schoolId}/modules`)}
          >
            Module permissions
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!original || original.status === 'disabled' || impersonateBusy}
            onClick={handleImpersonate}
          >
            {impersonateBusy ? 'Opening…' : 'Login as school'}
          </button>
        </div>
      </div>

      {loading && <p className="text-body-secondary">Loading school...</p>}
      {error && !loading && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="card shadow-sm border-secondary bg-body">
          <div className="card-body">
            {saveError && (
              <div className="alert alert-danger" role="alert">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="alert alert-success" role="alert">
                {saveSuccess}
              </div>
            )}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Subscription plan</label>
                <select
                  className="form-select"
                  value={form.plan_id === '' ? '' : String(form.plan_id)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, plan_id: v }));
                    void handlePlanChange(v);
                  }}
                >
                  <option value="">— None —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
                <div className="form-text">Defines default module visibility before per-school overrides.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Record</label>
                <div className="small text-muted">
                  <div>Created: {original?.created_at ? new Date(original.created_at).toLocaleString() : '—'}</div>
                  <div>
                    DB: <code>{form.db_name}</code>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">School Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.school_name}
                    onChange={(e) => onChange('school_name', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Institute Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.institute_number}
                    onChange={(e) => onChange('institute_number', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">School type</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.type}
                    onChange={(e) => onChange('type', e.target.value)}
                    disabled={saving}
                    placeholder="e.g. High school and junior college"
                    maxLength={512}
                    autoComplete="off"
                  />
                  <div className="form-text">Clear the field and save to store NULL.</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Database name</label>
                  <input type="text" className="form-control" value={form.db_name} disabled />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => onChange('status', e.target.value)}
                    disabled={saving}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 d-flex justify-content-end">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSchoolEdit;
