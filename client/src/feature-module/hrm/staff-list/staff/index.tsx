import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

import Table from "../../../../core/common/dataTable/index";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import type { TableData } from "../../../../core/data/interface";
import CommonSelect from "../../../../core/common/commonSelect";
import type { Option } from "../../../../core/common/commonSelect";
import { all_routes } from "../../../router/all_routes";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useStaff } from "../../../../core/hooks/useStaff";
import { useDepartments } from "../../../../core/hooks/useDepartments";
import { useDesignations } from "../../../../core/hooks/useDesignations";
import { apiService } from "../../../../core/services/apiService";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import {
  staffDirectoryFriendlyError,
  staffDirectoryFriendlyMessage,
} from "../staffDirectoryErrors";

type SortMode = "nameAsc" | "nameDesc" | "joinAsc" | "joinDesc" | "addedDesc";

/** Sentinel for "no department/designation filter" (must be truthy for CommonSelect controlled mode). */
const ALL_VALUE = "__all__";
const ALL_OPTION: Option[] = [{ value: ALL_VALUE, label: "All" }];

function parseJoinDateMs(original: Record<string, unknown> | undefined): number | null {
  if (!original) return null;
  const raw =
    original.joining_date ??
    original.date_of_join ??
    original.date_of_joining;
  if (raw == null || raw === "") return null;
  const t = new Date(String(raw)).getTime();
  return Number.isNaN(t) ? null : t;
}

function isActiveStaff(original: Record<string, unknown> | undefined): boolean {
  if (!original) return true;
  const a = original.is_active;
  if (a === false || a === "f" || a === 0 || a === "false") return false;
  return true;
}

