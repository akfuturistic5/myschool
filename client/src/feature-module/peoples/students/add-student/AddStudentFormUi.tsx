import type { ReactNode } from "react";

/** Red asterisk after label text; keeps alignment with form-label */
export function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <label className="form-label mb-1">
      <span>{children}</span>
      <span className="text-danger ms-1" style={{ color: "red" }} aria-hidden="true">
        *
      </span>
    </label>
  );
}

/** Inline error below control; reserved height reduces layout shift when message appears */
export function FieldError({ message }: { message?: string }) {
  return (
    <div
      className="add-student-field-error-slot"
      style={{ minHeight: "1.125rem" }}
      aria-live="polite"
    >
      {message ? (
        <span className="text-danger d-block small mt-1" style={{ fontSize: "0.8125rem" }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
