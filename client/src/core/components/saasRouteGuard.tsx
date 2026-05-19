import type { ReactElement } from 'react';
import SaasModuleRouteGuard from './SaasModuleRouteGuard';
import type { SaasRoutableModuleKey } from '../utils/saasModuleAccess';

export function guardSaasModule(moduleKey: SaasRoutableModuleKey, element: ReactElement) {
  return <SaasModuleRouteGuard moduleKey={moduleKey}>{element}</SaasModuleRouteGuard>;
}

export function guardHostelModule(element: ReactElement) {
  return guardSaasModule('hostel', element);
}

export function guardTransportModule(element: ReactElement) {
  return guardSaasModule('transport', element);
}

export function guardLibraryModule(element: ReactElement) {
  return guardSaasModule('library', element);
}

export function guardFeesModule(element: ReactElement) {
  return guardSaasModule('fees', element);
}

export function guardHrmModule(element: ReactElement) {
  return guardSaasModule('hrm', element);
}

export function guardReportsModule(element: ReactElement) {
  return guardSaasModule('reports', element);
}

export function guardAccountsModule(element: ReactElement) {
  return guardSaasModule('accounts', element);
}

export function guardUserManagementModule(element: ReactElement) {
  return guardSaasModule('user_management', element);
}

export function guardMembershipModule(element: ReactElement) {
  return guardSaasModule('membership', element);
}

export function guardSettingsModule(element: ReactElement) {
  return guardSaasModule('settings', element);
}

export function guardApplicationModule(element: ReactElement) {
  return guardSaasModule('application', element);
}

export function guardAnnouncementsModule(element: ReactElement) {
  return guardSaasModule('announcements', element);
}

export function guardContentModule(element: ReactElement) {
  return guardSaasModule('content', element);
}

export function guardSportsModule(element: ReactElement) {
  return guardSaasModule('sports', element);
}
