import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
  validateStrongPassword,
  showPasswordRequirementsAlert,
} from '../../core/utils/passwordPolicy';

interface PlatformStats {
  total_schools: number;
  total_active_schools: number;
  total_disabled_schools: number;
}

interface School {
  id: number;
  school_name: string;
  type?: string | null;
  institute_number: string;
  db_name: string;
  status: string;
  created_at: string;
}

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

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
    let cancelled = false;

    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await superAdminApiService.getPlatformStats();
        if (cancelled) return;
        if (res.status === 'SUCCESS' && res.data) {
          setStats(res.data as PlatformStats);
        } else {
          setStatsError(res.message || 'Failed to load platform statistics');
        }
      } catch (e: any) {
        if (!cancelled) setStatsError(e?.message || 'Failed to load platform statistics');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    const loadSchools = async () => {
      setSchoolsLoading(true);
      setSchoolsError(null);
      try {
        const res = await superAdminApiService.listSchools();
        if (cancelled) return;
        if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
          setSchools(res.data as School[]);
        } else {
          setSchoolsError(res.message || 'Failed to load schools');
        }
      } catch (e: any) {
        if (!cancelled) setSchoolsError(e?.message || 'Failed to load schools');
      } finally {
        if (!cancelled) setSchoolsLoading(false);
      }
    };

    loadStats();
    loadSchools();

    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated]);

  const refreshAll = async () => {
    // refresh stats and schools in parallel
    try {
      const [statsRes, schoolsRes] = await Promise.all([
        superAdminApiService.getPlatformStats(),
        superAdminApiService.listSchools(),
      ]);

      if (statsRes.status === 'SUCCESS' && statsRes.data) {
        setStats(statsRes.data as PlatformStats);
        setStatsError(null);
      } else {
        setStatsError(statsRes.message || 'Failed to load platform statistics');
      }

      if (schoolsRes.status === 'SUCCESS' && Array.isArray(schoolsRes.data)) {
        setSchools(schoolsRes.data as School[]);
        setSchoolsError(null);
      } else {
        setSchoolsError(schoolsRes.message || 'Failed to load schools');
      }
    } catch (e: any) {
      setStatsError(e?.message || 'Failed to load platform statistics');
      setSchoolsError(e?.message || 'Failed to load schools');
    }
  };

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
        await refreshAll();
        setShowCreateModal(false);
        setCreateForm({
          school_name: '',
          type: '',
          institute_number: '',
          admin_name: '',
          admin_email: '',
          admin_password: '',
        });
      } else {
        setCreateError(res.message || 'Failed to create school');
      }
    } catch (e: any) {
      setCreateError(e?.message || 'Failed to create school');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (school: School) => {
    const nextStatus = school.status === 'disabled' ? 'active' : 'disabled';
    setUpdatingId(school.id);
    try {
      const res = await superAdminApiService.updateSchoolStatus(school.id, nextStatus as 'active' | 'disabled');
      if (res.status === 'SUCCESS' && res.data) {
        setSchools((prev) =>
          prev.map((s) => (s.id === school.id ? { ...s, status: res.data.status } : s))
        );
        await refreshAll();
      } else {
        setSchoolsError(res.message || 'Failed to update school status');
      }
    } catch (e: any) {
      setSchoolsError(e?.message || 'Failed to update school status');
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
        ${school.type ? `Type: <strong>${school.type}</strong><br/>` : ''}
        Institute: <strong>${school.institute_number}</strong></p>
        <p class="mb-2 text-start">Tenant database: <code>${school.db_name}</code></p>
        <p class="mb-0 text-start text-danger small">This removes the school from the platform and drops its tenant database (when the server is allowed to). Enter your Super Admin password to continue.</p>
      `,
      input: 'password',
      inputLabel: 'Super Admin password',
      inputPlaceholder: 'Password',
      showCancelButton: true,
      confirmButtonText: 'Delete school',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      focusCancel: false,
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
      },
      preConfirm: async (password) => {
        const pwd = String(password || '').trim();
        if (!pwd) {
          Swal.showValidationMessage('Password is required');
          return false;
        }
        try {
          await superAdminApiService.deleteSchool(school.id, pwd);
          return true;
        } catch (e: unknown) {
          const err = e as Error & { status?: number };
          if (err?.status === 403) {
            Swal.showValidationMessage('Sorry, that password is incorrect.');
            return false;
          }
          Swal.showValidationMessage(err?.message || 'Could not remove school. Please try again.');
          return false;
        }
      },
    });

    if (!result.isConfirmed || result.value !== true) return;

    setSchools((prev) => prev.filter((s) => s.id !== school.id));
    await refreshAll();
    await MySwal.fire({
      icon: 'success',
      title: 'School removed',
      text: 'The school has been removed',
      confirmButtonText: 'OK',
    });
  };

  return (
    <div className="super-admin-dashboard">
      <h3 className="mb-4 text-body">Super Admin Dashboard</h3>
      {statsLoading && <p>Loading statistics...</p>}
      {statsError && !statsLoading && (
        <div className="alert alert-danger" role="alert">
          {statsError}
        </div>
      )}
      {stats && !statsLoading && !statsError && (
        <div className="row">
          <div className="col-md-4 mb-3">
            <div className="card shadow-sm border-secondary bg-body">
              <div className="card-body">
                <h6 className="text-muted">Total Schools</h6>
                <h3>{stats.total_schools}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-4 mb-3">
            <div className="card shadow-sm border-secondary bg-body">
              <div className="card-body">
                <h6 className="text-muted">Active Schools</h6>
                <h3>{stats.total_active_schools}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-4 mb-3">
            <div className="card">
              <div className="card-body">
                <h6 className="text-muted">Disabled Schools</h6>
                <h3>{stats.total_disabled_schools}</h3>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
        <h5 className="mb-0 text-body">Schools</h5>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
        >
          Create New School
        </button>
      </div>
      {schoolsLoading && <p className="text-body-secondary">Loading schools...</p>}
      {schoolsError && !schoolsLoading && (
        <div className="alert alert-danger" role="alert">
          {schoolsError}
        </div>
      )}
      {!schoolsLoading && !schoolsError && (
        <div className="table-responsive rounded border border-secondary">
          <table className="table table-striped table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>School Name</th>
                <th>Type</th>
                <th>Institute No.</th>
                <th>DB Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr
                  key={school.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/super-admin/schools/${school.id}`)}
                >
                  <td>{school.id}</td>
                  <td>{school.school_name}</td>
                  <td className="text-body-secondary small">{school.type || '—'}</td>
                  <td>{school.institute_number}</td>
                  <td>{school.db_name}</td>
                  <td>
                    <span
                      className={
                        school.status === 'disabled'
                          ? 'badge bg-danger-subtle text-danger'
                          : 'badge bg-success-subtle text-success'
                      }
                    >
                      {school.status || 'active'}
                    </span>
                  </td>
                  <td>
                    {school.status === 'disabled' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-2"
                          disabled={updatingId === school.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(school);
                          }}
                        >
                          Enable
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(school);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        disabled={updatingId === school.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStatus(school);
                        }}
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center">
                    No schools found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Create New School</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setShowCreateModal(false)}
                  />
                </div>
                <div className="modal-body">
                  {createError && (
                    <div className="alert alert-danger" role="alert">
                      {createError}
                    </div>
                  )}
                  <form onSubmit={handleCreateSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">School Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={createForm.school_name}
                          onChange={(e) => onCreateChange('school_name', e.target.value)}
                          disabled={creating}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Institute Number</label>
                        <input
                          type="text"
                          className="form-control"
                          value={createForm.institute_number}
                          onChange={(e) => onCreateChange('institute_number', e.target.value)}
                          disabled={creating}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">School type</label>
                        <input
                          type="text"
                          className="form-control"
                          value={createForm.type}
                          onChange={(e) => onCreateChange('type', e.target.value)}
                          disabled={creating}
                          placeholder="e.g. High school and junior college, College arts and science"
                          maxLength={512}
                          autoComplete="off"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Admin Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={createForm.admin_name}
                          onChange={(e) => onCreateChange('admin_name', e.target.value)}
                          disabled={creating}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Admin Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={createForm.admin_email}
                          onChange={(e) => onCreateChange('admin_email', e.target.value)}
                          disabled={creating}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Admin Password</label>
                        <input
                          type="password"
                          className="form-control"
                          value={createForm.admin_password}
                          onChange={(e) => onCreateChange('admin_password', e.target.value)}
                          disabled={creating}
                          minLength={8}
                          maxLength={20}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </form>
                </div>
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateSubmit}
                    disabled={creating}
                  >
                    {creating ? 'Creating...' : 'Create School'}
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

export default SuperAdminDashboard;


