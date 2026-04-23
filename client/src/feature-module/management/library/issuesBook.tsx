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

const IssueBook = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [books, setBooks] = useState<{ value: string; label: string }[]>([]);
  const [members, setMembers] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [appliedFilters, setAppliedFilters] = useState({
    status: "" as string,
    book_id: "",
    member_id: "",
    issue_date_from: "",
    issue_date_to: "",
  });
  const [filterDraft, setFilterDraft] = useState({ ...appliedFilters });

  const [issueForm, setIssueForm] = useState({
    book_id: "",
    library_member_id: "",
    due_date: "",
    remarks: "",
  });

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
        status: appliedFilters.status || undefined,
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
      setLoadError(getLibraryErrorMessage(e, "Could not load issues."));
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
      status: "",
      book_id: "",
      member_id: "",
      issue_date_from: "",
      issue_date_to: "",
    };
    setFilterDraft(empty);
    setAppliedFilters(empty);
  };

  const issueExportHeaders = ["ID", "Issued", "Due", "Borrower", "Book", "Returned", "Status"];
  const buildIssueExportRows = () =>
    rows.map((r) => [
      r.id,
      formatDateDMY(r.dateofIssue),
      formatDateDMY(r.dueDate),
      r.issueTo,
      r.booksIssued || r.book_title,
      r.bookReturned,
      r.status,
    ]);

  const handleExportXlsx = async () => {
    await exportRowsToXlsx("library-issues.xlsx", "Issues", issueExportHeaders, buildIssueExportRows());
  };

  const handleExportPdf = () => {
    exportRowsToPdf("Library — Issues", issueExportHeaders, buildIssueExportRows());
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

  const openIssue = () => {
    setFormError(null);
    setIssueForm({
      book_id: "",
      library_member_id: "",
      due_date: dayjs().add(14, "day").format("YYYY-MM-DD"),
      remarks: "",
    });
    setTimeout(() => showModal("library_issue_book_modal"), 0);
  };

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        book_id: Number(issueForm.book_id),
        library_member_id: Number(issueForm.library_member_id),
        due_date: issueForm.due_date,
        remarks: issueForm.remarks || null,
      };
      await apiService.createLibraryIssue(payload);
      hideModal("library_issue_book_modal");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not issue book."));
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (record: any) => {
    const id = record.raw?.id ?? record.id;
    setFormError(null);
    try {
      const res = await apiService.getLibraryIssueById(id);
      setDetail((res as any)?.data || null);
      setTimeout(() => showModal("book_details"), 0);
    } catch (e: unknown) {
      setFormError(getLibraryErrorMessage(e, "Could not load details."));
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
        <button type="button" className="btn btn-light add-fee" onClick={() => openDetails(record)}>
          View Details
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
              <h3 className="page-title mb-1">Issue Books</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Issue Books
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
              <button type="button" className="btn btn-primary" onClick={openIssue}>
                <i className="ti ti-book me-1" />
                Issue Book
              </button>
            </div>
          </div>

          {loadError && <div className="alert alert-danger">{loadError}</div>}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Issue Books</h4>
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
                              <label className="form-label">Status</label>
                              <select
                                className="form-select"
                                value={filterDraft.status}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({ ...f, status: e.target.value }))
                                }
                              >
                                <option value="">All</option>
                                <option value="issued">Issued</option>
                                <option value="returned">Returned</option>
                                <option value="lost">Lost</option>
                                <option value="damaged">Damaged</option>
                              </select>
                            </div>
                          </div>
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
              ) : (
                <Table dataSource={tableData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="library_issue_book_modal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Issue Book</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitIssue}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                <div className="mb-3">
                  <label className="form-label">Book *</label>
                  <select
                    className="form-select"
                    required
                    value={issueForm.book_id}
                    onChange={(e) => setIssueForm((f) => ({ ...f, book_id: e.target.value }))}
                  >
                    <option value="">Select book</option>
                    {books.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Library member *</label>
                  <select
                    className="form-select"
                    required
                    value={issueForm.library_member_id}
                    onChange={(e) =>
                      setIssueForm((f) => ({ ...f, library_member_id: e.target.value }))
                    }
                  >
                    <option value="">Select member (card — name)</option>
                    {members.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Due date *</label>
                  <DatePicker
                    className="w-100"
                    format="DD-MM-YYYY"
                    value={issueForm.due_date ? dayjs(issueForm.due_date, "YYYY-MM-DD") : null}
                    onChange={(d: Dayjs | null) =>
                      setIssueForm((f) => ({ ...f, due_date: d ? d.format("YYYY-MM-DD") : "" }))
                    }
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={issueForm.remarks}
                    onChange={(e) => setIssueForm((f) => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="book_details" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Issue details</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              {detail ? (
                <div className="view-book">
                  <div className="book-issue-details">
                    <div className="book-details-head">
                      <span className="text-primary">#{detail.id}</span>
                      <h6>
                        <span>Issue date: </span>{" "}
                        {formatDateDMY(detail.dateofIssue || detail.issue_date)}
                      </h6>
                    </div>
                    <ul className="book-taker-info list-unstyled">
                      <li className="mb-2">
                        <span>Book</span>
                        <h6>{detail.booksIssued || detail.book_title}</h6>
                      </li>
                      <li className="mb-2">
                        <span>ISBN / code</span>
                        <h6>{detail.isbn || "—"} / {detail.book_code || "—"}</h6>
                      </li>
                      <li className="mb-2">
                        <span>Issued to</span>
                        <h6>{detail.issueTo}</h6>
                      </li>
                      <li className="mb-2">
                        <span>Due date</span>
                        <h6>{formatDateDMY(detail.dueDate || detail.due_date)}</h6>
                      </li>
                      <li className="mb-2">
                        <span>Status</span>
                        <h6>{detail.status}</h6>
                      </li>
                      <li className="mb-2">
                        <span>Remarks</span>
                        <h6>{detail.issueRemarks || detail.remarks || "—"}</h6>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-muted mb-0">No data.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IssueBook;

