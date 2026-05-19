import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import { all_routes } from "../../router/all_routes";
import { apiService } from "../../../core/services/apiService";
import LibraryToolbar from "./LibraryToolbar";
import { exportRowsToPdf, exportRowsToXlsx, printRowsToPage } from "./libraryTableExport";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { getLibraryErrorMessage } from "./libraryApiErrors";
import { LibrarySearchableSelect } from "./librarySearchableSelect";

const conditionOptions = ["New", "Good", "Damaged", "Lost", "Maintenance"];

const LibraryBookCopies = () => {
  const routes = all_routes;
  const [searchParams, setSearchParams] = useSearchParams();
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [books, setBooks] = useState<{ value: string; label: string }[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const initialBookId = searchParams.get("book_id") || "";
  const [appliedFilters, setAppliedFilters] = useState({ book_id: initialBookId, accession_number: "", condition: "" });
  const [filterDraft, setFilterDraft] = useState({ ...appliedFilters });
  const [addForm, setAddForm] = useState({
    book_id: "",
    accession_number: "",
    book_location: "",
    condition: "New",
    copy_price: "" as string | number,
    quantity: 1,
  });
  const [editForm, setEditForm] = useState({
    book_id: "",
    accession_number: "",
    book_location: "",
    condition: "New",
    copy_price: "" as string | number,
  });

  const [bulkCopies, setBulkCopies] = useState<any[]>([]);

  const adjustBulkCopies = (
    qty: number,
    baseAccession: string,
    baseLocation: string,
    baseCondition: string,
    basePrice: string | number
  ) => {
    let prefix = '';
    let suffixNum = null;
    let paddingLen = 0;

    const match = /^(.*?)(\d+)$/.exec(baseAccession);
    if (match) {
      prefix = match[1];
      suffixNum = parseInt(match[2], 10);
      paddingLen = match[2].length;
    }

    setBulkCopies((prev) => {
      const result = [...prev];
      if (result.length > qty) {
        return result.slice(0, qty);
      }
      while (result.length < qty) {
        const i = result.length;
        let accNum = baseAccession;
        if (suffixNum !== null) {
          accNum = prefix + String(suffixNum + i).padStart(paddingLen, '0');
        } else {
          accNum = i > 0 ? `${baseAccession}-${i + 1}` : baseAccession;
        }
        result.push({
          accession_number: accNum,
          book_location: baseLocation,
          condition: baseCondition,
          copy_price: basePrice
        });
      }
      return result;
    });
  };

  const handleBulkCopyChange = (index: number, field: string, value: any) => {
    setBulkCopies((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleQuantityChange = (qty: number) => {
    const q = Math.max(1, qty);
    setAddForm((f) => {
      const nextForm = { ...f, quantity: q };
      adjustBulkCopies(q, nextForm.accession_number, nextForm.book_location, nextForm.condition, nextForm.copy_price);
      return nextForm;
    });
  };

  const handleStartingAccessionChange = (acc: string) => {
    setAddForm((f) => {
      const nextForm = { ...f, accession_number: acc };
      if (f.quantity === 1) {
        setBulkCopies([{
          accession_number: acc,
          book_location: f.book_location,
          condition: f.condition,
          copy_price: f.copy_price
        }]);
      } else {
        let prefix = '';
        let suffixNum = null;
        let paddingLen = 0;

        const match = /^(.*?)(\d+)$/.exec(acc);
        if (match) {
          prefix = match[1];
          suffixNum = parseInt(match[2], 10);
          paddingLen = match[2].length;
        }

        setBulkCopies((prev) =>
          prev.map((item, i) => {
            let accNum = acc;
            if (i > 0) {
              if (suffixNum !== null) {
                accNum = prefix + String(suffixNum + i).padStart(paddingLen, '0');
              } else {
                accNum = `${acc}-${i + 1}`;
              }
            }
            return {
              ...item,
              accession_number: accNum
            };
          })
        );
      }
      return nextForm;
    });
  };

  const handleBaseFieldChange = (field: string, value: any) => {
    setAddForm((f) => {
      const nextForm = { ...f, [field]: value };
      setBulkCopies((prev) =>
        prev.map((item, i) => {
          if (i === 0 || item[field] === (f as any)[field]) {
            return { ...item, [field]: value };
          }
          return item;
        })
      );
      return nextForm;
    });
  };

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

  const tableExportHeaders = ["ID", "Book", "Accession No", "Location", "Condition", "Price", "Available", "Created"];
  const exportRows = useMemo(
    () =>
      rows.map((r) => [
        r.id,
        r.book_title || "",
        r.accession_number || "",
        r.book_location || "",
        r.condition || "",
        r.copy_price != null && r.copy_price !== "" ? String(r.copy_price) : "",
        r.is_available ? "Yes" : "No",
        formatDateDMY(r.created_at),
      ]),
    [rows]
  );

  const openAdd = (bookId?: string) => {
    setFormError(null);
    void (async () => {
      let acc = "";
      try {
        const res = await apiService.getLibraryNextBookAccessionNumber();
        acc = (res as any)?.data?.accession_number ?? "";
      } catch {
        const maxSeq = rows.reduce((accN, r) => {
          const c = String(r.accession_number || "").trim();
          const m = /^ACC-(\d+)$/i.exec(c);
          return m ? Math.max(accN, parseInt(m[1], 10)) : accN;
        }, 0);
        acc = `ACC-${String(maxSeq + 1).padStart(5, "0")}`;
      }
      setAddForm({
        book_id: bookId || "",
        accession_number: acc,
        book_location: "",
        condition: "New",
        copy_price: "",
        quantity: 1,
      });
      setBulkCopies([
        {
          accession_number: acc,
          book_location: "",
          condition: "New",
          copy_price: "",
        },
      ]);
      setTimeout(() => showModal("add_library_book_copy"), 0);
    })();
  };

  useEffect(() => {
    const targetBookId = searchParams.get("book_id");
    const shouldAddCopy = searchParams.get("add_copy") === "true";
    if (targetBookId && shouldAddCopy && !loading && books.length > 0) {
      setSearchParams({ book_id: targetBookId }, { replace: true });
      openAdd(targetBookId);
    }
  }, [searchParams, loading, books, setSearchParams]);

  const openEdit = (record: any) => {
    const r = record.raw || record;
    setSelected(r);
    setFormError(null);
    setEditForm({
      book_id: r.book_id != null ? String(r.book_id) : "",
      accession_number: r.accession_number || "",
      book_location: r.book_location || "",
      condition: r.condition || "New",
      copy_price: r.copy_price ?? "",
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
    if (!String(addForm.book_id).trim()) {
      setFormError("Please select a book.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      let payload: any = {
        book_id: Number(addForm.book_id),
      };
      if (addForm.quantity > 1) {
        payload.copies = bulkCopies.map((item) => ({
          accession_number: item.accession_number.trim(),
          book_location: item.book_location || null,
          condition: item.condition || "New",
          copy_price: item.copy_price === "" || item.copy_price === undefined
            ? null
            : (Number.isFinite(Number(item.copy_price)) ? Number(item.copy_price) : null),
        }));
      } else {
        payload.accession_number = addForm.accession_number.trim();
        payload.book_location = addForm.book_location || null;
        payload.condition = addForm.condition;
        payload.copy_price = addForm.copy_price === "" || addForm.copy_price === undefined
          ? null
          : (Number.isFinite(Number(addForm.copy_price)) ? Number(addForm.copy_price) : null);
      }

      await apiService.createLibraryBookCopy(payload);
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
    if (!String(editForm.book_id).trim()) {
      setFormError("Please select a book.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiService.updateLibraryBookCopy(selected.id, {
        book_id: Number(editForm.book_id),
        accession_number: editForm.accession_number.trim(),
        book_location: editForm.book_location || null,
        condition: editForm.condition,
        copy_price:
          editForm.copy_price === "" || editForm.copy_price === undefined
            ? null
            : (Number.isFinite(Number(editForm.copy_price)) ? Number(editForm.copy_price) : null),
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
    copyPrice: r.copy_price != null && r.copy_price !== "" ? String(r.copy_price) : "—",
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
    { title: "Price", dataIndex: "copyPrice" },
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
                        <LibrarySearchableSelect
                          allowClear
                          options={books}
                          value={filterDraft.book_id}
                          onChange={(v) => setFilterDraft((f) => ({ ...f, book_id: v }))}
                          placeholder="All books — search…"
                        />
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
        <div className={`modal-dialog modal-dialog-centered ${addForm.quantity > 1 ? "modal-lg" : ""}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Book Copy</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitAdd}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                
                <div className="mb-3">
                  <label className="form-label">Book <span className="text-danger">*</span></label>
                  <LibrarySearchableSelect
                    options={books}
                    value={addForm.book_id}
                    onChange={(v) => handleBaseFieldChange("book_id", v)}
                    placeholder="Search book…"
                  />
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Accession number <span className="text-danger">*</span></label>
                    <input
                      required
                      className="form-control"
                      value={addForm.accession_number}
                      onChange={(e) => handleStartingAccessionChange(e.target.value)}
                    />
                    <small className="text-muted text-truncate d-block">Suggested starting serial.</small>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Number of Copies <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      className="form-control"
                      value={addForm.quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                    />
                    <small className="text-muted d-block">Copies to create (1-100).</small>
                  </div>
                </div>

                {addForm.quantity === 1 ? (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Book Location</label>
                      <input
                        className="form-control"
                        value={addForm.book_location}
                        onChange={(e) => handleBaseFieldChange("book_location", e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Price</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-control"
                        value={addForm.copy_price}
                        onChange={(e) => handleBaseFieldChange("copy_price", e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Condition</label>
                      <select
                        className="form-select"
                        value={addForm.condition}
                        onChange={(e) => handleBaseFieldChange("condition", e.target.value)}
                      >
                        {conditionOptions.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 border rounded p-3 bg-light">
                    <h5 className="mb-3">Configure Individual Copies</h5>
                    <div style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden" }}>
                      {bulkCopies.map((item, idx) => (
                        <div key={idx} className="row g-2 align-items-center mb-3 pb-3 border-bottom">
                          <div className="col-12 col-md-1 text-muted fw-bold text-center">
                            #{idx + 1}
                          </div>
                          <div className="col-12 col-md-3">
                            <label className="form-label small mb-1 text-secondary">Accession No *</label>
                            <input
                              required
                              className="form-control form-control-sm"
                              value={item.accession_number}
                              onChange={(e) => handleBulkCopyChange(idx, "accession_number", e.target.value)}
                            />
                          </div>
                          <div className="col-12 col-md-3">
                            <label className="form-label small mb-1 text-secondary">Condition</label>
                            <select
                              className="form-select form-select-sm"
                              value={item.condition}
                              onChange={(e) => handleBulkCopyChange(idx, "condition", e.target.value)}
                            >
                              {conditionOptions.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-md-3">
                            <label className="form-label small mb-1 text-secondary">Location</label>
                            <input
                              className="form-control form-control-sm"
                              placeholder="Location"
                              value={item.book_location}
                              onChange={(e) => handleBulkCopyChange(idx, "book_location", e.target.value)}
                            />
                          </div>
                          <div className="col-12 col-md-2">
                            <label className="form-label small mb-1 text-secondary">Price</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="form-control form-control-sm"
                              placeholder="Price"
                              value={item.copy_price}
                              onChange={(e) => handleBulkCopyChange(idx, "copy_price", e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_library_book_copy" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h4 className="modal-title">Edit Book Copy</h4><button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button></div>
          <form onSubmit={submitEdit}><div className="modal-body">
            {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
            <div className="mb-3"><label className="form-label">Book <span className="text-danger">*</span></label><LibrarySearchableSelect options={books} value={editForm.book_id} onChange={(v) => setEditForm((f) => ({ ...f, book_id: v }))} placeholder="Search book…" /></div>
            <div className="mb-3"><label className="form-label">Accession number <span className="text-danger">*</span></label><input required className="form-control" value={editForm.accession_number} onChange={(e) => setEditForm((f) => ({ ...f, accession_number: e.target.value }))} /><small className="text-muted">Editable; suggested format ACC-00001.</small></div>
            <div className="mb-3"><label className="form-label">Book Location</label><input className="form-control" value={editForm.book_location} onChange={(e) => setEditForm((f) => ({ ...f, book_location: e.target.value }))} /></div>
            <div className="mb-3"><label className="form-label">Price</label><input type="number" min={0} step="0.01" className="form-control" value={editForm.copy_price} onChange={(e) => setEditForm((f) => ({ ...f, copy_price: e.target.value }))} placeholder="Optional" /></div>
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
