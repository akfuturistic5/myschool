-- 120. Payment Modes (Master)
CREATE TABLE IF NOT EXISTS public.payment_modes (
    id SERIAL PRIMARY KEY,
    name character varying(50) NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default modes
INSERT INTO public.payment_modes (name) 
VALUES ('Cash'), ('UPI'), ('Card'), ('Bank Transfer')
ON CONFLICT (name) DO NOTHING;
