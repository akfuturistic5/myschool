import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';

interface Enquiry {
  id: number;
  contact_name: string;
  organization_name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  status: string;
  created_at: string;
}

const ENQUIRY_STATUSES = ['new', 'contacted', 'converted', 'dismissed'] as const;

const SuperAdminEnquiries = () => {
  const [searchParams] = useSearchParams();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const statusFromUrl = searchParams.get('status') || '';
  const initialStatus = ENQUIRY_STATUSES.includes(statusFromUrl as (typeof ENQUIRY_STATUSES)[number])
    ? statusFromUrl
    : '';

  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const [form, setForm] = useState({
    contact_name: '',
    organization_name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApiService.listEnquiries(statusFilter || undefined);
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setRows(res.data as Enquiry[]);
      } else {
        setError(res.message || 'Failed to load');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    load();
  }, [authChecked, isAuthenticated, statusFilter]);

  const addEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await superAdminApiService.createEnquiry({
        contact_name: form.contact_name.trim(),
        organization_name: form.organization_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        message: form.message.trim() || null,
      });
      if (res.status === 'SUCCESS') {
        setForm({ contact_name: '', organization_name: '', email: '', phone: '', message: '' });
        await load();
      } else {
        setError(res.message || 'Could not add');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setSubmitting(false);
    }
  };

  const patchStatus = async (id: number, status: Enquiry['status']) => {
    try {
      const res = await superAdminApiService.patchEnquiry(
        id,
        status as 'new' | 'contacted' | 'converted' | 'dismissed'
      );
      if (res.status === 'SUCCESS') await load();
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-body">School enquiries</h3>
      <p className="small text-body-secondary">
        Track organisations that are interested in the SaaS before you provision a tenant. Status workflow: new →
        contacted → converted (school created) or dismissed.
      </p>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card border-secondary shadow-sm">
            <div className="card-header bg-body">Add enquiry</div>
            <div className="card-body">
              <form onSubmit={addEnquiry} className="vstack gap-2">
                <div>
                  <label className="form-label small">Contact name *</label>
                  <input
                    className="form-control form-control-sm"
                    required
                    value={form.contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label small">Organisation</label>
                  <input
                    className="form-control form-control-sm"
                    value={form.organization_name}
                    onChange={(e) => setForm((f) => ({ ...f, organization_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label small">Email</label>
                  <input
                    type="email"
                    className="form-control form-control-sm"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label small">Phone</label>
                  <input
                    className="form-control form-control-sm"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label small">Notes</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn btn-sm btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save lead'}
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="small text-muted mb-0">Filter</label>
            <select
              className="form-select form-select-sm w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          {error && <div className="alert alert-danger py-1 small">{error}</div>}
          {loading && <p>Loading…</p>}
          {!loading && (
            <div className="table-responsive border border-secondary rounded">
              <table className="table table-sm table-striped mb-0">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Contact / org</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="small text-muted">{new Date(r.created_at).toLocaleString()}</td>
                      <td>
                        <div className="fw-medium">{r.contact_name}</div>
                        <div className="small">{r.organization_name || '—'}</div>
                        <div className="small text-muted">
                          {[r.email, r.phone].filter(Boolean).join(' · ') || ''}
                        </div>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={r.status}
                          onChange={(e) => patchStatus(r.id, e.target.value)}
                        >
                          <option value="new">new</option>
                          <option value="contacted">contacted</option>
                          <option value="converted">converted</option>
                          <option value="dismissed">dismissed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No enquiries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminEnquiries;
