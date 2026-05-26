import { useMemo, useRef, useState } from "react";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import { activeList, holidays } from "../../../core/common/selectoption/selectoption";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { useDepartments } from "../../../core/hooks/useDepartments";
import { apiService } from "../../../core/services/apiService";
import {
  exportDesignationsExcel,
  exportDesignationsPdf,
  printDesignationsTable,
} from "./designationExport";

function formatSalaryDisplay(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseDesignationApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  const marker = "message: ";
  const idx = msg.indexOf(marker);
  if (idx === -1) return msg || fallback;
  const jsonPart = msg.slice(idx + marker.length).trim();
  try {
    const j = JSON.parse(jsonPart) as { message?: string };
    if (typeof j.message === "string" && j.message.trim()) return j.message;
  } catch {
    /* ignore */
  }
  return msg || fallback;
}

function closeModalById(modalId: string) {
  const el = document.getElementById(modalId);
  if (!el) return;
  const bs = (window as any).bootstrap;
  if (bs?.Modal) {
    const modal = bs.Modal.getInstance(el) || new bs.Modal(el);
    modal.hide();
  }
}

const Designation = () => {
  const routes = all_routes;
  const { designations, loading, error, refetch } = useDesignations();
  const { departments, loading: departmentsLoading } = useDepartments();
  const data = designations;
  const [selectedDesignation, setSelectedDesignation] = useState<any>(null);
  const [editDesignationName, setEditDesignationName] = useState('');
  const [editDesignationStatus, setEditDesignationStatus] = useState(true);
  const [editSalaryMin, setEditSalaryMin] = useState('');
  const [editSalaryMax, setEditSalaryMax] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [addDesignationName, setAddDesignationName] = useState('');
  const [addDesignationStatus, setAddDesignationStatus] = useState(true);
  const [addSalaryMin, setAddSalaryMin] = useState('');
  const [addSalaryMax, setAddSalaryMax] = useState('');
  const [addDepartmentId, setAddDepartmentId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [designationPendingDelete, setDesignationPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const designationExportRows = useMemo(() => {
    return designations.map((r: any) => {
      const o = r.originalData || {};
      const deptId = o.department_id;
      let deptName = "—";
      if (deptId != null && deptId !== "") {
        const match = departments.find(
          (d: any) => Number(d.originalData?.id ?? d.id) === Number(deptId)
        );
        deptName =
          match?.department ??
          match?.originalData?.department_name ??
          `ID ${deptId}`;
      }
      return {
        ID: o.id != null ? String(o.id) : String(r.id ?? ""),
        Designation: String(r.designation ?? ""),
        Department: deptName,
        "Salary min": formatSalaryDisplay(o.salary_range_min),
        "Salary max": formatSalaryDisplay(o.salary_range_max),
        Status: String(r.status ?? ""),
      };
    });
  }, [designations, departments]);

  const departmentNameById = useMemo(() => {
    const map = new Map<number, string>();
    departments.forEach((d: any) => {
      const rawId = d.originalData?.id ?? d.id;
      const numericId = Number(rawId);
      if (!Number.isFinite(numericId)) return;
      const name =
        d.department ??
        d.originalData?.department_name ??
        `Department ${numericId}`;
      map.set(numericId, String(name));
    });
    return map;
  }, [departments]);

  const resolveDepartmentName = (record: any): string => {
    const deptId = record?.originalData?.department_id;
    if (deptId == null || deptId === "") return "—";
    const mapped = departmentNameById.get(Number(deptId));
    return mapped ?? `ID ${deptId}`;
  };

  const exportFileStamp = () => new Date().toISOString().slice(0, 10);

  const handleDesignationExportPdf = () => {
    try {
      if (!designationExportRows.length) {
        alert("No designations to export.");
        return;
      }
      exportDesignationsPdf(
        "Designations",
        `designations-${exportFileStamp()}`,
        designationExportRows
      );
    } catch (err: any) {
      alert(err?.message || "PDF export failed.");
    }
  };

  const handleDesignationExportExcel = () => {
    try {
      if (!designationExportRows.length) {
        alert("No designations to export.");
        return;
      }
      exportDesignationsExcel(
        `designations-${exportFileStamp()}`,
        designationExportRows
      );
    } catch (err: any) {
      alert(err?.message || "Excel export failed.");
    }
  };

  const handleDesignationPrint = () => {
    try {
      printDesignationsTable("Designations", designationExportRows);
    } catch (err: any) {
      alert(err?.message || "Print failed.");
    }
  };

  const columns = [
      {
        title: "ID",
        dataIndex: "id",
        render: (text: any, record: any) => (
          <>
           <Link to="#" className="link-primary">{text || record.id || 'N/A'}</Link>
          </>
        ),
        sorter: (a: TableData, b: TableData) => String(a.id || '').length - String(b.id || '').length,
      },
  
      {
        title: "Designation",
        dataIndex: "designation",
        sorter: (a: TableData, b: TableData) => a.designation.length - b.designation.length,
      },
      {
        title: "Department",
        dataIndex: "department",
        render: (_: unknown, record: any) => resolveDepartmentName(record),
        sorter: (a: any, b: any) =>
          resolveDepartmentName(a).localeCompare(resolveDepartmentName(b)),
      },
      {
        title: "Salary min",
        dataIndex: "salaryMin",
        render: (_: unknown, record: any) =>
          formatSalaryDisplay(record.originalData?.salary_range_min),
        sorter: (a: any, b: any) =>
          Number(a.originalData?.salary_range_min ?? 0) -
          Number(b.originalData?.salary_range_min ?? 0),
      },
      {
        title: "Salary max",
        dataIndex: "salaryMax",
        render: (_: unknown, record: any) =>
          formatSalaryDisplay(record.originalData?.salary_range_max),
        sorter: (a: any, b: any) =>
          Number(a.originalData?.salary_range_max ?? 0) -
          Number(b.originalData?.salary_range_max ?? 0),
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (text: string) => (
            <>
            {text === "Active" ? (
              <span
                className="badge badge-soft-success d-inline-flex align-items-center"
              >
                <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
              </span>
            ):
            (
              <span
                className="badge badge-soft-danger d-inline-flex align-items-center"
              >
                <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
              </span>
            )}
          </>
        ),
        sorter: (a: any, b: any) => a.status.length - b.status.length,
      },
      {
        title: "Action",
        dataIndex: "action",
        render: (text: any, record: any) => (
          <>
            <div className="dropdown">
              <Link
                to="#"
                className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
                data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
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
                      const desig = record.originalData || record;
                      const name =
                        desig.designation_name ||
                        desig.designation ||
                        desig.name ||
                        record.designation ||
                        '';
                      let status = true;
                      if (desig && Object.prototype.hasOwnProperty.call(desig, 'is_active')) {
                        status =
                          desig.is_active === true ||
                          desig.is_active === 1 ||
                          desig.is_active === 'true';
                      } else if (record.status) {
                        status = record.status === 'Active';
                      }
                      setEditDesignationName(name);
                      setEditDesignationStatus(status);
                      const smin = desig.salary_range_min;
                      const smax = desig.salary_range_max;
                      setEditSalaryMin(
                        smin != null && smin !== "" ? String(smin) : ""
                      );
                      setEditSalaryMax(
                        smax != null && smax !== "" ? String(smax) : ""
                      );
                      const did = desig.department_id;
                      setEditDepartmentId(
                        did != null && did !== "" ? String(did) : ""
                      );
                      setSelectedDesignation(record);
                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_designation');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                            modal.show();
                          }
                        }
                      }, 100);
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
                      const desig = record.originalData || record;
                      const rawId = desig.id ?? record.originalData?.id;
                      const nid =
                        typeof rawId === "number"
                          ? rawId
                          : parseInt(String(rawId ?? ""), 10);
                      if (!Number.isFinite(nid) || nid < 1) return;
                      setDeleteError(null);
                      setDesignationPendingDelete({
                        id: nid,
                        name: String(
                          desig.designation_name ||
                            desig.designation ||
                            record.designation ||
                            "this designation"
                        ),
                      });
                      setTimeout(() => {
                        const modalElement = document.getElementById(
                          "delete_designation_modal"
                        );
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal =
                              bootstrap.Modal.getInstance(modalElement) ||
                              new bootstrap.Modal(modalElement);
                            modal.show();
                          }
                        }
                      }, 0);
                    }}
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </>
        ),
      },
    ];
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Designation</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">HRM</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Designation
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={refetch}
                onPrint={handleDesignationPrint}
                onExportPdf={handleDesignationExportPdf}
                onExportExcel={handleDesignationExportExcel}
              />
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary d-flex align-items-center"
                    data-bs-toggle="modal"
                    data-bs-target="#add_designation"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Add Designation
                  </Link>
                </div>
              </div>
            </div>
            {/* /Page Header */}
            {/* Students List */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Designation</h4>
                <div className="d-flex align-items-center flex-wrap">
                  <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
                  </div>
                  <div className="dropdown mb-3 me-2">
              <Link
                to="#"
                className="btn btn-outline-light bg-white dropdown-toggle"
                data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                data-bs-auto-close="outside"
              >
                <i className="ti ti-filter me-2" />
                Filter
              </Link>
              <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                <form>
                  <div className="d-flex align-items-center border-bottom p-3">
                    <h4>Filter</h4>
                  </div>
                  <div className="p-3 border-bottom">
                    <div className="row">
                      <div className="col-md-12">
                        <div className="mb-3">
                          <label className="form-label">Holiday Title</label>
                          <CommonSelect
                                  className="select"
                                  options={activeList}
                                />
                        </div>
                      </div>
                      <div className="col-md-12">
                        <div className="mb-0">
                          <label className="form-label">Status</label>
                          <CommonSelect
                                  className="select"
                                  options={holidays}
                                />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 d-flex align-items-center justify-content-end">
                    <Link to="#" className="btn btn-light me-3">
                      Reset
                    </Link>
                    <Link
                            to="#"
                            className="btn btn-primary"
                            onClick={handleApplyClick}
                          >
                            Apply
                          </Link>
                  </div>
                </form>
              </div>
            </div>
                  <div className="dropdown mb-3">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                    >
                      <i className="ti ti-sort-ascending-2 me-2" />
                      Sort by A-Z{" "}
                    </Link>
                    <ul className="dropdown-menu p-3">
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Ascending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Descending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Viewed
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Added
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="card-body p-0 py-3">
                {/* Loading State */}
                {loading && (
                  <div className="text-center p-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading designations data...</p>
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="text-center p-4">
                    <div className="alert alert-danger" role="alert">
                      <i className="ti ti-alert-circle me-2"></i>
                      {error}
                      <button
                        className="btn btn-sm btn-outline-danger ms-3"
                        onClick={refetch}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* Student List */}
                {!loading && !error && (
                  <Table columns={columns} dataSource={data} Selection={true}/>
                )}
                {/* /Student List */}
              </div>
            </div>
            {/* /Students List */}
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Add Designation */}
        <div className="modal fade" id="add_designation">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Designation</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Designation</label>
                        <input
                          type="text"
                          className="form-control"
                          value={addDesignationName}
                          onChange={(e) => setAddDesignationName(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Department (optional)</label>
                        <select
                          className="form-select"
                          value={addDepartmentId}
                          onChange={(e) => setAddDepartmentId(e.target.value)}
                          disabled={departmentsLoading}
                        >
                          <option value="">— None —</option>
                          {departments.map((d: any) => {
                            const oid = d.originalData?.id ?? d.id;
                            const label =
                              d.department ??
                              d.originalData?.department_name ??
                              `Department ${oid}`;
                            return (
                              <option key={String(oid)} value={String(oid)}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Salary range min</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          step="0.01"
                          value={addSalaryMin}
                          onChange={(e) => setAddSalaryMin(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Salary range max</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          step="0.01"
                          value={addSalaryMax}
                          onChange={(e) => setAddSalaryMax(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="designation-add-status"
                          checked={addDesignationStatus}
                          onChange={(e) => setAddDesignationStatus(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                    onClick={() => {
                      setAddDesignationName("");
                      setAddSalaryMin("");
                      setAddSalaryMax("");
                      setAddDepartmentId("");
                      setAddDesignationStatus(true);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isCreating}
                    onClick={async () => {
                      const name = addDesignationName.trim();
                      if (!name) {
                        alert("Designation name is required");
                        return;
                      }
                      const minStr = addSalaryMin.trim();
                      const maxStr = addSalaryMax.trim();
                      const minNum =
                        minStr === "" ? null : Number(minStr);
                      const maxNum =
                        maxStr === "" ? null : Number(maxStr);
                      if (
                        (minStr !== "" && !Number.isFinite(minNum)) ||
                        (maxStr !== "" && !Number.isFinite(maxNum))
                      ) {
                        alert("Enter valid numbers for salary range");
                        return;
                      }
                      if (
                        minNum != null &&
                        maxNum != null &&
                        minNum > maxNum
                      ) {
                        alert(
                          "Salary range min must be less than or equal to max"
                        );
                        return;
                      }
                      const deptParsed = addDepartmentId
                        ? parseInt(addDepartmentId, 10)
                        : null;
                      if (addDepartmentId && !Number.isFinite(deptParsed)) {
                        alert("Invalid department");
                        return;
                      }
                      setIsCreating(true);
                      try {
                        const payload: Record<string, unknown> = {
                          designation_name: name,
                          is_active: addDesignationStatus,
                          department_id: deptParsed,
                          salary_range_min: minNum,
                          salary_range_max: maxNum,
                        };
                        const response = await apiService.createDesignation(
                          payload
                        );
                        if (response && response.status === "SUCCESS") {
                          const modalElement =
                            document.getElementById("add_designation");
                          if (modalElement) {
                            const bootstrap = (window as any).bootstrap;
                            if (bootstrap && bootstrap.Modal) {
                              const modal =
                                bootstrap.Modal.getInstance(modalElement) ||
                                new bootstrap.Modal(modalElement);
                              modal.hide();
                            }
                          }
                          setAddDesignationName("");
                          setAddSalaryMin("");
                          setAddSalaryMax("");
                          setAddDepartmentId("");
                          setAddDesignationStatus(true);
                          await refetch();
                        } else {
                          alert(
                            (response as any)?.message ||
                              "Failed to create designation"
                          );
                        }
                      } catch (err: any) {
                        console.error("Error creating designation:", err);
                        alert(
                          err?.message ||
                            "Failed to create designation. Please try again."
                        );
                      } finally {
                        setIsCreating(false);
                      }
                    }}
                  >
                    {isCreating ? "Saving..." : "Add Designation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Designation */}
        {/* Edit Designation */}
        <div className="modal fade" id="edit_designation">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Designation</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form >
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Designation</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Designation"
                          value={editDesignationName}
                          onChange={(e) => setEditDesignationName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Department (optional)</label>
                        <select
                          className="form-select"
                          value={editDepartmentId}
                          onChange={(e) => setEditDepartmentId(e.target.value)}
                          disabled={departmentsLoading}
                        >
                          <option value="">— None —</option>
                          {departments.map((d: any) => {
                            const oid = d.originalData?.id ?? d.id;
                            const label =
                              d.department ??
                              d.originalData?.department_name ??
                              `Department ${oid}`;
                            return (
                              <option key={String(oid)} value={String(oid)}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Salary range min</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          step="0.01"
                          value={editSalaryMin}
                          onChange={(e) => setEditSalaryMin(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Salary range max</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          step="0.01"
                          value={editSalaryMax}
                          onChange={(e) => setEditSalaryMax(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="designation-edit-status"
                          checked={editDesignationStatus}
                          onChange={(e) => setEditDesignationStatus(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      const idRaw = selectedDesignation?.originalData?.id;
                      const id =
                        typeof idRaw === "number" ? idRaw : parseInt(String(idRaw ?? ""), 10);
                      if (!Number.isFinite(id) || id <= 0 || isUpdating) return;

                      const name = editDesignationName.trim();
                      if (!name) {
                        alert('Designation name is required');
                        return;
                      }

                      const minStr = editSalaryMin.trim();
                      const maxStr = editSalaryMax.trim();
                      const minNum =
                        minStr === "" ? null : Number(minStr);
                      const maxNum =
                        maxStr === "" ? null : Number(maxStr);
                      if (
                        (minStr !== "" && !Number.isFinite(minNum)) ||
                        (maxStr !== "" && !Number.isFinite(maxNum))
                      ) {
                        alert("Enter valid numbers for salary range");
                        return;
                      }
                      if (
                        minNum != null &&
                        maxNum != null &&
                        minNum > maxNum
                      ) {
                        alert(
                          "Salary range min must be less than or equal to max"
                        );
                        return;
                      }
                      const deptParsed = editDepartmentId
                        ? parseInt(editDepartmentId, 10)
                        : null;
                      if (editDepartmentId && !Number.isFinite(deptParsed)) {
                        alert("Invalid department");
                        return;
                      }

                      setIsUpdating(true);
                      try {
                        const payload = {
                          designation_name: name,
                          is_active: editDesignationStatus,
                          department_id: deptParsed,
                          salary_range_min: minNum,
                          salary_range_max: maxNum,
                        };
                        const response = await apiService.updateDesignation(id, payload);
                        if (response && response.status === 'SUCCESS') {
                          const modalElement = document.getElementById('edit_designation');
                          if (modalElement) {
                            const bootstrap = (window as any).bootstrap;
                            if (bootstrap && bootstrap.Modal) {
                              const modal = bootstrap.Modal.getInstance(modalElement);
                              if (modal) modal.hide();
                            }
                          }
                          await refetch();
                          setSelectedDesignation(null);
                        } else {
                          alert(response?.message || 'Failed to update designation');
                        }
                      } catch (err: any) {
                        console.error('Error updating designation:', err);
                        alert(err?.message || 'Failed to update designation. Please try again.');
                      } finally {
                        setIsUpdating(false);
                      }
                    }}
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Department */}
        {/* Delete Modal */}
        <div className="modal fade" id="delete_designation_modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="modal-body text-center">
                  <span className="delete-icon">
                    <i className="ti ti-trash-x" />
                  </span>
                  <h4>Confirm Deletion</h4>
                  {deleteError && (
                    <div className="alert alert-danger text-start mb-3" role="alert">
                      {deleteError}
                    </div>
                  )}
                  <p className="mb-1">
                    Delete designation{" "}
                    <strong>{designationPendingDelete?.name ?? "—"}</strong>? This
                    cannot be undone.
                  </p>
                  <p className="text-muted small">
                    Deletion is blocked if staff members still use this designation.
                  </p>
                  <div className="d-flex justify-content-center mt-3">
                    <button
                      type="button"
                      className="btn btn-light me-3"
                      data-bs-dismiss="modal"
                      disabled={isDeleting}
                      onClick={() => {
                        setDeleteError(null);
                        setDesignationPendingDelete(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={isDeleting || !designationPendingDelete}
                      onClick={async () => {
                        if (!designationPendingDelete) return;
                        setDeleteError(null);
                        try {
                          setIsDeleting(true);
                          const response = await apiService.deleteDesignation(
                            designationPendingDelete.id
                          );
                          if (response && response.status === "SUCCESS") {
                            closeModalById("delete_designation_modal");
                            setDesignationPendingDelete(null);
                            await refetch();
                          } else {
                            setDeleteError(
                              (response as { message?: string })?.message ||
                                "Failed to delete designation"
                            );
                          }
                        } catch (err) {
                          setDeleteError(
                            parseDesignationApiError(
                              err,
                              "Failed to delete designation."
                            )
                          );
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                    >
                      {isDeleting ? "Deleting…" : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Delete Modal */}
      </>
    </div>
  );
};

export default Designation;





