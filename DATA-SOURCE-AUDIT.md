# Application-wide data source audit

**Purpose:** List every section where the UI uses **static/dummy data** (JSON) instead of **database-backed APIs**, so you can fix any place where DB data exists but is not shown.

---

## Backend APIs that exist (DB-connected)

| API prefix | Controller | Used for |
|------------|------------|----------|
| `/api/academic-years` | academicYearController | Academic years |
| `/api/classes` | classController | Classes |
| `/api/sections` | sectionController | Sections (class-section data) |
| `/api/subjects` | subjectController | Subjects |
| `/api/teachers` | teacherController | Teachers |
| `/api/students` | studentController | Students |
| `/api/blood-groups` | bloodGroupController | Blood groups |
| `/api/religions` | religionController | Religions |
| `/api/casts` | castController | Casts |
| `/api/mother-tongues` | motherTongueController | Mother tongues |
| `/api/parents` | parentController | Parents |
| `/api/guardians` | guardianController | Guardians |
| `/api/houses` | houseController | Houses |
| `/api/addresses` | addressController | Addresses |
| `/api/transport/routes` | transportRouteController | Transport routes |
| `/api/transport/pickup-points` | transportPickupController | Pickup points |
| `/api/transport/vehicles` | transportVehicleController | Vehicles |
| `/api/transport/drivers` | transportDriverController | Drivers |

**Frontend already using these APIs (OK):**  
Students (list, grid, promotion, add-student dropdowns), Teachers (list, grid), Parents (list, grid), Guardians (list, grid), Classes (list with sections), Add-student (academic years, blood groups, religions, casts, mother tongues, houses, classes, sections), Transport (Routes, Pickup Points, Vehicles, Drivers, Assign Vehicle), Header (academic years).

---

## PROBLEM LIST: Sections using static JSON (no API / DB not shown)

If your database has tables for any of these, the UI will **not** show that data until the section is wired to an API (and the API is added if missing).

### 1. Academic module

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Class Section** | `/academic/class-section` | `class-section.tsx` | **Yes** – `/api/sections` | UI uses dummy `classSection`. Should use sections API (sections + class join). |
| Academic Reason | `/academic/academic-reason` | `academic_reason.tsx` | No | Static only. If DB has table → need API + wire UI. |
| Class Syllabus | `/academic/class-syllabus` | `class-syllabus.tsx` | No | Static only. |
| Class Subject | `/academic/class-subject` | `class-subject.tsx` | No (subjects API exists for other use) | Static. If this list is “subjects per class”, may need class-subject API. |
| Class Room | `/academic/class-room` | `class-room.tsx` | No | Static only. |
| Class Routine | `/academic/class-routine` | `class-routine.tsx` | No | Static only. |
| Class Home Work | `/academic/class-home-work` | `class_home_work.tsx` | No | Static only. |
| Schedule Classes | `/academic/schedule-classes` | `schedule_class.tsx` | No | Static only. |
| Exam | `/academic/exam` | `exam.tsx` | No | Static only. |
| Exam Schedule | `/academic/exam-schedule` | `exam_schedule.tsx` | No | Static only. |
| Grade | `/academic/grade` | `grade.tsx` | No | Static only. |
| Exam Result | `/academic/exam-result` | `exam-result.tsx` | No | Static only. |
| Exam Attendance | `/academic/exam-attendance` | `exam_attendance.tsx` | No | Static only. |

**Note:** Academic **Classes** (`/academic/classes`) already uses API (`useClassesWithSections`).

---

