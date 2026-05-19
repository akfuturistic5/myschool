import type { SaasModulesMap } from './saasModuleKeys';
import { SAAS_MODULE_CATALOG } from './saasModuleKeys';

/** SaaS modules that can show a subscription lock overlay (excludes core modules). */
export type SaasRoutableModuleKey =
  | 'fees'
  | 'library'
  | 'hostel'
  | 'transport'
  | 'hrm'
  | 'accounts'
  | 'reports'
  | 'user_management'
  | 'membership'
  | 'settings'
  | 'application'
  | 'announcements'
  | 'content'
  | 'sports';

export function getModuleLabel(moduleKey: string): string {
  return SAAS_MODULE_CATALOG.find((m) => m.key === moduleKey)?.label ?? moduleKey;
}

/**
 * Route is locked when route access is off (subscription upgrade required).
 * When saas_modules is absent, all routes remain accessible (legacy tenants).
 */
export function isModuleRouteLocked(
  modules: SaasModulesMap | null | undefined,
  moduleKey: string
): boolean {
  if (!modules || typeof modules !== 'object') return false;
  const flags = modules[moduleKey];
  if (!flags) return false;
  return flags.route_accessible === false;
}

export function isModuleRouteAccessible(
  modules: SaasModulesMap | null | undefined,
  moduleKey: string
): boolean {
  return !isModuleRouteLocked(modules, moduleKey);
}
