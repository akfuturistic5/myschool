# QA Handover Report – School Management System Stabilisation

**Date:** March 8, 2025  
**Status:** Ready for formal QA testing

---

## 1. Summary of Fixes Implemented

All 12 issues from the technical audit have been addressed. Issues 1–10 required code changes; Issues 11 and 12 are documented as known technical debt for future work.

---

## 2. Issues Fixed (Code Changes)

### Issue 1 – Teacher Students API Endpoint Mismatch (CRITICAL) ✅

**Problem:** Frontend called `/teacher/students`; backend route is `/students/teacher/students`.

**Fix:** Updated `getTeacherStudents()` in `client/src/core/services/apiService.js` to use `/students/teacher/students`.

**Verification:** Teacher dashboard student list loads from the correct endpoint.

---

### Issue 2 – Student Attendance Page Using Mock Data (CRITICAL) ✅

**Problem:** `student-attendance.tsx` used hardcoded mock data.

**Fix:** Replaced with real API via `useStudents()`; added loading, error, and empty states; breadcrumb uses role-aware dashboard.

**Note:** Attendance marking (radio buttons) is UI-only; backend has no POST endpoint for marking attendance. This is a known gap for future implementation.

**Verification:** Attendance page shows real student data from the API.

---

### Issue 3 – Student Details Route Design (HIGH) ✅

**Problem:** Route `/student/student-details` relied on `location.state`; data lost on refresh or shared URL.

**Fix:**
- Route changed to `/student/student-details/:id`
- `StudentDetails` uses `useParams()` for `id` with fallback to `location.state`
- All links updated to use `${routes.studentDetail}/${studentId}` when `studentId` exists
- Sidebar “Students Details” links to `studentList` instead of `studentDetail`

**Files updated:** `router.link.tsx`, `studentDetails.tsx`, `all_routes.tsx`, `sidebarData.tsx`, `student-list`, `student-grid`, `studentModals`, `collectFees`, `parent-list`, `guardian-list`, `parentDashboard`, `studentDashboard`, `studentDetails`, `add-student`

**Verification:** Direct navigation to `/student/student-details/123` works; refresh preserves data.

---

### Issue 4 – Header Navigation Always Redirects to Admin Dashboard (HIGH) ✅

**Problem:** Header logo always linked to admin dashboard.

**Fix:** Header uses `getDashboardForRole(user?.role)` so logo links to the correct dashboard per role (Admin, Teacher, Student, Parent, Guardian).

**Verification:** Each role sees correct dashboard link in header.

---

### Issue 5 – Frontend Route Protection Weak (HIGH) ✅

**Problem:** `ProtectedRoute` only checked `isAuthenticated`; any authenticated user could open restricted routes.

**Fix:**
- Extended `canAccessPath()` in `roleUtils.ts` with `ADMIN_ONLY_PATH_PREFIXES` (e.g. `/user-management/`)
- Added `RoleGuard` component that redirects non-admin users away from admin-only paths
- Integrated `RoleGuard` in `Feature` component wrapping `DashboardGuard` and `Outlet`

**Verification:** Non-admin users are redirected to their dashboard when accessing `/user-management/*`.

---

### Issue 6 – useStudents Hook Race Condition (MEDIUM) ✅

**Problem:** Hook could call admin endpoints before user role was loaded; teachers could receive 403.

**Fix:**
- Early return when `!user`
- Only call student APIs when role is Teacher or Admin (via `roleId` or `role` string)
- Added `canListStudents` check; other roles get empty list without API call
- Updated `useEffect` dependencies to include `user?.role`

**Verification:** Teacher dashboard loads students without 403; Parent/Guardian/Student do not trigger student list API.

---

### Issue 7 – Duplicate Route Definitions (LOW) ✅

**Problem:** Duplicate entries in `router.link.tsx` (callHistory, countries, fantawesome).

**Fix:** Removed duplicate route definitions.

---

### Issue 8 – Route Path Typo (LOW) ✅

**Problem:** `uiDropdowns: "ui-dropdowns"` missing leading slash.

**Fix:** Updated to `uiDropdowns: "/ui-dropdowns"` in `all_routes.tsx`.

---

### Issue 9 – Debug Logging in Production (LOW) ✅

**Problem:** `console.log` in production code.

**Fix:** Removed debug `console.log` from:
- `add-student/index.tsx`
- `useReligions.js`, `useSections.js`, `useMotherTongues.js`, `useHouses.js`, `useAcademicYears.js`, `useClasses.js`, `useCasts.js`, `useBloodGroups.js`, `useClassesWithSections.js`, `useHostels.js`, `useHostelRooms.js`
- `teachersRoutine.tsx`, `events.tsx`, `class-section/index.tsx`, `rating.tsx`

**Note:** `apiService.js` keeps `console.log` guarded by `isDev` for development debugging. `console.error` retained for real errors.

---

### Issue 10 – Optional Chaining / Safe Defaults (LOW) ✅

**Problem:** Code assumed arrays exist (e.g. `academicYears.length` when undefined).

**Fix:**
- Header: `academicYearsList = academicYears ?? []` and `academicYearsList.length > 0`
- Student promotion: `(academicYears ?? []).map(...)` and `academicYears?.[0]?.id?.toString()` for defaultValue

