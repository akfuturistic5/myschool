/**
 * Role-based access control configuration
 * Must match public.user_roles (see migrations/001_init_full_schema.sql seed):
 * 1=admin, 2=teacher, 3=student, 4=parent, 5=Guardian, 6=administrative (if present)
 */
const ROLES = {
  ADMIN: 1,
  TEACHER: 2,
  STUDENT: 3,
  PARENT: 4,
  GUARDIAN: 5,
  ADMINISTRATIVE: 6,
};

/**
 * Admin-equivalent role IDs and names.
 * Keep these centralized so RBAC remains stable if schools use different admin labels.
 */
const ADMIN_ROLE_IDS = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];
const ADMIN_ROLE_NAMES = ['admin', 'headmaster', 'administrative', 'administrator'];

/** Any authenticated user (within a tenant) */
const ALL_AUTHENTICATED_ROLES = [
  ROLES.ADMIN,
  ROLES.ADMINISTRATIVE,
  ROLES.STUDENT,
  ROLES.TEACHER,
  ROLES.PARENT,
  ROLES.GUARDIAN,
];

const ROLE_NAMES = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.ADMINISTRATIVE]: 'Administrative',
  [ROLES.STUDENT]: 'Student',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.PARENT]: 'Parent',
  [ROLES.GUARDIAN]: 'Guardian',
};

/** Roles that can approve/reject leave applications (Headmaster / Admin only) */
const LEAVE_APPROVER_ROLES = [ROLES.ADMIN];

/** Roles that can manage fee collection (create, list all) */
const FEE_MANAGER_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

/** Roles that can manage notice board (create, update, delete) */
const NOTICE_MANAGER_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

/** Roles that can access dashboard operational stats */
const ADMIN_DASHBOARD_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

/** Roles that can manage users */
const USER_MANAGER_ROLES = [ROLES.ADMIN];

/** Roles that can list all students (not just /me or by class) */
const STUDENT_LIST_ALL_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER];

/** Roles that can list all teachers */
const TEACHER_LIST_ALL_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

/** Roles that can list parents. Teachers are server-scoped to only their own students' parents. */
const PARENT_LIST_ALL_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER];

/** Roles that can list all guardians */
const GUARDIAN_LIST_ALL_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

/** Roles that can create/update/delete school events (Headmaster + Teacher) */
const EVENT_MANAGER_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER];

/** Roles that can access getLeaveApplications (all/filtered list - Headmaster / Admin view only) */
const LEAVE_LIST_ALL_ROLES = [ROLES.ADMIN];

/** Roles that can access fee collections list (all students with fee summary) */
const FEE_COLLECTIONS_LIST_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

/** Roles that can create students, teachers, parents, guardians */
const PEOPLE_MANAGER_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

module.exports = {
  ROLES,
  ADMIN_ROLE_IDS,
  ADMIN_ROLE_NAMES,
  ALL_AUTHENTICATED_ROLES,
  ROLE_NAMES,
  EVENT_MANAGER_ROLES,
  LEAVE_APPROVER_ROLES,
  FEE_MANAGER_ROLES,
  NOTICE_MANAGER_ROLES,
  ADMIN_DASHBOARD_ROLES,
  USER_MANAGER_ROLES,
  STUDENT_LIST_ALL_ROLES,
  TEACHER_LIST_ALL_ROLES,
  PARENT_LIST_ALL_ROLES,
  GUARDIAN_LIST_ALL_ROLES,
  LEAVE_LIST_ALL_ROLES,
  FEE_COLLECTIONS_LIST_ROLES,
  PEOPLE_MANAGER_ROLES,
};
