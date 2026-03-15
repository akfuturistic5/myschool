# Multi-Tenant Database Setup

## Overview

The application supports multiple schools, each with its own database. The primary school uses the default connection (DB_HOST, DB_NAME, etc.). Additional schools can use separate cloud databases (e.g. Neon) via school-specific env vars.

## Required Architecture (Neon)

| Role | Database | When used |
|------|----------|-----------|
| **Main application** | `neondb` | All normal queries. `DATABASE_URL` and `TENANT_ADMIN_DATABASE_URL` must point here. |
| **Template** | `school_template` | **Never** for app queries. Only during provisioning: `CREATE DATABASE new_tenant TEMPLATE school_template`. No persistent connections. |
| **Tenant** | `school_5555`, `school_6666`, etc. | After login, tenant context switches to the school's `db_name` for that request. |

**Critical:** The application must **never** open a connection pool to `school_template`. If `DATABASE_URL` (or `DB_NAME`) is set to `school_template`, the server will exit at startup with a clear error. Set `DATABASE_URL=.../neondb` and `PROVISIONING_TEMPLATE_DB_NAME=school_template` so the template is used only by name during provisioning. Before `CREATE DATABASE ... TEMPLATE`, the provisioning code terminates any sessions connected to the template so the clone can proceed.

## Production: Master DB on Neon

To connect `master_db` (school registry) to its Neon database in production:

1. **Set in your production env**:
   ```
   MASTER_DATABASE_URL=postgresql://USER:PASSWORD@ep-sweet-mode-a1vx0r90-pooler.ap-southeast-1.aws.neon.tech:5432/master_db?sslmode=require&channel_binding=require
   ```
   Replace `USER` and `PASSWORD` with your Neon credentials.

2. This affects only the school-registry queries (`master_db.schools`). Tenant DB routing remains unchanged.

## Production: Millat School on Neon

To connect Millat (institute 2222) to its Neon database in production:

1. **Set in your production env** (Render, Vercel, etc.):
   ```
   MILLAT_DATABASE_URL=postgresql://USER:PASSWORD@ep-sweet-mode-a1vx0r90-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require&channel_binding=require
   ```
   Replace `USER` and `PASSWORD` with your Neon credentials.

2. **master_db** and the **primary school** (school_db) remain on your main PostgreSQL server. Only Millat traffic uses Neon when institute 2222 logs in.

3. **Local development:** Leave `MILLAT_DATABASE_URL` unset to use local `millat_db` on the same server as school_db.

## Production: Iqra School on Neon

To connect Iqra (institute 3333) to its Neon database in production:

1. **Set in your production env** (Render, Vercel, etc.):
   ```
   IQRA_DATABASE_URL=postgresql://USER:PASSWORD@ep-sweet-mode-a1vx0r90-pooler.ap-southeast-1.aws.neon.tech:5432/iqra_db?sslmode=require&channel_binding=require
   ```
   Replace `USER` and `PASSWORD` with your Neon credentials.

2. **Local development:** Leave `IQRA_DATABASE_URL` unset to use local `iqra_db`.

## Tenant Provisioning (Create New School)

When creating a new school, the system:
1. Resolves the template DB name via `getTemplateDbName()` (see priority below).
2. **Neon (URL contains neon.tech):** Does **not** use `CREATE DATABASE ... TEMPLATE`. Creates an empty DB, then clones schema via **pg_dump** + restore from template. Requires `PROVISIONING_SOURCE_DATABASE_URL` (Neon DIRECT endpoint) and **pg_dump/psql** on the server (e.g. Dockerfile with `postgresql-client` on Render). This avoids the Neon issue where TEMPLATE can create an empty DB (first school works, second fails).
3. **Non-Neon:** Tries `CREATE DATABASE "<tenant_db>" TEMPLATE "<template_db>"`. If the template is "being accessed by other users", creates an empty DB and clones via **pg_dump** + restore.
4. If the new DB still has no schema (e.g. TEMPLATE produced empty), drops the DB, creates empty, and provisions via **pg_dump** + restore again.
5. Truncates tenant-specific data, creates headmaster, and inserts into `master_db.schools`.

**Template name priority:** `PROVISIONING_TEMPLATE_DB_NAME` → `DB_NAME` → database from `DATABASE_URL` → database from `TENANT_ADMIN_DATABASE_URL` → `school_db`.

**Neon "too many connections" / "syntax error" on create school:** Use `PROVISIONING_SOURCE_DATABASE_URL` pointing at the **template DB** (e.g. school_template or your primary DB) via Neon **DIRECT** endpoint (host without `-pooler`). This avoids pooler limits during pg_dump and ensures a clean dump. Restore uses `psql` when available (Docker image includes postgresql-client); otherwise statements are run one-by-one to avoid parsing errors.

**Timeouts:** pg_dump default 2 min, restore default 5 min. If restore still times out, set `PROVISIONING_RESTORE_TIMEOUT_MS=600000` (10 min) in env. Prefer Neon **DIRECT** URL in `PROVISIONING_SOURCE_DATABASE_URL` for faster dump.

**TENANT_ADMIN_DATABASE_URL:** Used for `CREATE DATABASE` and for deriving target connection in provisioning. Falls back to `DATABASE_URL`.

**Connection pools:** All pools use `DB_POOL_MAX` (default 5) to stay within Neon limits.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes (production) | Primary DB (e.g. PreSkool). Used for routing and as fallback for provisioning. |
| DB_NAME | No | Primary/template DB name. Local: schooldb. Neon: neondb. |
| MASTER_DATABASE_URL | Yes (production) | master_db on Neon (schools registry). |
| TENANT_ADMIN_DATABASE_URL | No | CREATE DATABASE and tenant connections. Falls back to DATABASE_URL. |
| PROVISIONING_TEMPLATE_DB_NAME | No | Dedicated template DB name (e.g. school_template). |
| PROVISIONING_SOURCE_DATABASE_URL | Recommended (Neon) | Template DB URL for pg_dump. Use **direct** endpoint (no -pooler). |
| PROVISIONING_ALTERNATE_SOURCE_DB | No | Fallback DB name if template fails (default: preskool). |
| DB_POOL_MAX | No | Max connections per pool (default 5). Keep low for Neon. |
| MILLAT_DATABASE_URL | No | Millat on Neon. |
| IQRA_DATABASE_URL | No | Iqra on Neon. |

## Security

- Never commit real credentials. Use placeholders in env.example.
- Add `MASTER_DATABASE_URL` only in production env (Render dashboard, etc.).
- Add `MILLAT_DATABASE_URL` only in production env (Render dashboard, etc.).
- Add `IQRA_DATABASE_URL` only in production env (Render dashboard, etc.).
- Keep `.env` in `.gitignore` (already configured).
