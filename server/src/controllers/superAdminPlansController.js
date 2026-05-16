const { masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { SAAS_MODULE_KEYS, defaultAllModulesTrue } = require('../config/saasModuleCatalog');
const { listPlanModuleRows, replacePlanModules } = require('../services/saasSchoolModulesService');
const { writeSuperAdminAudit } = require('../utils/superAdminSecurity');
const {
  PLAN_PRICING_COLUMNS,
  parsePlanPricingFields,
  defaultPricingFields,
} = require('../utils/saasPlanPricing');

const PLAN_LIST_COLUMNS = `id, name, slug, description, sort_order, is_active, ${PLAN_PRICING_COLUMNS}, created_at, updated_at`;

const listPlans = async (req, res) => {
  try {
    const r = await masterQuery(
      `SELECT ${PLAN_LIST_COLUMNS}
       FROM saas_plans
       ORDER BY sort_order ASC, id ASC`
    );
    return success(res, 200, 'Plans fetched', r.rows || []);
  } catch (err) {
    console.error('listPlans error:', err);
    return errorResponse(res, 500, 'Failed to list plans');
  }
};

const createPlan = async (req, res) => {
  try {
    const { name, slug, description, sort_order, is_active } = req.body || {};
    const nm = String(name || '').trim();
    const sl = String(slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (nm.length < 2) return errorResponse(res, 400, 'Plan name is required');
    if (sl.length < 2) return errorResponse(res, 400, 'Plan slug is required');

    const pricingParsed = parsePlanPricingFields(req.body);
    if (pricingParsed.error) return errorResponse(res, 400, pricingParsed.error);
    const pricing = { ...defaultPricingFields(), ...pricingParsed.fields };

    const ins = await masterQuery(
      `
      INSERT INTO saas_plans (
        name, slug, description, sort_order, is_active,
        price_amount, billing_interval, setup_fee, trial_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      RETURNING ${PLAN_LIST_COLUMNS}
      `,
      [
        nm,
        sl,
        description != null ? String(description).trim() || null : null,
        Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
        is_active === false ? false : true,
        pricing.price_amount,
        pricing.billing_interval,
        pricing.setup_fee,
        pricing.trial_days,
      ]
    );
    const plan = ins.rows[0];
    const defaults = SAAS_MODULE_KEYS.map((k) => ({
      module_key: k,
      show_in_menu: true,
      route_accessible: true,
    }));
    await replacePlanModules(plan.id, defaults);

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'saas_plan_created',
      resourceType: 'saas_plan',
      resourceId: String(plan.id),
      details: { slug: plan.slug, price_amount: plan.price_amount },
      req,
    });

    return success(res, 201, 'Plan created', plan);
  } catch (err) {
    if (err && err.code === '23505') {
      return errorResponse(res, 409, 'Slug already exists');
    }
    console.error('createPlan error:', err);
    return errorResponse(res, 500, 'Failed to create plan');
  }
};

const updatePlan = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid plan id');
    const { name, description, sort_order, is_active } = req.body || {};
    const sets = [];
    const params = [];
    if (name !== undefined) {
      const nm = String(name).trim();
      if (nm.length < 2) return errorResponse(res, 400, 'Invalid name');
      params.push(nm);
      sets.push(`name = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description == null ? null : String(description).trim() || null);
      sets.push(`description = $${params.length}`);
    }
    if (sort_order !== undefined) {
      params.push(Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0);
      sets.push(`sort_order = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(!!is_active);
      sets.push(`is_active = $${params.length}`);
    }

    const pricingParsed = parsePlanPricingFields(req.body);
    if (pricingParsed.error) return errorResponse(res, 400, pricingParsed.error);
    for (const [key, val] of Object.entries(pricingParsed.fields || {})) {
      params.push(val);
      sets.push(`${key} = $${params.length}`);
    }

    if (!sets.length) return errorResponse(res, 400, 'No fields to update');
    sets.push('updated_at = NOW()');
    params.push(id);
    const r = await masterQuery(
      `UPDATE saas_plans SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${PLAN_LIST_COLUMNS}`,
      params
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Plan not found');
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'saas_plan_updated',
      resourceType: 'saas_plan',
      resourceId: String(id),
      req,
    });
    return success(res, 200, 'Plan updated', r.rows[0]);
  } catch (err) {
    console.error('updatePlan error:', err);
    return errorResponse(res, 500, 'Failed to update plan');
  }
};

const getPlanModules = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid plan id');
    const rows = await listPlanModuleRows(id);
    const map = defaultAllModulesTrue();
    for (const row of rows) {
      const k = String(row.module_key || '').trim();
      if (!SAAS_MODULE_KEYS.includes(k)) continue;
      map[k] = {
        show_in_menu: !!row.show_in_menu,
        route_accessible: !!row.route_accessible,
      };
    }
    return success(res, 200, 'Plan modules', { modules: map, rows });
  } catch (err) {
    console.error('getPlanModules error:', err);
    return errorResponse(res, 500, 'Failed to load plan modules');
  }
};

const putPlanModules = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid plan id');
    const { modules } = req.body || {};
    if (!modules || typeof modules !== 'object') {
      return errorResponse(res, 400, 'modules object is required');
    }
    const pr = await masterQuery(`SELECT id FROM saas_plans WHERE id = $1 LIMIT 1`, [id]);
    if (!pr.rows?.length) return errorResponse(res, 404, 'Plan not found');

    const rows = [];
    for (const key of SAAS_MODULE_KEYS) {
      const m = modules[key];
      if (!m || typeof m !== 'object') {
        rows.push({ module_key: key, show_in_menu: true, route_accessible: true });
      } else {
        rows.push({
          module_key: key,
          show_in_menu: !!m.show_in_menu,
          route_accessible: !!m.route_accessible,
        });
      }
    }
    await replacePlanModules(id, rows);
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'saas_plan_modules_updated',
      resourceType: 'saas_plan',
      resourceId: String(id),
      req,
    });
    const map = defaultAllModulesTrue();
    for (const row of rows) {
      map[row.module_key] = {
        show_in_menu: row.show_in_menu,
        route_accessible: row.route_accessible,
      };
    }
    return success(res, 200, 'Plan modules saved', { modules: map });
  } catch (err) {
    console.error('putPlanModules error:', err);
    return errorResponse(res, 500, 'Failed to save plan modules');
  }
};

module.exports = {
  listPlans,
  createPlan,
  updatePlan,
  getPlanModules,
  putPlanModules,
};
