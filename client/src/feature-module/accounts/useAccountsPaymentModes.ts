import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../core/services/apiService";

type PaymentOption = { value: string; label: string };

const FALLBACK_FORM: PaymentOption[] = [{ value: "Cash", label: "Cash" }];

/**
 * Active payment modes from Settings → Payment Modes (`payment_modes` table).
 * Used by Accounts income/expense forms and filters.
 */
export function useAccountsPaymentModes() {
  const [formOptions, setFormOptions] = useState<PaymentOption[]>(FALLBACK_FORM);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getPaymentModes(true);
        if (cancelled) return;
        if (res?.status === "SUCCESS" && Array.isArray(res.data) && res.data.length > 0) {
          const options = res.data
            .filter((m: { name?: string }) => String(m?.name || "").trim())
            .map((m: { name: string }) => ({
              value: String(m.name).trim(),
              label: String(m.name).trim(),
            }));
          if (options.length > 0) {
            setFormOptions(options);
          }
        }
      } catch {
        if (!cancelled) setFormOptions(FALLBACK_FORM);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => [{ value: "Select", label: "Select" }, ...formOptions],
    [formOptions]
  );

  const defaultPaymentMethod = formOptions[0]?.value || "Cash";

  /** Ensure edit form value appears even if mode was deactivated in settings. */
  const optionsIncluding = (currentValue?: string | null) => {
    const v = String(currentValue || "").trim();
    if (!v || formOptions.some((o) => o.value === v)) return formOptions;
    return [{ value: v, label: v }, ...formOptions];
  };

  return {
    formOptions,
    filterOptions,
    defaultPaymentMethod,
    optionsIncluding,
  };
}
