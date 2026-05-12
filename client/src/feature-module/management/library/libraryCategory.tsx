import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable";
import CommonSelect from "../../../core/common/commonSelect";
import { status as statusOptions } from "../../../core/common/selectoption/selectoption";
import { all_routes } from "../../router/all_routes";
import { apiService } from "../../../core/services/apiService";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import LibraryToolbar from "./LibraryToolbar";
import { exportRowsToPdf, exportRowsToXlsx, printRowsToPage } from "./libraryTableExport";
import { getLibraryErrorMessage } from "./libraryApiErrors";

const emptyForm = { category_name: "", description: "", is_active: true };

const isCategoryActive = (r: any) => r.is_active !== false && r.is_active !== 0;

const LibraryCategory = () => {
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
  const [appliedFilters, setAppliedFilters] = useState({ status: "all" });
  const [filterDraft, setFilterDraft] = useState({ status: "all" });

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
      const res = await apiService.getLibraryCategories();
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
      setLoadError(getLibraryErrorMessage(e, "Could not load categories."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const st = appliedFilters.status;
    return rows.filter((r: any) => {
      const active = isCategoryActive(r);
      if (st === "active") return active;
      if (st === "inactive") return !active;
      return true;
    });
  }, [rows, appliedFilters.status]);

  const applyFiltersFromDraft = (e?: React.FormEvent) => {
    e?.preventDefault();
    setAppliedFilters({ ...filterDraft });
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const resetFilters = () => {
    const empty = { status: "all" };
    setFilterDraft(empty);
    setAppliedFilters(empty);
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const openAdd = () => {
    setFormError(null);
    setAddForm({ ...emptyForm });
    setTimeout(() => showModal("add_library_category"), 0);
  };

  const openEdit = (record: any) => {
    const row = record.raw || record;
    setSelected(row);
    setFormError(null);
    setEditForm({
      category_name: row.category_name || "",
      description: row.description || "",
      is_active: row.is_active !== false,
    });
    setTimeout(() => showModal("edit_library_category"), 0);
  };

  const openDelete = (record: any) => {
    const row = record.raw || record;
    setSelected(row);
    setFormError(null);
    setTimeout(() => showModal("delete_library_category"), 0);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiService.createLibraryCategory({
        category_name: addForm.category_name.trim(),
        description: addForm.description.trim() || null,
        is_active: addForm.is_active,
      });
      hideModal("add_library_category");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not create category."));
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
      await apiService.updateLibraryCategory(selected.id, {
        category_name: editForm.category_name.trim(),
        description: editForm.description.trim() || null,
        is_active: editForm.is_active,
      });
      hideModal("edit_library_category");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not update category."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteLibraryCategory(selected.id);
      hideModal("delete_library_category");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not delete category."));
    } finally {
      setSaving(false);
    }
  };

  const exportHeaders = ["ID", "Category Name", "Description", "Created On", "Status"];
  const exportRows = () =>
    filteredRows.map((r: any) => [
      r.id,
      r.category_name || "",
      r.description || "",
      formatDateDMY(r.created_at),
      isCategoryActive(r) ? "Active" : "Inactive",
    ]);

  const handleExportXlsx = async () => {
    await exportRowsToXlsx("library-categories.xlsx", "Categories", exportHeaders, exportRows());
  };

  const handleExportPdf = () => {
    exportRowsToPdf("Library - Categories", exportHeaders, exportRows());
  };

  const handlePrint = () => {
    printRowsToPage("Library - Categories", exportHeaders, exportRows());
  };

  const tableData = filteredRows.map((r: any) => ({
    ...r,
    categoryName: r.category_name || "—",
    descriptionText: r.description || "—",
    createdOn: formatDateDMY(r.created_at),
    statusLabel: isCategoryActive(r) ? "Active" : "Inactive",
    raw: r,
  }));

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: (a: TableData, b: TableData) => String(a.id || "").localeCompare(String(b.id || "")),
    },
    {
      title: "Category Name",
      dataIndex: "categoryName",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).categoryName || "").localeCompare(String((b as any).categoryName || "")),
    },
    {
      title: "Description",
      dataIndex: "descriptionText",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).descriptionText || "").localeCompare(String((b as any).descriptionText || "")),
    },
    {
      title: "Created On",
      dataIndex: "createdOn",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).createdOn || "").localeCompare(String((b as any).createdOn || "")),
    },
    {
      title: "Status",
      dataIndex: "statusLabel",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).statusLabel || "").localeCompare(String((b as any).statusLabel || "")),
      render: (text: string) =>
        text === "Active" ? (
          <span className="badge badge-soft-success d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1" />
            {text}
          </span>
        ) : (
          <span className="badge badge-soft-danger d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1" />
            {text}
          </span>
        ),
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
              <h3 className="page-title mb-1">Library Categories</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Categories
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center justify-content-end flex-wrap flex-row-reverse gap-2">
              <div className="mb-2">
                <button type="button" className="btn btn-primary" onClick={openAdd}>
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Category
                </button>
              </div>
              <LibraryToolbar
                onRefresh={load}
                onExportExcel={handleExportXlsx}
                onExportPdf={handleExportPdf}
                onPrint={handlePrint}
              />
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
                          <div className="col-md-12">
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
                <div className="p-4 text-center text-muted">Loading categories…</div>
              ) : (
                <Table dataSource={tableData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_library_category" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Category</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitAdd}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Category Name *</label>
                      <input
                        className="form-control"
                        required
                        value={addForm.category_name}
                        onChange={(e) => setAddForm((f) => ({ ...f, category_name: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={addForm.description}
                        onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                      <div className="status-title">
                        <h5>Status</h5>
                        <label className="form-label mb-0" htmlFor="add_library_category_status">
                          {addForm.is_active ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="add_library_category_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={addForm.is_active}
                          onChange={(e) =>
                            setAddForm((f) => ({ ...f, is_active: e.target.checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_library_category" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Category</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Category Name *</label>
                      <input
                        className="form-control"
                        required
                        value={editForm.category_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, category_name: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                      <div className="status-title">
                        <h5>Status</h5>
                        <label className="form-label mb-0" htmlFor="edit_library_category_status">
                          {editForm.is_active ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="edit_library_category_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, is_active: e.target.checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="delete_library_category" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon">
                <i className="ti ti-trash-x" />
              </span>
              <h4>Confirm Deletion</h4>
              <p className="mb-2">
                Delete category <strong>{selected?.category_name || ""}</strong>?
              </p>
              {formError && <p className="text-danger small">{formError}</p>}
              <div className="d-flex justify-content-center mt-3">
                <button type="button" className="btn btn-light me-3" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={saving}>
                  {saving ? "…" : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LibraryCategory;
