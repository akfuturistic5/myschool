import type { Option } from "../common/commonSelect";

type DesignationRow = {
  originalData?: {
    id?: number | string | null;
    department_id?: number | string | null;
    is_active?: boolean;
    designation_name?: string;
  };
  designation?: string;
};

type DepartmentRow = {
  originalData?: { id?: number | string | null };
  department?: string;
};

export function getDesignationDepartmentId(row: DesignationRow): number | null {
  const raw = row?.originalData?.department_id;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Active designations mapped to the selected department (strict department_id match). */
export function filterDesignationsForDepartment(
  designations: DesignationRow[],
  departmentId: string | null
): DesignationRow[] {
  if (!departmentId) return [];
  const deptNum = parseInt(departmentId, 10);
  if (!Number.isInteger(deptNum) || deptNum <= 0) return [];

  return (designations || []).filter((d) => {
    if (d.originalData?.id == null) return false;
    const active = d.originalData?.is_active;
    if (active === false) return false;
    return getDesignationDepartmentId(d) === deptNum;
  });
}

export function buildDesignationSelectOptions(
  designations: DesignationRow[],
  departmentId: string | null,
  /** Keep visible on edit when stored pair predates strict filtering */
  includeDesignationId?: string | null
): Option[] {
  const opts = filterDesignationsForDepartment(designations, departmentId).map((d) => ({
    value: String(d.originalData!.id),
    label: d.designation ?? d.originalData?.designation_name ?? "",
  }));

  if (!includeDesignationId || opts.some((o) => o.value === String(includeDesignationId))) {
    return opts;
  }

  const row = (designations || []).find(
    (d) => d.originalData?.id != null && String(d.originalData.id) === String(includeDesignationId)
  );
  if (!row) return opts;

  return [
    {
      value: String(row.originalData!.id),
      label: row.designation ?? row.originalData?.designation_name ?? "",
    },
    ...opts,
  ];
}

export function designationBelongsToDepartment(
  designations: DesignationRow[],
  designationId: string | null,
  departmentId: string | null
): boolean {
  if (!designationId || !departmentId) return false;
  const row = (designations || []).find(
    (d) => String(d.originalData?.id) === String(designationId)
  );
  if (!row) return false;
  const deptNum = parseInt(departmentId, 10);
  return getDesignationDepartmentId(row) === deptNum;
}

export function buildDepartmentSelectOptions(departments: DepartmentRow[]): Option[] {
  return ((departments as DepartmentRow[]) || [])
    .filter((d) => d.originalData?.id != null)
    .map((d) => ({
      value: String(d.originalData!.id),
      label: d.department ?? "",
    }));
}

/** Clears designation when department changes and current designation is invalid. */
export function resolveDesignationAfterDepartmentChange(
  designationId: string | null,
  designations: DesignationRow[],
  newDepartmentId: string | null
): string | null {
  if (!newDepartmentId) return null;
  if (!designationId) return null;
  return designationBelongsToDepartment(designations, designationId, newDepartmentId)
    ? designationId
    : null;
}
