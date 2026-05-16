-- SaaS plan billing / pricing columns (master_db only).
-- Safe to run after 20260514120000_saas_plans_enquiries.sql

ALTER TABLE public.saas_plans
    ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS setup_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trial_days INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.saas_plans.price_amount IS 'Recurring plan charge per billing_interval';
COMMENT ON COLUMN public.saas_plans.currency_code IS 'ISO 4217 currency code, e.g. INR, USD';
COMMENT ON COLUMN public.saas_plans.billing_interval IS 'monthly, quarterly, yearly, lifetime, one_time';
COMMENT ON COLUMN public.saas_plans.setup_fee IS 'One-time onboarding / setup fee';
COMMENT ON COLUMN public.saas_plans.trial_days IS 'Optional trial period in days';

CREATE INDEX IF NOT EXISTS idx_saas_plans_billing_interval ON public.saas_plans(billing_interval);

-- Existing "full" plan: keep free (no change to module behaviour)
UPDATE public.saas_plans
SET price_amount = 0,
    setup_fee = 0,
    trial_days = 0,
    billing_interval = 'monthly',
    currency_code = COALESCE(NULLIF(TRIM(currency_code), ''), 'INR')
WHERE slug = 'full'
  AND price_amount IS NULL;
