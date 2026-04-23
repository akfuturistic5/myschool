
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Table from "../../core/common/dataTable/index";
import CommonSelect from "../../core/common/commonSelect";
import PredefinedDateRanges from "../../core/common/datePicker";
import { category2 } from "../../core/common/selectoption/selectoption";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { apiService } from "../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { fetchAllAccountsPages, parseAccountsListResponse } from "./accountsListUtils";
import { exportAccountsExcel, exportAccountsPdf, printAccountsData } from "./accountsExportUtils";
import { createAccountsTableChangeHandler } from "./accountsTableHandlers";

function mapCategoryToRow(c: any) {
  return {
    key: c.id,
    raw: c,
    id: String(c.id),
    category: c.category_name ?? "",
    description: c.description ?? "",
  };
}

const ExpensesCategory = () => {
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
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>("Select");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortOrderFor = (field: string) =>
    sortBy === field ? (sortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null;

  const categoryListParams = useMemo(
    () => ({
      search: appliedSearch.trim() || undefined,
      ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      ...(sortBy ? { sort_by: sortBy, sort_order: sortDir } : {}),
    }),
    [appliedSearch, academicYearId, sortBy, sortDir]
  );

  const emptyForm = { category_name: "", description: "" as string };
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
      const res = await apiService.getAccountsExpenseCategories({
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
    { key: "description", header: "Description" },
  ];

  const runExportExcel = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsExpenseCategories({ ...categoryListParams, ...p })
    );
    const flat = list.map((r) => ({
      id: r.id ?? "",
      category_name: r.category_name ?? "",
      description: r.description ?? "",
    }));
    exportAccountsExcel(flat, catExportCols, "expense-categories");
  };

  const runExportPdf = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsExpenseCategories({ ...categoryListParams, ...p })
    );
    const flat = list.map((r) => ({
      id: r.id ?? "",
      category_name: r.category_name ?? "",
      description: r.description ?? "",
    }));
    exportAccountsPdf(flat, catExportCols, "expense-categories", "Expense categories");
  };

  const runPrint = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsExpenseCategories({ ...categoryListParams, ...p })
    );
    const flat = list.map((r) => ({
      id: r.id ?? "",
      category_name: r.category_name ?? "",
      description: r.description ?? "",
    }));
    printAccountsData("Expense categories", catExportCols, flat);
  };

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setFormError(null);
    setAddForm({ ...emptyForm });
    setTimeout(() => showModal("add_expenses_category"), 0);
  };

  const openEdit = useCallback((record: any) => {
    const r = record.raw;
    setSelectedRecord(record);
    setEditForm({
      category_name: r.category_name || "",
      description: r.description || "",
    });
    setFormError(null);
    setTimeout(() => showModal("edit_expenses_category"), 0);
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
        title: "Description",
        dataIndex: "description",
        key: "description",
        sorter: true,
        sortOrder: sortOrderFor("description"),
      },
      {
        title: "Action",
        dataIndex: "action",
        key: "_action",
        render: (_: any, record: any) => (
          <>
            <div className="d-flex align-items-center">
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
            </div>
          </>
        ),
      },
    ],
    [openEdit, openDelete, sortBy, sortDir]
  );

  const onFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = filterCategory && filterCategory !== "Select" ? filterCategory : "";
    setAppliedSearch(v.trim());
    setPage(1);
    document.body.click();
  };

  const onFilterReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterCategory("Select");
    setAppliedSearch("");
    setPage(1);
    document.body.click();
  };

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
      await apiService.createAccountsExpenseCategory({
        category_name: addForm.category_name.trim(),
        description: addForm.description.trim() || null,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      hideModal("add_expenses_category");
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
      await apiService.updateAccountsExpenseCategory(id, {
        category_name: editForm.category_name.trim(),
        description: editForm.description.trim() || null,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      hideModal("edit_expenses_category");
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
      await apiService.deleteAccountsExpenseCategory(id);
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
      {" "}
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Expense Category</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Expense Category
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
          {/* /Page Header */}
          {loadError && (
            <div className="alert alert-danger" role="alert">
              {loadError}
            </div>
          )}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Expense Category List</h4>
              <div className="d-flex align-items-center flex-wrap">
              </div>
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
      {/* /Page Wrapper */}
      {/* Add */}
      <div className="modal fade" id="add_expenses_category">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Expense Category</h4>
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
                  <label className="form-label">Category Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={addForm.category_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, category_name: e.target.value }))}
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  />
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
      {/* Edit */}
      <div className="modal fade" id="edit_expenses_category">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Expense Category</h4>
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
                  <label className="form-label">Category Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.category_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, category_name: e.target.value }))}
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  />
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
                <p>
                  You want to delete all the marked items, this cant be undone
                  once you delete.
                </p>
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

export default ExpensesCategory;

