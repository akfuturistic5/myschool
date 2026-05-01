/*
=============================================================================
CENTRAL MASTER DATABASE SCHEMA - PLATFORM LEVEL
=============================================================================
This database manages the global school registry, super admin accounts, 
and tenant session binding for the entire E-School SaaS platform.
=============================================================================
*/

-- 1. Schools (Tenant Registry)
CREATE TABLE IF NOT EXISTS public.schools (
    id SERIAL PRIMARY KEY,
    school_name character varying(255) NOT NULL,
    institute_number character varying(50) NOT NULL UNIQUE,
    db_name character varying(100) NOT NULL UNIQUE,
    status character varying(20) NOT NULL DEFAULT 'active',
    type character varying(512),
    logo text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_schools_status ON public.schools(status);

-- 2. Super Admin Users (Platform Management)
CREATE TABLE IF NOT EXISTS public.super_admin_users (
    id SERIAL PRIMARY KEY,
    username character varying(150) NOT NULL UNIQUE,
    email character varying(255) NOT NULL UNIQUE,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL DEFAULT 'super_admin',
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tenant Sessions (Session-to-School Binding)
CREATE TABLE IF NOT EXISTS public.tenant_sessions (
    id SERIAL PRIMARY KEY,
    session_hash character varying(128) NOT NULL UNIQUE,
    school_id integer NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    institute_number character varying(50) NOT NULL,
    db_name character varying(100) NOT NULL,
    tenant_user_id integer NOT NULL,
    user_agent text,
    ip_address character varying(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenant_sessions_school ON public.tenant_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_tenant_sessions_expires ON public.tenant_sessions(expires_at);

-- 4. Super Admin Audit Log
CREATE TABLE IF NOT EXISTS public.super_admin_audit_log (
    id SERIAL PRIMARY KEY,
    super_admin_id integer REFERENCES public.super_admin_users(id),
    action character varying(96) NOT NULL,
    resource_type character varying(64),
    resource_id character varying(128),
    details jsonb,
    ip_address character varying(100),
    user_agent text,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_created ON public.super_admin_audit_log(created_at DESC);

-- 5. Migration History (Global Versioning)
CREATE TABLE IF NOT EXISTS public.migration_history (
    id SERIAL PRIMARY KEY,
    migration_name character varying(255) NOT NULL UNIQUE,
    batch integer NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
