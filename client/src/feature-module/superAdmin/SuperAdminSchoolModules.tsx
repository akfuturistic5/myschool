import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { SAAS_MODULE_CATALOG, type SaasModulesMap } from '../../core/utils/saasModuleKeys';
import { all_routes } from '../router/all_routes';

const SuperAdminSchoolModules = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const schoolId = Number(id);
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<SaasModulesMap | null>(null);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !schoolId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [modRes, schRes] = await Promise.all([
          superAdminApiService.getSchoolModules(schoolId),
          superAdminApiService.getSchoolById(schoolId),
        ]);
        if (cancelled) return;
        if (schRes.status === 'SUCCESS' && schRes.data) {
          setSchoolName(String((schRes.data as { school_name?: string }).school_name || ''));
        }
        if (modRes.status === 'SUCCESS' && modRes.data && (modRes.data as { effective?: SaasModulesMap }).effective) {
          setModules({ ...(modRes.data as { effective: SaasModulesMap }).effective });
        } else {
          setError(modRes.message || 'Failed to load modules');
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId, authChecked, isAuthenticated]);

  const updateFlag = (key: string, field: 'show_in_menu' | 'route_accessible', value: boolean) => {
    setModules((prev) => {
      if (!prev) return prev;
      const cur = prev[key] || { show_in_menu: true, route_accessible: true };
      return {
        ...prev,
        [key]: { ...cur, [field]: value },
      };
    });
  };

  const handleSave = async () => {
    if (!modules) return;
    setSaving(true);
    setError(null);
    try {
      const overrides = SAAS_MODULE_CATALOG.map(({ key }) => ({
        module_key: key,
        show_in_menu: !!modules[key]?.show_in_menu,
        route_accessible: !!modules[key]?.route_accessible,
      }));
      const res = await superAdminApiService.putSchoolModuleOverrides(schoolId, overrides);
      if (res.status !== 'SUCCESS') {
        setError(res.message || 'Save failed');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="mb-0 text-body">School modules</h3>
          <div className="small text-muted">
            {schoolName ? <span>{schoolName}</span> : <span>School #{schoolId}</span>}
            <span className="mx-1">·</span>
            <span>Overrides replace plan defaults for this tenant only.</span>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(`${all_routes.superAdminSchoolPermissions}?school=${schoolId}`)}
          >
            Permissions view
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(`/super-admin/schools/${schoolId}`)}>
            School details
          </button>
          <button type="button" className="btn btn-primary" disabled={saving || !modules} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save overrides'}
          </button>
        </div>
      </div>

      {loading && <p className="text-body-secondary">Loading…</p>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && modules && (
        <div className="table-responsive border border-secondary rounded">
          <table className="table table-sm align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Module</th>
                <th>Show in menu</th>
                <th>Route accessible</th>
              </tr>
            </thead>
            <tbody>
              {SAAS_MODULE_CATALOG.map(({ key, label }) => (
                <tr key={key}>
                  <td>
                    <div className="fw-medium">{label}</div>
                    <code className="small text-muted">{key}</code>
                  </td>
                  <td>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={!!modules[key]?.show_in_menu}
                        onChange={(e) => updateFlag(key, 'show_in_menu', e.target.checked)}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={!!modules[key]?.route_accessible}
                        onChange={(e) => updateFlag(key, 'route_accessible', e.target.checked)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSchoolModules;
