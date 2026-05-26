import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Table from "../../../../core/common/dataTable/index";
import TooltipOption from "../../../../core/common/tooltipOption";
import { all_routes } from "../../../router/all_routes";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { apiService } from "../../../../core/services/apiService";
import { isHeadmasterRole } from "../../../../core/utils/roleUtils";
import { parseFetchErrorMessage } from "../../../../core/utils/parseFetchErrorMessage";

type LeaveTypeRow = {
  id: number;
  leave_type: string;
  code: string | null;
  max_days: number | null;
  description: string | null;
  is_paid: boolean | null;
  applicable_for: "student" | "staff" | "both" | "";
  requires_medical_certificate: boolean | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type LeaveTypeForm = {
  leave_type: string;
  code: string;
  max_days: string;
  description: string;
  is_paid: boolean;
  applicable_for: "student" | "staff" | "both";
  requires_medical_certificate: boolean;
  is_active: boolean;
};

const defaultForm: LeaveTypeForm = {
  leave_type: "",
  code: "",
  max_days: "",
  description: "",
  is_paid: true,
  applicable_for: "both",
  requires_medical_certificate: false,
  is_active: true,
};

const LeaveTypesPage = () => {
  const routes = all_routes;
  const { user: meUser, loading: meLoading } = useCurrentUser();
  const reduxUser = useSelector(selectUser);

  const canManageLeaveTypes = useMemo(() => {
    const candidates = [meUser, reduxUser].filter(Boolean);
    if (candidates.length === 0) return false;
    return candidates.some((candidate) =>
      isHeadmasterRole(candidate as Parameters<typeof isHeadmasterRole>[0])
    );
  }, [meUser, reduxUser]);

  /** Wait for auth before permission checks — avoids a brief "Access denied" flash while /auth/me loads. */
  const sessionPending = meLoading && !meUser && !reduxUser;
  const authResolved = !sessionPending;

  const [rows, setRows] = useState<LeaveTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeEditRow, setActiveEditRow] = useState<LeaveTypeRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<LeaveTypeForm>(defaultForm);
  const [editForm, setEditForm] = useState<LeaveTypeForm>(defaultForm);

  const fetchRows = async () => {
    if (!authResolved || !canManageLeaveTypes) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getLeaveTypesAdmin({ include_inactive: includeInactive ? 1 : 0 });
      if (res?.status === "SUCCESS" && Array.isArray(res?.data)) {
        setRows(
          res.data.map((r: any) => ({
            id: Number(r.id),
            leave_type: String(r.leave_type || ""),
            code: r.code == null ? null : String(r.code),
            max_days: r.max_days == null ? null : Number(r.max_days),
            description: r.description == null ? null : String(r.description),
            is_paid: r.is_paid == null ? null : Boolean(r.is_paid),
            applicable_for: (r.applicable_for || "") as "student" | "staff" | "both" | "",
            requires_medical_certificate:
              r.requires_medical_certificate == null ? null : Boolean(r.requires_medical_certificate),
            is_active: r.is_active == null ? null : Boolean(r.is_active),
            created_at: r.created_at,
            updated_at: r.updated_at,
          }))
        );
      } else {
        setRows([]);
      }
    } catch (e: unknown) {
      setRows([]);
      setError(parseFetchErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authResolved || !canManageLeaveTypes) return;
    fetchRows();
  }, [includeInactive, authResolved, canManageLeaveTypes]);

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const openEditModal = (row: LeaveTypeRow) => {
    setActiveEditRow(row);
    setEditForm({
      leave_type: row.leave_type || "",
      code: row.code || "",
      max_days: row.max_days == null ? "" : String(row.max_days),
      description: row.description || "",
      is_paid: row.is_paid == null ? true : Boolean(row.is_paid),
      applicable_for: row.applicable_for && ["student", "staff", "both"].includes(row.applicable_for)
        ? (row.applicable_for as "student" | "staff" | "both")
        : "both",
      requires_medical_certificate:
        row.requires_medical_certificate == null ? false : Boolean(row.requires_medical_certificate),
      is_active: row.is_active == null ? true : Boolean(row.is_active),
    });
    setShowEditModal(true);
  };

  const buildPayload = (form: LeaveTypeForm) => ({
    leave_type: form.leave_type.trim(),
    code: form.code.trim() || null,
    max_days: form.max_days.trim() === "" ? null : Number(form.max_days),
    description: form.description.trim() || null,
    is_paid: Boolean(form.is_paid),
    applicable_for: form.applicable_for,
    requires_medical_certificate: Boolean(form.requires_medical_certificate),
    is_active: Boolean(form.is_active),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.leave_type.trim()) {
      setFeedback({ type: "danger", text: "Leave type name is required." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiService.createLeaveType(buildPayload(addForm));
      if (res?.status === "SUCCESS") {
        setFeedback({ type: "success", text: "Leave type created successfully." });
        setShowAddModal(false);
        setAddForm(defaultForm);
        await fetchRows();
      } else {
        setFeedback({ type: "danger", text: String(res?.message || "Failed to create leave type.") });
      }
    } catch (e2: unknown) {
      setFeedback({ type: "danger", text: parseFetchErrorMessage(e2) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditRow?.id) return;
    if (!editForm.leave_type.trim()) {
      setFeedback({ type: "danger", text: "Leave type name is required." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiService.updateLeaveType(activeEditRow.id, buildPayload(editForm));
      if (res?.status === "SUCCESS") {
        setFeedback({ type: "success", text: "Leave type updated successfully." });
        setShowEditModal(false);
        setActiveEditRow(null);
        await fetchRows();
      } else {
        setFeedback({ type: "danger", text: String(res?.message || "Failed to update leave type.") });
      }
    } catch (e2: unknown) {
      setFeedback({ type: "danger", text: parseFetchErrorMessage(e2) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: LeaveTypeRow) => {
    if (!row?.id || deletingId != null) return;
    const ok = window.confirm(
      `Delete leave type "${row.leave_type}"? This will remove it from UI and database.`
    );
    if (!ok) return;
    setDeletingId(row.id);
    setFeedback(null);
    try {
      const res = await apiService.deleteLeaveType(row.id);
      if (res?.status === "SUCCESS") {
        setFeedback({ type: "success", text: "Leave type deleted successfully." });
        await fetchRows();
      } else {
        setFeedback({ type: "danger", text: String(res?.message || "Failed to delete leave type.") });
      }
    } catch (e2: unknown) {
      setFeedback({ type: "danger", text: parseFetchErrorMessage(e2) });
    } finally {
      setDeletingId(null);
    }
  };

  const data = useMemo(
    () =>
      rows.map((row) => ({
        key: String(row.id),
        id: row.id,
        leaveType: row.leave_type || "—",
        code: row.code || "—",
        maxDays: row.max_days == null ? "—" : String(row.max_days),
        applicableFor: row.applicable_for ? row.applicable_for : "—",
        paid: row.is_paid == null ? "—" : row.is_paid ? "Paid" : "Unpaid",
        medicalRequired:
          row.requires_medical_certificate == null ? "—" : row.requires_medical_certificate ? "Yes" : "No",
        status: row.is_active == null ? "Unknown" : row.is_active ? "Active" : "Inactive",
        updatedAt: formatDate(row.updated_at || row.created_at),
        raw: row,
      })),
    [rows]
  );

  const columns = [
    { title: "ID", dataIndex: "id" },
    { title: "Leave Type", dataIndex: "leaveType" },
    { title: "Code", dataIndex: "code" },
    { title: "Max Days", dataIndex: "maxDays" },
    { title: "Applicable For", dataIndex: "applicableFor" },
    { title: "Paid", dataIndex: "paid" },
    { title: "Medical Certificate", dataIndex: "medicalRequired" },
    { title: "Status", dataIndex: "status" },
    { title: "Updated", dataIndex: "updatedAt" },
    {
      title: "Action",
      dataIndex: "raw",
      render: (_: unknown, record: any) => (
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(record.raw)}>
            Edit
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={() => handleDelete(record.raw)}
            disabled={deletingId === record?.raw?.id}
          >
            {deletingId === record?.raw?.id ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  const exportHeaders = [
    "ID",
    "Leave Type",
    "Code",
    "Max Days",
    "Applicable For",
    "Paid",
    "Medical Certificate",
    "Status",
    "Updated",
  ];
  const exportRows = useMemo(
    () =>
      data.map((row: any) => [
        row.id ?? "—",
        row.leaveType ?? "—",
        row.code ?? "—",
        row.maxDays ?? "—",
        row.applicableFor ?? "—",
        row.paid ?? "—",
        row.medicalRequired ?? "—",
        row.status ?? "—",
        row.updatedAt ?? "—",
      ]),
    [data]
  );

  const downloadCsv = (filename: string) => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [exportHeaders, ...exportRows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTable = () => {
    const htmlRows = exportRows
      .map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=1200,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Leave Types</title>
      <style>
        body{font-family:Arial,sans-serif;padding:16px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
        th{background:#f5f5f5}
      </style></head><body>
      <h3>Leave Types</h3>
      <table><thead><tr>${exportHeaders.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${htmlRows}</tbody></table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (sessionPending) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" aria-label="Loading session" />
          </div>
        </div>
      </div>
    );
  }

  if (!canManageLeaveTypes) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger">Access denied. Only Headmaster or Administrative users can manage leave types.</div>
        </div>
      </div>
    );
  }

  const renderFormFields = (form: LeaveTypeForm, setForm: (f: LeaveTypeForm) => void) => (
    <div className="row">
      <div className="col-md-6 mb-3">
        <label className="form-label">Leave Type Name *</label>
        <input
          type="text"
          className="form-control"
          value={form.leave_type}
          onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
          maxLength={100}
          required
        />
      </div>
      <div className="col-md-6 mb-3">
        <label className="form-label">Code</label>
        <input
          type="text"
          className="form-control"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          maxLength={20}
        />
      </div>
      <div className="col-md-6 mb-3">
        <label className="form-label">Max Days</label>
        <input
          type="number"
          min={0}
          className="form-control"
          value={form.max_days}
          onChange={(e) => setForm({ ...form, max_days: e.target.value })}
        />
      </div>
      <div className="col-md-6 mb-3">
        <label className="form-label">Applicable For</label>
        <select
          className="form-select"
          value={form.applicable_for}
          onChange={(e) => setForm({ ...form, applicable_for: e.target.value as "student" | "staff" | "both" })}
        >
          <option value="both">Both</option>
          <option value="student">Student</option>
          <option value="staff">Staff</option>
        </select>
      </div>
      <div className="col-md-12 mb-3">
        <label className="form-label">Description</label>
        <textarea
          className="form-control"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={1000}
        />
      </div>
      <div className="col-md-4 mb-2">
        <div className="form-check form-switch">
          <input
            id="lt-is-paid"
            className="form-check-input"
            type="checkbox"
            checked={form.is_paid}
            onChange={(e) => setForm({ ...form, is_paid: e.target.checked })}
          />
          <label htmlFor="lt-is-paid" className="form-check-label">Is Paid</label>
        </div>
      </div>
      <div className="col-md-4 mb-2">
        <div className="form-check form-switch">
          <input
            id="lt-med-cert"
            className="form-check-input"
            type="checkbox"
            checked={form.requires_medical_certificate}
            onChange={(e) => setForm({ ...form, requires_medical_certificate: e.target.checked })}
          />
          <label htmlFor="lt-med-cert" className="form-check-label">Requires Medical Certificate</label>
        </div>
      </div>
      <div className="col-md-4 mb-2">
        <div className="form-check form-switch">
          <input
            id="lt-active"
            className="form-check-input"
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          <label htmlFor="lt-active" className="form-check-label">Active</label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Leave Types</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">HRM</li>
                <li className="breadcrumb-item active" aria-current="page">
                  Leave Types
                </li>
              </ol>
            </nav>
          </div>
          <div className="d-flex align-items-center flex-wrap">
            <TooltipOption
              onRefresh={fetchRows}
              onPrint={printTable}
              onExportPdf={printTable}
              onExportExcel={() => downloadCsv("leave-types.csv")}
            />
            <button className="btn btn-primary ms-2" onClick={() => setShowAddModal(true)}>
              Add Leave Type
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Manage Leave Types</h5>
            <div className="form-check form-switch">
              <input
                id="lt-include-inactive"
                className="form-check-input"
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              <label htmlFor="lt-include-inactive" className="form-check-label">Show Inactive</label>
            </div>
          </div>
          <div className="card-body">
            {feedback && (
              <div className={`alert alert-${feedback.type === "success" ? "success" : "danger"}`} role="alert">
                {feedback.text}
              </div>
            )}
            {error && <div className="alert alert-danger">{error}</div>}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : (
              <Table columns={columns} dataSource={data} Selection={false} />
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Leave Type</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)} />
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">{renderFormFields(addForm, setAddForm)}</div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Leave Type</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowEditModal(false);
                    setActiveEditRow(null);
                  }}
                />
              </div>
              <form onSubmit={handleUpdate}>
                <div className="modal-body">{renderFormFields(editForm, setEditForm)}</div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => {
                      setShowEditModal(false);
                      setActiveEditRow(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Updating..." : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTypesPage;
