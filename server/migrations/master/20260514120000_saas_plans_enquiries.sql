-- SaaS: subscription plans, per-plan module defaults, per-school overrides, and school enquiries (leads).
-- Run against master_db (same database as public.schools).

CREATE TABLE IF NOT EXISTS public.saas_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saas_plan_modules (
    id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
    module_key VARCHAR(64) NOT NULL,
    show_in_menu BOOLEAN NOT NULL DEFAULT TRUE,
    route_accessible BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (plan_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_saas_plan_modules_plan ON public.saas_plan_modules(plan_id);

ALTER TABLE public.schools
    ADD COLUMN IF NOT EXISTS plan_id INT REFERENCES public.saas_plans(id);

CREATE INDEX IF NOT EXISTS idx_schools_plan_id ON public.schools(plan_id);

CREATE TABLE IF NOT EXISTS public.school_module_overrides (
    id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    module_key VARCHAR(64) NOT NULL,
    show_in_menu BOOLEAN NOT NULL,
    route_accessible BOOLEAN NOT NULL,
    UNIQUE (school_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_school_module_overrides_school ON public.school_module_overrides(school_id);

CREATE TABLE IF NOT EXISTS public.school_enquiries (
    id SERIAL PRIMARY KEY,
    contact_name VARCHAR(255) NOT NULL,
    organization_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(64),
    message TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_enquiries_status ON public.school_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_school_enquiries_created ON public.school_enquiries(created_at DESC);

-- Seed default "Full" plan and grant all known module keys (see server/src/config/saasModuleCatalog.js).
INSERT INTO public.saas_plans (name, slug, description, sort_order, is_active)
VALUES (
    'Full platform',
    'full',
    'Default plan with every module enabled. Existing schools are attached on migration.',
    0,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
    pid INT;
BEGIN
    SELECT id INTO pid FROM public.saas_plans WHERE slug = 'full' LIMIT 1;
    IF pid IS NULL THEN
        RETURN;
    END IF;
    INSERT INTO public.saas_plan_modules (plan_id, module_key, show_in_menu, route_accessible)
    SELECT pid, k, TRUE, TRUE
    FROM (VALUES
        ('peoples'),
        ('academic'),
        ('fees'),
        ('library'),
        ('hostel'),
        ('transport'),
        ('hrm'),
        ('accounts'),
        ('reports'),
        ('user_management'),
        ('membership'),
        ('settings'),
        ('application'),
        ('announcements'),
        ('content'),
        ('sports')
    ) AS v(k)
    ON CONFLICT (plan_id, module_key) DO NOTHING;
END $$;

UPDATE public.schools s
SET plan_id = p.id
FROM public.saas_plans p
WHERE p.slug = 'full'
  AND s.deleted_at IS NULL
  AND s.plan_id IS NULL;
