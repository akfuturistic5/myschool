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
import { exportRowsToPdf, exportRowsToXlsx, printRowsToPage } from "./libraryTableExport";
import { getLibraryErrorMessage } from "./libraryApiErrors";

const LibraryReservations = () => {
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
  const [appliedFilters, setAppliedFilters] = useState({
    status: "" as string,
    book_id: "",
    member_id: "",
  });
  const [filterDraft, setFilterDraft] = useState({ ...appliedFilters });
  const [resForm, setResForm] = useState({
    book_id: "",
    library_member_id: "",
    expiration_date: "",
  });

  const loadRefs = useCallback(async () => {
    try {
      const ay = academicYearId != null ? { academic_year_id: academicYearId } : {};
      const [bRes, mRes] = await Promise.all([
        apiService.getLibraryBooks(ay),
        apiService.getLibraryMembers({ ...ay, status: "active" }),
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
        ml.map((m: any) => {
          const kind =
            String(m.member_type || "").toLowerCase() === "staff" ? "Staff" : "Student";
          return {
            value: String(m.id),
            label: `${m.card_number || m.cardNo || m.id} — ${m.name || m.member_name || "Member"} (${kind})`,
          };
        })
      );
    } catch {
      /* ignore */
    }
  }, [academicYearId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getLibraryReservations({
        status: appliedFilters.status || undefined,
        book_id: appliedFilters.book_id || undefined,
        member_id: appliedFilters.member_id || undefined,
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
      setLoadError(getLibraryErrorMessage(e, "Could not load reservations."));
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
    const empty = { status: "", book_id: "", member_id: "" };
    setFilterDraft(empty);
    setAppliedFilters(empty);
  };

  const exportHeaders = ["ID", "Reserved", "Expires", "Book", "Requester", "Status"];
  const buildExportRows = () =>
    rows.map((r) => [
      r.id,
      formatDateDMY(r.reserved_at),
      formatDateDMY(r.expiration_date),
      r.book_title,
      r.requesterLabel || r.student_name || r.staff_name || "—",
      r.status,
    ]);

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

  const openAdd = () => {
    setFormError(null);
    setResForm({
      book_id: "",
      library_member_id: "",
      expiration_date: "",
    });
    setTimeout(() => showModal("library_reservation_modal"), 0);
  };

  const submitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        book_id: Number(resForm.book_id),
        library_member_id: Number(resForm.library_member_id),
      };
      if (resForm.expiration_date && resForm.expiration_date.trim()) {
        payload.expiration_date = resForm.expiration_date.trim().slice(0, 10);
      }
      if (academicYearId != null) payload.academic_year_id = academicYearId;
      await apiService.createLibraryReservation(payload);
      hideModal("library_reservation_modal");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not create reservation."));
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (id: string, status: "Fulfilled" | "Cancelled" | "Expired") => {
    if (status === "Cancelled" && !window.confirm("Cancel this reservation?")) return;
    if (status === "Expired" && !window.confirm("Mark this reservation as expired?")) return;
    try {
      await apiService.updateLibraryReservation(id, { status });
      await load();
    } catch (e: unknown) {
      window.alert(getLibraryErrorMessage(e, "Update failed."));
    }
  };

  const tableData = rows.map((r) => ({
    ...r,
    reservedDisplay: formatDateDMY(r.reserved_at),
    expiresDisplay: formatDateDMY(r.expiration_date),
    raw: r,
  }));

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).id || "").localeCompare(String((b as any).id || "")),
    },
    {
      title: "Reserved",
      dataIndex: "reservedDisplay",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).reserved_at || "").localeCompare(String((b as any).reserved_at || "")),
    },
    {
      title: "Expires",
      dataIndex: "expiresDisplay",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).expiration_date || "").localeCompare(
          String((b as any).expiration_date || "")
        ),
    },
    {
      title: "Book",
      dataIndex: "book_title",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).book_title || "").localeCompare(String((b as any).book_title || "")),
    },
    {
      title: "Requester",
      dataIndex: "requesterLabel",
      render: (_: unknown, record: any) => {
        const name =
          record.requesterLabel || record.student_name || record.staff_name || "—";
        const img = record.borrower_photo || record.img || "assets/img/profiles/avatar-01.jpg";
        return (
          <div className="d-flex align-items-center">
            <span className="avatar avatar-md">
              <ImageWithBasePath src={img} className="img-fluid rounded-circle" alt="" />
            </span>
            <div className="ms-2">
              <p className="text-dark mb-0">{name}</p>
              <span className="fs-12">{record.classLabel || ""}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).status || "").localeCompare(String((b as any).status || "")),
    },
    {
      title: "Actions",
      dataIndex: "action",
      render: (_: unknown, record: any) => {
        const st = String(record.status || "");
        if (st !== "Pending") {
          return <span className="text-muted small">—</span>;
        }
        return (
          <div className="d-flex flex-wrap gap-1">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                void patchStatus(String(record.id), "Fulfilled");
              }}
            >
              Fulfilled
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                void patchStatus(String(record.id), "Expired");
              }}
            >
              Expired
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => {
                void patchStatus(String(record.id), "Cancelled");
              }}
            >
              Cancel
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Book reservations</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Reservations
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center justify-content-end flex-wrap flex-row-reverse gap-2">
              <button type="button" className="btn btn-primary mb-2" onClick={openAdd}>
                <i className="ti ti-calendar-plus me-1" />
                Add reservation
              </button>
              <LibraryToolbar
                onRefresh={load}
                onExportExcel={async () =>
                  exportRowsToXlsx(
                    "library-reservations.xlsx",
                    "Reservations",
                    exportHeaders,
                    buildExportRows()
                  )
                }
                onExportPdf={() =>
                  exportRowsToPdf("Library — Reservations", exportHeaders, buildExportRows())
                }
                onPrint={() =>
                  printRowsToPage("Library — Reservations", exportHeaders, buildExportRows())
                }
              />
            </div>
          </div>

          {loadError && <div className="alert alert-danger">{loadError}</div>}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <div className="mb-3">
                <h4 className="mb-1">Wait list (high-demand titles)</h4>
                <p className="text-muted small mb-0">
                  When every copy is on loan, add members here and work the queue as books come back.
                </p>
              </div>
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
                              <option value="pending">Pending</option>
                              <option value="fulfilled">Fulfilled</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="expired">Expired</option>
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
                          <div className="mb-0">
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

      <div className="modal fade" id="library_reservation_modal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add reservation</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitReservation}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                <p className="small text-muted">
                  Queue a borrower for when a copy is returned. Work pending rows from oldest to newest.
                </p>
                <div className="mb-3">
                  <label className="form-label">Book *</label>
                  <select
                    className="form-select"
                    required
                    value={resForm.book_id}
                    onChange={(e) => setResForm((f) => ({ ...f, book_id: e.target.value }))}
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
                    value={resForm.library_member_id}
                    onChange={(e) =>
                      setResForm((f) => ({ ...f, library_member_id: e.target.value }))
                    }
                  >
                    <option value="">Select member</option>
                    {members.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-0">
                  <label className="form-label">Hold expiry (optional)</label>
                  <DatePicker
                    className="w-100"
                    format="DD-MM-YYYY"
                    allowClear
                    value={resForm.expiration_date ? dayjs(resForm.expiration_date, "YYYY-MM-DD") : null}
                    onChange={(d: Dayjs | null) =>
                      setResForm((f) => ({
                        ...f,
                        expiration_date: d ? d.format("YYYY-MM-DD") : "",
                      }))
                    }
                  />
                  <small className="text-muted d-block mt-1">
                    Optional. If omitted, the hold stays pending until it is fulfilled, cancelled, or marked
                    expired.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default LibraryReservations;
