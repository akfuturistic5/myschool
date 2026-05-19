const { masterQuery } = require('../config/database');
const { SAAS_MODULE_KEYS, SAAS_CORE_MODULE_KEYS, defaultAllModulesTrue, enforceCoreModules } = require('../config/saasModuleCatalog');

/**
 * Effective module flags for a school: plan defaults merged with optional per-school overrides.
 * Unknown module keys in DB are ignored. Missing keys default to visible + accessible.
 */
async function getEffectiveSchoolModules(schoolId) {
  const id = parseInt(String(schoolId), 10);
  if (!Number.isFinite(id)) {
    return { plan: null, modules: defaultAllModulesTrue() };
  }

  const schoolRes = await masterQuery(
    `SELECT id, plan_id FROM schools WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
  if (!schoolRes.rows?.length) {
    return { plan: null, modules: defaultAllModulesTrue() };
  }
  const planId = schoolRes.rows[0].plan_id;

  const base = defaultAllModulesTrue();

  if (planId) {
    const modRes = await masterQuery(
      `SELECT module_key, show_in_menu, route_accessible
       FROM saas_plan_modules WHERE plan_id = $1`,
      [planId]
    );
    for (const row of modRes.rows || []) {
      const k = String(row.module_key || '').trim();
      if (!SAAS_MODULE_KEYS.includes(k)) continue;
      base[k] = {
        show_in_menu: !!row.show_in_menu,
        route_accessible: !!row.route_accessible,
      };
    }
  }

  const ovRes = await masterQuery(
    `SELECT module_key, show_in_menu, route_accessible
     FROM school_module_overrides WHERE school_id = $1`,
    [id]
  );
  for (const row of ovRes.rows || []) {
    const k = String(row.module_key || '').trim();
    if (!SAAS_MODULE_KEYS.includes(k)) continue;
    base[k] = {
      show_in_menu: !!row.show_in_menu,
      route_accessible: !!row.route_accessible,
    };
  }

  let planMeta = null;
  if (planId) {
    const pRes = await masterQuery(
      `SELECT id, name, slug FROM saas_plans WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [planId]
    );
    if (pRes.rows?.length) {
      planMeta = pRes.rows[0];
    }
  }

  return { plan: planMeta, modules: enforceCoreModules(base) };
}

async function listPlanModuleRows(planId) {
  const pid = parseInt(String(planId), 10);
  if (!Number.isFinite(pid)) return [];
  const r = await masterQuery(
    `SELECT module_key, show_in_menu, route_accessible
     FROM saas_plan_modules WHERE plan_id = $1 ORDER BY module_key ASC`,
    [pid]
  );
  return r.rows || [];
}

function normalizeModuleRow(row) {
  const show = !!row.show_in_menu;
  return {
    show_in_menu: show,
    route_accessible: show ? !!row.route_accessible : false,
  };
}

async function replacePlanModules(planId, rows) {
  const pid = parseInt(String(planId), 10);
  if (!Number.isFinite(pid)) throw new Error('Invalid plan id');
  await masterQuery(`DELETE FROM saas_plan_modules WHERE plan_id = $1`, [pid]);
  for (const row of rows) {
    const k = String(row.module_key || '').trim();
    if (!SAAS_MODULE_KEYS.includes(k)) continue;
    const flags = normalizeModuleRow(row);
    await masterQuery(
      `INSERT INTO saas_plan_modules (plan_id, module_key, show_in_menu, route_accessible)
       VALUES ($1, $2, $3, $4)`,
      [pid, k, flags.show_in_menu, flags.route_accessible]
    );
  }
  await masterQuery(
    `INSERT INTO saas_plan_modules (plan_id, module_key, show_in_menu, route_accessible)
     SELECT $1, k, TRUE, TRUE
     FROM unnest($2::text[]) AS k
     ON CONFLICT (plan_id, module_key) DO UPDATE
       SET show_in_menu = TRUE, route_accessible = TRUE`,
    [pid, SAAS_CORE_MODULE_KEYS]
  );
}

async function replaceSchoolOverrides(schoolId, rows) {
  const sid = parseInt(String(schoolId), 10);
  if (!Number.isFinite(sid)) throw new Error('Invalid school id');
  await masterQuery(`DELETE FROM school_module_overrides WHERE school_id = $1`, [sid]);
  for (const row of rows) {
    const k = String(row.module_key || '').trim();
    if (!SAAS_MODULE_KEYS.includes(k)) continue;
    if (SAAS_CORE_MODULE_KEYS.includes(k)) continue;
    const flags = normalizeModuleRow(row);
    await masterQuery(
      `INSERT INTO school_module_overrides (school_id, module_key, show_in_menu, route_accessible)
       VALUES ($1, $2, $3, $4)`,
      [sid, k, flags.show_in_menu, flags.route_accessible]
    );
  }
}

module.exports = {
  getEffectiveSchoolModules,
  listPlanModuleRows,
  replacePlanModules,
  replaceSchoolOverrides,
};
