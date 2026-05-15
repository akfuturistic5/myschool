import { Link } from "react-router-dom";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Dropdown, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { apiService } from "../../../core/services/apiService";
import { useCurrentUser } from "../../../core/hooks/useCurrentUser";
import { selectUser } from "../../../core/data/redux/authSlice";
import { isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

type RowExamType = {
  id: number;
  type_name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
};

const MASTER_DESCRIPTION_MAX = 5000;
const MASTER_SETTINGS_ROLE_IDS = new Set([1, 6]);

function formatDt(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const ExamTypeManagement = () => {
  const route = all_routes;
  const { user: meUser, loading: meLoading } = useCurrentUser();
  const reduxUser = useSelector(selectUser);

  const isAdmin = useMemo(() => {
    const candidates: Array<unknown> = [meUser, reduxUser].filter(Boolean);
    if (candidates.length === 0) return false;
    return candidates.some((candidate) => {
      const c = candidate as { role_id?: number | string; user_role_id?: number | string };
      const rawId = c.role_id ?? c.user_role_id;
      const rid = Number(rawId);
      if (Number.isFinite(rid) && MASTER_SETTINGS_ROLE_IDS.has(rid)) return true;
      return isHeadmasterRole(candidate as any) || isAdministrativeRole(candidate as any);
    });
  }, [meUser, reduxUser]);

  const sessionPending = meLoading && !meUser && !reduxUser;
  const controlsLocked = !isAdmin;

  const [rows, setRows] = useState<RowExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newTypeName, setNewTypeName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [listSearch, setListSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiService.getExamTypes({ includeInactive: true });
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError((e as Error)?.message || "Failed to load exam types");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.type_name, row.description, row.is_active ? "yes" : "no", formatDt(row.created_at)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, listSearch]);

  const handleExportPdf = useCallback(() => {
    const columns = [
      { title: "Type Name", dataKey: "Type Name" },
      { title: "Description", dataKey: "Description" },
      { title: "Active", dataKey: "Active" },
      { title: "Created", dataKey: "Created" },
    ];
    const data = filteredRows.map((r) => ({
      "Type Name": r.type_name,
      Description: r.description ?? "",
      Active: r.is_active ? "Yes" : "No",
      Created: formatDt(r.created_at),
    }));
    exportToPDF(data, "Exam Types", "Exam_Types_Export", columns);
  }, [filteredRows]);

  const handleExportExcel = useCallback(() => {
    const data = filteredRows.map((r) => ({
      "Type Name": r.type_name,
      Description: r.description ?? "",
      Active: r.is_active ? "Yes" : "No",
      Created: formatDt(r.created_at),
    }));
    exportToExcel(data, "Exam_Types_Export", "Exam Types");
  }, [filteredRows]);

  const handleExportPrint = useCallback(() => {
    const columns = [
      { title: "Type Name", dataKey: "Type Name" },
      { title: "Description", dataKey: "Description" },
      { title: "Active", dataKey: "Active" },
      { title: "Created", dataKey: "Created" },
    ];
    const data = filteredRows.map((r) => ({
      "Type Name": r.type_name,
      Description: r.description ?? "",
      Active: r.is_active ? "Yes" : "No",
      Created: formatDt(r.created_at),
    }));
    printData("Exam Types", columns, data);
  }, [filteredRows]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (controlsLocked) return;
    if (!newTypeName.trim()) {
      setError("Type name is required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.createExamType({
        type_name: newTypeName.trim(),
        description: newDescription.trim() || null,
        is_active: newIsActive,
      });
      setNewTypeName("");
      setNewDescription("");
      setNewIsActive(true);
      setMessage("Exam type created successfully.");
      await loadRows();
    } catch (err) {
      setError((err as Error)?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: RowExamType) => {
    setEditingId(row.id);
    setEditTypeName(row.type_name);
    setEditDescription(row.description || "");
    setEditIsActive(row.is_active);
    setError("");
    setMessage("");
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (controlsLocked || editingId == null) return;
    if (!editTypeName.trim()) {
      setError("Type name is required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.updateExamType(editingId, {
        type_name: editTypeName.trim(),
        description: editDescription.trim() || null,
        is_active: editIsActive,
      });
      setEditingId(null);
      setMessage("Exam type updated successfully.");
      await loadRows();
    } catch (err) {
      setError((err as Error)?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    if (controlsLocked) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.toggleExamTypeStatus(id);
      setMessage("Status updated.");
      await loadRows();
    } catch (err) {
      setError((err as Error)?.message || "Failed to toggle status");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (controlsLocked || deleteTarget == null) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.deleteExamType(deleteTarget.id);
      setDeleteTarget(null);
      setMessage("Record deleted.");
      await loadRows();
    } catch (err) {
      setError((err as Error)?.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content bg-white">
        <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Exam Types</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={route.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <span className="text-muted">Settings</span>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Exam Types
                </li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <div className="pe-1 mb-2">
              <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-refresh">Refresh</Tooltip>}>
                <button
                  type="button"
                  className="btn btn-outline-light bg-white btn-icon me-1"
                  onClick={() => loadRows()}
                  disabled={saving || loading || sessionPending}
                >
                  <i className="ti ti-refresh" />
                </button>
              </OverlayTrigger>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-muted mb-4">Manage custom exam categories (e.g. Unit Test 1, Semester 2, internal assessment).</p>

          {sessionPending && <div className="alert alert-info">Loading your session…</div>}
          {!sessionPending && controlsLocked && (
            <div className="alert alert-warning">
              Actions are available only for Headmaster or Administrative role.
            </div>
          )}
          {loading && <div className="alert alert-info">Loading…</div>}
          {!!message && <div className="alert alert-success">{message}</div>}
          {!!error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleAdd} className="border rounded p-3 mb-4">
            <h6 className="mb-3">Add new Exam Type</h6>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Type Name</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength={100}
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  disabled={controlsLocked || saving || loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength={MASTER_DESCRIPTION_MAX}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  disabled={controlsLocked || saving || loading}
                />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="new-active"
                    checked={newIsActive}
                    onChange={(e) => setNewIsActive(e.target.checked)}
                    disabled={controlsLocked || saving || loading}
                  />
                  <label className="form-check-label" htmlFor="new-active">
                    Active
                  </label>
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-3" disabled={controlsLocked || saving || loading}>
              Create Type
            </button>
          </form>

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="flex-grow-1" style={{ minWidth: 220, maxWidth: 420 }}>
              <input
                type="search"
                className="form-control"
                placeholder="Search exam types…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
            <Dropdown>
              <Dropdown.Toggle variant="outline-primary" disabled={loading || filteredRows.length === 0}>
                <i className="ti ti-download me-1" />
                Export
              </Dropdown.Toggle>
              <Dropdown.Menu align="end">
                <Dropdown.Item onClick={handleExportPdf}>PDF</Dropdown.Item>
                <Dropdown.Item onClick={handleExportExcel}>Excel</Dropdown.Item>
                <Dropdown.Item onClick={handleExportPrint}>Print</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>

          <div className="table-responsive border rounded">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Type Name</th>
                  <th>Description</th>
                  <th>Active</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {editingId === row.id ? (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editTypeName}
                          onChange={(e) => setEditTypeName(e.target.value)}
                        />
                      ) : (
                        <span className="fw-bold">{row.type_name}</span>
                      )}
                    </td>
                    <td>
                      {editingId === row.id ? (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                      ) : (
                        row.description || "—"
                      )}
                    </td>
                    <td>
                      {editingId === row.id ? (
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                          />
                        </div>
                      ) : (
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={row.is_active}
                            onChange={() => handleToggle(row.id)}
                            disabled={controlsLocked || saving}
                          />
                        </div>
                      )}
                    </td>
                    <td className="small text-muted">{formatDt(row.created_at)}</td>
                    <td className="text-end">
                      {editingId === row.id ? (
                        <div className="btn-group">
                          <button className="btn btn-sm btn-success" onClick={handleEdit} disabled={saving}>
                            Save
                          </button>
                          <button className="btn btn-sm btn-light" onClick={() => setEditingId(null)} disabled={saving}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => startEdit(row)}
                            disabled={controlsLocked || saving}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setDeleteTarget({ id: row.id, label: row.type_name })}
                            disabled={controlsLocked || saving}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No exam types found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal show={deleteTarget !== null} onHide={() => setDeleteTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the exam type <strong>{deleteTarget?.label}</strong>?
          <br />
          <small className="text-danger">This action cannot be undone if no exams are linked.</small>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-light" onClick={() => setDeleteTarget(null)} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={confirmDelete} disabled={saving}>
            {saving ? "Deleting..." : "Delete"}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamTypeManagement;
