import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkAdmissionNumberUnique,
  ADMISSION_NUMBER_DUPLICATE_MSG,
} from "../../../../core/validation/uniqueFieldChecks";

export interface UseAdmissionNumberUniquenessOptions {
  /** Current admission number from the form */
  admissionNumber: string;
  /** When editing, exclude this student id from the duplicate check */
  excludeStudentId?: string | null;
  /** Admission number loaded from server (edit mode). Used to skip false positives when unchanged. */
  baselineAdmission: string;
  debounceMs?: number;
}

export function useAdmissionNumberUniqueness({
  admissionNumber,
  excludeStudentId,
  baselineAdmission,
  debounceMs = 500,
}: UseAdmissionNumberUniquenessOptions) {
  const [checking, setChecking] = useState(false);
  /** null = not yet determined for current value; true = duplicate; false = available */
  const [exists, setExists] = useState<boolean | null>(null);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = useCallback(async (): Promise<boolean> => {
    const v = admissionNumber.trim();
    if (!v) {
      setExists(null);
      setSoftWarning(null);
      setChecking(false);
      return false;
    }
    if (
      excludeStudentId &&
      baselineAdmission.trim() === v
    ) {
      setExists(false);
      setSoftWarning(null);
      setChecking(false);
      return false;
    }

    const myId = ++reqIdRef.current;
    setChecking(true);
    setSoftWarning(null);
    try {
      const res = await checkAdmissionNumberUnique(v, excludeStudentId ?? null);
      if (myId !== reqIdRef.current) return false;
      const dup = res?.exists === true;
      setExists(dup);
      return dup;
    } catch {
      if (myId !== reqIdRef.current) return false;
      setExists(null);
      setSoftWarning(
        "Could not verify admission number. You can still try saving — the server will validate."
      );
      return false;
    } finally {
      if (myId === reqIdRef.current) setChecking(false);
    }
  }, [admissionNumber, excludeStudentId, baselineAdmission]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const v = admissionNumber.trim();
    if (!v) {
      setExists(null);
      setSoftWarning(null);
      setChecking(false);
      return;
    }
    if (
      excludeStudentId &&
      baselineAdmission.trim() === v
    ) {
      setExists(false);
      setSoftWarning(null);
      setChecking(false);
      return;
    }

    setExists(null);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runCheck();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [
    admissionNumber,
    baselineAdmission,
    debounceMs,
    excludeStudentId,
    runCheck,
  ]);

  const flushOnBlur = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void runCheck();
  }, [runCheck]);

  /** Await before submit (server still validates). */
  const ensureUniqueBeforeSubmit = useCallback(async (): Promise<boolean> => {
    const v = admissionNumber.trim();
    if (!v) return false;
    if (
      excludeStudentId &&
      baselineAdmission.trim() === v
    ) {
      return false;
    }
    const dup = await runCheck();
    return dup;
  }, [admissionNumber, baselineAdmission, excludeStudentId, runCheck]);

  const duplicateMessage =
    exists === true && admissionNumber.trim().length > 0
      ? ADMISSION_NUMBER_DUPLICATE_MSG
      : null;

  return {
    checking,
    exists,
    softWarning,
    duplicateMessage,
    flushOnBlur,
    ensureUniqueBeforeSubmit,
  };
}