/** Numeric PK for `?id=` — never use employee_code as id. */
function numericStaffPk(record: {
  dbId?: number | null;
  originalData?: Record<string, unknown>;
}): number | null {
  if (record.dbId != null && Number.isFinite(record.dbId) && record.dbId > 0) {
    return record.dbId;
  }
  const oid = record.originalData?.id;
  if (oid != null) {
    const n = Number(oid);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const Staff = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const canManage = canManageStaffDirectory(user);
  const dashboardFallback = getDashboardForRole(user?.role, user?.user_role_id);

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { staffList, loading, error, refetch } = useStaff({ enabled: canManage });
  const { departments: deptRows } = useDepartments();
  const { designations: desigRows } = useDesignations();

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [filterName, setFilterName] = useState("");
  const [filterDept, setFilterDept] = useState(ALL_VALUE);
  const [filterDesig, setFilterDesig] = useState(ALL_VALUE);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const [joinFrom, setJoinFrom] = useState("");
  const [joinTo, setJoinTo] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("nameAsc");

  /** Labels match `department_name` / `designation_name` from the API (same as DB). */
  const departmentOptions: Option[] = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    (deptRows as { department?: string }[]).forEach((row) => {
      const name = String(row.department ?? "").trim();
      if (!name || name === "N/A") return;
      if (!seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    });
    const extras: string[] = [];
    staffList.forEach((row: any) => {
      const d = String(row.department ?? "").trim();
      if (!d || d === "N/A") return;
      if (!seen.has(d)) extras.push(d);
    });
    extras.sort((a, b) => a.localeCompare(b));
    return [
      ...ALL_OPTION,
      ...ordered.map((v) => ({ value: v, label: v })),
      ...extras.map((v) => ({ value: v, label: v })),
    ];
  }, [deptRows, staffList]);

  const designationOptions: Option[] = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    (desigRows as { designation?: string }[]).forEach((row) => {
      const name = String(row.designation ?? "").trim();
      if (!name || name === "N/A") return;
      if (!seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    });
    const extras: string[] = [];
    staffList.forEach((row: any) => {
      const d = String(row.designation ?? "").trim();
      if (!d || d === "N/A") return;
      if (!seen.has(d)) extras.push(d);
    });
    extras.sort((a, b) => a.localeCompare(b));
    return [
      ...ALL_OPTION,
      ...ordered.map((v) => ({ value: v, label: v })),
      ...extras.map((v) => ({ value: v, label: v })),
    ];
  }, [desigRows, staffList]);

  const filteredAndSorted = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    const fromMs = joinFrom ? new Date(joinFrom).setHours(0, 0, 0, 0) : null;
    const toMs = joinTo ? new Date(joinTo).setHours(23, 59, 59, 999) : null;

    const rows = staffList.filter((row: any) => {
      const orig = row.originalData as Record<string, unknown> | undefined;
      if (q) {
        const nm = String(row.name || "").toLowerCase();
        if (!nm.includes(q)) return false;
      }
      if (filterDept !== ALL_VALUE) {
        if (String(row.department) !== filterDept) return false;
      }
      if (filterDesig !== ALL_VALUE) {
        if (String(row.designation) !== filterDesig) return false;
      }
      if (filterStatus !== "all") {
        const active = isActiveStaff(orig);
        if (filterStatus === "active" && !active) return false;
        if (filterStatus === "inactive" && active) return false;
      }
      if (fromMs != null || toMs != null) {
        const j = parseJoinDateMs(orig);
        if (j == null) return false;
        if (fromMs != null && j < fromMs) return false;
        if (toMs != null && j > toMs) return false;
      }
      return true;
    });

    const sorted = [...rows];
    const nameCmp = (a: any, b: any) =>
      String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
    const joinCmp = (a: any, b: any) => {
      const ta = parseJoinDateMs(a.originalData) ?? 0;
      const tb = parseJoinDateMs(b.originalData) ?? 0;
      return ta - tb;
    };
    const idCmp = (a: any, b: any) => {
      const ia = Number(a.originalData?.id ?? a.dbId ?? 0);
      const ib = Number(b.originalData?.id ?? b.dbId ?? 0);
      return ia - ib;
    };

    switch (sortMode) {
      case "nameDesc":
        sorted.sort((a, b) => -nameCmp(a, b));
        break;
      case "joinAsc":
        sorted.sort((a, b) => joinCmp(a, b));
        break;
      case "joinDesc":
        sorted.sort((a, b) => -joinCmp(a, b));
        break;
      case "addedDesc":
        sorted.sort((a, b) => -idCmp(a, b));
        break;
      case "nameAsc":
      default:
        sorted.sort(nameCmp);
        break;
    }
    return sorted;
  }, [
    staffList,
    filterName,
    filterDept,
    filterDesig,
    filterStatus,
    joinFrom,
    joinTo,
    sortMode,
  ]);

  const data = filteredAndSorted;

  const resetFilters = () => {
    setFilterName("");
    setFilterDept(ALL_VALUE);
    setFilterDesig(ALL_VALUE);
    setFilterStatus("all");
    setJoinFrom("");
    setJoinTo("");
    setSortMode("nameAsc");
  };

  const applyFilters = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const closeDeleteModal = () => {
    const el = document.getElementById("delete-modal");
    if (el && (window as any).bootstrap?.Modal) {
      const inst = (window as any).bootstrap.Modal.getInstance(el);
      inst?.hide();
    }
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    const id = deleteTarget?.originalData?.id ?? deleteTarget?.dbId;
    if (id == null) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const res = (await apiService.deleteStaff(id)) as any;
      if (res?.status === "SUCCESS") {
        await refetch();
        closeDeleteModal();
      } else {
        setDeleteError(res?.message || "Failed to remove staff.");
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to remove staff.";
      try {
        const jsonPart = msg.includes("message: ")
          ? msg.split("message: ").slice(1).join("message: ").trim()
          : msg;
        const j = JSON.parse(jsonPart);
        setDeleteError(j?.message || msg);
      } catch {
        setDeleteError(msg);
      }
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const sortLabel =
    sortMode === "nameAsc"
      ? "Name A–Z"
      : sortMode === "nameDesc"
        ? "Name Z–A"
        : sortMode === "joinAsc"
          ? "Join date (oldest first)"
          : sortMode === "joinDesc"
            ? "Join date (newest first)"
            : "Recently added";

  /** Must run unconditionally (hooks) — access denied UI is returned after hooks. */
  const columns = useMemo(() => {
    const base = [
      {
        title: "ID",
        dataIndex: "id",
        render: (text: any, record: any) => {
          const pk = numericStaffPk(record);
          return (
            <>
              <Link
                to={{
                  pathname: routes.staffDetails,
                  ...(pk != null ? { search: `?id=${pk}` } : {}),
                }}
                state={{
                  staffId: pk ?? undefined,
                  staff: record.originalData,
                }}
                className="link-primary"
              >
                {text || record.id || "N/A"}
              </Link>
            </>
          );
        },
        sorter: (a: TableData, b: TableData) =>
          String(a.id || "").localeCompare(String(b.id || "")),
      },
      {
        title: "Name",
        dataIndex: "name",
        render: (text: string, record: any) => {
          const pk = numericStaffPk(record);
          const toDetail = {
            pathname: routes.staffDetails,
            ...(pk != null ? { search: `?id=${pk}` } : {}),
          };
          return (
            <div className="d-flex align-items-center">
              <Link
                to={toDetail}
                state={{
                  staffId: pk ?? undefined,
                  staff: record.originalData,
                }}
                className="avatar avatar-md"
              >
                <ImageWithBasePath
                  src={record.img}
                  className="img-fluid rounded-circle"
                  alt="img"
                />
              </Link>
              <div className="ms-2">
                <p className="text-dark mb-0">
                  <Link
                    to={toDetail}
                    state={{
                      staffId: pk ?? undefined,
                      staff: record.originalData,
                    }}
                  >
                    {text}
                  </Link>
                </p>
              </div>
            </div>
          );
        },
        sorter: (a: TableData, b: TableData) => a.name.length - b.name.length,
      },
      {
        title: "Department",
        dataIndex: "department",
        sorter: (a: TableData, b: TableData) =>
          String((a as any).department ?? "").localeCompare(
            String((b as any).department ?? "")
          ),
      },
      {
        title: "Designation",
        dataIndex: "designation",
        sorter: (a: TableData, b: TableData) =>
          String((a as any).designation ?? "").localeCompare(
            String((b as any).designation ?? "")
          ),
      },
      {
        title: "Phone",
        dataIndex: "phone",
        sorter: (a: TableData, b: TableData) =>
          String((a as any).phone ?? "").localeCompare(
            String((b as any).phone ?? "")
          ),
      },
      {
        title: "Email",
        dataIndex: "email",
        sorter: (a: TableData, b: TableData) =>
          String((a as any).email ?? "").localeCompare(
            String((b as any).email ?? "")
          ),
      },
      {
        title: "Date of Join",
        dataIndex: "dateOfJoin",
        sorter: (a: TableData, b: TableData) =>
          String((a as any).dateOfJoin ?? "").localeCompare(
            String((b as any).dateOfJoin ?? "")
          ),
      },
    ];

    if (!canManage) return base;

    return [
      ...base,
      {
        title: "Action",
        dataIndex: "action",
        render: (_: any, record: any) => {
          const pk = numericStaffPk(record);
          const toDetail = {
            pathname: routes.staffDetails,
            ...(pk != null ? { search: `?id=${pk}` } : {}),
          };
          const toEdit = {
            pathname: routes.editStaff,
            ...(pk != null ? { search: `?id=${pk}` } : {}),
          };
          return (
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
                  <ul className="dropdown-menu dropdown-menu-right p-3">
                    <li>
                      <Link
                        className="dropdown-item rounded-1"
                        to={toDetail}
                        state={{
                          staffId: pk ?? undefined,
                          staff: record.originalData,
                        }}
                      >
                        <i className="ti ti-menu me-2" />
                        View Staff
                      </Link>
                    </li>
                    <li>
                      <Link
                        className="dropdown-item rounded-1"
                        to={toEdit}
                        state={{
                          staffId: pk ?? undefined,
                          staff: record.originalData,
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
                      data-bs-toggle="modal"
                      data-bs-target="#delete-modal"
                      onClick={() => {
                        setDeleteTarget(record);
                        setDeleteError(null);
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
          );
        },
      },
    ];
  }, [canManage, routes]);

  if (!canManage) {
    return (
      <div>
        <div className="page-wrapper">
          <div className="content">
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Staffs</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">HRM</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Staffs
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
            <div className="alert alert-warning" role="alert">
              <h5 className="alert-heading">Staff directory</h5>
              <p className="mb-2">
                Your role does not include access to the full staff list. Only
                Headmaster (Admin) and Administrative users can view or manage
                directory records.
              </p>
              <Link to={dashboardFallback} className="btn btn-primary">
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Staffs</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">HRM</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Staffs
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              <div className="mb-2">
                <Link
                  to={routes.addStaff}
                  className="btn btn-primary d-flex align-items-center"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Staff
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Staff List</h4>
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
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        applyFilters();
                      }}
                    >
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4 className="mb-0">Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Name contains</label>
                              <input
                                type="search"
                                className="form-control"
                                placeholder="Search by name"
                                value={filterName}
                                onChange={(e) => setFilterName(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Department</label>
                              <CommonSelect
                                className="select"
                                options={departmentOptions}
                                value={filterDept}
                                onChange={(v) =>
                                  setFilterDept(v != null && v !== "" ? v : ALL_VALUE)
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Designation</label>
                              <CommonSelect
                                className="select"
                                options={designationOptions}
                                value={filterDesig}
                                onChange={(v) =>
                                  setFilterDesig(v != null && v !== "" ? v : ALL_VALUE)
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "all", label: "All" },
                                  { value: "active", label: "Active" },
                                  { value: "inactive", label: "Inactive" },
                                ]}
                                value={filterStatus}
                                onChange={(v) => {
                                  if (v === "active" || v === "inactive") {
                                    setFilterStatus(v);
                                  } else {
                                    setFilterStatus("all");
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-0">
                              <label className="form-label">
                                Join date from
                              </label>
                              <input
                                type="date"
                                className="form-control"
                                value={joinFrom}
                                onChange={(e) => setJoinFrom(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-0">
                              <label className="form-label">Join date to</label>
                              <input
                                type="date"
                                className="form-control"
                                value={joinTo}
                                onChange={(e) => setJoinTo(e.target.value)}
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
                  >
                    <i className="ti ti-sort-ascending-2 me-2" />
                    {sortLabel}
                  </Link>
                  <ul className="dropdown-menu p-3">
                    <li>
                      <button
                        type="button"
                        className={`dropdown-item rounded-1 ${sortMode === "nameAsc" ? "active" : ""}`}
                        onClick={() => setSortMode("nameAsc")}
                      >
                        Name A–Z
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={`dropdown-item rounded-1 ${sortMode === "nameDesc" ? "active" : ""}`}
                        onClick={() => setSortMode("nameDesc")}
                      >
                        Name Z–A
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={`dropdown-item rounded-1 ${sortMode === "joinAsc" ? "active" : ""}`}
                        onClick={() => setSortMode("joinAsc")}
                      >
                        Join date (oldest first)
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={`dropdown-item rounded-1 ${sortMode === "joinDesc" ? "active" : ""}`}
                        onClick={() => setSortMode("joinDesc")}
                      >
                        Join date (newest first)
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={`dropdown-item rounded-1 ${sortMode === "addedDesc" ? "active" : ""}`}
                        onClick={() => setSortMode("addedDesc")}
                      >
                        Recently added
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading && (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading staff data...</p>
                </div>
              )}

              {error && (
                <div className="text-center p-4">
                  <div className="alert alert-danger" role="alert">
                    <i className="ti ti-alert-circle me-2"></i>
                    {staffDirectoryFriendlyMessage(error)}
                    <button
                      className="btn btn-sm btn-outline-danger ms-3"
                      onClick={refetch}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && data.length === 0 && (
                <div className="text-center p-5 text-muted">
                  <p className="mb-0">
                    {staffList.length === 0
                      ? "No staff records yet. Use Add Staff to create one."
                      : "No staff match your filters. Try adjusting or reset filters."}
                  </p>
                </div>
              )}
              {!loading && !error && data.length > 0 && (
                <Table columns={columns} dataSource={data} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon">
                <i className="ti ti-trash-x" />
              </span>
              <h4>Deactivate staff</h4>
              <p className="mb-2">
                {deleteTarget?.name
                  ? `This will deactivate ${deleteTarget.name} and disable their login.`
                  : "This will deactivate the staff member and disable their login."}
              </p>
              {deleteError && (
                <p className="text-danger small mb-2">{deleteError}</p>
              )}
              <div className="d-flex justify-content-center">
                <button
                  type="button"
                  className="btn btn-light me-3"
                  data-bs-dismiss="modal"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleteSubmitting || !deleteTarget}
                  onClick={handleConfirmDelete}
                >
                  {deleteSubmitting ? "Working…" : "Yes, deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Staff;
