# Security & Production Hardening - Summary of Changes

## Overview
This document summarizes all security and production-readiness improvements made to the PreSkool School Management application.

---

## Critical Fixes Implemented

### 1. Secure Password Handling
- **authController.js**: Login now uses `bcrypt.compare()` with `password_hash` column
- Backward compatibility: If `password_hash` is empty, falls back to phone comparison and migrates hash on success
- No plain-text password comparison in production
- Run `node scripts/run-hash-phone.js` to pre-populate hashes for existing users (optional - lazy migration on login works)

### 2. Role-Based Access Control (RBAC)
- **New**: `server/src/config/roles.js` - Role IDs and permission mappings
- **New**: `server/src/middleware/rbacMiddleware.js` - `requireRole(allowedRoleIds)`
- **Applied to**:
  - Users: Admin only
  - Fee collections list & create: Admin only
  - Leave approval (PUT): Admin only
  - Leave list all (GET): Admin only
  - Notice board create/update/delete: Admin only
  - Dashboard stats, fee-stats, finance-summary: Admin only
  - Students list, create, update: Admin only
  - Teachers list, update: Admin only
  - Parents list, create, update: Admin only
  - Guardians list, create, update: Admin only

### 3. Leave Approval Authorization
- Only Admin role can approve/reject leave applications
- `PUT /api/leave-applications/:id` requires `requireRole(LEAVE_APPROVER_ROLES)`

### 4. Fee Collection Security
- `getFeeCollectionsList` and `createFeeCollection` restricted to Admin
- `getStudentFees` enforces ownership: Admin (any), Student (own), Parent (children), Guardian (wards)

---

## High Priority Fixes

### 5. CORS Configuration
- Production: Restricts origins to `CORS_ORIGIN` env var (comma-separated list)
- If `CORS_ORIGIN` not set in production, falls back to localhost only
- Set `CORS_ORIGIN=https://your-frontend.com` in production

### 6. Centralized Error Handling
- **New**: `server/src/utils/errorHandler.js` - `globalErrorHandler`, `getSafeMessage`
- Production: Never exposes `error.message`, stack traces, or DB details
- Controllers updated to return generic messages in production

### 7. Database SSL
- Production: `rejectUnauthorized: true` for PostgreSQL SSL
- Development: Keeps `rejectUnauthorized: false` for local/dev DBs

### 8. Sensitive Defaults & Debug Logs Removed
- JWT: Production requires explicit `JWT_SECRET` (no fallback)
- Removed `console.log("ENV CHECK:")` from database.js
- Removed login debug log from authRoutes
- README: Removed example credentials

---

## Medium Priority Fixes

### 9. Input Validation
- **New validations**: fee, leave, guardian, notice board, class schedule
- Joi schemas applied to: fee collect, leave create/update status, guardian create/update, notice create/update, class schedule create

### 10. Login Rate Limiting
- Stricter limit: 10 attempts per 15 min per IP on `/api/auth/login`
- Override: `LOGIN_RATE_LIMIT_MAX` env var

---

## Environment Variables Required

### Production
| Variable | Required | Description |
|----------|----------|-------------|
| NODE_ENV | Yes | `production` |
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | Strong random secret |
| CORS_ORIGIN | Yes | Frontend URL(s), comma-separated |
| PORT | No | Default 5000 |

### Optional
| Variable | Default | Description |
|----------|---------|-------------|
| RATE_LIMIT_MAX | 500 | API requests per 15 min per IP |
| LOGIN_RATE_LIMIT_MAX | 10 | Login attempts per 15 min per IP |
| JWT_EXPIRES_IN | 7d | Token expiration |

---

## Migration Steps

### 1. Database
```bash
psql -U your_user -d schooldb -f server/migrations/ensure_password_hash_column.sql
```

### 2. Pre-populate Password Hashes (optional)
```bash
cd server
node scripts/run-hash-phone.js
```
Or rely on lazy migration: users are hashed on first successful login.

### 3. Environment
- Update `.env` or Render/env: set `JWT_SECRET`, `CORS_ORIGIN`, `DATABASE_URL` for production
- Remove any hardcoded credentials

### 4. Restart Server
```bash
npm run dev   # development
npm start     # production
```

---

## Testing Checklist

- [ ] Admin login works
- [ ] Teacher login works
- [ ] Student login works
- [ ] Parent login works
- [ ] Guardian login works
- [ ] Admin dashboard stats load
- [ ] Teacher/Student/Parent/Guardian dashboards load
- [ ] Leave create works (student, staff)
- [ ] Leave approve/reject works (Admin only)
- [ ] Fee collection create works (Admin only)
- [ ] Student fees view works (student own, parent children)
- [ ] Notice board CRUD (Admin only)
- [ ] Students/Teachers/Parents/Guardians list (Admin only)
- [ ] Non-admin cannot access Admin-only APIs (403)

---

## Manual Steps

1. Ensure `user_roles` table has: Admin (1), Student (2), Teacher (3), Parent (4), Guardian (5)
2. Set production `CORS_ORIGIN` to your frontend domain(s)
3. Generate strong JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
