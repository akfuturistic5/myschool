# Technical Audit Report — MySchool (PreSkool) School Management System

**Date:** March 8, 2025  
**Scope:** Full codebase analysis (frontend, backend, database, auth, RBAC)  
**Mode:** Analysis and reporting only — no code modifications

---

## Executive Summary

This report documents the technical audit of the MySchool school management application. The system uses React (Vite), Redux, Node.js, Express, and PostgreSQL with JWT/cookie-based authentication and role-based access control. The overall architecture is sound, but several issues require attention before formal QA begins.

---

## 1. Overall Architecture Assessment

### Strengths
- Clear separation between client and server
- Feature-based frontend structure
- Centralized API service with request deduplication
- Global authentication middleware and RBAC
- Parameterized SQL queries (no string concatenation for user input)

### Concerns
- **Role naming inconsistency:** Project overview mentions "Super Admin" and "Headmaster" but `roles.js` defines only Admin, Student, Teacher, Parent, Guardian
- **Misleading naming:** `publicRoutes` in `router.link.tsx` actually contains protected routes
- **Schema drift:** Multiple fallbacks for legacy columns (e.g. `religion_id` vs `reigion_id`) suggest schema inconsistencies

---

## 2. Frontend Issues

### 2.1 Routing

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `router.link.tsx` | Lines 236-238, 278-279, 318-319, 459-461, 476-478, 506-507, 868-869, 1029-1030 | Duplicate route entries (callHistory, countries, guardiansList, events, connectedApps, fantawesome) | Low |
| `router.link.tsx` | Lines 241-242 | Variable `publicRoutes` is misleading — these are protected routes, not public | Low |
| `all_routes.tsx` | Lines 105-106 | `dataTable` and `tableBasic` appear swapped: dataTable points to tables-basic, tableBasic points to data-tables | Medium |
| `router.link.tsx` | Line 278 | Duplicate `routes.countries` entry | Low |

### 2.2 Student Details Navigation

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `all_routes.tsx` | Line 203 | `studentDetail` route is `/student/student-details` with no `:id` parameter | Medium |
| `studentDetails.tsx` | - | Component relies on `location.state` for studentId; direct URL navigation or page refresh loses state | Medium |

### 2.3 Parent "My Profile" Link

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `sidebarDataUtils.tsx` | Lines 32-41 | Parent role "My Profile" links to `routes.parentList` (Admin-only page) instead of `routes.profile`; Parent receives 403 when clicking | High |

### 2.4 Header Component

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `header/index.tsx` | Lines 40-41 | Debug `console.log` statements left in production code | Low |
| `header/index.tsx` | Line 190 | `academicYears.length > 0` may throw if `academicYears` is undefined (e.g. API error) | Medium |

### 2.5 Login Token Storage

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `login.tsx` | Lines 50-55 | Token stored in Redux only; `apiService` reads Bearer token from `localStorage` | Low |
| `apiService.js` | Line 73 | `getToken()` reads from localStorage; login never writes token there | Low |

*Note: Cookie-based auth works; Bearer token is redundant for current flow but inconsistent.*

### 2.6 useStudents Hook

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `useStudents.js` | Lines 17-22 | Parent/Guardian roles call `getStudents()` (Admin-only) and receive 403; unnecessary failed API call | Medium |

---

## 3. Backend Issues

### 3.1 Student Controller — Database Schema Assumptions

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `studentController.js` | Lines 678, 1450 | Queries `routes` table; transport schema may use `transport_routes` | Medium |
| `studentController.js` | Lines 684, 990 | Inconsistent `pickup_points` column usage: getStudentById uses `pickup_point`, `address`, etc.; getCurrentStudent uses `pickup_point_name` | Medium |
| `studentController.js` | Line 483 | `LEFT JOIN addresses addr ON s.user_id = addr.user_id` may produce duplicate student rows if user has multiple address records | Medium |

### 3.2 getAllStudents Pagination

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `studentController.js` | Lines 447-483 | Count query does not filter by `is_active`; may overcount inactive students | Low |

### 3.3 Redundant Middleware

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `leaveApplicationRoutes.js` | Lines 23, 26, 29, 31, 33, 35 | `protectApi` applied on routes already protected by global middleware | Low |

---

## 4. API Problems

### 4.1 API Response Handling

| File | Location | Issue | Severity |
|------|----------|-------|----------|
| `apiService.js` | Lines 109-112 | Empty response throws generic error; could provide more specific message | Low |

---

## 5. Database Query Problems

### 5.1 SQL Injection
- **Status:** No SQL injection risks identified. All queries use parameterized placeholders (`$1`, `$2`, etc.).

### 5.2 Schema Fallbacks
- Multiple try/catch blocks in `studentController` handle `religion_id` vs `reigion_id` and missing columns
- Suggests schema inconsistencies across environments; consider migration to standardize

### 5.3 Address Join Duplication
- `getAllStudents` and `getStudentsByClass` use `LEFT JOIN addresses addr ON s.user_id = addr.user_id` without filtering by `role_id` or using `DISTINCT`, potentially duplicating rows

---

## 6. Authentication Concerns

### 6.1 Auth Flow
- Login flow is correct: bcrypt compare, JWT generation, HTTP-only cookie
- `getMe` correctly hydrates user; AuthBootstrap restores session on load
- Logout clears cookie correctly

### 6.2 Token Handling
- Backend accepts both cookie and Bearer token
- Frontend relies on cookie; Bearer token in localStorage is never set by login
- 401 handler clears localStorage and dispatches `auth:sessionExpired`; redirect works