### 2. Management module

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Fees Group** | `/management/fees-group` | `feesData.tsx` | No | Static. If DB has fees_group → need API + wire UI. |
| **Fees Type** | `/management/fees-type` | `feesType.tsx` | No | Static. |
| **Fees Master** | `/management/fees-master` | `feesMaster.tsx` | No | Static. |
| **Fees Assign** | `/management/fees-assign` | `assignFeesData.tsx` | No | Static. |
| **Collect Fees** | `/management/collect-fees` | `collectFees.tsx` | No | Static. |
| **Library Members** | `/management/library-members` | `libraryMemberList.tsx` | No | Static. |
| **Library Issue Book** | `/management/library-issue-book` | `bookIssueList.tsx` | No | Static. |
| **Library Books** | `/management/library-books` | `bookList.tsx` | No | Static. |
| **Library Return** | `/management/library-return` | `bookIssueList.tsx` | No | Static. |
| **Sports List** | `/management/sports` | `sportsList.tsx` | No | Static. |
| **Players List** | `/management/players` | `sportsList.tsx` | No | Static. |
| **Hostel List** | `/management/hostel-list` | `hostelListData.tsx` | No | Static. |
| **Hostel Type** | `/management/hostel-type` | `hostelRoomType.tsx` | No | Static. |
| **Hostel Rooms** | `/management/hostel-rooms` | `hostelRoomsData.tsx` | No | Static. |

**Note:** Transport (Routes, Pickup Points, Vehicles, Drivers, Assign Vehicle) is already wired to DB APIs.

---

### 3. HRM module

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Staff List** | `/hrm/staff` | `staff.tsx` | No | Static. If DB has staff → need API + wire UI. |
| **Departments** | `/hrm/departments` | `departments.tsx` | No | Static. |
| **Designation** | `/hrm/designation` | `designation.tsx` | No | Static. |
| **Payroll** | `/hrm/payroll` | `pay-roll.tsx` | No | Static. |
| **Holidays** | `/hrm/holidays` | `holiday.tsx` | No | Static. |
| **List Leaves** | `/hrm/list-leaves` | `list_leaves.tsx` | No | Static. |
| **Approve Request** | `/hrm/approve-request` | `approve_request.tsx` | No | Static. |
| **Staff Payroll** | `/hrm/staff-payroll` | `staff-payroll.tsx` | No | Static. |
| **Staff Leave** | `/hrm/staff-leave` | `staff-leave.tsx` | No | Static. |
| **Staffs Attendance** | `/hrm/staffs-attendance` | `staffs_attendance.tsx` | No | Static. |
| **Student Attendance** | `/hrm/student-attendance` | `student_attendance.tsx` | No | Static. |
| **Teacher Attendance** | `/hrm/teacher-attendance` | `teacher_attendance.tsx` | No | Static. |
| **Staff Attendance** | `/hrm/staff-attendance` | `staff-attendance.tsx` | No | Static. |

---

### 4. Reports module

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Student Report** | `/report/student-report` | `student_report.tsx` | No | Static. |
| **Leave Report** | `/report/leave-report` | `leave_report_data.tsx` | No | Static. |
| **Grade Report** | `/report/grade-report` | `grade_report_data.tsx` | No | Static. |
| **Fees Report** | `/report/fees-report` | `fees_report_data.tsx` | No | Static. |
| **Class Report** | `/report/class-report` | `class_report.tsx`, `class_studentreport.tsx` | No | Static. |
| **Attendance Report** | `/report/attendance-report` | `attendence_report.tsx` | No | Static. |
| **Teacher Report** (attendance) | (under attendance-report) | `teacher_attendance_data.tsx` | No | Static. |
| **Staff Report** (attendance) | (under attendance-report) | `teacher_attendance_data.tsx` | No | Static. |
| **Student Day Wise** | `/report/student-day-wise` | `student_day_wise.tsx` | No | Static. |
| **Teacher Day Wise** | `/report/teacher-day-wise` | `teacher_day_wise.tsx` | No | Static. |
| **Staff Day Wise** | `/report/staff-day-wise` | `staff_day_wise.tsx` | No | Static. |
| **Daily Attendance** | `/report/daily-attendance` | `dailyAttendanceData.tsx` | No | Static. |
| **Student Attendance Type** | `/report/student-attendance-type` | `StudentAttendanceType.tsx` | No | Static. |

---

