import { formatDateDMY } from "../../../core/utils/dateDisplay";

export { formatDateDMY };

/** Project date format for table "Add On" column (DD-MM-YYYY). */
export function formatAddedOn(value: string | Date | null | undefined): string {
  return formatDateDMY(value);
}

export function activeInactiveLabel(isActive: boolean | null | undefined): string {
  if (isActive === true) return "Active";
  if (isActive === false) return "Inactive";
  return "—";
}

/** Same pattern as transport / library lists: soft green (active) vs soft red (inactive). */
export function ActiveInactiveBadge({ isActive }: { isActive: boolean | null | undefined }) {
  if (isActive === true) {
    return (
      <span className="badge badge-soft-success d-inline-flex align-items-center">
        <i className="ti ti-circle-filled fs-5 me-1" />
        Active
      </span>
    );
  }
  if (isActive === false) {
    return (
      <span className="badge badge-soft-danger d-inline-flex align-items-center">
        <i className="ti ti-circle-filled fs-5 me-1" />
        Inactive
      </span>
    );
  }
  return <span className="text-muted">—</span>;
}

/** Library / transport style soft badges for hostel_assignments.assignment_status. */
export function HostelAssignmentStatusBadge({ status }: { status: string | null | undefined }) {
  const s = String(status || "").trim().toLowerCase();
  const label =
    s === "active" ? "Active" : s === "completed" ? "Completed" : s === "cancelled" ? "Cancelled" : "";
  if (!label) return <span className="text-muted">—</span>;
  const cls =
    s === "active" ? "badge-soft-success" : s === "completed" ? "badge-soft-info" : "badge-soft-danger";
  return (
    <span className={`badge ${cls} d-inline-flex align-items-center`}>
      <i className="ti ti-circle-filled fs-5 me-1" />
      {label}
    </span>
  );
}

/** Matches library / transport modals: Status heading + Active/Inactive label + Bootstrap switch. */
export function HostelRecordStatusToggle({
  id,
  checked,
  onChange,
  disabled,
  heading = "Status",
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  heading?: string;
}) {
  return (
    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
      <div className="status-title">
        <h5>{heading}</h5>
        <label className="form-label mb-0" htmlFor={id}>
          {checked ? "Active" : "Inactive"}
        </label>
      </div>
      <div className="form-check form-switch">
        <input
          id={id}
          className="form-check-input"
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    </div>
  );
}
