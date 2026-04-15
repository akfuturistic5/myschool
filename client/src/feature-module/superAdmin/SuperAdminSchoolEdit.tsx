import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';

interface School {
  id: number;
  school_name: string;
  type?: string | null;
  institute_number: string;
  db_name: string;
  status: string;
  created_at: string;
}

const SuperAdminSchoolEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  });

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
        const res = await superAdminApiService.getSchoolById(schoolId);
        if (cancelled) return;
        if (res.status === 'SUCCESS' && res.data) {
          const s = res.data as School;
          setOriginal(s);
          setForm({
            school_name: s.school_name,
            type: s.type ?? '',
            institute_number: s.institute_number,
            db_name: s.db_name,
            status: s.status || 'active',
          });
        } else {
          setError(res.message || 'Failed to load school');
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load school');
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
      setTimeout(() => {
        navigate('/super-admin/dashboard');
      }, 800);
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="super-admin-school-edit">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h3 className="mb-0 text-body">Edit School</h3>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate('/super-admin/dashboard')}
        >
          Back to Dashboard
        </button>
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
                  <div className="form-text">Optional to clear: delete text and save (stores NULL).</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Database Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.db_name}
                    disabled
                  />
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
                <button
                  type="button"
                  className="btn btn-outline-secondary me-2"
                  onClick={() => navigate('/super-admin/dashboard')}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
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

