import { useEffect, useState } from 'react';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  validateStrongPassword,
  showPasswordRequirementsAlert,
} from '../../core/utils/passwordPolicy';

interface School {
  id: number;
  school_name: string;
  type?: string | null;
  institute_number: string;
  db_name: string;
  status: string;
  created_at: string;
}

const SuperAdminSchools = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    school_name: '',
    type: '',
    institute_number: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  const loadSchools = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApiService.listSchools();
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setSchools(res.data as School[]);
      } else {
        setError(res.message || 'Failed to load schools');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (
      !form.school_name.trim() ||
      !form.type.trim() ||
      !form.institute_number.trim() ||
      !form.admin_name.trim() ||
      !form.admin_email.trim() ||
      !form.admin_password
    ) {
      setCreateError('All fields are required');
      return;
    }
    const passwordIssue = validateStrongPassword(form.admin_password);
    if (passwordIssue) {
      await showPasswordRequirementsAlert(passwordIssue);
      return;
    }
    setCreating(true);
    try {
      const res = await superAdminApiService.createSchool({
        school_name: form.school_name.trim(),
        type: form.type.trim(),
        institute_number: form.institute_number.trim(),
        admin_name: form.admin_name.trim(),
        admin_email: form.admin_email.trim(),
        admin_password: form.admin_password,
      });
      if (res.status === 'SUCCESS' && res.data) {
        await loadSchools();
        setForm({
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
      const m = e?.message || 'Failed to create school';
      if (/password/i.test(m)) {
        await showPasswordRequirementsAlert(m);
      } else {
        setCreateError(m);
      }
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
      } else {
        setError(res.message || 'Failed to update school status');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update school status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <h3 className="mb-4">Schools</h3>
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3">Create New School</h5>
          {createError && (
            <div className="alert alert-danger" role="alert">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">School Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.school_name}
                  onChange={(e) => onChange('school_name', e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Institute Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.institute_number}
                  onChange={(e) => onChange('institute_number', e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">School type</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.type}
                  onChange={(e) => onChange('type', e.target.value)}
                  disabled={creating}
                  placeholder="e.g. High school and junior college"
                  maxLength={512}
                  autoComplete="off"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Admin Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.admin_name}
                  onChange={(e) => onChange('admin_name', e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Admin Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.admin_email}
                  onChange={(e) => onChange('admin_email', e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Admin Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={form.admin_password}
                  onChange={(e) => onChange('admin_password', e.target.value)}
                  disabled={creating}
                  minLength={8}
                  maxLength={20}
                  autoComplete="new-password"
                />
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create School'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {loading && <p>Loading schools...</p>}
      {error && !loading && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && (
        <div className="table-responsive">
          <table className="table table-striped align-middle">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Institute No.</th>
                <th>DB Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id}>
                  <td>{school.id}</td>
                  <td>{school.school_name}</td>
                  <td className="text-secondary small">{school.type || '—'}</td>
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
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={updatingId === school.id}
                      onClick={() => toggleStatus(school)}
                    >
                      {school.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
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
    </div>
  );
};

export default SuperAdminSchools;

