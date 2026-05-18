import type { SaasModulesMap } from '../../core/utils/saasModuleKeys';

/** When menu is off, route access is forced off. Route toggle only applies when menu is on. */
export function patchSaasModuleFlags(
  prev: SaasModulesMap,
  key: string,
  field: 'show_in_menu' | 'route_accessible',
  value: boolean
): SaasModulesMap {
  const cur = prev[key] || { show_in_menu: true, route_accessible: true };

  if (field === 'show_in_menu') {
    return {
      ...prev,
      [key]: {
        show_in_menu: value,
        route_accessible: value ? cur.route_accessible : false,
      },
    };
  }

  if (!cur.show_in_menu) {
    return prev;
  }

  return {
    ...prev,
    [key]: { ...cur, route_accessible: value },
  };
}

export function normalizeSaasModulesMap(modules: SaasModulesMap): SaasModulesMap {
  const out: SaasModulesMap = { ...modules };
  for (const key of Object.keys(out)) {
    const row = out[key];
    if (!row) continue;
    if (!row.show_in_menu) {
      out[key] = { ...row, route_accessible: false };
    }
  }
  return out;
}
