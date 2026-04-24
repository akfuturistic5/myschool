import type { Dayjs } from "dayjs";

/** Field keys used by teacher add/edit validation */
export type TeacherFormField =
  | "first_name"
  | "last_name"
  | "phone"
  | "email"
  | "qualification"
  | "joiningDate"
  | "class_id"
  | "subject_id"
  | "new_password"
  | "confirm_password"
  | "resume"
  | "joining_letter"
  | "father_name"
  | "mother_name"
  | "pan_number"
  | "id_number"
  | "previous_school_phone"
  | "marital_status";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9]{10}$/;

export function validateField(
  name: TeacherFormField,
  value: string | null | undefined,
  ctx?: {
    joiningDate?: Dayjs | null;
    password?: string;
    confirmPassword?: string;
    requireClassSubject?: boolean;
  }
): string | null {
  const v = value != null ? String(value) : "";

  switch (name) {
    case "first_name": {
      const t = v.trim();
      if (!t) return "First name is required";
      if (t.length < 2) return "First name must be at least 2 characters";
      if (t.length > 50) return "First name cannot exceed 50 characters";
      return null;
    }
    case "last_name": {
      const t = v.trim();
      if (!t) return "Last name is required";
      if (t.length < 2) return "Last name must be at least 2 characters";
      if (t.length > 50) return "Last name cannot exceed 50 characters";
      return null;
    }
    case "phone": {
      if (!v.trim()) return "Mobile is required";
      if (/[a-zA-Z]/.test(v)) return "Mobile number cannot contain letters";
      const digits = v.replace(/\D/g, "");
      if (!MOBILE_RE.test(digits)) return "Enter a valid 10-digit mobile number";
      return null;
    }
    case "email": {
      if (!v.trim()) return "Email is required";
      if (!EMAIL_RE.test(v.trim())) return "Enter a valid email address";
      return null;
    }
    case "qualification": {
      if (!v.trim()) return "Qualification is required";
      return null;
    }
    case "joiningDate": {
      const jd = ctx?.joiningDate;
      if (!jd || !jd.isValid()) return "Date of joining is required";
      return null;
    }
    case "class_id": {
      if (ctx?.requireClassSubject && !v?.trim()) return "Class is required";
      return null;
    }
    case "subject_id": {
      if (ctx?.requireClassSubject && !v?.trim()) return "Subject is required";
      return null;
    }
    case "new_password": {
      const pw = ctx?.password ?? v;
      const cf = ctx?.confirmPassword ?? "";
      if (!pw && !cf) return null;
      if (pw && pw.length < 6) return "Password must be at least 6 characters";
      return null;
    }
    case "confirm_password": {
      const pw = ctx?.password ?? "";
      const cf = ctx?.confirmPassword ?? v;
      if (!pw && !cf) return null;
      if (pw !== cf) return "Passwords do not match";
      return null;
    }
    case "father_name":
      if (v.length > 100) return "Father name cannot exceed 100 characters";
      return null;
    case "mother_name":
      if (v.length > 100) return "Mother name cannot exceed 100 characters";
      return null;
    case "pan_number":
      if (v.length > 10) return "PAN number cannot exceed 10 characters";
      return null;
    case "id_number":
      if (v.length > 50) return "ID number cannot exceed 50 characters";
      return null;
    case "previous_school_phone": {
      if (!v.trim()) return null;
      if (/[a-zA-Z]/.test(v)) return "Phone number cannot contain letters";
      if (v.length > 15) return "Phone number cannot exceed 15 characters";
      return null;
    }
    case "marital_status":
      if (v.length > 20) return "Marital status cannot exceed 20 characters";
      return null;
    case "resume":
    case "joining_letter":
      return null;
    default:
      return null;
  }
}

export type TeacherFormValues = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  qualification: string;
  joiningDate: Dayjs | null;
  class_id: string | null;
  subject_id: string | null;
  new_password: string;
  confirm_password: string;
  father_name: string;
  mother_name: string;
  pan_number: string;
  id_number: string;
  previous_school_phone: string;
  marital_status: string;
};

export function validateTeacherFormSync(
  values: TeacherFormValues,
  options: { requireClassSubject: boolean; isEdit: boolean }
): Partial<Record<TeacherFormField, string>> {
  const ctxBase = {
    joiningDate: values.joiningDate,
    requireClassSubject: options.requireClassSubject,
    password: values.new_password,
    confirmPassword: values.confirm_password,
  };

  const out: Partial<Record<TeacherFormField, string>> = {};

  const jdErr = validateField("joiningDate", "", ctxBase);
  if (jdErr) out.joiningDate = jdErr;

  const simple: { key: TeacherFormField; val: string | null }[] = [
    { key: "first_name", val: values.first_name },
    { key: "last_name", val: values.last_name },
    { key: "phone", val: values.phone },
    { key: "email", val: values.email },
    { key: "qualification", val: values.qualification },
    { key: "father_name", val: values.father_name },
    { key: "mother_name", val: values.mother_name },
    { key: "pan_number", val: values.pan_number },
    { key: "id_number", val: values.id_number },
    { key: "previous_school_phone", val: values.previous_school_phone },
    { key: "marital_status", val: values.marital_status },
  ];
  for (const { key, val } of simple) {
    const err = validateField(key, val, ctxBase);
    if (err) out[key] = err;
  }

  if (options.requireClassSubject) {
    const ce = validateField("class_id", values.class_id, ctxBase);
    if (ce) out.class_id = ce;
    const se = validateField("subject_id", values.subject_id, ctxBase);
    if (se) out.subject_id = se;
  }

  if (!options.isEdit) {
    const pe = validateField("new_password", values.new_password, ctxBase);
    if (pe) out.new_password = pe;
    const ce = validateField("confirm_password", values.confirm_password, ctxBase);
    if (ce) out.confirm_password = ce;
  }

  return out;
}

/** Ordered for scroll-to-first-error */
export const TEACHER_FORM_FIELD_ORDER: TeacherFormField[] = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "qualification",
  "joiningDate",
  "class_id",
  "subject_id",
  "new_password",
  "confirm_password",
  "resume",
  "joining_letter",
  "father_name",
  "mother_name",
  "pan_number",
  "id_number",
  "previous_school_phone",
  "marital_status",
];

export function firstErrorFieldKey(
  errors: Partial<Record<TeacherFormField, string>>
): TeacherFormField | null {
  for (const k of TEACHER_FORM_FIELD_ORDER) {
    if (errors[k]) return k;
  }
  return null;
}