### 5. Accounts / Finance

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Accounts Income** | `/accounts/accounts-income` | `accounts_income_data.tsx` | No | Static. |
| **Accounts Invoices** | `/accounts/accounts-invoices` | `accounts_invoices_data.tsx` | No | Static. |
| **Accounts Transactions** | `/accounts/accounts-transactions` | `accounts_transactions_data.tsx` | No | Static. |
| **Expense** | `/accounts/expense` | `expense_data.tsx` | No | Static. |
| **Expense Category** | `/accounts/expense-category` | `expenses_category_data.tsx` | No | Static. |

---

### 6. Content module

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Pages** | `/content/pages` | `pages_data.tsx` | No | Static. |
| **Countries** | `/content/countries` | `countries_data.tsx` | No | Static. |
| **States** | `/content/states` | `states_data.tsx` | No | Static. |
| **Cities** | `/content/cities` | `cities_data.tsx` | No | Static. |
| **Testimonials** | `/content/testimonials` | `testimonials_data.tsx` | No | Static. |
| **FAQ** | `/content/faq` | `faq_data.tsx` | No | Static. |
| **Blog Categories** | `/content/blog-categories` | `blog_categories_data.tsx` | No | Static. |
| **Blog Comments** | `/content/blog-comments` | `blog_comments_data.tsx` | No | Static. |
| **Blog Tags** | `/content/blog-tags` | `blog_tags_data.tsx` | No | Static. |

---

### 7. User Management

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Manage Users** | `/user-management/manage-users` | `manageuser.tsx` | No | Static. |
| **Roles & Permissions** | `/user-management/roles-permissions` | `rolesPermissions.tsx` | No | Static. |
| **Permissions** | `/user-management/permissions` | `permission.tsx` | No | Static. |
| **Delete Request** | `/user-management/delete-request` | `deleteaRequest.tsx` | No | Static. |

---

### 8. Support

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Contact Messages** | `/support/contact-messages` | `contactMessages.tsx` | No | Static. |

---

### 9. Membership

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Membership Transaction** | `/membership-transactions` (or similar) | `membership_transcation.tsx` | No | Static. |

---

### 10. Peoples – detail sub-pages (teacher / student)

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Teacher Salary** | Teacher details > Salary | `salary.tsx` | No | Static. |
| **Teacher Leave** | Teacher details > Leave | `leaveData.tsx`, `attendance.tsx` | No | Static. |
| **Student Leaves** | Student details > Leaves | `leaveData.tsx`, `attendance.tsx` | No | Static. |

**Note:** Teacher list/grid and Student list/grid use API. Only these detail sub-pages use static data.

---

### 11. Application (demo / utility)

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **File Manager** | `/application/file-manager` | `file_data.tsx` | No | Static (often demo). |
| **Call History** | `/application/call-history` | `callHistoryData.tsx` | No | Static. |

---

### 12. Settings / UI

| Section | Route / location | Static data file | Backend API exists? | Issue |
|--------|-------------------|------------------|----------------------|------|
| **Language** (website settings) | `/website-settings/language` | `language.tsx` | No | Static. |
| **Data Tables** (UI demo) | `/data-tables` or `/tables-basic` | `datatable.tsx` | No | Static (UI demo). |

---

## Summary

- **One section has API but UI still on static data (fix by wiring UI to API):**
  - **Academic → Class Section:** Backend has `/api/sections`. Replace `classSection` JSON with sections API (e.g. `useSections()` or a dedicated hook that maps sections + class like backend).

- **All other listed sections:** No backend API found for that feature. So:
  - If your **DB has tables** for any of them, you need to add **backend APIs** and then **wire the UI** to those APIs (same pattern as transport/students/teachers).
  - If there is **no DB table** for a section, leaving it as static is fine.

---

## Recommended order to fix (when DB has data)

1. **Academic → Class Section** – API exists; only frontend wiring needed.
2. Any **Management** (fees, library, hostel, sports) where you have DB tables.
3. **HRM** (staff, departments, attendance, payroll, leaves, etc.) if you have DB.
4. **Reports** – usually need APIs that aggregate from students/teachers/attendance/fees.
5. **Accounts, Content, User Management, Support, Membership** – per your DB and priorities.

No database writes are required for this audit; only backend APIs and frontend data wiring where you want to show existing DB data.