### 6.3 Public Paths
- `isPublicPath` correctly excludes `/auth/login` and `/health`
- `/auth/me` requires authentication (correct)
- `/auth/logout` does not require auth (correct — allows clearing cookie on expired session)

---

## 7. Role Permission Problems

### 7.1 RBAC Coverage
- Student, Teacher, Parent, Guardian, User Management, Fee, Notice, Events, Leave, Dashboard routes use `requireRole` appropriately
- Ownership checks in controllers (e.g. `getStudentById`, `getStudentLoginDetails`) are correct for Student, Parent, Guardian

### 7.2 Missing Headmaster Role
- `roleUtils.ts` maps "headmaster" to Admin dashboard and page title
- `roles.js` has no Headmaster role; Admin (id=1) is used
- UI shows "Headmaster" for Admin in header; consistent with roleUtils

### 7.3 Unprotected Endpoints
- Routes under `/api` are protected by global `protectApi` except auth and health
- Controllers enforce ownership for sensitive data (students, fees, attendance, etc.)

---

## 8. UI Logic Issues

### 8.1 DashboardGuard
- Correctly redirects users from other role dashboards to their own
- Only applies to dashboard paths; non-dashboard routes (e.g. `/student/student-list`) are not guarded

### 8.2 Sidebar Role Filtering
- Admin sees full sidebar; other roles see Dashboard + Application only
- Parent "My Profile" links to wrong page (see 2.3)

### 8.3 Student List for Different Roles
- Student: uses `useCurrentStudent`; works correctly
- Teacher: uses `getTeacherStudents`; works correctly
- Admin: uses `getStudents`; works correctly
- Parent/Guardian: call `getStudents`, get 403; sidebar hides Student List, but manual URL navigation shows error state

---

## 9. Potential Runtime Errors

### 9.1 Frontend
| File | Issue | Severity |
|------|-------|----------|
| `header/index.tsx` | `academicYears.length` when `academicYears` is undefined | Medium |
| `AuthBootstrap.tsx` | `d.student_first_name` etc. — safe with optional chaining in displayName | Low |
| `student-list/index.tsx` | `studentsToShow.map` — empty array safe; `currentStudent` could be null for Student role | Low |

### 9.2 Backend
| File | Issue | Severity |
|------|-------|----------|
| `authController.js` | Fallback query on email column error — may mask schema issues | Low |
| `studentController.js` | Multiple schema fallbacks — complex error handling; ensure all paths tested | Medium |

---

## 10. Performance Risks

### 10.1 Database
- `getAllStudents` and `getStudentsByClass` address join may duplicate rows
- `getStudentById` and `getCurrentStudent` run multiple sequential queries for hostel, transport, extra fields — consider batching

### 10.2 Frontend
- `useCurrentUser` and `useStudents` both fetch on mount; some pages may trigger both
- Request deduplication in apiService helps; no obvious excessive re-renders

### 10.3 API
- Rate limiting: 10/login/15min, 500/api/15min — reasonable
- No pagination on some list endpoints (e.g. `getStudentsByClass`) — may be slow with large datasets

---

## 11. Error Handling Review

### 11.1 Backend
- `globalErrorHandler` prevents leaking stack traces in production
- Controllers use `errorResponse` for consistent format
- Some controllers catch and rethrow with `statusCode`; pattern is consistent

### 11.2 Frontend
- API errors surface via `err.message`; 401 triggers session expiry and redirect
- Some components may not display API errors clearly; recommend audit of error states

---

## 12. Data Flow Consistency

### 12.1 Login Flow
1. User submits credentials → `apiService.login` → POST `/auth/login`
2. Server validates, sets cookie, returns token + user
3. Frontend dispatches `setAuth`, navigates to role dashboard
4. Cookie sent with `credentials: 'include'` on subsequent requests

### 12.2 Auth Bootstrap
1. App load → AuthBootstrap → `getMe()` with credentials
2. Success → `setAuthFromSession`; failure → `setAuthChecked` only
3. ProtectedRoute checks `authChecked` and `isAuthenticated`

### 12.3 Student CRUD
- Create/Update use Joi validation
- Ownership enforced in getStudentById, getStudentLoginDetails, getStudentAttendance, getStudentExamResults

---

## 13. Summary of High/Medium Severity Issues

| # | Severity | Issue |
|---|----------|-------|
| 1 | High | Parent "My Profile" links to Admin-only parent list (403) |
| 2 | Medium | Student details route has no `:id`; relies on state; refresh loses context |
| 3 | Medium | `dataTable` and `tableBasic` routes swapped |
| 4 | Medium | Header `academicYears.length` may throw if undefined |
| 5 | Medium | useStudents calls getStudents for Parent/Guardian (403) |
| 6 | Medium | Student controller address join may duplicate rows |
| 7 | Medium | Inconsistent pickup_points and routes table/column usage |
| 8 | Medium | Student controller schema fallbacks — test all code paths |

---

## 14. Recommendations for QA Team

1. **Role-based flows:** Test each role (Admin, Teacher, Student, Parent, Guardian) for dashboard, sidebar, and main features.
2. **Parent "My Profile":** Confirm 403 and wrong destination; fix before release.
3. **Student details:** Test direct URL, refresh, and back/forward; ensure studentId is available.
4. **Database:** Verify `routes` vs `transport_routes` and `pickup_points` column names in target environment.
5. **Auth:** Test cookie-based session, logout, and 401 handling (e.g. token expiry).
6. **Error states:** Check loading, error, and empty states on list/detail pages.

---

*End of Report*
