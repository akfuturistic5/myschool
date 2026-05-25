import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import SuperAdminSettingsOffcanvas from './SuperAdminSettingsOffcanvas';
import { all_routes } from '../router/all_routes';
import '../../style/icon/tabler-icons/webfont/tabler-icons.css';
import './superAdminShell.css';

const SuperAdminLayout = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const r = all_routes;
  const schoolsSectionActive = /^\/super-admin\/schools/.test(location.pathname);

  const [schoolsMenuOpen, setSchoolsMenuOpen] = useState(schoolsSectionActive);

  useEffect(() => {
    if (schoolsSectionActive) {
      setSchoolsMenuOpen(true);
    }
  }, [schoolsSectionActive, location.pathname]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `sa-nav-link${isActive ? ' active' : ''}`;

  const subNavCls = ({ isActive }: { isActive: boolean }) =>
    `${navCls({ isActive })} sa-nav-sublink`;

  const mobileNavCls = (extra: string) => ({ isActive }: { isActive: boolean }) =>
    `${navCls({ isActive })} ${extra}`.trim();

  const toggleSchoolsMenu = () => {
    setSchoolsMenuOpen((open) => !open);
  };

  return (
    <div className="sa-shell super-admin-shell min-vh-100 d-flex flex-column bg-body text-body">
      <header className="sa-header d-flex justify-content-between align-items-center py-3 px-3 px-md-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center bg-white bg-opacity-25 text-white"
            style={{ width: 42, height: 42 }}
            aria-hidden
          >
            <i className="ti ti-layout-dashboard fs-4" />
          </div>
          <div>
            <div className="sa-brand fw-bold fs-5 lh-1 mb-1">MySchool</div>
            <div className="small opacity-75">Platform administration</div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-light btn-sm px-3 rounded-pill d-flex align-items-center gap-2"
          onClick={() => setSettingsOpen(true)}
          aria-expanded={settingsOpen}
          aria-controls="superAdminSettings"
        >
          <i className="ti ti-settings" />
          <span className="d-none d-sm-inline">Settings</span>
        </button>
      </header>

      <div className="d-flex flex-grow-1 overflow-hidden">
        <aside className="sa-sidebar flex-shrink-0 d-none d-md-flex flex-column">
          <div className="px-3 pt-4 pb-2 small text-uppercase fw-semibold" style={{ color: 'var(--sa-muted)', letterSpacing: '0.06em' }}>
            Menu
          </div>
          <nav className="nav flex-column px-2 pb-4 gap-1" aria-label="Super admin">
            <NavLink to={r.superAdminDashboard} className={navCls} end>
              <i className="ti ti-chart-bar" />
              Dashboard
            </NavLink>

            <div className={`sa-nav-group${schoolsSectionActive ? ' sa-nav-group--active' : ''}`}>
              <button
                type="button"
                className={`sa-nav-link sa-nav-parent w-100${schoolsSectionActive ? ' active' : ''}`}
                onClick={toggleSchoolsMenu}
                aria-expanded={schoolsMenuOpen}
                aria-controls="sa-nav-schools-submenu"
              >
                <i className="ti ti-building-community" />
                <span className="sa-nav-parent__label">Manage schools</span>
                <i
                  className={`ti ti-chevron-down sa-nav-chevron${schoolsMenuOpen ? ' sa-nav-chevron--open' : ''}`}
                  aria-hidden
                />
              </button>
              <div
                id="sa-nav-schools-submenu"
                className={`sa-nav-submenu${schoolsMenuOpen ? ' sa-nav-submenu--open' : ''}`}
              >
                <NavLink to={r.superAdminSchoolList} className={subNavCls}>
                  <i className="ti ti-list" />
                  School list
                </NavLink>
                <NavLink to={r.superAdminSchoolPermissions} className={subNavCls}>
                  <i className="ti ti-shield-lock" />
                  School permissions
                </NavLink>
              </div>
            </div>

            <NavLink to={r.superAdminPlans} className={navCls}>
              <i className="ti ti-layers-intersect" />
              Plans &amp; modules
            </NavLink>
            <NavLink to={r.superAdminEnquiries} className={navCls}>
              <i className="ti ti-mail-forward" />
              School enquiries
            </NavLink>
            <NavLink to={r.superAdminHelpCenter} className={navCls}>
              <i className="ti ti-book-2" />
              Help center CMS
            </NavLink>
            <NavLink to={r.superAdminSupportTickets} className={navCls}>
              <i className="ti ti-lifebuoy" />
              Support tickets
            </NavLink>
          </nav>
          <div className="mt-auto px-3 py-3 small border-top" style={{ borderColor: 'var(--sa-border)' }}>
            <div className="text-muted">Signed in as platform admin</div>
          </div>
        </aside>

        <main className="sa-main flex-grow-1 overflow-auto">
          <div className="sa-main-inner p-3 p-md-4 pb-5">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="sa-mobile-nav d-md-none px-1 py-2 d-flex justify-content-around align-items-stretch">
        <NavLink to={r.superAdminDashboard} className={mobileNavCls('flex-column flex-fill align-items-center justify-content-center py-2')} end>
          <i className="ti ti-home fs-5" />
          <span className="small mt-1">Home</span>
        </NavLink>
        <NavLink to={r.superAdminSchoolList} className={mobileNavCls('flex-column flex-fill align-items-center justify-content-center py-2')}>
          <i className="ti ti-building fs-5" />
          <span className="small mt-1">Schools</span>
        </NavLink>
        <NavLink to={r.superAdminPlans} className={mobileNavCls('flex-column flex-fill align-items-center justify-content-center py-2')}>
          <i className="ti ti-stack-2 fs-5" />
          <span className="small mt-1">Plans</span>
        </NavLink>
        <NavLink to={r.superAdminEnquiries} className={mobileNavCls('flex-column flex-fill align-items-center justify-content-center py-2')}>
          <i className="ti ti-inbox fs-5" />
          <span className="small mt-1">Leads</span>
        </NavLink>
      </nav>

      <SuperAdminSettingsOffcanvas open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default SuperAdminLayout;
