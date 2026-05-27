
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Table from "../../core/common/dataTable/index";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { apiService } from "../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { fetchAllAccountsPages, parseAccountsListResponse } from "./accountsListUtils";
import { exportAccountsExcel, exportAccountsPdf, printAccountsData } from "./accountsExportUtils";
import { createAccountsTableChangeHandler } from "./accountsTableHandlers";

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "Income", label: "Income" },
  { value: "Expense", label: "Expense" },
];

const FORM_TYPE_OPTIONS = [
  { value: "Income", label: "Income" },
  { value: "Expense", label: "Expense" },
];

function mapCategoryToRow(c: any) {
  return {
    key: c.id,
    raw: c,
    id: String(c.id),
    category: c.category_name ?? "",
    categoryType: c.category_type ?? "",
    description: c.description ?? "",
    isActive: c.is_active === false ? "Inactive" : "Active",
  };
}

const AccountCategories = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortOrderFor = (field: string) =>
    sortBy === field ? (sortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null;

  const categoryListParams = useMemo(
    () => ({
      category_type: filterType || undefined,
      ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      ...(sortBy ? { sort_by: sortBy, sort_order: sortDir } : {}),
    }),
    [filterType, academicYearId, sortBy, sortDir]
  );

  const emptyForm = {
    category_name: "",
    category_type: "Expense",
    description: "" as string,
    is_active: true,
  };
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

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
      const res = await apiService.getAccountsCategories({
        ...categoryListParams,
        page,
        page_size: pageSize,
      });
      const { data: list, total: tot } = parseAccountsListResponse(res);
      setRows(list.map(mapCategoryToRow));
      setTotal(tot);
    } catch (e: unknown) {
      setLoadError(getAccountsErrorMessage(e, "Could not load categories."));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [categoryListParams, page, pageSize]);

  const handleTableChange = useMemo(
    () =>
      createAccountsTableChangeHandler({
        setPage,
        setPageSize,
        setSortBy,
        setSortDir,
      }),
    []
  );

  const catExportCols = [
    { key: "id", header: "ID" },
    { key: "category_name", header: "Category" },
    { key: "category_type", header: "Type" },
    { key: "description", header: "Description" },
    { key: "is_active", header: "Status" },
  ];

  const runExportExcel = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsCategories({ ...categoryListParams, ...p })
    );
    const flat = list.map((r) => ({
      id: r.id ?? "",
      category_name: r.category_name ?? "",
      category_type: r.category_type ?? "",
      description: r.description ?? "",
      is_active: r.is_active === false ? "Inactive" : "Active",
    }));
    exportAccountsExcel(flat, catExportCols, "account-categories");
  };

  const runExportPdf = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsCategories({ ...categoryListParams, ...p })
    );
    const flat = list.map((r) => ({
      id: r.id ?? "",
      category_name: r.category_name ?? "",
      category_type: r.category_type ?? "",
      description: r.description ?? "",
      is_active: r.is_active === false ? "Inactive" : "Active",
    }));
    exportAccountsPdf(flat, catExportCols, "account-categories", "Account categories");
  };

  const runPrint = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsCategories({ ...categoryListParams, ...p })
    );
    const flat = list.map((r) => ({
      id: r.id ?? "",
      category_name: r.category_name ?? "",
      category_type: r.category_type ?? "",
      description: r.description ?? "",
      is_active: r.is_active === false ? "Inactive" : "Active",
    }));
    printAccountsData("Account categories", catExportCols, flat);
  };

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setFormError(null);
    setAddForm({ ...emptyForm });
    setTimeout(() => showModal("add_account_category"), 0);
  };

  const openEdit = useCallback((record: any) => {
    const r = record.raw;
    setSelectedRecord(record);
    setEditForm({
      category_name: r.category_name || "",
      category_type: r.category_type === "Income" ? "Income" : "Expense",
      description: r.description || "",
      is_active: r.is_active !== false,
    });
    setFormError(null);
    setTimeout(() => showModal("edit_account_category"), 0);
  }, []);

  const openDelete = useCallback((record: any) => {
    setSelectedRecord(record);
    setFormError(null);
    setTimeout(() => showModal("delete-modal"), 0);
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        sorter: true,
        sortOrder: sortOrderFor("id"),
        render: (text: any) => (
          <Link to="#" className="link-primary">
            {text}
          </Link>
        ),
      },
      {
        title: "Category",
        dataIndex: "category",
        key: "category_name",
        sorter: true,
        sortOrder: sortOrderFor("category_name"),
      },
      {
        title: "Type",
        dataIndex: "categoryType",
        key: "category_type",
        sorter: true,
        sortOrder: sortOrderFor("category_type"),
        render: (text: string) => (
          <span
            className={`badge ${text === "Income" ? "badge-soft-success" : "badge-soft-danger"}`}
          >
            {text || "—"}
          </span>
        ),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        sorter: true,
        sortOrder: sortOrderFor("description"),
        render: (text: any) => (
          <div
            className="text-wrap text-break"
            style={{ minWidth: "150px", maxWidth: "250px", wordBreak: "break-word", whiteSpace: "normal" }}
          >
            {text || "—"}
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "isActive",
        key: "is_active",
      },
      {
        title: "Action",
        dataIndex: "action",
        key: "_action",
        render: (_: any, record: any) => (
          <div className="d-flex align-items-center">
            <div className="dropdown">
              <Link
                to="#"
                className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
                data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
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
          </div>
        ),
      },
    ],
    [openEdit, openDelete, sortBy, sortDir]
  );

  const onFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    document.body.click();
  };

  const onFilterReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterType("");
    setPage(1);
    document.body.click();
  };

  const buildPayload = (form: typeof emptyForm) => ({
    category_name: form.category_name.trim(),
    category_type: form.category_type,
    description: form.description.trim() || null,
    is_active: form.is_active,
    ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
  });

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (!addForm.category_name.trim()) {
        setFormError("Category name is required.");
        setSaving(false);
        return;
      }
      if (!addForm.category_type) {
        setFormError("Category type is required.");
        setSaving(false);
        return;
      }
      await apiService.createAccountsCategory(buildPayload(addForm));
      hideModal("add_account_category");
      setAddForm({ ...emptyForm });
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not save category."));
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = selectedRecord?.raw?.id;
    if (id == null) return;
    setSaving(true);
    setFormError(null);
    try {
      if (!editForm.category_name.trim()) {
        setFormError("Category name is required.");
        setSaving(false);
        return;
      }
      await apiService.updateAccountsCategory(id, buildPayload(editForm));
      hideModal("edit_account_category");
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not update category."));
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = selectedRecord?.raw?.id;
    if (id == null) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteAccountsCategory(id);
      hideModal("delete-modal");
      setSelectedRecord(null);
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not delete category."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Account Categories</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Categories
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={load}
                onPrint={runPrint}
                onExportPdf={runExportPdf}
                onExportExcel={runExportExcel}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary d-flex align-items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    openAdd();
                  }}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Category
                </Link>
              </div>
            </div>
          </div>

          {loadError && (
            <div className="alert alert-danger" role="alert">
              {loadError}
            </div>
          )}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Category List</h4>
              <form
                className="d-flex align-items-center flex-wrap gap-2 mb-3 me-5"
                onSubmit={onFilterSubmit}
              >
                <select
                  className="form-select form-select-sm"
                  style={{ minWidth: "140px" }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-sm btn-primary">
                  Apply
                </button>
                <button type="button" className="btn btn-sm btn-light" onClick={onFilterReset}>
                  Reset
                </button>
              </form>
            </div>
            <div className="card-body p-0 py-3">
              {formError && (
                <div className="alert alert-warning mx-3" role="alert">
                  {formError}
                </div>
              )}
              {loading ? (
                <div className="p-4 text-center text-muted">Loading…</div>
              ) : (
                <Table
                  dataSource={rows}
                  columns={columns}
                  Selection={true}
                  showSearch={true}
                  onTableChange={handleTableChange}
                  pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "30"],
                    showTotal: (tot, range) => `${range[0]}-${range[1]} of ${tot} items`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_account_category">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Category</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitAdd}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">
                    Category Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={addForm.category_type}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, category_type: e.target.value as "Income" | "Expense" }))
                    }
                  >
                    {FORM_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Category Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={addForm.category_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, category_name: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="add_category_active"
                    checked={addForm.is_active}
                    onChange={(e) => setAddForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="add_category_active">
                    Active
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_account_category">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Category</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">
                    Category Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={editForm.category_type}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, category_type: e.target.value as "Income" | "Expense" }))
                    }
                  >
                    {FORM_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Category Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.category_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, category_name: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="edit_category_active"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="edit_category_active">
                    Active
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={submitDelete}>
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>Confirm Deletion</h4>
                <p>This category will be removed. This action cannot be undone.</p>
                <div className="d-flex justify-content-center">
                  <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-danger" disabled={saving}>
                    {saving ? "…" : "Yes, Delete"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountCategories;