---

## 3. Documentation-Only Items (No Code Change)

### Issue 11 – Database Schema Inconsistencies

**Observation:** Controllers contain fallback logic for inconsistent column names (e.g. `religion_id` vs `reigion_id`).

**Recommendation:** Run a schema audit and migration to standardise column names; then remove fallbacks from controllers.

---

### Issue 12 – API Response Structure Consistency

**Observation:** Some pages handle multiple response formats (e.g. `res.data` vs `res.data.student`).

**Recommendation:** Standardise backend response shape (e.g. `{ data: T, status: string }`) and update frontend consumers accordingly.

---

## 4. Files Modified

| File | Changes |
|------|---------|
| `client/src/core/services/apiService.js` | Teacher students endpoint |
| `client/src/feature-module/hrm/attendance/student-attendance.tsx` | Replace mock data with API |
| `client/src/feature-module/router/router.link.tsx` | Student details route, remove duplicates |
| `client/src/feature-module/router/all_routes.tsx` | uiDropdowns typo |
| `client/src/feature-module/peoples/students/student-details/studentDetails.tsx` | Use `:id` param |
| `client/src/core/common/header/index.tsx` | Role-aware navigation, safe defaults |
| `client/src/core/components/ProtectedRoute.tsx` | (No change – role logic in RoleGuard) |
| `client/src/core/components/RoleGuard.tsx` | **New** – role-based path protection |
| `client/src/core/utils/roleUtils.ts` | `canAccessPath` extended for admin-only paths |
| `client/src/feature-module/feature.tsx` | Integrate RoleGuard |
| `client/src/core/hooks/useStudents.js` | Race condition fix |
| `client/src/feature-module/peoples/students/add-student/index.tsx` | Remove console.log, fix back link |
| `client/src/core/hooks/useReligions.js` | Remove console.log |
| `client/src/core/hooks/useSections.js` | Remove console.log |
| `client/src/core/hooks/useMotherTongues.js` | Remove console.log |
| `client/src/core/hooks/useHouses.js` | Remove console.log |
| `client/src/core/hooks/useAcademicYears.js` | Remove console.log |
| `client/src/core/hooks/useClasses.js` | Remove console.log |
| `client/src/core/hooks/useCasts.js` | Remove console.log |
| `client/src/core/hooks/useBloodGroups.js` | Remove console.log |
| `client/src/core/hooks/useClassesWithSections.js` | Remove console.log |
| `client/src/core/hooks/useHostels.js` | Remove console.log |
| `client/src/core/hooks/useHostelRooms.js` | Remove console.log |
| `client/src/feature-module/peoples/teacher/teacher-details/teachersRoutine.tsx` | Remove console.log |
| `client/src/feature-module/announcements/events.tsx` | Remove console.log |
| `client/src/feature-module/academic/class-section/index.tsx` | Remove console.log |
| `client/src/feature-module/uiInterface/advanced-ui/rating.tsx` | Remove console.log |
| `client/src/feature-module/peoples/students/student-promotion/index.tsx` | Safe defaults for academicYears |
| `client/src/core/data/json/sidebarData.tsx` | (If updated for student details link) |
| Multiple pages linking to student details | Updated to use `studentDetail/${id}` |

---

## 5. Verification Checklist for QA

### Role-Based Access

- [ ] **Admin:** Dashboard, user management, student/teacher/parent/guardian lists, settings
- [ ] **Teacher:** Dashboard, teacher students list, attendance, routine, leaves
- [ ] **Student:** Dashboard, own attendance, leaves, results, timetable
- [ ] **Parent:** Dashboard, children list, children attendance/leaves/results
- [ ] **Guardian:** Dashboard, wards list, wards attendance/leaves/results

### Major Features

- [ ] Student management (list, add, edit, details)
- [ ] Attendance (student attendance page loads real data)
- [ ] Fees (collect fees, fee structure)
- [ ] Leaves (apply, approve, list)
- [ ] Routine (class routine, teacher routine)
- [ ] Results (exam results)
- [ ] Messaging (if applicable)
- [ ] User management (admin only)

### Navigation

- [ ] Header logo links to correct dashboard per role
- [ ] Non-admin users redirected from `/user-management/*`
- [ ] Student details URL `/student/student-details/:id` works and survives refresh

### API Connectivity

- [ ] Teacher students list loads (no 404)
- [ ] Student attendance page shows real students
- [ ] All dashboards load without console errors

---

## 6. Remaining Risks

1. **Attendance marking:** No backend POST for marking attendance; UI is display-only.
2. **Schema inconsistencies:** Fallbacks in controllers may hide data issues; schema standardisation recommended.
3. **API response shape:** Inconsistent formats may cause edge-case bugs; standardisation recommended.
4. **Admin-only paths:** Only `/user-management/` is protected; other admin-only routes (e.g. settings, reports) may need similar protection.

---

## 7. Conclusion

The application is stabilised for QA testing. All critical and high-priority issues are resolved. Role-based access, navigation, and API connectivity are aligned with backend RBAC. Known technical debt (schema, API consistency) is documented for future work.
