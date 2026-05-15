/**
 * Canonical SaaS module keys for plan defaults and school overrides.
 * Keep in sync with client/src/core/utils/saasModuleKeys.ts
 */
const SAAS_MODULE_CATALOG = [
  { key: 'peoples', label: 'Peoples', description: 'Students, parents, guardians, teachers' },
  { key: 'academic', label: 'Academic', description: 'Years, classes, subjects, timetable, exams' },
  { key: 'fees', label: 'Fees collection', description: 'Fee masters and collection' },
  { key: 'library', label: 'Library', description: 'Books, issue/return' },
  { key: 'hostel', label: 'Hostel', description: 'Rooms, beds, assignments' },
  { key: 'transport', label: 'Transport', description: 'Routes, vehicles, allocation' },
  { key: 'hrm', label: 'HRM', description: 'Staff, attendance, leave, payroll' },
  { key: 'accounts', label: 'Finance & accounts', description: 'Income, expenses, invoices' },
  { key: 'reports', label: 'Reports', description: 'Operational and academic reports' },
  { key: 'user_management', label: 'User management', description: 'Users, roles, delete requests' },
  { key: 'membership', label: 'Membership', description: 'Membership plans inside tenant' },
  { key: 'settings', label: 'School settings', description: 'Masters, payment modes, school profile' },
  { key: 'application', label: 'Application toolkit', description: 'Chat, calendar, email, files' },
  { key: 'announcements', label: 'Notice board & events', description: 'Announcements and school events' },
  { key: 'content', label: 'Content & pages', description: 'CMS-style pages, blog, locations' },
  { key: 'sports', label: 'Sports', description: 'Sports and players' },
];

const SAAS_MODULE_KEYS = SAAS_MODULE_CATALOG.map((m) => m.key);

function defaultAllModulesTrue() {
  const o = {};
  for (const k of SAAS_MODULE_KEYS) {
    o[k] = { show_in_menu: true, route_accessible: true };
  }
  return o;
}

module.exports = {
  SAAS_MODULE_CATALOG,
  SAAS_MODULE_KEYS,
  defaultAllModulesTrue,
};
