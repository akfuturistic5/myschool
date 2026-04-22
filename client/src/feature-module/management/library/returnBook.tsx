import { useRef, useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { apiService } from "../../../core/services/apiService";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import LibraryToolbar from "./LibraryToolbar";
import { exportRowsToPdf, exportRowsToXlsx } from "./libraryTableExport";
import { getLibraryErrorMessage } from "./libraryApiErrors";
import { getFilterDropdownPopupContainer } from "./libraryFilterDatePicker";

const ReturnBook = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [books, setBooks] = useState<{ value: string; label: string }[]>([]);
  const [members, setMembers] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [returnForm, setReturnForm] = useState({ fine_amount: "", remarks: "" });
  const [appliedFilters, setAppliedFilters] = useState({
    book_id: "",
    member_id: "",
    issue_date_from: "",
    issue_date_to: "",
  });
  const [filterDraft, setFilterDraft] = useState({ ...appliedFilters });

  const loadRefs = useCallback(async () => {
    try {
      const ay = academicYearId != null ? { academic_year_id: academicYearId } : {};
      const [bRes, mRes] = await Promise.all([
        apiService.getLibraryBooks(ay),
        apiService.getLibraryMembers(ay),
      ]);
      const bl = (bRes as any)?.data || [];
      setBooks(
        bl.map((b: any) => ({
          value: String(b.id),
          label: b.book_title || `Book #${b.id}`,
        }))
      );
      const ml = (mRes as any)?.data || [];
      setMembers(
        ml.map((m: any) => ({
          value: String(m.id),
          label: `${m.card_number || m.cardNo || m.id} — ${m.name || m.member_name || "Member"} (${m.member_type})`,
        }))
      );
    } catch {
      /* ignore */
    }
  }, [academicYearId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getLibraryIssues({
        status: "issued",
        book_id: appliedFilters.book_id || undefined,
        member_id: appliedFilters.member_id || undefined,
        issue_date_from: appliedFilters.issue_date_from || undefined,
        issue_date_to: appliedFilters.issue_date_to || undefined,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      const list = (res as any)?.data || [];
      setRows(
        list.map((r: any) => ({
          ...r,
          id: String(r.id),
          key: r.id,
        }))
      );
    } catch (e: unknown) {
      setLoadError(getLibraryErrorMessage(e, "Could not load open issues."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, academicYearId]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFiltersFromDraft = () => {
    setAppliedFilters({ ...filterDraft });
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const resetFilters = () => {
    const empty = {
      book_id: "",
      member_id: "",
      issue_date_from: "",
      issue_date_to: "",
    };
    setFilterDraft(empty);
    setAppliedFilters(empty);
  };

  const returnExportHeaders = ["ID", "Issued", "Due", "Borrower", "Book", "Returned", "Remarks"];
  const buildReturnExportRows = () =>
    rows.map((r) => [
      r.id,
      formatDateDMY(r.dateofIssue),
      formatDateDMY(r.dueDate),
      r.issueTo,
      r.booksIssued || r.book_title,
      r.bookReturned,
      r.issueRemarks,
    ]);

  const handleExportXlsx = async () => {
    await exportRowsToXlsx("library-return-open.xlsx", "Return", returnExportHeaders, buildReturnExportRows());
  };

  const handleExportPdf = () => {
    exportRowsToPdf("Library — Return (open issues)", returnExportHeaders, buildReturnExportRows());
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
    bootstrap?.Modal?.getInstance(el)?.hide();
  };

  const openReturn = (record: any) => {
    const r = record.raw || record;
    setSelected(r);
    setFormError(null);
    setReturnForm({ fine_amount: "", remarks: "" });
    setTimeout(() => showModal("library_return_modal"), 0);
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.returnLibraryIssue(selected.id, {
        fine_amount: returnForm.fine_amount === "" ? 0 : Number(returnForm.fine_amount),
        remarks: returnForm.remarks || null,
        status: "returned",
      });
      hideModal("library_return_modal");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not record return."));
    } finally {
      setSaving(false);
    }
  };

  const tableData = rows.map((r) => ({
    ...r,
    dateofIssue: formatDateDMY(r.dateofIssue),
    dueDate: formatDateDMY(r.dueDate),
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
      sorter: (a: TableData, b: TableData) => String(a.id || "").localeCompare(String(b.id || "")),
    },
    {
      title: "Date of Issue",
      dataIndex: "dateofIssue",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).dateofIssue || "").localeCompare(String((b as any).dateofIssue || "")),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).dueDate || "").localeCompare(String((b as any).dueDate || "")),
    },
    {
      title: "Issue To",
      dataIndex: "issueTo",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <span className="avatar avatar-md">
            <ImageWithBasePath
              src={record.img}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </span>
          <div className="ms-2">
            <p className="text-dark mb-0">{text}</p>
            <span className="fs-12">{record.class}</span>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) =>
        String((a as any).issueTo || "").localeCompare(String((b as any).issueTo || "")),
    },
    {
      title: "Book",
      dataIndex: "booksIssued",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).booksIssued || "").localeCompare(String((b as any).booksIssued || "")),
    },
    {
      title: "Returned",
      dataIndex: "bookReturned",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).bookReturned || "").localeCompare(String((b as any).bookReturned || "")),
    },
    {
      title: "Remarks",
      dataIndex: "issueRemarks",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).issueRemarks || "").localeCompare(String((b as any).issueRemarks || "")),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: any) => (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => openReturn(record)}>
          Return
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Return Books</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Return Books
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <LibraryToolbar
                onRefresh={load}
                onExportExcel={handleExportXlsx}
                onExportPdf={handleExportPdf}
              />
            </div>
          </div>

          {loadError && <div className="alert alert-danger">{loadError}</div>}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Open issues (return)</h4>
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
                              <label className="form-label">Book</label>
                              <select
                                className="form-select"
                                value={filterDraft.book_id}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({ ...f, book_id: e.target.value }))
                                }
                              >
                                <option value="">All</option>
                                {books.map((b) => (
                                  <option key={b.value} value={b.value}>
                                    {b.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Library member</label>
                              <select
                                className="form-select"
                                value={filterDraft.member_id}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({ ...f, member_id: e.target.value }))
                                }
                              >
                                <option value="">Any</option>
                                {members.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Issue from</label>
                              <DatePicker
                                className="w-100"
                                format="DD-MM-YYYY"
                                allowClear
                                getPopupContainer={getFilterDropdownPopupContainer}
                                value={
                                  filterDraft.issue_date_from
                                    ? dayjs(filterDraft.issue_date_from, "YYYY-MM-DD")
                                    : null
                                }
                                onChange={(d: Dayjs | null) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    issue_date_from: d ? d.format("YYYY-MM-DD") : "",
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Issue to</label>
                              <DatePicker
                                className="w-100"
                                format="DD-MM-YYYY"
                                allowClear
                                getPopupContainer={getFilterDropdownPopupContainer}
                                value={
                                  filterDraft.issue_date_to
                                    ? dayjs(filterDraft.issue_date_to, "YYYY-MM-DD")
                                    : null
                                }
                                onChange={(d: Dayjs | null) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    issue_date_to: d ? d.format("YYYY-MM-DD") : "",
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
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading ? (
                <div className="p-4 text-center text-muted">Loading…</div>
              ) : tableData.length === 0 ? (
                <div className="p-4 text-center text-muted">No books currently issued.</div>
              ) : (
                <Table dataSource={tableData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="library_return_modal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Return book</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitReturn}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                <p className="small text-muted mb-3">
                  Issue #{selected?.id} — {selected?.booksIssued || selected?.book_title}
                </p>
                <div className="mb-3">
                  <label className="form-label">Fine (if any)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control"
                    value={returnForm.fine_amount}
                    onChange={(e) => setReturnForm((f) => ({ ...f, fine_amount: e.target.value }))}
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={returnForm.remarks}
                    onChange={(e) => setReturnForm((f) => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Confirm return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReturnBook;

