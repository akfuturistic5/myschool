import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiService } from "../../../core/services/apiService";
import { all_routes } from "../../router/all_routes";
import {
  resolveStaffNumericId,
  staffDirectoryFriendlyError,
} from "./staffDirectoryErrors";

export interface StaffProfileLocationState {
  staffId?: number;
  staff?: Record<string, unknown>;
}

export function useStaffProfileLoader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const state = location.state as StaffProfileLocationState | null;

  const staffId = useMemo(
    () =>
      resolveStaffNumericId({
        search: location.search,
        stateStaffId: state?.staffId,
        stateStaffRecord: state?.staff ?? null,
      }),
    [location.search, state?.staffId, state?.staff]
  );

  const [staff, setStaff] = useState<Record<string, unknown> | null>(
    () => state?.staff ?? null
  );
  const [loading, setLoading] = useState(!!staffId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!staffId) {
      navigate(all_routes.staff, { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = (await apiService.getStaffById(staffId)) as {
          status?: string;
          data?: Record<string, unknown>;
          message?: string;
        };
        if (cancelled) return;
        if (res?.status === "SUCCESS" && res?.data) {
          setStaff(res.data);
          const pk = Number(res.data.id);
          if (Number.isFinite(pk) && pk > 0) {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.set("id", String(pk));
                return next;
              },
              { replace: true }
            );
          }
        } else {
          setError(res?.message || "Could not load staff.");
        }
      } catch (e: unknown) {
        if (!cancelled) setError(staffDirectoryFriendlyError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staffId, navigate, setSearchParams]);

  const pkFromStaff =
    staff != null &&
    Number.isFinite(Number(staff.id)) &&
    Number(staff.id) > 0
      ? Number(staff.id)
      : null;
  const effectivePk =
    pkFromStaff ?? (staffId != null && staffId > 0 ? staffId : null);

  const detailSearch =
    effectivePk != null ? `?id=${effectivePk}` : "";

  const navState: StaffProfileLocationState | null =
    effectivePk != null
      ? { staffId: effectivePk, staff: staff ?? {} }
      : null;

  return {
    staffId,
    staff,
    loading,
    error,
    detailSearch,
    navState,
    pk: effectivePk ?? NaN,
  };
}
