import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { SAAS_MODULE_CATALOG, type SaasModulesMap } from '../../core/utils/saasModuleKeys';
import { patchSaasModuleFlags } from './saasModuleUi';
import { superAdminToast } from './superAdminToast';

const BILLING_INTERVALS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'one_time', label: 'One-time' },
] as const;

interface PlanRow {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  price_amount?: number | string;
  billing_interval?: string;
  setup_fee?: number | string;
  trial_days?: number;
}

type BillingForm = {
  price_amount: string;
  billing_interval: string;
  setup_fee: string;
  trial_days: string;
};

const emptyBillingForm = (): BillingForm => ({
  price_amount: '0',
  billing_interval: 'monthly',
  setup_fee: '0',
  trial_days: '0',
});

const formatInr = (amount: number) =>
  amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const toNum = (v: number | string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatPlanCharge = (plan: PlanRow) => {
  const amount = toNum(plan.price_amount);
  const interval = plan.billing_interval || 'monthly';
  const setup = toNum(plan.setup_fee);
  const trial = plan.trial_days ?? 0;

  if (amount <= 0 && setup <= 0) {
    return 'Free';
  }

  const intervalLabel = BILLING_INTERVALS.find((b) => b.value === interval)?.label || interval;
  let line = `₹${formatInr(amount)} / ${intervalLabel.toLowerCase()}`;
  if (setup > 0) {
    line += ` · setup ₹${formatInr(setup)}`;
  }
  if (trial > 0) {
    line += ` · ${trial}d trial`;
  }
  return line;
};

const planToBillingForm = (plan: PlanRow): BillingForm => ({
  price_amount: String(toNum(plan.price_amount)),
  billing_interval: plan.billing_interval || 'monthly',
  setup_fee: String(toNum(plan.setup_fee)),
  trial_days: String(plan.trial_days ?? 0),
});

const SuperAdminPlans = () => {
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modules, setModules] = useState<SaasModulesMap | null>(null);
  const [modLoading, setModLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingForm, setBillingForm] = useState<BillingForm>(emptyBillingForm());
  const [billingErr, setBillingErr] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newBilling, setNewBilling] = useState<BillingForm>(emptyBillingForm());
  const [createErr, setCreateErr] = useState<string | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApiService.listPlans();
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setPlans(res.data as PlanRow[]);
      } else {
        setError(res.message || 'Failed to load plans');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    loadPlans();
  }, [authChecked, isAuthenticated]);

  useEffect(() => {
    if (selectedId == null) {
      setBillingForm(emptyBillingForm());
      return;
    }
    const plan = plans.find((p) => p.id === selectedId);
    if (plan) setBillingForm(planToBillingForm(plan));
  }, [selectedId, plans]);

  const openModules = async (planId: number) => {
    setSelectedId(planId);
    setModLoading(true);
    setModules(null);
    setBillingErr(null);
    try {
      const res = await superAdminApiService.getPlanModules(planId);
      if (res.status === 'SUCCESS' && res.data && (res.data as { modules?: SaasModulesMap }).modules) {
        setModules({ ...(res.data as { modules: SaasModulesMap }).modules });
      }
    } catch {
      setModules(null);
    } finally {
      setModLoading(false);
    }
  };

  const updateFlag = (key: string, field: 'show_in_menu' | 'route_accessible', value: boolean) => {
    setModules((prev) => (prev ? patchSaasModuleFlags(prev, key, field, value) : prev));
  };

  const saveModules = async () => {
    if (!selectedId || !modules) return;
    setSaving(true);
    try {
      const res = await superAdminApiService.putPlanModules(selectedId, modules);
      if (res.status === 'SUCCESS') {
        superAdminToast.success('Plan modules saved successfully');
      } else {
        superAdminToast.error(res.message || 'Failed to save modules');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Failed to save modules');
    } finally {
      setSaving(false);
    }
  };

  const saveBilling = async () => {
    if (selectedId == null) return;
    setBillingErr(null);
    setSavingBilling(true);
    try {
      const res = await superAdminApiService.updatePlan(selectedId, {
        price_amount: Number(billingForm.price_amount) || 0,
        billing_interval: billingForm.billing_interval,
        setup_fee: Number(billingForm.setup_fee) || 0,
        trial_days: parseInt(billingForm.trial_days, 10) || 0,
      });
      if (res.status === 'SUCCESS') {
        await loadPlans();
        superAdminToast.success('Plan billing updated successfully');
      } else {
        superAdminToast.error(res.message || 'Failed to save billing');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Failed to save billing');
    } finally {
      setSavingBilling(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr(null);
    if (newName.trim().length < 2 || newSlug.trim().length < 2) {
      setCreateErr('Name and slug are required');
      return;
    }
    try {
      const res = await superAdminApiService.createPlan({
        name: newName.trim(),
        slug: newSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        price_amount: Number(newBilling.price_amount) || 0,
        billing_interval: newBilling.billing_interval,
        setup_fee: Number(newBilling.setup_fee) || 0,
        trial_days: parseInt(newBilling.trial_days, 10) || 0,
      });
      if (res.status === 'SUCCESS') {
        setNewName('');
        setNewSlug('');
        setNewBilling(emptyBillingForm());
        await loadPlans();
        superAdminToast.success('Plan created successfully');
      } else {
        superAdminToast.error(res.message || 'Create failed');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const selectedPlan = selectedId != null ? plans.find((p) => p.id === selectedId) : null;

  return (
    <div>
      <h3 className="mb-3 text-body">Plans &amp; module permissions</h3>
      <p className="text-body-secondary small">
        Each plan defines default visibility for navigation and coarse module access. Schools inherit a plan and may
        receive per-school overrides on the school&apos;s Modules screen.
      </p>

      {loading && <p>Loading…</p>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && (
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card border-secondary shadow-sm">
              <div className="card-header bg-body">Plans</div>
              <ul className="list-group list-group-flush">
                {plans.map((p) => (
                  <li
                    key={p.id}
                    className={`list-group-item d-flex justify-content-between align-items-start gap-2${
                      selectedId === p.id ? ' active' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="fw-medium">{p.name}</div>
                      <code className="small">{p.slug}</code>
                      <div className="small text-muted mt-1">{formatPlanCharge(p)}</div>
                      {!p.is_active && <span className="badge bg-secondary ms-0 mt-1">inactive</span>}
                    </div>
                    <button type="button" className="btn btn-sm btn-outline-primary flex-shrink-0" onClick={() => openModules(p.id)}>
                      Edit
                    </button>
                  </li>
                ))}
                {plans.length === 0 && <li className="list-group-item text-muted">No plans yet.</li>}
              </ul>
            </div>

            <div className="card border-secondary shadow-sm mt-3">
              <div className="card-header bg-body">Create plan</div>
              <div className="card-body">
                <form onSubmit={handleCreate}>
                  {createErr && <div className="alert alert-danger py-1 small">{createErr}</div>}
                  <div className="mb-2">
                    <label className="form-label small">Name</label>
                    <input className="form-control form-control-sm" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small">Slug (unique)</label>
                    <input
                      className="form-control form-control-sm"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="e.g. starter"
                    />
                  </div>
                  <p className="small text-muted fw-semibold mb-2 mt-3">Billing</p>
                  <div className="mb-2">
                    <label className="form-label small">Price (₹)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="form-control form-control-sm"
                      value={newBilling.price_amount}
                      onChange={(e) => setNewBilling((b) => ({ ...b, price_amount: e.target.value }))}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small">Billing interval</label>
                    <select
                      className="form-select form-select-sm"
                      value={newBilling.billing_interval}
                      onChange={(e) => setNewBilling((b) => ({ ...b, billing_interval: e.target.value }))}
                    >
                      {BILLING_INTERVALS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small">Setup fee (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-control form-control-sm"
                        value={newBilling.setup_fee}
                        onChange={(e) => setNewBilling((b) => ({ ...b, setup_fee: e.target.value }))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Trial (days)</label>
                      <input
                        type="number"
                        min={0}
                        className="form-control form-control-sm"
                        value={newBilling.trial_days}
                        onChange={(e) => setNewBilling((b) => ({ ...b, trial_days: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-sm btn-primary">
                    Add plan
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card border-secondary shadow-sm h-100">
              <div className="card-header bg-body d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span>
                  {selectedPlan ? (
                    <>
                      <span className="fw-semibold">{selectedPlan.name}</span>
                      <span className="text-muted small ms-2">module matrix</span>
                    </>
                  ) : (
                    'Module matrix'
                  )}
                </span>
                {selectedId != null && (
                  <button type="button" className="btn btn-sm btn-primary" disabled={saving || modLoading} onClick={saveModules}>
                    {saving ? 'Saving…' : 'Save modules'}
                  </button>
                )}
              </div>
              <div className="card-body">
                {selectedId == null && <p className="text-muted mb-0">Select a plan to edit billing and module defaults.</p>}

                {selectedId != null && (
                  <div className="border rounded-3 p-3 mb-4 bg-body-tertiary">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small fw-semibold text-uppercase text-muted" style={{ letterSpacing: '0.05em' }}>
                        Plan charges
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        disabled={savingBilling}
                        onClick={saveBilling}
                      >
                        {savingBilling ? 'Saving…' : 'Save billing'}
                      </button>
                    </div>
                    {billingErr && <div className="alert alert-danger py-1 small mb-2">{billingErr}</div>}
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label small">Price (₹)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="form-control form-control-sm"
                          value={billingForm.price_amount}
                          onChange={(e) => setBillingForm((b) => ({ ...b, price_amount: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small">Billing interval</label>
                        <select
                          className="form-select form-select-sm"
                          value={billingForm.billing_interval}
                          onChange={(e) => setBillingForm((b) => ({ ...b, billing_interval: e.target.value }))}
                        >
                          {BILLING_INTERVALS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small">Setup fee (₹)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="form-control form-control-sm"
                          value={billingForm.setup_fee}
                          onChange={(e) => setBillingForm((b) => ({ ...b, setup_fee: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small">Trial (days)</label>
                        <input
                          type="number"
                          min={0}
                          className="form-control form-control-sm"
                          value={billingForm.trial_days}
                          onChange={(e) => setBillingForm((b) => ({ ...b, trial_days: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modLoading && <p>Loading modules…</p>}
                {!modLoading && selectedId != null && modules && (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th>Menu</th>
                          <th>Accessible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAAS_MODULE_CATALOG.map(({ key, label }) => {
                          const menuOn = !!modules[key]?.show_in_menu;
                          return (
                            <tr key={key}>
                              <td>{label}</td>
                              <td>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={menuOn}
                                  onChange={(e) => updateFlag(key, 'show_in_menu', e.target.checked)}
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={!!modules[key]?.route_accessible}
                                  disabled={!menuOn}
                                  title={menuOn ? undefined : 'Enable menu first'}
                                  onChange={(e) => updateFlag(key, 'route_accessible', e.target.checked)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPlans;
