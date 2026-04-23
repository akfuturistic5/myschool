import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import { apiService } from "../../../core/services/apiService";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import LibraryToolbar from "./LibraryToolbar";
import { exportRowsToPdf, exportRowsToXlsx } from "./libraryTableExport";
import { downloadLibraryBooksImportTemplate, parseBooksImportFile } from "./libraryImportBooks";
import { getLibraryErrorMessage } from "./libraryApiErrors";
import { getFilterDropdownPopupContainer } from "./libraryFilterDatePicker";

const Books = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState({
    category_id: "",
    book_code: "",
    date_from: "",
    date_to: "",
  });
  const [filterDraft, setFilterDraft] = useState({ ...appliedFilters });
  /** Title sort from toolbar; API already returns title ASC — default matches server. */
  const [bookTitleSort, setBookTitleSort] = useState<"asc" | "desc">("asc");
  const sortDropdownRef = useRef<HTMLUListElement | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importModalFile, setImportModalFile] = useState<File | null>(null);
  const [importModalBusy, setImportModalBusy] = useState(false);
  const [importModalParseError, setImportModalParseError] = useState<string | null>(null);
  const [importModalResult, setImportModalResult] = useState<{
    created: number;
    failed: number;
    errors: { index: number; message: string }[];
  } | null>(null);

  const emptyForm = {
    book_title: "",
    book_code: "",
    author: "",
    isbn: "",
    publisher: "",
    publication_year: "" as string | number,
    category_id: "" as string | number,
    total_copies: 1,
    available_copies: 1,
    book_price: "" as string | number,
    book_location: "",
    description: "",
  };
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [booksRes, catRes] = await Promise.all([
        apiService.getLibraryBooks({
          category_id: appliedFilters.category_id || undefined,
          book_code: appliedFilters.book_code.trim() || undefined,
          date_from: appliedFilters.date_from || undefined,
          date_to: appliedFilters.date_to || undefined,
          ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
        }),
        apiService.getLibraryCategories(),
      ]);
      const list = (booksRes as any)?.data || [];
      setRows(
        list.map((r: any) => ({
          ...r,
          id: String(r.id),
          key: r.id,
        }))
      );
      const cats = (catRes as any)?.data || [];
      setCategories(
        cats.map((c: any) => ({ value: String(c.id), label: c.category_name || `Category ${c.id}` }))
      );
    } catch (e: unknown) {
      setLoadError(getLibraryErrorMessage(e, "Could not load books."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, academicYearId]);

  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    return [...rows].sort((a, b) => {
      const ta = String(a.book_title ?? "").toLowerCase();
      const tb = String(b.book_title ?? "").toLowerCase();
      const c = ta.localeCompare(tb, undefined, { sensitivity: "base" });
      return bookTitleSort === "asc" ? c : -c;
    });
  }, [rows, bookTitleSort]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFiltersFromDraft = () => {
    setAppliedFilters({ ...filterDraft });
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const resetFilters = () => {
    const empty = { category_id: "", book_code: "", date_from: "", date_to: "" };
    setFilterDraft(empty);
    setAppliedFilters(empty);
  };

  const tableExportHeaders = [
    "ID",
    "Book Name",
    "Book No",
    "Publisher",
    "Author",
    "Subject",
    "Rack No",
    "Qty",
    "Available",
    "Price",
    "Post Date",
  ];

  const buildBookExportRows = () =>
    sortedRows.map((r) => [
      r.id,
      r.book_title,
      r.book_code || r.isbn || "",
      r.publisher || "",
      r.author || "",
      r.category_name || "",
      r.book_location || "",
      r.total_copies ?? "",
      r.available_copies ?? "",
      r.book_price ?? "",
      formatDateDMY(r.postDate || r.created_at),
    ]);

  const handleExportXlsx = async () => {
    setExportBusy(true);
    try {
      await exportRowsToXlsx("library-books.xlsx", "Books", tableExportHeaders, buildBookExportRows());
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportPdf = () => {
    setExportBusy(true);
    try {
      exportRowsToPdf("Library — Books", tableExportHeaders, buildBookExportRows());
    } finally {
      setExportBusy(false);
    }
  };

  const openImportModal = () => {
    setImportModalFile(null);
    setImportModalResult(null);
    setImportModalParseError(null);
    setTimeout(() => showModal("library_import_books_modal"), 0);
  };

  const runImportFromModal = async () => {
    if (!importModalFile) {
      setImportModalParseError("Choose a file first.");
      return;
    }
    setImportModalBusy(true);
    setImportModalParseError(null);
    setImportModalResult(null);
    try {
      const books = await parseBooksImportFile(importModalFile);
      if (!books.length) {
        setImportModalParseError(
          'No data rows found. Use the "Data" sheet with headers (book_title, category, total_copies, …).'
        );
        return;
      }
      const res = await apiService.importLibraryBooks({
        books,
        academic_year_id: academicYearId ?? undefined,
      });
      const d = (res as any)?.data;
      setImportModalResult({
        created: d?.created ?? 0,
        failed: d?.failed ?? 0,
        errors: Array.isArray(d?.errors) ? d.errors : [],
      });
      await load();
    } catch (e: unknown) {
      setImportModalParseError(getLibraryErrorMessage(e, "Could not import books."));
    } finally {
      setImportModalBusy(false);
    }
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

  const openAdd = () => {
    setFormError(null);
    setAddForm({ ...emptyForm });
    setTimeout(() => showModal("add_library_book"), 0);
  };

  const openEdit = (record: any) => {
    setFormError(null);
    const r = record.raw || record;
    setSelected(r);
    setEditForm({
      book_title: r.book_title || "",
      book_code: r.book_code || "",
      author: r.author || "",
      isbn: r.isbn || "",
      publisher: r.publisher || "",
      publication_year: r.publication_year ?? "",
      category_id: r.category_id != null ? String(r.category_id) : "",
      total_copies: r.total_copies ?? 1,
      available_copies: r.available_copies ?? 1,
      book_price: r.book_price ?? "",
      book_location: r.book_location || "",
      description: r.description || "",
    });
    setTimeout(() => showModal("edit_library_book"), 0);
  };

  const openDelete = (record: any) => {
    const r = record.raw || record;
    setSelected(r);
    setFormError(null);
    setTimeout(() => showModal("delete_library_book_modal"), 0);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const tc = Number(addForm.total_copies) || 1;
      let ac = Number(addForm.available_copies);
      if (!Number.isFinite(ac)) ac = tc;
      ac = Math.min(Math.max(0, ac), tc);
      const payload: any = {
        book_title: addForm.book_title.trim(),
        book_code: addForm.book_code || null,
        author: addForm.author || null,
        isbn: addForm.isbn || null,
        publisher: addForm.publisher || null,
        publication_year: addForm.publication_year === "" ? null : Number(addForm.publication_year),
        category_id: addForm.category_id === "" ? null : Number(addForm.category_id),
        total_copies: tc,
        available_copies: ac,
        book_price: addForm.book_price === "" ? null : Number(addForm.book_price),
        book_location: addForm.book_location || null,
        description: addForm.description || null,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      };
      await apiService.createLibraryBook(payload);
      hideModal("add_library_book");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not save book."));
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
      const payload: any = {
        book_title: editForm.book_title.trim(),
        book_code: editForm.book_code || null,
        author: editForm.author || null,
        isbn: editForm.isbn || null,
        publisher: editForm.publisher || null,
        publication_year: editForm.publication_year === "" ? null : Number(editForm.publication_year),
        category_id: editForm.category_id === "" ? null : Number(editForm.category_id),
        total_copies: Number(editForm.total_copies) || 1,
        available_copies: Number(editForm.available_copies) || 0,
        book_price: editForm.book_price === "" ? null : Number(editForm.book_price),
        book_location: editForm.book_location || null,
        description: editForm.description || null,
        is_active: true,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      };
      await apiService.updateLibraryBook(selected.id, payload);
      hideModal("edit_library_book");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not update book."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteLibraryBook(selected.id);
      hideModal("delete_library_book_modal");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not delete book."));
    } finally {
      setSaving(false);
    }
  };

  const tableData = sortedRows.map((r) => ({
    ...r,
    bookName: r.book_title,
    bookNo: r.book_code || r.isbn || "—",
    publisher: r.publisher || "—",
    author: r.author || "—",
    subject: r.category_name || r.subject || "—",
    rackNo: r.book_location || "—",
    qty: String(r.total_copies ?? ""),
    available: String(r.available_copies ?? ""),
    price: r.book_price != null ? String(r.book_price) : "—",
    postDate: formatDateDMY(r.postDate || r.created_at),
    raw: r,
  }));

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: string) => (
        <Link to="#" className="link-primary" onClick={(e) => e.preventDefault()}>
          {text}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) =>
        String(a.id || "").localeCompare(String(b.id || "")),
    },
    {
      title: "Book Name",
      dataIndex: "bookName",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).bookName || "").localeCompare(String((b as any).bookName || "")),
    },
    {
      title: "Book No",
      dataIndex: "bookNo",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).bookNo || "").localeCompare(String((b as any).bookNo || "")),
    },
    {
      title: "Publisher",
      dataIndex: "publisher",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).publisher || "").localeCompare(String((b as any).publisher || "")),
    },
    {
      title: "Author",
      dataIndex: "author",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).author || "").localeCompare(String((b as any).author || "")),
    },
    {
      title: "Subject",
      dataIndex: "subject",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).subject || "").localeCompare(String((b as any).subject || "")),
    },
    {
      title: "Rack No",
      dataIndex: "rackNo",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).rackNo || "").localeCompare(String((b as any).rackNo || "")),
    },
    {
      title: "Qty",
      dataIndex: "qty",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).qty || "").localeCompare(String((b as any).qty || "")),
    },
    {
      title: "Available",
      dataIndex: "available",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).available || "").localeCompare(String((b as any).available || "")),
    },
    {
      title: "Price",
      dataIndex: "price",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).price || "").localeCompare(String((b as any).price || "")),
    },
    {
      title: "Post Date",
      dataIndex: "postDate",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).postDate || "").localeCompare(String((b as any).postDate || "")),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: any) => (
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
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Books</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Books
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <LibraryToolbar
                onRefresh={load}
                onExportExcel={handleExportXlsx}
                onExportPdf={handleExportPdf}
                extra={
                  <div className="mb-2 me-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={openImportModal}
                      disabled={exportBusy}
                    >
                      <i className="ti ti-upload me-1" />
                      Import books
                    </button>
                  </div>
                }
              />
              <div className="mb-2">
                <button type="button" className="btn btn-primary" onClick={openAdd}>
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Book
                </button>
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
              <h4 className="mb-3">Books</h4>
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
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        applyFiltersFromDraft();
                      }}
                    >
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Category</label>
                              <select
                                className="form-select"
                                value={filterDraft.category_id}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({ ...f, category_id: e.target.value }))
                                }
                              >
                                <option value="">All</option>
                                {categories.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Book / accession no.</label>
                              <input
                                className="form-control"
                                placeholder="Contains…"
                                value={filterDraft.book_code}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({ ...f, book_code: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Added from</label>
                              <DatePicker
                                className="w-100"
                                format="DD-MM-YYYY"
                                allowClear
                                getPopupContainer={getFilterDropdownPopupContainer}
                                value={
                                  filterDraft.date_from
                                    ? dayjs(filterDraft.date_from, "YYYY-MM-DD")
                                    : null
                                }
                                onChange={(d: Dayjs | null) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    date_from: d ? d.format("YYYY-MM-DD") : "",
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Added to</label>
                              <DatePicker
                                className="w-100"
                                format="DD-MM-YYYY"
                                allowClear
                                getPopupContainer={getFilterDropdownPopupContainer}
                                value={
                                  filterDraft.date_to
                                    ? dayjs(filterDraft.date_to, "YYYY-MM-DD")
                                    : null
                                }
                                onChange={(d: Dayjs | null) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    date_to: d ? d.format("YYYY-MM-DD") : "",
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button
                          type="button"
                          className="btn btn-light me-3"
                          onClick={() => {
                            resetFilters();
                            if (dropdownMenuRef.current) {
                              dropdownMenuRef.current.classList.remove("show");
                            }
                          }}
                        >
                          Reset
                        </button>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="dropdown mb-3">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                    onClick={(e) => e.preventDefault()}
                  >
                    <i
                      className={`ti me-2 ${bookTitleSort === "asc" ? "ti-sort-ascending-2" : "ti-sort-descending-2"}`}
                    />
                    {bookTitleSort === "asc" ? "Sort: A–Z" : "Sort: Z–A"}
                  </Link>
                  <ul className="dropdown-menu p-3" ref={sortDropdownRef}>
                    <li>
                      <button
                        type="button"
                        className={`dropdown-item rounded-1 text-start w-100 border-0 bg-transparent ${bookTitleSort === "asc" ? "active" : ""}`}
                        onClick={() => {
                          setBookTitleSort("asc");
                          sortDropdownRef.current?.classList.remove("show");
                        }}
                      >
                        Ascending (A–Z)
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={`dropdown-item rounded-1 text-start w-100 border-0 bg-transparent ${bookTitleSort === "desc" ? "active" : ""}`}
                        onClick={() => {
                          setBookTitleSort("desc");
                          sortDropdownRef.current?.classList.remove("show");
                        }}
                      >
                        Descending (Z–A)
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading ? (
                <div className="p-4 text-center text-muted">Loading books…</div>
              ) : (
                <Table dataSource={tableData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Book */}
      <div className="modal fade" id="add_library_book" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Book</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitAdd}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger py-2 small" role="alert">
                    {formError}
                  </div>
                )}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Book Name *</label>
                    <input
                      className="form-control"
                      required
                      value={addForm.book_title}
                      onChange={(e) => setAddForm((f) => ({ ...f, book_title: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Book No / Accession</label>
                    <input
                      className="form-control"
                      value={addForm.book_code}
                      onChange={(e) => setAddForm((f) => ({ ...f, book_code: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">ISBN</label>
                    <input
                      className="form-control"
                      value={addForm.isbn}
                      onChange={(e) => setAddForm((f) => ({ ...f, isbn: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={addForm.category_id}
                      onChange={(e) => setAddForm((f) => ({ ...f, category_id: e.target.value }))}
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Publisher</label>
                    <input
                      className="form-control"
                      value={addForm.publisher}
                      onChange={(e) => setAddForm((f) => ({ ...f, publisher: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Author</label>
                    <input
                      className="form-control"
                      value={addForm.author}
                      onChange={(e) => setAddForm((f) => ({ ...f, author: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Publication year</label>
                    <input
                      type="number"
                      className="form-control"
                      value={addForm.publication_year}
                      onChange={(e) => setAddForm((f) => ({ ...f, publication_year: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={addForm.total_copies}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, total_copies: Number(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Available</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      value={addForm.available_copies}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, available_copies: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Rack / Location</label>
                    <input
                      className="form-control"
                      value={addForm.book_location}
                      onChange={(e) => setAddForm((f) => ({ ...f, book_location: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={addForm.book_price}
                      onChange={(e) => setAddForm((f) => ({ ...f, book_price: e.target.value }))}
                    />
                  </div>
                  <div className="col-12 mb-0">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={addForm.description}
                      onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Book */}
      <div className="modal fade" id="edit_library_book" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Book</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger py-2 small" role="alert">
                    {formError}
                  </div>
                )}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Book Name *</label>
                    <input
                      className="form-control"
                      required
                      value={editForm.book_title}
                      onChange={(e) => setEditForm((f) => ({ ...f, book_title: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Book No / Accession</label>
                    <input
                      className="form-control"
                      value={editForm.book_code}
                      onChange={(e) => setEditForm((f) => ({ ...f, book_code: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">ISBN</label>
                    <input
                      className="form-control"
                      value={editForm.isbn}
                      onChange={(e) => setEditForm((f) => ({ ...f, isbn: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={editForm.category_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value }))}
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Publisher</label>
                    <input
                      className="form-control"
                      value={editForm.publisher}
                      onChange={(e) => setEditForm((f) => ({ ...f, publisher: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Author</label>
                    <input
                      className="form-control"
                      value={editForm.author}
                      onChange={(e) => setEditForm((f) => ({ ...f, author: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Publication year</label>
                    <input
                      type="number"
                      className="form-control"
                      value={editForm.publication_year}
                      onChange={(e) => setEditForm((f) => ({ ...f, publication_year: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={editForm.total_copies}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, total_copies: Number(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Available</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      value={editForm.available_copies}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, available_copies: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Rack / Location</label>
                    <input
                      className="form-control"
                      value={editForm.book_location}
                      onChange={(e) => setEditForm((f) => ({ ...f, book_location: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editForm.book_price}
                      onChange={(e) => setEditForm((f) => ({ ...f, book_price: e.target.value }))}
                    />
                  </div>
                  <div className="col-12 mb-0">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    />
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

      {/* Import books */}
      <div className="modal fade" id="library_import_books_modal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Import books</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                Upload an Excel (<code>.xlsx</code>) or CSV file. Required columns:{" "}
                <strong>book_title</strong>, <strong>category</strong> (name or id), <strong>total_copies</strong>.
                Use the <strong>Data</strong> sheet in the template (ignore the Guide sheet when saving).
              </p>
              <div className="mb-3">
                <label className="form-label">File</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  disabled={importModalBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setImportModalFile(f);
                    setImportModalResult(null);
                    setImportModalParseError(null);
                  }}
                />
              </div>
              <div className="mb-3">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={downloadLibraryBooksImportTemplate}
                  disabled={importModalBusy}
                >
                  <i className="ti ti-download me-1" />
                  Download sample Excel template
                </button>
                <div className="form-text">Includes Guide (required vs optional) and Data with a demo row.</div>
              </div>
              {importModalParseError && (
                <div className="alert alert-danger py-2 small" role="alert">
                  {importModalParseError}
                </div>
              )}
              {importModalResult && (
                <div className="border rounded p-3 bg-light">
                  <p className="mb-2 fw-medium">
                    <span className="text-success">Created: {importModalResult.created}</span>
                    {" · "}
                    <span className={importModalResult.failed > 0 ? "text-warning" : "text-muted"}>
                      Skipped / failed: {importModalResult.failed}
                    </span>
                  </p>
                  {importModalResult.errors.length > 0 && (
                    <>
                      <p className="small text-muted mb-1">Row errors (0-based index):</p>
                      <div
                        className="small font-monospace border rounded bg-white p-2"
                        style={{ maxHeight: 220, overflowY: "auto" }}
                      >
                        {importModalResult.errors.slice(0, 80).map((err, i) => (
                          <div key={`${err.index}-${i}`}>
                            Row {err.index}: {err.message}
                          </div>
                        ))}
                        {importModalResult.errors.length > 80 && (
                          <div className="text-muted">… and {importModalResult.errors.length - 80} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importModalBusy || !importModalFile}
                onClick={runImportFromModal}
              >
                {importModalBusy ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete */}
      <div className="modal fade" id="delete_library_book_modal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon">
                <i className="ti ti-trash-x" />
              </span>
              <h4>Confirm Deletion</h4>
              <p className="mb-2">
                Deactivate book <strong>{selected?.book_title || ""}</strong>? Active issues must be returned first.
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

export default Books;

