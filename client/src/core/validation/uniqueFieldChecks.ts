import { apiService } from "../services/apiService";

export type UniqueFieldKind = "admissionNumber";

/** Standard duplicate message (keep in sync with server where applicable). */
export const ADMISSION_NUMBER_DUPLICATE_MSG = "Admission Number already exists";

/**
 * Debounce helper for input-driven validation.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
}

export async function checkAdmissionNumberUnique(
  admissionNumber: string,
  excludeStudentId: string | number | null = null
): Promise<{ status?: string; exists?: boolean; checked?: boolean }> {
  return apiService.checkAdmissionNumberUnique(
    admissionNumber,
    excludeStudentId
  ) as Promise<{ status?: string; exists?: boolean; checked?: boolean }>;
}

/**
 * Extensible entry point for future fields (GR, email, phone).
 */
export async function checkUniqueField(
  field: UniqueFieldKind,
  value: string,
  excludeStudentId: string | number | null = null
): Promise<{ status?: string; exists?: boolean; checked?: boolean }> {
  switch (field) {
    case "admissionNumber":
      return checkAdmissionNumberUnique(value, excludeStudentId);
    default:
      throw new Error(`Unknown unique field: ${String(field)}`);
  }
}
