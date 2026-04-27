# Project Commands Reference

This document lists all available NPM commands for the E-School management system.

## Server Commands (Backend)
Run these commands from the `server` directory.

### 🚀 Development
- `npm run dev`
  - Starts the backend server with auto-reload (using `--watch`).
- `npm run start`
  - Starts the backend server in production mode.

### 📦 Multi-Tenant Database Management (RECOMMENDED)
- `npm run db:migrate:all`
  - **The "Big Red Button"**. Runs all pending migrations against the Master DB and EVERY school database (Millat, Iqra, etc.) sequentially. Use this for standard updates.
- `npm run db:migrate:master`
  - Runs migrations only against the `master_db` school registry.
- `npm run db:setup`
  - Performs a full setup of the system, including initializing the master registry and default school database.

### 🌱 Seeding (Dummy Data)
- `npm run db:seed:all`
  - Seeds every school database with realistic dummy data (students, teachers, academic records). Use this to populate the system for testing or demos.
- `npm run db:seed`
  - Seeds only the default database defined in your `.env`.

### 🛠️ Maintenance & Repair
- `npm run db:provision:repair`
  - (Script: `scripts/provision-missing-tenants.js`)
  - Scans the master registry and creates physical PostgreSQL databases for any schools that are missing them.
- `npm run db:init`
  - Initializes the current `DB_NAME` from `.env` with the baseline schema (001).
- `npm run db:init:reset`
  - **WARNING**: Wipes the current tenant database and re-initializes it from scratch.

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
