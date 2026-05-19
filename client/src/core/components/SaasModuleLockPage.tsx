import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../data/redux/authSlice';
import { getDashboardForRole } from '../utils/roleUtils';
import { getModuleLabel, type SaasRoutableModuleKey } from '../utils/saasModuleAccess';

type ModuleMeta = { icon: string; iconClass: string; benefits: string[] };

const DEFAULT_META: ModuleMeta = {
  icon: 'ti-package',
  iconClass: 'saas-module-lock-overlay__icon-wrap--default',
  benefits: [
    'Full access to this module on your plan',
    'All menus and routes in this section',
    'Contact your administrator to upgrade',
  ],
};

const MODULE_META: Partial<Record<SaasRoutableModuleKey, ModuleMeta>> = {
  hostel: {
    icon: 'ti-building-community',
    iconClass: 'saas-module-lock-overlay__icon-wrap--hostel',
    benefits: [
      'Hostel buildings, rooms, beds & floors',
      'Student and staff bed assignments',
      'Occupancy and allocation reports',
    ],
  },
  transport: {
    icon: 'ti-bus',
    iconClass: 'saas-module-lock-overlay__icon-wrap--transport',
    benefits: [
      'Routes, vehicles & pickup points',
      'Student and staff transport allocation',
      'Fees and assignment management',
    ],
  },
  library: {
    icon: 'ti-books',
    iconClass: 'saas-module-lock-overlay__icon-wrap--library',
    benefits: [
      'Book catalog, categories & policies',
      'Issue, return & reservations',
      'Member management and due tracking',
    ],
  },
  fees: {
    icon: 'ti-receipt',
    iconClass: 'saas-module-lock-overlay__icon-wrap--fees',
    benefits: [
      'Fee groups, types & assignments',
      'Collect and track student payments',
      'Fee reports and collection history',
    ],
  },
  hrm: {
    icon: 'ti-users-group',
    iconClass: 'saas-module-lock-overlay__icon-wrap--hrm',
    benefits: [
      'Staff directory, departments & designations',
      'Attendance, leave & payroll',
      'Salary settings and approvals',
    ],
  },
  reports: {
    icon: 'ti-chart-bar',
    iconClass: 'saas-module-lock-overlay__icon-wrap--reports',
    benefits: [
      'Fees, attendance & academic reports',
      'Student, class & grade analytics',
      'Staff and leave operational reports',
    ],
  },
  accounts: {
    icon: 'ti-wallet',
    iconClass: 'saas-module-lock-overlay__icon-wrap--accounts',
    benefits: [
      'Income, expenses & transactions',
      'Invoices and payment tracking',
      'Financial category management',
    ],
  },
  user_management: {
    icon: 'ti-shield-lock',
    iconClass: 'saas-module-lock-overlay__icon-wrap--user-management',
    benefits: [
      'Users, roles & permissions',
      'Access control for your school',
      'Delete account request handling',
    ],
  },
  membership: {
    icon: 'ti-id-badge-2',
    iconClass: 'saas-module-lock-overlay__icon-wrap--membership',
    benefits: [
      'Membership plans & add-ons',
      'Member transactions',
      'Subscription billing inside tenant',
    ],
  },
  settings: {
    icon: 'ti-settings',
    iconClass: 'saas-module-lock-overlay__icon-wrap--settings',
    benefits: [
      'School profile & master data',
      'Payment modes, religion & houses',
      'System and app configuration',
    ],
  },
  application: {
    icon: 'ti-apps',
    iconClass: 'saas-module-lock-overlay__icon-wrap--application',
    benefits: [
      'Chat, email & calendar',
      'File manager, notes & to-do',
      'Voice and video calling',
    ],
  },
  announcements: {
    icon: 'ti-speakerphone',
    iconClass: 'saas-module-lock-overlay__icon-wrap--announcements',
    benefits: [
      'Notice board for your school',
      'Events and calendar publishing',
      'Communicate with your community',
    ],
  },
  content: {
    icon: 'ti-layout',
    iconClass: 'saas-module-lock-overlay__icon-wrap--content',
    benefits: [
      'CMS pages, blog & FAQ',
      'Locations and testimonials',
      'Public-facing school content',
    ],
  },
  sports: {
    icon: 'ti-run',
    iconClass: 'saas-module-lock-overlay__icon-wrap--sports',
    benefits: [
      'Sports and teams management',
      'Player registration',
      'Sports activity tracking',
    ],
  },
};

function getModuleMeta(moduleKey: SaasRoutableModuleKey): ModuleMeta {
  return MODULE_META[moduleKey] ?? DEFAULT_META;
}

type Props = {
  moduleKey: SaasRoutableModuleKey;
};

const SaasModuleLockPage = ({ moduleKey }: Props) => {
  const user = useSelector(selectUser);
  const moduleLabel = getModuleLabel(moduleKey);
  const meta = getModuleMeta(moduleKey);
  const dashboardPath = getDashboardForRole(user?.role, user?.user_role_id);

  return (
    <div
      className="saas-module-lock-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saas-module-lock-title"
    >
      <div className="saas-module-lock-overlay__center">
        <div className="saas-module-lock-overlay__card">
          <div className="saas-module-lock-overlay__card-top">
            <div className="saas-module-lock-overlay__glow" aria-hidden />
            <div className={`saas-module-lock-overlay__icon-wrap ${meta.iconClass}`} aria-hidden>
              <i className={`ti ${meta.icon}`} />
            </div>
            <span className="saas-module-lock-overlay__badge">
              <i className="ti ti-lock" aria-hidden />
              Premium module
            </span>
            <h2 id="saas-module-lock-title" className="saas-module-lock-overlay__title">
              Unlock {moduleLabel}
            </h2>
            <p className="saas-module-lock-overlay__desc">
              Upgrade your school plan to use all {moduleLabel.toLowerCase()} features. A preview of
              this module is visible behind this panel.
            </p>
          </div>

          <div className="saas-module-lock-overlay__card-body">
            <ul className="saas-module-lock-overlay__benefits">
              {meta.benefits.map((line) => (
                <li key={line}>
                  <i className="ti ti-circle-check-filled" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="saas-module-lock-overlay__card-footer">
            <div className="saas-module-lock-overlay__actions">
              <Link to={dashboardPath} className="saas-module-lock-overlay__btn-dash">
                <i className="ti ti-layout-dashboard" aria-hidden />
                Back to dashboard
              </Link>
              <span className="saas-module-lock-overlay__btn-upgrade" title="Coming soon">
                <i className="ti ti-crown" aria-hidden />
                Upgrade plan — coming soon
              </span>
            </div>
            {user?.school_name && (
              <p className="saas-module-lock-overlay__school">{user.school_name}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaasModuleLockPage;
