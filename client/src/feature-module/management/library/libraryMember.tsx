import { useRef, useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { apiService } from "../../../core/services/apiService";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import LibraryToolbar from "./LibraryToolbar";
import { exportRowsToPdf, exportRowsToXlsx, printRowsToPage } from "./libraryTableExport";
import { getLibraryErrorMessage } from "./libraryApiErrors";
import { LibrarySearchableSelect } from "./librarySearchableSelect";

const normalizeStatus = (value: unknown): "active" | "inactive" =>
  String(value || "").toLowerCase() === "active" ? "active" : "inactive";

const LibraryMember = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<{ value: string; label: string }[]>([]);
  const [staffList, setStaffList] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [peopleLoadWarning, setPeopleLoadWarning] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState({
    member_type: "" as "" | "student" | "staff",
    member_id: "",
    status: "" as "" | "active" | "inactive",
  });
  const [filterDraft, setFilterDraft] = useState({ ...appliedFilters });

  const [addForm, setAddForm] = useState({
    member_type: "student" as "student" | "staff",
    student_id: "",
    staff_id: "",
    card_number: "",
    status: "active" as "active" | "inactive",
    remarks: "",
  });
  const [editForm, setEditForm] = useState({
    card_number: "",
    status: "active" as "active" | "inactive",
    remarks: "",
  });

  const loadPeople = useCallback(async () => {
    const listFromResponse = (res: unknown): any[] => {
      if (res == null || typeof res !== "object") return [];
      const r = res as Record<string, unknown>;
      if (r.status === "ERROR" || r.success === false) return [];
      const d = r.data;
      return Array.isArray(d) ? d : [];
    };

    setPeopleLoadWarning(null);
    const [stOut, sfOut] = await Promise.allSettled([
      apiService.getStudents({
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
        limit: 10000,
        page: 1,
      }),
      apiService.getStaff(),
    ]);

    let warn: string | null = null;
    const stData = stOut.status === "fulfilled" ? listFromResponse(stOut.value) : [];
    if (stOut.status === "rejected") {
      warn = "Could not load students.";
    }

    const sfData = sfOut.status === "fulfilled" ? listFromResponse(sfOut.value) : [];
    if (sfOut.status === "rejected") {
      warn = warn ? `${warn} Could not load staff.` : "Could not load staff.";
    }
    setPeopleLoadWarning(warn);

    setStudents(
      stData.map((s: any) => ({
        value: String(s.id),
        label:
          `${[s.first_name, s.last_name].filter(Boolean).join(" ") || `Student #${s.id}`}` +
          `${s.class_name || s.section_name ? ` (${[s.class_name, s.section_name].filter(Boolean).join(" — ")})` : ""}`,
      }))
    );
    setStaffList(
      sfData
        .filter((s: any) => String(s.status || "").toLowerCase() === "active" || s.is_active === true)
        .map((s: any) => ({
          value: String(s.id),
          label: [s.first_name, s.last_name].filter(Boolean).join(" ") || `Staff #${s.id}`,
        }))
    );
  }, [academicYearId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getLibraryMembers({
        member_type: appliedFilters.member_type || undefined,
        member_id: appliedFilters.member_id.trim() || undefined,
        status: appliedFilters.status || undefined,
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
      setLoadError(getLibraryErrorMessage(e, "Could not load members."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, academicYearId]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFiltersFromDraft = () => {
    setAppliedFilters({ ...filterDraft });
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const resetFilters = () => {
    const empty = { member_type: "" as const, member_id: "", status: "" as const };
    setFilterDraft(empty);
    setAppliedFilters(empty);
  };

  const memberExportHeaders = ["ID", "Name", "Type", "Card", "Email", "Mobile", "Status"];
  const buildMemberExportRows = () =>
    rows.map((r) => [
      r.id,
      r.name || r.member_name,
      r.member_type || (r.student_id ? "student" : "staff"),
      r.cardNo || r.card_number,
      r.email || "",
      r.mobile || r.phone || "",
      normalizeStatus(r.status),
    ]);

  const handleExportXlsx = async () => {
    await exportRowsToXlsx("library-members.xlsx", "Members", memberExportHeaders, buildMemberExportRows());
  };

  const handleExportPdf = () => {
    exportRowsToPdf("Library — Members", memberExportHeaders, buildMemberExportRows());
  };

  const handlePrint = () => {
    printRowsToPage("Library — Members", memberExportHeaders, buildMemberExportRows());
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
    const m = el && bootstrap?.Modal?.getInstance(el);
    m?.hide();
  };

  const openAdd = () => {
    setFormError(null);
    void (async () => {
      await loadPeople();
      let card = "";
      try {
        const res = await apiService.getLibraryNextCardNumber();
        card = (res as any)?.data?.card_number ?? "";
      } catch {
        const maxSeq = rows.reduce((acc, r) => {
          const c = String(r.card_number || r.cardNo || "").trim();
          const m = /^LIB-(\d+)$/i.exec(c);
          return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
        }, 0);
        card = `LIB-${String(maxSeq + 1).padStart(5, "0")}`;
      }
      setAddForm({
        member_type: "student",
        student_id: "",
        staff_id: "",
        card_number: card,
        status: "active",
        remarks: "",
      });
      setTimeout(() => showModal("add_library_members"), 0);
    })();
  };

  const openEdit = (record: any) => {
    const r = record.raw || record;
    setSelected(r);
    setFormError(null);
    setEditForm({
      card_number: r.card_number || r.cardNo || "",
      status: normalizeStatus(r.status),
      remarks: r.remarks || "",
    });
    setTimeout(() => showModal("edit_library_members"), 0);
  };

  const openDelete = (record: any) => {
    setSelected(record.raw || record);
    setFormError(null);
    setTimeout(() => showModal("delete_library_member_modal"), 0);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addForm.member_type === "student" && !String(addForm.student_id).trim()) {
      setFormError("Please select a student.");
      return;
    }
    if (addForm.member_type === "staff" && !String(addForm.staff_id).trim()) {
      setFormError("Please select a staff member.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        card_number: addForm.card_number.trim(),
        student_id: addForm.member_type === "student" ? Number(addForm.student_id) : null,
        staff_id: addForm.member_type === "staff" ? Number(addForm.staff_id) : null,
        status: addForm.status,
        remarks: addForm.remarks.trim() || null,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      };
      await apiService.createLibraryMember(payload);
      hideModal("add_library_members");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not add member."));
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
      await apiService.updateLibraryMember(selected.id, {
        card_number: editForm.card_number.trim(),
        status: editForm.status,
        remarks: editForm.remarks.trim() || null,
      });
      hideModal("edit_library_members");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not update member."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteLibraryMember(selected.id);
      hideModal("delete_library_member_modal");
      await load();
    } catch (err: unknown) {
      setFormError(getLibraryErrorMessage(err, "Could not remove member."));
    } finally {
      setSaving(false);
    }
  };

  const tableData = rows.map((r) => ({
    ...r,
    name: r.name || r.member_name || "—",
    memberType: r.member_type || (r.student_id ? "student" : "staff"),
    cardNo: r.cardNo || r.card_number || "—",
    email: r.email || "—",
    mobile: r.mobile || r.phone || "—",
    img: r.img || r.photo_url || "assets/img/profiles/avatar-01.jpg",
    status: normalizeStatus(r.status),
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
      title: "Member",
      dataIndex: "name",
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
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) =>
        String((a as any).name || "").localeCompare(String((b as any).name || "")),
    },
    {
      title: "Card No",
      dataIndex: "cardNo",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).cardNo || "").localeCompare(String((b as any).cardNo || "")),
    },
    {
      title: "Type",
      dataIndex: "memberType",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).memberType || "").localeCompare(String((b as any).memberType || "")),
    },
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).email || "").localeCompare(String((b as any).email || "")),
    },
    {
      title: "Mobile",
      dataIndex: "mobile",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).mobile || "").localeCompare(String((b as any).mobile || "")),
    },
    {
      title: "Status",
      dataIndex: "status",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).status || "").localeCompare(String((b as any).status || "")),
      render: (text: string) => {
        const active = normalizeStatus(text) === "active";
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
              <h3 className="page-title mb-1">Library Members</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Library Members
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center justify-content-end flex-wrap flex-row-reverse gap-2">
              <div className="mb-2">
                <button type="button" className="btn btn-primary" onClick={openAdd}>
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Member
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
            <div className="alert alert-warning" role="alert">
              {loadError}
            </div>
          )}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Library Members List</h4>
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
                              <label className="form-label">Member type</label>
                              <select
                                className="form-select"
                                value={filterDraft.member_type}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    member_type: e.target.value as "" | "student" | "staff",
                                  }))
                                }
                              >
                                <option value="">All</option>
                                <option value="student">Student</option>
                                <option value="staff">Staff</option>
                              </select>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Member ID</label>
                              <input
                                className="form-control"
                                placeholder="Exact id"
                                value={filterDraft.member_id}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({ ...f, member_id: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <select
                                className="form-select"
                                value={filterDraft.status}
                                onChange={(e) =>
                                  setFilterDraft((f) => ({
                                    ...f,
                                    status: e.target.value as any,
                                  }))
                                }
                              >
                                <option value="">All</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
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

      <div className="modal fade" id="add_library_members" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Member</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitAdd}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                {peopleLoadWarning && (
                  <div className="alert alert-warning py-2 small">{peopleLoadWarning}</div>
                )}
                <div className="mb-3">
                  <label className="form-label">Member type</label>
                  <select
                    className="form-select"
                    value={addForm.member_type}
                    onChange={(e) => {
                      const v = e.target.value as "student" | "staff";
                      setAddForm((f) => ({
                        ...f,
                        member_type: v,
                        student_id: v === "student" ? f.student_id : "",
                        staff_id: v === "staff" ? f.staff_id : "",
                      }));
                    }}
                  >
                    <option value="student">Student</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                {addForm.member_type === "student" ? (
                  <div className="mb-3">
                    <label className="form-label">Student *</label>
                    <LibrarySearchableSelect
                      options={students}
                      value={addForm.student_id}
                      onChange={(v) => setAddForm((f) => ({ ...f, student_id: v }))}
                      placeholder="Search student…"
                    />
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="form-label">Staff *</label>
                    <LibrarySearchableSelect
                      options={staffList}
                      value={addForm.staff_id}
                      onChange={(v) => setAddForm((f) => ({ ...f, staff_id: v }))}
                      placeholder="Search staff…"
                    />
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Card No *</label>
                  <input
                    className="form-control"
                    required
                    value={addForm.card_number}
                    onChange={(e) => setAddForm((f) => ({ ...f, card_number: e.target.value }))}
                  />
                  <small className="text-muted">Suggested serial (LIB-00001); you may change it.</small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={addForm.remarks}
                    onChange={(e) => setAddForm((f) => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
                <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-1 mx-2 mb-0">
                  <div className="status-title">
                    <h5 className="mb-0">Status</h5>
                    <label className="form-label mb-0" htmlFor="add_library_member_status">
                      {addForm.status === "active" ? "Active" : "Inactive"}
                    </label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      id="add_library_member_status"
                      className="form-check-input"
                      type="checkbox"
                      checked={addForm.status === "active"}
                      onChange={(e) =>
                        setAddForm((f) => ({
                          ...f,
                          status: e.target.checked ? "active" : "inactive",
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_library_members" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Member</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                <div className="mb-3">
                  <label className="form-label">Card No *</label>
                  <input
                    className="form-control"
                    required
                    value={editForm.card_number}
                    onChange={(e) => setEditForm((f) => ({ ...f, card_number: e.target.value }))}
                  />
                  <small className="text-muted">Editable; suggested format LIB-00001.</small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={editForm.remarks}
                    onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
                <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-1 mx-2 mb-0">
                  <div className="status-title">
                    <h5 className="mb-0">Status</h5>
                    <label className="form-label mb-0" htmlFor="edit_library_member_status">
                      {editForm.status === "active" ? "Active" : "Inactive"}
                    </label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      id="edit_library_member_status"
                      className="form-check-input"
                      type="checkbox"
                      checked={editForm.status === "active"}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          status: e.target.checked ? "active" : "inactive",
                        }))
                      }
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

      <div className="modal fade" id="delete_library_member_modal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon">
                <i className="ti ti-trash-x" />
              </span>
              <h4>Confirm Deletion</h4>
              <p>Remove library member card {selected?.card_number || ""}?</p>
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

export default LibraryMember;

