# Project Commands Reference

This document lists all available NPM commands for the E-School management system.

## Server Commands (Backend)
Run these commands from the `server` directory.

### 🚀 Development
- `npm run dev`
  - Starts the backend server with auto-reload (using `--watch`).
- `npm run start`
  - Starts the backend server in production mode.

### 📦 Multi-Tenant Database Management (Modular Sequence)
Run these commands in order for a fresh setup, or use the **Full Setup** command.

#### **🔥 The Big Red Button**
- `npm run db:project:setup`
  - **Clean Platform Setup**. Initializes the master database and creates the super admin. Use this for a fresh production-ready platform.
- `npm run db:demo:setup`
  - **Full Automated Demo Setup**. Executes the entire sequence: Master Migration -> Admin Seeding -> School Registration -> Infrastructure Provisioning -> Tenant Migration -> Tenant Seeding -> Demo Data Injection.

#### **Step 1: Platform Setup (Master DB)**
- `npm run db:master:migrate`
  - Initializes the 5 global management tables (Schools, Super Admins, Sessions, etc.).
- `npm run db:master:seed:admin`
  - Adds the default Platform Super Admin (`superadmin` / `admin123`).
- `npm run db:master:seed:demo-school`
  - Registers "St. Xavier's International" in the central school registry.

#### **Step 2: Physical Infrastructure**
- `npm run db:master:create-demo-db`
  - Physically creates the `sxis_school_db` on your PostgreSQL server.
- `npm run db:master:provision:all`
  - **Bulk Infrastructure Provisioning**. Automatically creates physical databases for EVERY school registered in the Master DB.

#### **Step 3: Tenant Operations (Bulk/Global)**
These commands automatically discover and process **ALL** active school databases:
- `npm run db:tenants:migrate:all`
  - Applies the 96-table hardened schema (`schema.sql`) to every school.
- `npm run db:tenants:seed:lookups`
  - Seeds **Required Default Data** (Roles, Blood Groups, Religions, Time Slots, etc.) to all schools.
- `npm run db:tenants:seed:demo`
  - Injects **Exhaustive Demo Data** (Mock Students, Teachers, Exams, Fees) to all schools for testing.

### 🧪 Testing
- `npm run test`
  - Runs all backend unit tests.
- `npm run test:attendance`
  - Runs specific validation tests for the attendance module.

---

## Client Commands (Frontend)
Run these commands from the `client` directory.

- `npm run dev`
  - Starts the Vite development server.
- `npm run build`
  - Builds the production bundle.
- `npm run lint`
  - Runs ESLint to check for code quality issues.
- `npm run preview`
  - Previews the local production build.
