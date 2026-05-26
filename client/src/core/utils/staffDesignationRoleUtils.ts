/** Teaching designations → Teacher login (matches server staffLoginRoleSync). */
const TEACHER_DESIGNATION_KEYS = new Set([
  "teacher",
  "senior teacher",
  "assistant teacher",
  "class teacher",
  "primary teacher",
  "hod",
  "demo teacher",
]);

const DRIVER_DESIGNATION_KEYS = new Set(["driver", "drivers"]);

const LEADERSHIP_DESIGNATION_KEYS = new Set(["principal", "vice principal"]);

const ACADEMIC_DEPARTMENT_KEYS = new Set([
  "academic",
  "academics",
  "teaching",
  "primary education",
  "demo academics department",
]);

const NON_TEACHING_DESIGNATION_IN_ACADEMIC = new Set([
  "clerk",
  "librarian",
  "accountant",
  "receptionist",
  "warden",
]);

export function normalizeDesignationName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

export function designationNameIsDriver(name: string): boolean {
  const n = normalizeDesignationName(name);
  return Boolean(n && DRIVER_DESIGNATION_KEYS.has(n));
}

export function designationNameIsTeacher(
  designationName: string,
  departmentName?: string
): boolean {
  const n = normalizeDesignationName(designationName);
  const dept = normalizeDesignationName(departmentName || "");
  if (!n || LEADERSHIP_DESIGNATION_KEYS.has(n)) return false;
  if (n.includes("administrative") || n.includes("administration")) return false;
  if (TEACHER_DESIGNATION_KEYS.has(n)) return true;
  if (n.includes("teacher")) return true;
  if (
    dept &&
    ACADEMIC_DEPARTMENT_KEYS.has(dept) &&
    !NON_TEACHING_DESIGNATION_IN_ACADEMIC.has(n)
  ) {
    return true;
  }
  return false;
}

/** Login role derived from designation (and optional stored users.role_id on edit). */
export function resolveStaffFormRoleId(opts: {
  designationName: string;
  storedRoleId?: string | number | null;
  teacherRoleId: string | null;
  driverRoleId: string | null;
  administrativeRoleId: string | null;
}): string | null {
  const name = opts.designationName;
  if (designationNameIsDriver(name) && opts.driverRoleId) return opts.driverRoleId;
  if (designationNameIsTeacher(name) && opts.teacherRoleId) return opts.teacherRoleId;

  const stored =
    opts.storedRoleId != null && String(opts.storedRoleId).trim() !== ""
      ? String(opts.storedRoleId)
      : null;
  if (stored === opts.teacherRoleId || stored === opts.driverRoleId) {
    return opts.administrativeRoleId;
  }
  if (stored) return stored;
  return opts.administrativeRoleId;
}
