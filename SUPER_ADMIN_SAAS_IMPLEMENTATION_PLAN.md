# Super Admin SaaS Dashboard — Implementation Plan

This document describes what was implemented for the platform (Super Admin) area and tenant experience: metrics, school management, subscription plans with module permissions, school enquiries (leads), “login as school” impersonation, and a first version of menu filtering driven by those permissions.

---

## 1. Goals (product)

1. **Super Admin dashboard** — Show at a glance: total schools, active schools, inactive schools (any non-`active` status), disabled schools (`status = disabled`), number of active subscription **plans**, and count of **new** school enquiries (prospective customers).
2. **Manage schools** — Dedicated list with **status** and **text search** (name, institute number, database name). Row opens **school detail**; actions include **module permissions** screen and **Login as school** (tenant session as Headmaster or, if missing, Administrative user).
3. **Plans & modules** — CRUD-lite for **plans**; each plan has a **matrix** of coarse modules with `show_in_menu` and `route_accessible`. New schools default to the **Full platform** plan when it exists.
4. **School enquiries** — CRM-style list for inbound leads with statuses: `new`, `contacted`, `converted`, `dismissed`.
5. **Tenant UX** — **Headmaster dashboard** shows a compact **school context** strip. Sidebar menus are **filtered** using `saas_modules` returned on login and `/auth/me` (when master DB tables exist).

---

## 2. Database (master_db)

**Migration file:** `server/migrations/master/20260514120000_saas_plans_enquiries.sql`

Run this against the **same PostgreSQL database** that already holds `public.schools` (your `master_db`).

| Object | Purpose |
|--------|---------|
| `saas_plans` | Named subscription tiers (`name`, `slug`, `is_active`, …). |
| `saas_plan_modules` | Per-plan defaults: `module_key`, `show_in_menu`, `route_accessible`. |
| `schools.plan_id` | Optional FK to `saas_plans`; existing rows are backfilled to the `full` plan when present. |
| `school_module_overrides` | Per-school overrides of the same flags (full replace on save from UI). |
| `school_enquiries` | Lead records before a tenant exists. |

**Seed:** A plan with `slug = 'full'` is inserted if missing, all catalog module keys are inserted with both flags `true`, and every school with `plan_id IS NULL` is assigned that plan.

**Module keys** (canonical list) live in:

- Server: `server/src/config/saasModuleCatalog.js`
- Client: `client/src/core/utils/saasModuleKeys.ts`

Keep these lists aligned when adding a new coarse module.

---

## 3. Backend behaviour

### 3.1 Shared tenant session issuance

`server/src/services/tenantSessionIssueService.js` centralises JWT + `sid` row in `tenant_sessions` + cookies (`auth_token`, `sid`, `XSRF-TOKEN`), matching normal tenant login.  
`authController.login` now calls this helper so impersonation and login stay consistent.

The issued `user` payload in JSON now includes **`saas_modules`** (effective merged plan + overrides) when `getEffectiveSchoolModules` succeeds.

### 3.2 Super Admin APIs (`/super-admin/api` …)

