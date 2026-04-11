import { useCallback, useState } from "react";
import {
  type AddStudentErrorKey,
  CONTACT_PAIRS,
  REQUIRED_FIELD_META,
  validateContactPair,
  validateFormatForKey,
  validateRequiredValue,
} from "./addStudentFormValidation";

/** Subset of form state needed for validation */
export interface AddStudentFormSnapshot {
  academic_year_id: string | null;
  admission_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  father_email: string;
  father_phone: string;
  mother_email: string;
  mother_phone: string;
  guardian_email: string;
  guardian_phone: string;
  unique_student_ids: string;
  pen_number: string;
  aadhaar_no: string;
}

type FormDataLike = AddStudentFormSnapshot & Record<string, unknown>;

function getRequiredValue(fd: FormDataLike, key: AddStudentErrorKey): unknown {
  return fd[key as keyof FormDataLike];
}

export function useAddStudentFieldErrors(
  formData: FormDataLike,
  options: { isEdit: boolean }
) {
  const { isEdit } = options;
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<AddStudentErrorKey, string>>
  >({});

  /** Clear field and paired contact keys when one of the pair changes */
  const clearFieldErrorSmart = useCallback(
    (field: string) => {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field as AddStudentErrorKey];
        for (const p of CONTACT_PAIRS) {
          if (p.emailKey === field || p.phoneKey === field) {
            delete next[p.emailKey];
            delete next[p.phoneKey];
          }
        }
        return next;
      });
    },
    []
  );

  const validateRequiredKey = useCallback(
    (fd: FormDataLike, key: AddStudentErrorKey): string | null => {
      if (key === "academic_year_id" && isEdit) return null;
      const meta = REQUIRED_FIELD_META.find((m) => m.key === key);
      if (!meta) return null;
      return validateRequiredValue(
        key,
        getRequiredValue(fd, key),
        meta.label
      );
    },
    [isEdit]
  );

  const validatePairKeys = useCallback((fd: FormDataLike) => {
    const out: Partial<Record<AddStudentErrorKey, string>> = {};
    for (const p of CONTACT_PAIRS) {
      const msg = validateContactPair(
        String(fd[p.emailKey] ?? ""),
        String(fd[p.phoneKey] ?? "")
      );
      if (msg) {
        out[p.emailKey] = msg;
        out[p.phoneKey] = msg;
      }
    }
    return out;
  }, []);

  /** Phone digit rules apply only when email+phone pair is valid. */
  const validatePhoneFormats = useCallback((fd: FormDataLike) => {
    const out: Partial<Record<AddStudentErrorKey, string>> = {};
    for (const p of CONTACT_PAIRS) {
      if (
        validateContactPair(
          String(fd[p.emailKey] ?? ""),
          String(fd[p.phoneKey] ?? "")
        )
      ) {
        const pe = validateFormatForKey(p.phoneKey, fd);
        if (pe) out[p.phoneKey] = pe;
      }
    }
    return out;
  }, []);

  const validateIdFormatFields = useCallback((fd: FormDataLike) => {
    const out: Partial<Record<AddStudentErrorKey, string>> = {};
    for (const key of ["unique_student_ids", "pen_number", "aadhaar_no"] as const) {
      const err = validateFormatForKey(key, fd);
      if (err) out[key] = err;
    }
    return out;
  }, []);

  const validateOnBlur = useCallback(
    (key: AddStudentErrorKey, fd: FormDataLike) => {
      const meta = REQUIRED_FIELD_META.find((m) => m.key === key);
      if (meta && meta.validateOnBlur === false) return;

      setFieldErrors((prev) => {
        const next = { ...prev };
        const reqErr = validateRequiredKey(fd, key);
        if (reqErr) {
          next[key] = reqErr;
          return next;
        }
        delete next[key];

        for (const p of CONTACT_PAIRS) {
          if (p.emailKey === key || p.phoneKey === key) {
            const msg = validateContactPair(
              String(fd[p.emailKey] ?? ""),
              String(fd[p.phoneKey] ?? "")
            );
            if (msg) {
              next[p.emailKey] = msg;
              next[p.phoneKey] = msg;
            } else {
              delete next[p.emailKey];
              delete next[p.phoneKey];
              const pe = validateFormatForKey(p.phoneKey, fd);
              if (pe) next[p.phoneKey] = pe;
            }
            break;
          }
        }

        const idErr = validateFormatForKey(key, fd);
        if (
          key === "unique_student_ids" ||
          key === "pen_number" ||
          key === "aadhaar_no"
        ) {
          if (idErr) next[key] = idErr;
          else delete next[key];
        }

        return next;
      });
    },
    [validateRequiredKey]
  );

  const validateAllForSubmit = useCallback(
    (fd: FormDataLike): Partial<Record<AddStudentErrorKey, string>> | null => {
      const next: Partial<Record<AddStudentErrorKey, string>> = {};

      for (const m of REQUIRED_FIELD_META) {
        if (m.key === "academic_year_id" && isEdit) continue;
        const err = validateRequiredKey(fd, m.key);
        if (err) next[m.key] = err;
      }

      Object.assign(next, validatePairKeys(fd));
      Object.assign(next, validatePhoneFormats(fd));
      Object.assign(next, validateIdFormatFields(fd));

      setFieldErrors(next);
      return Object.keys(next).length === 0 ? null : next;
    },
    [
      isEdit,
      validatePairKeys,
      validatePhoneFormats,
      validateIdFormatFields,
      validateRequiredKey,
    ]
  );

  return {
    fieldErrors,
    setFieldErrors,
    clearFieldErrorSmart,
    validateOnBlur,
    validateAllForSubmit,
  };
}

export type { AddStudentErrorKey };
