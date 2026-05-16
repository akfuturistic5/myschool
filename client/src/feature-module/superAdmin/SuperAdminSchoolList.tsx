import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { all_routes } from '../router/all_routes';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
  validateStrongPassword,
  showPasswordRequirementsAlert,
} from '../../core/utils/passwordPolicy';
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

const r = all_routes;

const SuperAdminSchoolList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const statusFromUrl = searchParams.get('status') || '';
  const initialStatus =
    statusFromUrl === 'active' || statusFromUrl === 'disabled' ? statusFromUrl : '';

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    school_name: '',
    type: '',
    institute_number: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const MySwal = withReactContent(Swal);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApiService.listSchools(
        statusFilter || undefined,
        debouncedSearch || undefined
      );
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setSchools(res.data as School[]);
      } else {
        setError(res.message || 'Failed to load schools');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, authChecked, isAuthenticated]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    loadSchools();
  }, [loadSchools, authChecked, isAuthenticated]);

  const onCreateChange = (key: keyof typeof createForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (
      !createForm.school_name.trim() ||
      !createForm.type.trim() ||
      !createForm.institute_number.trim() ||
      !createForm.admin_name.trim() ||
      !createForm.admin_email.trim() ||
      !createForm.admin_password
    ) {
      setCreateError('All fields are required');
      return;
    }
    const passwordIssue = validateStrongPassword(createForm.admin_password);
    if (passwordIssue) {
      await showPasswordRequirementsAlert(passwordIssue);
      return;
    }
    setCreating(true);
    try {
      const res = await superAdminApiService.createSchool({
        school_name: createForm.school_name.trim(),
        type: createForm.type.trim(),
        institute_number: createForm.institute_number.trim(),
        admin_name: createForm.admin_name.trim(),
        admin_email: createForm.admin_email.trim(),
        admin_password: createForm.admin_password,
      });
      if (res.status === 'SUCCESS' && res.data) {
        const row = res.data as { id?: number };
        await loadSchools();
        setShowCreateModal(false);
        setCreateForm({
          school_name: '',
          type: '',
          institute_number: '',
          admin_name: '',
          admin_email: '',
          admin_password: '',
        });
        if (row?.id) {
          navigate(`${r.superAdminSchoolPermissions}?school=${row.id}`);
        }
      } else {
        setCreateError(res.message || 'Failed to create school');
      }
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create school');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (school: School) => {
    const nextStatus = school.status === 'disabled' ? 'active' : 'disabled';
    setUpdatingId(school.id);
    try {
      const res = await superAdminApiService.updateSchoolStatus(school.id, nextStatus as 'active' | 'disabled');
      if (res.status === 'SUCCESS') await loadSchools();
      else setError(res.message || 'Failed to update school status');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update school status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (school: School) => {
    const result = await MySwal.fire({
      icon: 'warning',
      title: 'Delete school',
      html: `
        <p class="mb-2 text-start"><strong>${school.school_name}</strong><br/>
        Institute: <strong>${school.institute_number}</strong></p>
        <p class="mb-0 text-start text-danger small">This removes the school from the platform and may drop its tenant database. Enter your Super Admin password.</p>
      `,
      input: 'password',
      showCancelButton: true,
      confirmButtonText: 'Delete school',
      confirmButtonColor: '#d33',
      preConfirm: async (password) => {
        const pwd = String(password || '').trim();
        if (!pwd) {
          Swal.showValidationMessage('Password is required');
          return false;
        }
        try {
          await superAdminApiService.deleteSchool(school.id, pwd);
          return true;
        } catch (err: unknown) {
          const er = err as Error & { status?: number };
          if (er?.status === 403) Swal.showValidationMessage('Incorrect password');
          else Swal.showValidationMessage(er?.message || 'Delete failed');
          return false;
        }
      },
    });
    if (result.isConfirmed) await loadSchools();
  };

  return (
    <div className="super-admin-school-list">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold mb-2" style={{ letterSpacing: '0.08em', color: 'var(--sa-muted)' }}>
            Manage schools
          </p>
          <h1 className="h3 fw-bold mb-1 text-body">School list</h1>
          <p className="text-body-secondary mb-0 small">
            All tenant schools. Open a record for settings, or use{' '}
            <Link to={r.superAdminSchoolPermissions} className="fw-semibold">
              School permissions
            </Link>{' '}
            to review module access.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary rounded-pill px-4 d-flex align-items-center gap-2"
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
        >
          <i className="ti ti-plus" />
          Create school
        </button>
      </div>

      <div className="sa-glass-card p-3 p-md-4 mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label small fw-semibold text-muted mb-1">Status</label>
            <select
              className="form-select rounded-3"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="col-md-8">
            <label className="form-label small fw-semibold text-muted mb-1">Search</label>
            <div className="input-group">
              <span className="input-group-text bg-body border-end-0 rounded-start-3 text-muted">
                <i className="ti ti-search" />
              </span>
              <input
                type="search"
                className="form-control border-start-0 rounded-end-3"
                placeholder="School name, institute number, or database name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="d-flex align-items-center gap-2 text-body-secondary py-5 justify-content-center">
          <div className="spinner-border spinner-border-sm" />
          Loading schools…
        </div>
      )}
      {error && !loading && <div className="alert alert-danger rounded-3">{error}</div>}

      {!loading && !error && (
        <div className="sa-glass-card overflow-hidden">
          <div
            className="px-3 py-3 border-bottom d-flex justify-content-between align-items-center"
            style={{ borderColor: 'var(--sa-border)' }}
          >
            <span className="fw-semibold text-body">
              <i className="ti ti-list me-2 text-primary" />
              Schools
              <span className="text-muted fw-normal ms-2">({schools.length})</span>
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">School</th>
                  <th>Institute</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr
                    key={s.id}
                    className="sa-school-row"
                    onClick={() => navigate(`/super-admin/schools/${s.id}`)}
                  >
                    <td className="ps-3">
                      <div className="fw-semibold text-body">{s.school_name}</div>
                      <div className="small text-muted text-truncate" style={{ maxWidth: 280 }}>
                        {s.type || '—'}
                      </div>
                    </td>
                    <td>
                      <code className="small bg-body-secondary px-2 py-1 rounded">{s.institute_number}</code>
                    </td>
                    <td className="small">{s.plan_name || '—'}</td>
                    <td>
                      <span
                        className={`badge rounded-pill ${
                          s.status === 'disabled' ? 'text-bg-danger-subtle text-danger' : 'text-bg-success-subtle text-success'
                        }`}
                      >
                        {s.status || 'active'}
                      </span>
                    </td>
                    <td className="text-end pe-3" onClick={(e) => e.stopPropagation()}>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          title="School record"
                          onClick={() => navigate(`/super-admin/schools/${s.id}`)}
                        >
                          <i className="ti ti-id" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          title="Module permissions"
                          onClick={() => navigate(`${r.superAdminSchoolPermissions}?school=${s.id}`)}
                        >
                          <i className="ti ti-shield-check" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          title="Edit module overrides"
                          onClick={() => navigate(`/super-admin/schools/${s.id}/modules`)}
                        >
                          <i className="ti ti-adjustments" />
                        </button>
                        {s.status === 'disabled' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline-success"
                              disabled={updatingId === s.id}
                              onClick={() => toggleStatus(s)}
                              title="Enable"
                            >
                              <i className="ti ti-power" />
                            </button>
                            <button type="button" className="btn btn-outline-danger" title="Delete" onClick={() => handleDelete(s)}>
                              <i className="ti ti-trash" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-warning"
                            disabled={updatingId === s.id}
                            title="Disable"
                            onClick={() => toggleStatus(s)}
                          >
                            <i className="ti ti-ban" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {schools.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted">
                      No schools match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <div className="modal-content border-0 shadow-lg rounded-4">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold">Create school</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setShowCreateModal(false)}
                  />
                </div>
                <div className="modal-body pt-2">
                  {createError && <div className="alert alert-danger rounded-3">{createError}</div>}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">School name</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        value={createForm.school_name}
                        onChange={(e) => onCreateChange('school_name', e.target.value)}
                        disabled={creating}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Institute number</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        value={createForm.institute_number}
                        onChange={(e) => onCreateChange('institute_number', e.target.value)}
                        disabled={creating}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">School type</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        value={createForm.type}
                        onChange={(e) => onCreateChange('type', e.target.value)}
                        disabled={creating}
                        placeholder="e.g. High school"
                        maxLength={512}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Admin name</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        value={createForm.admin_name}
                        onChange={(e) => onCreateChange('admin_name', e.target.value)}
                        disabled={creating}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Admin email</label>
                      <input
                        type="email"
                        className="form-control rounded-3"
                        value={createForm.admin_email}
                        onChange={(e) => onCreateChange('admin_email', e.target.value)}
                        disabled={creating}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Admin password</label>
                      <input
                        type="password"
                        className="form-control rounded-3"
                        value={createForm.admin_password}
                        onChange={(e) => onCreateChange('admin_password', e.target.value)}
                        disabled={creating}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-4"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary rounded-pill px-4" disabled={creating} onClick={handleCreateSubmit}>
                    {creating ? 'Creating…' : 'Create tenant'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SuperAdminSchoolList;