Mounted in `server/src/routes/superAdminRoutes.js` (all require Super Admin auth):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats/platform` | Extended stats including `total_inactive_schools`, `total_plans`, `enquiries_new`. |
| GET | `/schools` | Query: `status`, `q` (search). Joins plan name when tables exist. |
| GET | `/schools/:id` | School row + `saas_plan`, `saas_modules` (effective), `saas_module_overrides`. |
| POST | `/schools/:id/impersonate` | Creates tenant session as first active **Admin** (Headmaster) else **Administrative** user; audits `school_impersonation`. |
| PATCH | `/schools/:id/plan` | Body `{ plan_id: number \| null }`. |
| GET | `/schools/:id/modules` | `{ plan, effective, overrides }`. |
| PUT | `/schools/:id/modules/overrides` | Body `{ overrides: [{ module_key, show_in_menu, route_accessible }] }` — replaces all override rows. |
| GET/POST/PATCH/PUT | `/plans`, `/plans/:id`, `/plans/:id/modules` | Plan CRUD + module matrix (see `superAdminPlansController.js`). |
| GET/POST/PATCH | `/enquiries`, `/enquiries/:id` | List, create, update status. |

**School creation** (`createSchool`) assigns `plan_id` to the `full` plan when that row exists.

### 3.3 Tenant `/auth/me`

`getMe` attaches `saas_modules` when `school_id` is present so a reload keeps menu state without re-login.

---

## 4. Frontend (Super Admin SPA)

Routes under `SuperAdminLayout` (`client/src/feature-module/router/router.tsx`):

| Path | Component |
|------|-----------|
| `/super-admin/dashboard` | `SuperAdminDashboard.tsx` — metric cards + shortcuts. |
| `/super-admin/schools` | `SuperAdminSchools.tsx` — filters, table, create-school modal. |
| `/super-admin/schools/:id` | `SuperAdminSchoolEdit.tsx` — details, plan selector, impersonate, link to modules. |
| `/super-admin/schools/:id/modules` | `SuperAdminSchoolModules.tsx` — override matrix. |
| `/super-admin/plans` | `SuperAdminPlans.tsx` — plan list + module editor. |
| `/super-admin/enquiries` | `SuperAdminEnquiries.tsx` — leads form + table. |

**Layout:** `SuperAdminLayout.tsx` adds a **sidebar** (desktop) and a compact bottom nav (mobile).

**API client:** `client/src/core/services/superAdminApiService.ts` — new methods for all endpoints above.

**Impersonation UX:** From school detail, **Login as school** calls impersonate, `dispatch(setAuth(…))`, `apiService.ensureCsrfToken()`, then navigates to the role’s dashboard (same pattern as normal login).

---

## 5. Menu filtering (tenant)

- **Redux:** `authSlice` stores optional `saas_modules`.
- **Bootstrap / login:** Values copied from API (`AuthBootstrap`, impersonate handler).
- **Sidebar:** `client/src/core/common/sidebar/index.tsx` runs `filterSidebarBySaasModules()` from `client/src/core/utils/saasSidebarFilter.ts` after `getSidebarDataForRole()`.

**Important limitation (by design in this phase):**

- **`show_in_menu`** is enforced in the **sidebar** only.
- **`route_accessible`** is stored and editable in Super Admin, but **most HTTP routes are not yet gated** by module. Users could still open a URL directly. A follow-up should add either middleware mapping paths → `module_key` or per-route checks aligned with the same catalog.

---

## 6. Security & audit notes

- **Impersonation** requires an active Super Admin session; action is written to `super_admin_audit_log` as `school_impersonation` with target user id and institute number.
- **Disabled schools** cannot impersonate (HTTP 403).
- **Tenant session** remains standard: opaque `sid` binds JWT to `school_id` / `db_name` in `tenant_sessions`.
- Super Admin cookie (`super_admin_auth`) can remain set alongside tenant cookies; returning to `/super-admin/*` still works.

---

## 7. Deployment checklist

1. **Apply migration** on production `master_db` (backup first).
2. **Restart API** so new routes and services load.
3. **Deploy client** build.
4. Smoke-test: Super Admin login → dashboard counts → create enquiry → assign plan on a school → edit modules → **Login as school** → confirm tenant dashboard loads and sidebar reflects disabled modules.

---

## 8. Suggested next iterations

1. **Server-side route protection** for `route_accessible` (shared map from path prefix or route metadata to `module_key`).
2. **Public “Request demo” form** posting to a **non–Super Admin** endpoint (rate-limited) that inserts into `school_enquiries`.
3. **Billing integration** — link `saas_plans` to payment provider / invoice ids.
4. **Per-seat or usage limits** stored on plan and enforced in tenant APIs.
5. **Administrative / Teacher sidebars** — extend `saasSidebarFilter` mappings for `buildAdministrativeSidebar` / `buildTeacherSidebar` trees so the same flags apply consistently.

---

## 9. Files touched (reference)

**Server:** `superAdminController.js`, `superAdminRoutes.js`, `authController.js`, `tenantSessionIssueService.js`, `saasSchoolModulesService.js`, `saasModuleCatalog.js`, `superAdminPlansController.js`, `superAdminEnquiriesController.js`, migration SQL under `server/migrations/master/`.

**Client:** `SuperAdminLayout.tsx`, `SuperAdminDashboard.tsx`, `SuperAdminSchools.tsx`, `SuperAdminSchoolEdit.tsx`, `SuperAdminSchoolModules.tsx`, `SuperAdminPlans.tsx`, `SuperAdminEnquiries.tsx`, `router.tsx`, `all_routes.tsx`, `superAdminApiService.ts`, `authSlice.ts`, `AuthBootstrap.tsx`, `sidebar/index.tsx`, `saasModuleKeys.ts`, `saasSidebarFilter.ts`, `adminDashboard/index.tsx`.

This file is the hand-off for operators and future developers extending the SaaS control plane.
