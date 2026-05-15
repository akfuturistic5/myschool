import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable";
import CommonSelect from "../../../core/common/commonSelect";
import { status as statusOptions } from "../../../core/common/selectoption/selectoption";import { all_routes } from "../../router/all_routes";
import { apiService } from "../../../core/services/apiService";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import LibraryToolbar from "./LibraryToolbar";
import { exportRowsToPdf, exportRowsToXlsx, printRowsToPage } from "./libraryTableExport";
import { getLibraryErrorMessage } from "./libraryApiErrors";

const emptyForm = {
  policy_name: "",
  audience_type: "ALL",
  max_books_allowed: "" as string | number,
  issue_duration_days: "" as string | number,
  max_renewals_allowed: "" as string | number,
  per_day_fine: "" as string | number,
  grace_period_days: "" as string | number,
  max_fine_limit: "" as string | number,
  is_active: true,
};

const toNumOrNull = (value: string | number) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const audienceFilterOptions = [
  { value: "all", label: "All audiences" },
  { value: "Student", label: "Student" },
  { value: "Staff", label: "Staff" },
  { value: "ALL", label: "ALL" },
];

const isRowActive = (r: any) => r.is_active !== false && r.is_active !== 0;

const LibraryPolicy = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [appliedFilters, setAppliedFilters] = useState({ audience: "all", status: "all" });
  const [filterDraft, setFilterDraft] = useState({ audience: "all", status: "all" });

  const showModal = (id: string) => {
    const el = document.getElementById(id);
    const bootstrap = (window as any).bootstrap;
    if (el && bootstrap?.Modal) {
      const m = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
      m.show();
    }
  };

  const hideModal = (id: string) => {
    const el = document.getElementById(id);
    const bootstrap = (window as any).bootstrap;
    if (el && bootstrap?.Modal) {
      const m = bootstrap.Modal.getInstance(el);
      m?.hide();
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getLibraryPolicies();
      const list = (res as any)?.data || [];
      setRows(
        list.map((r: any) => ({
          ...r,
          id: String(r.id),
          key: r.id,
        }))
      );
    } catch (e: unknown) {
      setRows([]);
      setLoadError(getLibraryErrorMessage(e, "Could not load policies."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((r: any) => {
      if (appliedFilters.audience !== "all") {
        const aud = String(r.audience_type ?? "ALL");
        if (aud !== appliedFilters.audience) return false;
      }
      const active = isRowActive(r);
      if (appliedFilters.status === "active") return active;
      if (appliedFilters.status === "inactive") return !active;
      return true;
    });
  }, [rows, appliedFilters.audience, appliedFilters.status]);

  const applyFiltersFromDraft = (e?: React.FormEvent) => {
    e?.preventDefault();
    setAppliedFilters({ ...filterDraft });
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const resetFilters = () => {
    const empty = { audience: "all", status: "all" };
    setFilterDraft(empty);
    setAppliedFilters(empty);
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const openAdd = () => {
    setFormError(null);
    setAddForm({ ...emptyForm });
    setTimeout(() => showModal("add_library_policy"), 0);
  };

  const openEdit = (record: any) => {
    const row = record.raw || record;
    setSelected(row);
    setFormError(null);
    setEditForm({
      policy_name: row.policy_name || "",
      audience_type: row.audience_type || "ALL",
      max_books_allowed: row.max_books_allowed ?? "",
      issue_duration_days: row.issue_duration_days ?? "",
      max_renewals_allowed: row.max_renewals_allowed ?? "",
      per_day_fine: row.per_day_fine ?? "",
      grace_period_days: row.grace_period_days ?? "",
      max_fine_limit: row.max_fine_limit ?? "",
      is_active: isRowActive(row),
    });
    setTimeout(() => showModal("edit_library_policy"), 0);
  };

  const openDelete = (record: any) => {
    const row = record.raw || record;
    setSelected(row);
    setFormError(null);
    setTimeout(() => showModal("delete_library_policy"), 0);
  };

  const buildPayload = (form: typeof emptyForm) => ({
    policy_name: form.policy_name.trim(),
    audience_type: form.audience_type,
    max_books_allowed: toNumOrNull(form.max_books_allowed),
    issue_duration_days: Number(form.issue_duration_days),
    max_renewals_allowed: toNumOrNull(form.max_renewals_allowed),
    per_day_fine: toNumOrNull(form.per_day_fine),
    grace_period_days: toNumOrNull(form.grace_period_days),
    max_fine_limit: toNumOrNull(form.max_fine_limit),
    is_active: form.is_active,
  });

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiService.createLibraryPolicy(buildPayload(addForm));
      hideModal("add_library_policy");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not create policy."));
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.updateLibraryPolicy(selected.id, buildPayload(editForm));
      hideModal("edit_library_policy");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not update policy."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteLibraryPolicy(selected.id);
      hideModal("delete_library_policy");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not delete policy."));
    } finally {
      setSaving(false);
    }
  };

  const exportHeaders = [
    "ID",
    "Policy Name",
    "Audience",
    "Max Books",
    "Issue Days",
    "Renewals",
    "Fine/Day",
    "Grace Days",
    "Max Fine",
    "Status",
  ];

  const exportRows = () =>
    filteredRows.map((r) => [
      r.id,
      r.policy_name || "",
      r.audience_type || "",
      r.max_books_allowed ?? "",
      r.issue_duration_days ?? "",
      r.max_renewals_allowed ?? "",
      r.per_day_fine ?? "",
      r.grace_period_days ?? "",
      r.max_fine_limit ?? "",
      isRowActive(r) ? "Active" : "Inactive",
    ]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: (a: TableData, b: TableData) => String(a.id || "").localeCompare(String(b.id || "")),
    },
    {
      title: "Policy Name",
      dataIndex: "policy_name",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).policy_name || "").localeCompare(String((b as any).policy_name || "")),
    },
    {
      title: "Audience",
      dataIndex: "audience_type",
    },
    {
      title: "Issue Days",
      dataIndex: "issue_duration_days",
    },
    {
      title: "Fine / Day",
      dataIndex: "per_day_fine",
      render: (v: number | null) => (v != null ? v : "—"),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      render: (v: string) => formatDateDMY(v),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (_: unknown, record: any) => {
        const active = isRowActive(record);
        return active ? (
          <span className="badge badge-soft-success d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1" />
            Active
          </span>
        ) : (
          <span className="badge badge-soft-danger d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1" />
            Inactive
          </span>
        );
      },
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: any) => (
        <div className="dropdown">
          <Link
            to="#"
            className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-end p-2">
            <li>
              <Link
                className="dropdown-item rounded-1"
                to="#"
                onClick={(e) => {
                  e.preventDefault();
                  openEdit(record);
                }}
              >
                <i className="ti ti-edit-circle me-2" />
                Edit
              </Link>
            </li>
            <li>
              <Link
                className="dropdown-item rounded-1"
                to="#"
                onClick={(e) => {
                  e.preventDefault();
                  openDelete(record);
                }}
              >
                <i className="ti ti-trash-x me-2" />
                Delete
              </Link>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Library Policies</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Policies
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center justify-content-end flex-wrap flex-row-reverse gap-2">
              <div className="mb-2">
                <button type="button" className="btn btn-primary" onClick={openAdd}>
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Policy
                </button>
              </div>
              <LibraryToolbar
                onRefresh={load}
                onExportExcel={() => exportRowsToXlsx("library-policies.xlsx", "Policies", exportHeaders, exportRows())}
                onExportPdf={() => exportRowsToPdf("Library - Policies", exportHeaders, exportRows())}
                onPrint={() => printRowsToPage("Library - Policies", exportHeaders, exportRows())}
              />
            </div>
          </div>

          {loadError && <div className="alert alert-danger">{loadError}</div>}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Policy List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                  >
                    <i className="ti ti-filter me-2" />
                    Filter
                  </Link>
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ overflow: "visible" }}
                  >
                    <form onSubmit={applyFiltersFromDraft}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Audience type</label>
                              <CommonSelect
                                className="select"
                                options={audienceFilterOptions}
                                value={filterDraft.audience}
                                onChange={(val: string | null) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    audience: !val || val === "all" ? "all" : val,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "all", label: "All Status" },
                                  ...statusOptions.map((s) => ({
                                    value: s.value.toLowerCase(),
                                    label: s.label,
                                  })),
                                ]}
                                value={filterDraft.status}
                                onChange={(val: string | null) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    status:
                                      val === "All" || val === "all" ? "all" : val?.toLowerCase() || "all",
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={resetFilters}>
                          Reset
                        </button>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading ? (
                <div className="p-4 text-center text-muted">Loading policies…</div>
              ) : (
                <Table dataSource={filteredRows} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_library_policy" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Policy</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitAdd}>
              <PolicyForm form={addForm} setForm={setAddForm} formError={formError} statusFieldId="add_library_policy_status" />
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Add Policy"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_library_policy" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Policy</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <PolicyForm form={editForm} setForm={setEditForm} formError={formError} statusFieldId="edit_library_policy_status" />
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="delete_library_policy" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon"><i className="ti ti-trash-x" /></span>
              <h4>Confirm Deletion</h4>
              <p className="mb-2">Delete policy <strong>{selected?.policy_name || ""}</strong>?</p>
              {formError && <p className="text-danger small">{formError}</p>}
              <div className="d-flex justify-content-center mt-3">
                <button type="button" className="btn btn-light me-3" data-bs-dismiss="modal">Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={saving}>{saving ? "…" : "Yes, Delete"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

type PolicyFormProps = {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  formError: string | null;
  statusFieldId: string;
};

const PolicyForm = ({ form, setForm, formError, statusFieldId }: PolicyFormProps) => (
  <div className="modal-body">
    {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
    <div className="row">
      <div className="col-md-6 mb-3">
        <label className="form-label">Policy Name *</label>
        <input className="form-control" required value={form.policy_name} onChange={(e) => setForm((f) => ({ ...f, policy_name: e.target.value }))} />
      </div>
      <div className="col-md-6 mb-3">
        <label className="form-label">Audience *</label>
        <select className="form-select" value={form.audience_type} onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value }))}>
          <option value="ALL">ALL</option>
          <option value="Student">Student</option>
          <option value="Staff">Staff</option>
        </select>
      </div>
      <div className="col-md-4 mb-3">
        <label className="form-label">Issue Duration Days *</label>
        <input type="number" min={1} className="form-control" required value={form.issue_duration_days} onChange={(e) => setForm((f) => ({ ...f, issue_duration_days: e.target.value }))} />
      </div>
      <div className="col-md-4 mb-3">
        <label className="form-label">Max Books Allowed</label>
        <input type="number" min={1} className="form-control" value={form.max_books_allowed} onChange={(e) => setForm((f) => ({ ...f, max_books_allowed: e.target.value }))} />
      </div>
      <div className="col-md-4 mb-3">
        <label className="form-label">Max Renewals</label>
        <input type="number" min={0} className="form-control" value={form.max_renewals_allowed} onChange={(e) => setForm((f) => ({ ...f, max_renewals_allowed: e.target.value }))} />
      </div>
      <div className="col-md-4 mb-3">
        <label className="form-label">Per Day Fine</label>
        <input type="number" min={0} step="0.01" className="form-control" value={form.per_day_fine} onChange={(e) => setForm((f) => ({ ...f, per_day_fine: e.target.value }))} />
      </div>
      <div className="col-md-4 mb-3">
        <label className="form-label">Grace Period Days</label>
        <input type="number" min={0} className="form-control" value={form.grace_period_days} onChange={(e) => setForm((f) => ({ ...f, grace_period_days: e.target.value }))} />
      </div>
      <div className="col-md-4 mb-3">
        <label className="form-label">Max Fine Limit</label>
        <input type="number" min={0} step="0.01" className="form-control" value={form.max_fine_limit} onChange={(e) => setForm((f) => ({ ...f, max_fine_limit: e.target.value }))} />
      </div>
      <div className="col-md-12">
        <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
          <div className="status-title">
            <h5>Status</h5>
            <label className="form-label mb-0" htmlFor={statusFieldId}>
              {form.is_active ? "Active" : "Inactive"}
            </label>
          </div>
          <div className="form-check form-switch">
            <input
              id={statusFieldId}
              className="form-check-input"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default LibraryPolicy;
