/** Keep keys aligned with server/src/config/saasModuleCatalog.js */
export const SAAS_CORE_MODULE_KEYS = ['peoples', 'academic'] as const;

export function isSaasCoreModule(key: string): boolean {
  return (SAAS_CORE_MODULE_KEYS as readonly string[]).includes(key);
}

/** Keep keys aligned with server/src/config/saasModuleCatalog.js */
export const SAAS_MODULE_CATALOG: { key: string; label: string }[] = [
  { key: 'peoples', label: 'Peoples' },
  { key: 'academic', label: 'Academic' },
  { key: 'fees', label: 'Fees collection' },
  { key: 'library', label: 'Library' },
  { key: 'hostel', label: 'Hostel' },
  { key: 'transport', label: 'Transport' },
  { key: 'hrm', label: 'HRM' },
  { key: 'accounts', label: 'Finance & accounts' },
  { key: 'reports', label: 'Reports' },
  { key: 'user_management', label: 'User management' },
  { key: 'membership', label: 'Membership' },
  { key: 'settings', label: 'School settings' },
  { key: 'application', label: 'Application toolkit' },
  { key: 'announcements', label: 'Notice board & events' },
  { key: 'content', label: 'Content & pages' },
  { key: 'sports', label: 'Sports' },
];

export type SaasModuleFlags = { show_in_menu: boolean; route_accessible: boolean };

export type SaasModulesMap = Record<string, SaasModuleFlags>;
