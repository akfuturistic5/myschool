import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
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
  const [original, setOriginal] = useState<School | null>(null);
  const [form, setForm] = useState({
    school_name: '',
    type: '',
    institute_number: '',
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
            status: s.status || 'active',
          });
        } else {
          setError(res.message || 'Failed to load school');
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!original) return;

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

      superAdminToast.success('School updated successfully');
      navigate(`/super-admin/schools/${schoolId}`);
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="super-admin-school-edit">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <button
            type="button"
            className="btn btn-link btn-sm text-muted px-0 mb-1"
            onClick={() => navigate(`/super-admin/schools/${schoolId}`)}
          >
            <i className="ti ti-arrow-left me-1" />
            Back to school
          </button>
          <h3 className="mb-0 text-body">Edit school</h3>
          {original && <p className="small text-muted mb-0">{original.school_name}</p>}
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate(all_routes.superAdminSchoolList)}
        >
          All schools
        </button>
      </div>

      {loading && <p className="text-body-secondary">Loading…</p>}
      {error && !loading && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && original && (
        <div className="card shadow-sm border-secondary bg-body">
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">School name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.school_name}
                    onChange={(e) => onChange('school_name', e.target.value)}
                    disabled={saving}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Institute number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.institute_number}
                    onChange={(e) => onChange('institute_number', e.target.value)}
                    disabled={saving}
                    required
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
                  <div className="form-text">Clear the field and save to store empty.</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Database name</label>
                  <input type="text" className="form-control" value={original.db_name} disabled readOnly />
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
              <div className="mt-4 d-flex flex-wrap gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={saving}
                  onClick={() => navigate(`/super-admin/schools/${schoolId}`)}
                >
                  Cancel
                </button>
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
