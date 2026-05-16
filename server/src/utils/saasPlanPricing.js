const BILLING_INTERVALS = ['monthly', 'quarterly', 'yearly', 'lifetime', 'one_time'];

const PLAN_PRICING_COLUMNS = `
  price_amount,
  billing_interval,
  setup_fee,
  trial_days
`;

function parseMoney(value, label = 'amount') {
  if (value === undefined || value === null || value === '') return { value: 0 };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { error: `Invalid ${label}` };
  }
  return { value: Math.round(n * 100) / 100 };
}

function parseTrialDays(value) {
  if (value === undefined || value === null || value === '') return { value: 0 };
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0 || n > 3650) {
    return { error: 'Invalid trial_days' };
  }
  return { value: n };
}

/**
 * Extract pricing fields from create/update body. Omitted keys are not returned.
 */
function parsePlanPricingFields(body = {}) {
  const out = {};
  const errors = [];

  if (body.price_amount !== undefined) {
    const p = parseMoney(body.price_amount, 'price_amount');
    if (p.error) errors.push(p.error);
    else out.price_amount = p.value;
  }
  if (body.setup_fee !== undefined) {
    const p = parseMoney(body.setup_fee, 'setup_fee');
    if (p.error) errors.push(p.error);
    else out.setup_fee = p.value;
  }
  if (body.trial_days !== undefined) {
    const p = parseTrialDays(body.trial_days);
    if (p.error) errors.push(p.error);
    else out.trial_days = p.value;
  }
  if (body.billing_interval !== undefined) {
    const bi = String(body.billing_interval || '')
      .trim()
      .toLowerCase();
    if (!BILLING_INTERVALS.includes(bi)) {
      errors.push(`billing_interval must be one of: ${BILLING_INTERVALS.join(', ')}`);
    } else {
      out.billing_interval = bi;
    }
  }

  if (errors.length) return { error: errors[0], fields: null };
  return { error: null, fields: out };
}

function defaultPricingFields() {
  return {
    price_amount: 0,
    billing_interval: 'monthly',
    setup_fee: 0,
    trial_days: 0,
  };
}

module.exports = {
  BILLING_INTERVALS,
  PLAN_PRICING_COLUMNS,
  parsePlanPricingFields,
  defaultPricingFields,
};
