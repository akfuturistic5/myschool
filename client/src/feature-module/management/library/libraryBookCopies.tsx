import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import { all_routes } from "../../router/all_routes";
import { apiService } from "../../../core/services/apiService";
import LibraryToolbar from "./LibraryToolbar";
import { exportRowsToPdf, exportRowsToXlsx, printRowsToPage } from "./libraryTableExport";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { getLibraryErrorMessage } from "./libraryApiErrors";

const conditionOptions = ["New", "Good", "Damaged", "Lost", "Maintenance"];

const LibraryBookCopies = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [books, setBooks] = useState<{ value: string; label: string }[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState({ book_id: "", accession_number: "", condition: "" });
  const [filterDraft, setFilterDraft] = useState({ ...appliedFilters });
  const [addForm, setAddForm] = useState({ book_id: "", accession_number: "", book_location: "", condition: "New" });
  const [editForm, setEditForm] = useState({ book_id: "", accession_number: "", book_location: "", condition: "New" });

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
      const [res, booksRes] = await Promise.all([
        apiService.getLibraryBookCopies(appliedFilters),
        apiService.getLibraryBooks(),
      ]);
      const list = (res as any)?.data || [];
      setRows(list.map((r: any) => ({ ...r, key: r.id, id: String(r.id) })));
      const bookList = (booksRes as any)?.data || [];
      setBooks(bookList.map((b: any) => ({ value: String(b.id), label: b.book_title || `Book #${b.id}` })));
    } catch (e: unknown) {
      setLoadError(getLibraryErrorMessage(e, "Could not load book copies."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const tableExportHeaders = ["ID", "Book", "Accession No", "Location", "Condition", "Available", "Created"];
  const exportRows = useMemo(
    () =>
      rows.map((r) => [
        r.id,
        r.book_title || "",
        r.accession_number || "",
        r.book_location || "",
        r.condition || "",
        r.is_available ? "Yes" : "No",
        formatDateDMY(r.created_at),
      ]),
    [rows]
  );

  const openAdd = () => {
    setFormError(null);
    setAddForm({ book_id: "", accession_number: "", book_location: "", condition: "New" });
    setTimeout(() => showModal("add_library_book_copy"), 0);
  };

  const openEdit = (record: any) => {
    const r = record.raw || record;
    setSelected(r);
    setFormError(null);
    setEditForm({
      book_id: r.book_id != null ? String(r.book_id) : "",
      accession_number: r.accession_number || "",
      book_location: r.book_location || "",
      condition: r.condition || "New",
    });
    setTimeout(() => showModal("edit_library_book_copy"), 0);
  };

  const openDelete = (record: any) => {
    const r = record.raw || record;
    setSelected(r);
    setFormError(null);
    setTimeout(() => showModal("delete_library_book_copy_modal"), 0);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiService.createLibraryBookCopy({
        book_id: Number(addForm.book_id),
        accession_number: addForm.accession_number.trim(),
        book_location: addForm.book_location || null,
        condition: addForm.condition,
      });
      hideModal("add_library_book_copy");
      await load();
    } catch (e: unknown) {
      setFormError(getLibraryErrorMessage(e, "Could not create copy."));
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
      await apiService.updateLibraryBookCopy(selected.id, {
        book_id: Number(editForm.book_id),
        accession_number: editForm.accession_number.trim(),
        book_location: editForm.book_location || null,
        condition: editForm.condition,
      });
      hideModal("edit_library_book_copy");
      await load();
    } catch (e: unknown) {
      setFormError(getLibraryErrorMessage(e, "Could not update copy."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteLibraryBookCopy(selected.id);
      hideModal("delete_library_book_copy_modal");
      await load();
    } catch (e: unknown) {
      setFormError(getLibraryErrorMessage(e, "Could not delete copy."));
    } finally {
      setSaving(false);
    }
  };

  const tableData = rows.map((r: any) => ({
    ...r,
    book: r.book_title || "—",
    accessionNo: r.accession_number || "—",
    location: r.book_location || "—",
    condition: r.condition || "New",
    available: r.is_available ? "Yes" : "No",
    createdAt: formatDateDMY(r.created_at),
    raw: r,
  }));

  const columns = [
    { title: "ID", dataIndex: "id", sorter: (a: TableData, b: TableData) => String(a.id || "").localeCompare(String(b.id || "")) },
    { title: "Book", dataIndex: "book", sorter: (a: TableData, b: TableData) => String((a as any).book || "").localeCompare(String((b as any).book || "")) },
    { title: "Accession No", dataIndex: "accessionNo" },
    { title: "Location", dataIndex: "location" },
    { title: "Condition", dataIndex: "condition" },
    { title: "Available", dataIndex: "available" },
    { title: "Created", dataIndex: "createdAt" },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: any) => (
        <div className="d-flex align-items-center">
          <div className="dropdown">
            <Link to="#" className="btn btn-white btn-icon btn-sm rounded-circle p-0" data-bs-toggle="dropdown">
              <i className="ti ti-dots-vertical fs-14" />
            </Link>
            <ul className="dropdown-menu dropdown-menu-end p-2">
              <li>
                <Link className="dropdown-item rounded-1" to="#" onClick={(e) => { e.preventDefault(); openEdit(record); }}>
                  <i className="ti ti-edit-circle me-2" />
                  Edit
                </Link>
              </li>
              <li>
                <Link className="dropdown-item rounded-1" to="#" onClick={(e) => { e.preventDefault(); openDelete(record); }}>
                  <i className="ti ti-trash-x me-2" />
                  Delete
                </Link>
              </li>
            </ul>
          </div>
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
              <h3 className="page-title mb-1">Book Copies</h3>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center justify-content-end flex-wrap flex-row-reverse gap-2">
              <div className="mb-2">
                <button type="button" className="btn btn-primary" onClick={openAdd}>
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Copy
                </button>
              </div>
              <LibraryToolbar onRefresh={load} onExportExcel={() => exportRowsToXlsx("library-book-copies.xlsx", "Book Copies", tableExportHeaders, exportRows)} onExportPdf={() => exportRowsToPdf("Library - Book Copies", tableExportHeaders, exportRows)} onPrint={() => printRowsToPage("Library - Book Copies", tableExportHeaders, exportRows)} />
            </div>
          </div>

          {loadError && <div className="alert alert-danger">{loadError}</div>}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Book Copies</h4>
              <div className="dropdown mb-3">
                <Link to="#" className="btn btn-outline-light bg-white dropdown-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside">
                  <i className="ti ti-filter me-2" />
                  Filter
                </Link>
                <div className="dropdown-menu drop-width" ref={dropdownMenuRef} onMouseDown={(e) => e.stopPropagation()}>
                  <form onSubmit={(e) => { e.preventDefault(); setAppliedFilters({ ...filterDraft }); dropdownMenuRef.current?.classList.remove("show"); }}>
                    <div className="d-flex align-items-center border-bottom p-3"><h4>Filter</h4></div>
                    <div className="p-3 border-bottom">
                      <div className="mb-3">
                        <label className="form-label">Book</label>
                        <select className="form-select" value={filterDraft.book_id} onChange={(e) => setFilterDraft((f) => ({ ...f, book_id: e.target.value }))}>
                          <option value="">All books</option>
                          {books.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Accession No</label>
                        <input className="form-control" value={filterDraft.accession_number} onChange={(e) => setFilterDraft((f) => ({ ...f, accession_number: e.target.value }))} />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Condition</label>
                        <select className="form-select" value={filterDraft.condition} onChange={(e) => setFilterDraft((f) => ({ ...f, condition: e.target.value }))}>
                          <option value="">All</option>
                          {conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="p-3 d-flex align-items-center justify-content-end">
                      <button type="button" className="btn btn-light me-2" onClick={() => { const empty = { book_id: "", accession_number: "", condition: "" }; setFilterDraft(empty); setAppliedFilters(empty); dropdownMenuRef.current?.classList.remove("show"); }}>Reset</button>
                      <button type="submit" className="btn btn-primary">Apply</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">{loading ? <div className="p-4 text-center text-muted">Loading copies...</div> : <Table dataSource={tableData} columns={columns} Selection={true} />}</div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_library_book_copy" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h4 className="modal-title">Add Book Copy</h4><button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button></div>
          <form onSubmit={submitAdd}><div className="modal-body">
            {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
            <div className="mb-3"><label className="form-label">Book <span className="text-danger">*</span></label><select className="form-select" required value={addForm.book_id} onChange={(e) => setAddForm((f) => ({ ...f, book_id: e.target.value }))}><option value="">Select</option>{books.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
            <div className="mb-3"><label className="form-label">Accession Number <span className="text-danger">*</span></label><input required className="form-control" value={addForm.accession_number} onChange={(e) => setAddForm((f) => ({ ...f, accession_number: e.target.value }))} /></div>
            <div className="mb-3"><label className="form-label">Book Location</label><input className="form-control" value={addForm.book_location} onChange={(e) => setAddForm((f) => ({ ...f, book_location: e.target.value }))} /></div>
            <div className="mb-0"><label className="form-label">Condition</label><select className="form-select" value={addForm.condition} onChange={(e) => setAddForm((f) => ({ ...f, condition: e.target.value }))}>{conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          </div><div className="modal-footer"><button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div></form>
        </div></div>
      </div>

      <div className="modal fade" id="edit_library_book_copy" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h4 className="modal-title">Edit Book Copy</h4><button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button></div>
          <form onSubmit={submitEdit}><div className="modal-body">
            {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
            <div className="mb-3"><label className="form-label">Book <span className="text-danger">*</span></label><select className="form-select" required value={editForm.book_id} onChange={(e) => setEditForm((f) => ({ ...f, book_id: e.target.value }))}><option value="">Select</option>{books.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
            <div className="mb-3"><label className="form-label">Accession Number <span className="text-danger">*</span></label><input required className="form-control" value={editForm.accession_number} onChange={(e) => setEditForm((f) => ({ ...f, accession_number: e.target.value }))} /></div>
            <div className="mb-3"><label className="form-label">Book Location</label><input className="form-control" value={editForm.book_location} onChange={(e) => setEditForm((f) => ({ ...f, book_location: e.target.value }))} /></div>
            <div className="mb-0"><label className="form-label">Condition</label><select className="form-select" value={editForm.condition} onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))}>{conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          </div><div className="modal-footer"><button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Update"}</button></div></form>
        </div></div>
      </div>

      <div className="modal fade" id="delete_library_book_copy_modal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-body text-center">
          {formError && <div className="alert alert-danger py-2 small text-start">{formError}</div>}
          <span className="avatar avatar-xl bg-transparent-danger text-danger mb-3"><i className="ti ti-trash-x fs-36" /></span>
          <h4 className="mb-1">Delete Book Copy</h4>
          <p className="mb-3">Are you sure you want to delete this copy?</p>
          <div className="d-flex justify-content-center"><button type="button" className="btn btn-light me-3" data-bs-dismiss="modal">Cancel</button><button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={saving}>{saving ? "Deleting..." : "Delete"}</button></div>
        </div></div></div>
      </div>
    </>
  );
};

export default LibraryBookCopies;
