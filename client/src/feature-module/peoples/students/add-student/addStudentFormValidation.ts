/**
 * Shared validation rules for Add / Edit Student form (aligned with API + UX).
 */

export type AddStudentErrorKey =
  | "academic_year_id"
  | "admission_number"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "father_email"
  | "father_phone"
  | "mother_email"
  | "mother_phone"
  | "guardian_email"
  | "guardian_phone"
  | "unique_student_ids"
  | "pen_number"
  | "aadhaar_no";

export const REQUIRED_FIELD_META: {
  key: AddStudentErrorKey;
  label: string;
  /** If false, only validate on submit (e.g. read-only academic year) */
  validateOnBlur?: boolean;
}[] = [
  { key: "academic_year_id", label: "Academic Year", validateOnBlur: false },
  { key: "admission_number", label: "Admission Number" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
];

/** Email + phone must appear together for login (matches server). */
export function contactPairValid(email: string, phone: string): boolean {
  const e = (email || "").trim();
  const p = (phone || "").trim();
  if (!e && !p) return true;
  return Boolean(e && p);
}

const PAIR_MESSAGE =
  "Email and phone must both be filled, or leave both empty.";

/** DOM order for focusing the first invalid field after submit */
export const ADD_STUDENT_FIELD_FOCUS_ORDER: AddStudentErrorKey[] = [
  "academic_year_id",
  "admission_number",
  "first_name",
  "last_name",
  "phone",
  "email",
  "father_email",
  "father_phone",
  "mother_email",
  "mother_phone",
  "guardian_phone",
  "guardian_email",
  "unique_student_ids",
  "pen_number",
  "aadhaar_no",
];

/** Matches server column limits (studentController allocate* helpers). */
export const MAX_UNIQUE_STUDENT_ID_LEN = 50;
export const MAX_PEN_NUMBER_LEN = 20;
export const AADHAAR_DIGITS = 12;

/** Empty OK; if filled, must be exactly 12 digits (UID). */
export function validateAadhaarOptional(value: string): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  if (!/^\d{12}$/.test(t)) {
    return `Aadhaar must be exactly ${AADHAAR_DIGITS} digits (or leave blank to auto-assign)`;
  }
  return null;
}

/** Empty OK; if filled, max length (server truncates / rejects duplicates). */
export function validatePenNumberOptional(value: string): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  if (t.length > MAX_PEN_NUMBER_LEN) {
    return `PEN number must be at most ${MAX_PEN_NUMBER_LEN} characters`;
  }
  return null;
}

export function validateUniqueStudentIdOptional(value: string): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  if (t.length > MAX_UNIQUE_STUDENT_ID_LEN) {
    return `Unique Student ID must be at most ${MAX_UNIQUE_STUDENT_ID_LEN} characters`;
  }
  return null;
}

/** Empty OK; if filled, digits only, typical mobile length (API stores as text). */
export function validatePhoneDigitsOptional(value: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return "Phone must be 10–15 digits";
  }
  return null;
}

export function validateFormatForKey(
  key: AddStudentErrorKey,
  fd: Record<string, unknown>
): string | null {
  switch (key) {
    case "aadhaar_no":
      return validateAadhaarOptional(String(fd.aadhaar_no ?? ""));
    case "pen_number":
      return validatePenNumberOptional(String(fd.pen_number ?? ""));
    case "unique_student_ids":
      return validateUniqueStudentIdOptional(String(fd.unique_student_ids ?? ""));
    case "phone":
      return validatePhoneDigitsOptional(String(fd.phone ?? ""));
    case "father_phone":
      return validatePhoneDigitsOptional(String(fd.father_phone ?? ""));
    case "mother_phone":
      return validatePhoneDigitsOptional(String(fd.mother_phone ?? ""));
    case "guardian_phone":
      return validatePhoneDigitsOptional(String(fd.guardian_phone ?? ""));
    default:
      return null;
  }
}

export function getFirstInvalidFieldKey(
  errors: Partial<Record<AddStudentErrorKey, string>>
): AddStudentErrorKey | undefined {
  for (const key of ADD_STUDENT_FIELD_FOCUS_ORDER) {
    if (errors[key]) return key;
  }
  return undefined;
}

/**
 * Scroll field into view and focus native input, or a focusable wrapper (tabIndex -1).
 */
export function focusAddStudentField(key: AddStudentErrorKey): void {
  requestAnimationFrame(() => {
    const root = document.querySelector(
      `[data-add-student-field="${key}"]`
    ) as HTMLElement | null;
    if (!root) return;

    root.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
      if (root.matches("input, textarea, select")) {
        const inp = root as HTMLInputElement;
        if (!inp.disabled) {
          inp.focus({ preventScroll: true });
          return;
        }
      }
      const inner = root.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      if (inner) {
        inner.focus({ preventScroll: true });
        return;
      }
      if (root.hasAttribute("tabindex")) {
        root.focus({ preventScroll: true });
        return;
      }
      root.querySelector<HTMLElement>(".react-select__input input")?.focus({
        preventScroll: true,
      });
    }, 50);
  });
}

export const CONTACT_PAIRS: {
  emailKey: AddStudentErrorKey;
  phoneKey: AddStudentErrorKey;
  label: string;
}[] = [
  { emailKey: "email", phoneKey: "phone", label: "Student" },
  { emailKey: "father_email", phoneKey: "father_phone", label: "Father" },
  { emailKey: "mother_email", phoneKey: "mother_phone", label: "Mother" },
  { emailKey: "guardian_email", phoneKey: "guardian_phone", label: "Guardian" },
];

function isEmptyText(value: unknown): boolean {
  return String(value ?? "").trim() === "";
}

export function validateRequiredValue(
  key: AddStudentErrorKey,
  value: unknown,
  label: string
): string | null {
  if (key === "academic_year_id") {
    if (value == null || String(value).trim() === "") {
      return `${label} is required`;
    }
    return null;
  }
  if (isEmptyText(value)) {
    return `${label} is required`;
  }
  return null;
}

export function validateContactPair(
  email: string,
  phone: string
): string | null {
  return contactPairValid(email, phone) ? null : PAIR_MESSAGE;
}

/** Bootstrap invalid state for text inputs */
export function formControlInvalidClass(hasError: boolean): string {
  return hasError ? "is-invalid" : "";
}
