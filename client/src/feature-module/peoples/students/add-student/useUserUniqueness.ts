import { useCallback, useEffect, useRef, useState } from "react";
import { apiService } from "../../../../core/services/apiService";

export interface UseUserUniquenessOptions {
  phone: string;
  email: string;
  excludeUserId?: number | null;
  debounceMs?: number;
  enabled?: boolean;
}

export function useUserUniqueness({
  phone,
  email,
  excludeUserId,
  debounceMs = 500,
  enabled = true,
}: UseUserUniquenessOptions) {
  const [checking, setChecking] = useState(false);
  const [asyncErrors, setAsyncErrors] = useState<{
    phone?: string;
    email?: string;
  }>({});
  
  const reqIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = useCallback(async () => {
    const p = phone.replace(/\D/g, "");
    const e = email.trim();
    
    // Don't check if both are empty
    if (!p && !e) {
      setAsyncErrors({});
      setChecking(false);
      return;
    }

    const myId = ++reqIdRef.current;
    setChecking(true);
    
    try {
      const res = await apiService.checkUserUnique({
        mobile: p || undefined,
        email: e || undefined,
        excludeId: excludeUserId ?? undefined,
      });

      if (myId !== reqIdRef.current) return;

      setAsyncErrors({
        phone: res?.mobileExists ? "This phone number is already in use" : undefined,
        email: res?.emailExists ? "This email address is already in use" : undefined,
      });
    } catch (err) {
      if (myId !== reqIdRef.current) return;
      console.error("Uniqueness check failed:", err);
      // Fail silently on network errors so user can still try to submit
    } finally {
      if (myId === reqIdRef.current) setChecking(false);
    }
  }, [phone, email, excludeUserId]);

  useEffect(() => {
    if (!enabled) {
      setAsyncErrors({});
      setChecking(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const p = phone.replace(/\D/g, "");
    const e = email.trim();

    if (!p && !e) {
      setAsyncErrors({});
      setChecking(false);
      return;
    }

    // Optimization: If values are too short/invalid, don't waste API calls
    // But let the parent handle format validation; here we just debounce.

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
  }, [phone, email, enabled, debounceMs, runCheck]);

  return {
    checking,
    asyncErrors,
    refresh: runCheck,
  };
}
