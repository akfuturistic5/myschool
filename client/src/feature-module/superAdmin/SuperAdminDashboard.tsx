import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { all_routes } from '../router/all_routes';
import '../../style/icon/tabler-icons/webfont/tabler-icons.css';
import './superAdminShell.css';

interface PlatformStats {
  total_schools: number;
  total_active_schools: number;
  total_inactive_schools: number;
  total_plans: number;
  enquiries_new: number;
}

type StatDef = {
  key: keyof PlatformStats;
  label: string;
  hint?: string;
  icon: string;
  accent: string;
  iconBg: string;
  to: string;
};

const STAT_ITEMS: StatDef[] = [
  {
    key: 'total_schools',
    label: 'Total schools',
    icon: 'ti-building-community',
    accent: '#334155',
    iconBg: 'rgba(51,65,85,0.12)',
    to: all_routes.superAdminSchoolList,
  },
  {
    key: 'total_active_schools',
    label: 'Active',
    icon: 'ti-circle-check',
    accent: '#059669',
    iconBg: 'rgba(5,150,105,0.12)',
    to: `${all_routes.superAdminSchoolList}?status=active`,
  },
  {
    key: 'total_inactive_schools',
    label: 'Inactive',
    hint: 'Schools not on active status',
    icon: 'ti-alert-circle',
    accent: '#d97706',
    iconBg: 'rgba(217,119,6,0.14)',
    to: `${all_routes.superAdminSchoolList}?status=disabled`,
  },
  {
    key: 'total_plans',
    label: 'Plans',
    hint: 'Active subscription tiers',
    icon: 'ti-layers-intersect',
    accent: '#4f46e5',
    iconBg: 'rgba(79,70,229,0.14)',
    to: all_routes.superAdminPlans,
  },
  {
    key: 'enquiries_new',
    label: 'New leads',
    hint: 'Enquiry status: new',
    icon: 'ti-mail-plus',
    accent: '#2563eb',
    iconBg: 'rgba(37,99,235,0.12)',
    to: `${all_routes.superAdminEnquiries}?status=new`,
  },
];

const SuperAdminDashboard = () => {
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);
  const r = all_routes;

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await superAdminApiService.getPlatformStats();
        if (cancelled) return;
        if (res.status === 'SUCCESS' && res.data) {
          const raw = res.data as PlatformStats & { total_disabled_schools?: number };
          setStats({
            total_schools: raw.total_schools ?? 0,
            total_active_schools: raw.total_active_schools ?? 0,
            total_inactive_schools: raw.total_inactive_schools ?? 0,
            total_plans: raw.total_plans ?? 0,
            enquiries_new: raw.enquiries_new ?? 0,
          });
        } else {
          setStatsError(res.message || 'Failed to load platform statistics');
        }
      } catch (e: unknown) {
        if (!cancelled) setStatsError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated]);

  return (
    <div className="super-admin-dashboard">
      {statsLoading && (
        <div className="d-flex align-items-center gap-2 text-body-secondary py-4">
          <div className="spinner-border spinner-border-sm" role="status" aria-hidden />
          Loading live statistics…
        </div>
      )}
      {statsError && !statsLoading && (
        <div className="alert alert-danger rounded-3 border-0 shadow-sm" role="alert">
          {statsError}
        </div>
      )}

      {stats && !statsLoading && !statsError && (
        <div className="row g-3 g-md-4 mb-4">
          {STAT_ITEMS.map((item) => (
            <div key={item.key} className="col-6 col-xl-4">
              <Link to={item.to} className="sa-stat-card sa-stat-card--link p-4 h-100 text-decoration-none text-body">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div
                    className="sa-stat-icon flex-shrink-0"
                    style={{ background: item.iconBg, color: item.accent }}
                  >
                    <i className={`ti ${item.icon}`} />
                  </div>
                  <i className="ti ti-arrow-up-right text-muted sa-stat-card__arrow" aria-hidden />
                </div>
                <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ letterSpacing: '0.04em' }}>
                  {item.label}
                </div>
                <div className="display-6 fw-bold lh-sm" style={{ color: item.accent }}>
                  {stats[item.key]}
                </div>
                {item.hint && <div className="small text-muted mt-2">{item.hint}</div>}
              </Link>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default SuperAdminDashboard;
