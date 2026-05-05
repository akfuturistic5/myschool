import { Link } from "react-router-dom";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Dropdown, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { apiService } from "../../../core/services/apiService";
import { useCurrentUser } from "../../../core/hooks/useCurrentUser";
import { selectUser } from "../../../core/data/redux/authSlice";
import { isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

export type SchoolMasterKind = "houses" | "blood-groups" | "mother-tongues" | "casts";

type ReligionOpt = { id: number; religion_name: string };

type RowHouse = {
  id: number;
  house_name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
};

type RowBlood = {
  id: number;
  blood_group: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
};

type RowMother = {
  id: number;
  language_name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
};

type RowCast = {
  id: number;
  cast_name: string;
  religion_id?: number | null;
  religion_name?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
};

type AnyRow = RowHouse | RowBlood | RowMother | RowCast;

/** Must match server `masterDataAdminGate.MAX_MASTER_DESCRIPTION_CHARS` */
const MASTER_DESCRIPTION_MAX = 5000;

/** Matches server `config/roles.js` ROLES.ADMIN (1) + ADMINISTRATIVE (6) for master-data writes */
const MASTER_SETTINGS_ROLE_IDS = new Set([1, 6]);

function formatDt(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SchoolMasterSettingsPage({ kind }: { kind: SchoolMasterKind }) {
  const route = all_routes;
  const { user: meUser, loading: meLoading } = useCurrentUser();
  const reduxUser = useSelector(selectUser);

  /**
   * Robust permission resolution: evaluate BOTH /auth/me and Redux session and grant if either
   * source identifies Headmaster/Administrative. This avoids false-disabled controls when one
   * source is stale/incomplete.
   */
  const isAdmin = useMemo(() => {
    const candidates: Array<unknown> = [meUser, reduxUser].filter(Boolean);
    if (candidates.length === 0) return false;
    return candidates.some((candidate) => {
      const c = candidate as { role_id?: number | string; user_role_id?: number | string };
      const rawId = c.role_id ?? c.user_role_id;
      const rid = Number(rawId);
      if (Number.isFinite(rid) && MASTER_SETTINGS_ROLE_IDS.has(rid)) return true;
      return isHeadmasterRole(candidate as never) || isAdministrativeRole(candidate as never);
    });
  }, [meUser, reduxUser]);

  const sessionPending = meLoading && !meUser && !reduxUser;
  const controlsLocked = !isAdmin;

  const meta = useMemo(() => {
    switch (kind) {
      case "houses":
        return {
          title: "Houses",
          description: "Manage school houses (e.g. for sports or student grouping).",
        };
      case "blood-groups":
        return {
          title: "Blood Groups",
          description: "Manage blood group options used on student and user profiles.",
        };
      case "mother-tongues":
        return {
          title: "Mother Tongues",
          description: "Manage language options for student demographics.",
        };
      case "casts":
        return {
          title: "Casts",
          description: "Manage cast categories, optionally linked to a religion.",
        };
      default:
        return { title: "", description: "" };
    }
  }, [kind]);

  const [rows, setRows] = useState<AnyRow[]>([]);
  const [religions, setReligions] = useState<ReligionOpt[]>([]);
  const [religionsError, setReligionsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newPrimary, setNewPrimary] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReligionId, setNewReligionId] = useState<string>("");
  const [newIsActive, setNewIsActive] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrimary, setEditPrimary] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editReligionId, setEditReligionId] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [listSearch, setListSearch] = useState("");
  /** Delete confirmation modal target (all four master kinds share this page). */
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    setListSearch("");
    setDeleteTarget(null);
  }, [kind]);

  const deleteEntityLabel = useMemo(() => {
    switch (kind) {
      case "houses":
        return "house";
      case "blood-groups":
        return "blood group";
      case "mother-tongues":
        return "language";
      case "casts":
        return "cast";
      default:
        return "record";
    }
  }, [kind]);

  const rowDeleteLabel = (row: AnyRow): string => {
    if (kind === "houses") {
      const n = (row as RowHouse).house_name?.trim();
      return n || `Record #${row.id}`;
    }
    if (kind === "blood-groups") {
      const n = (row as RowBlood).blood_group?.trim();
      return n || `Record #${row.id}`;
    }
    if (kind === "mother-tongues") {
      const n = (row as RowMother).language_name?.trim();
      return n || `Record #${row.id}`;
    }
    const n = (row as RowCast).cast_name?.trim();
    return n || `Record #${row.id}`;
  };

  const openDeleteConfirm = (row: AnyRow) => {
    if (controlsLocked) return;
    setDeleteTarget({ id: row.id, label: rowDeleteLabel(row) });
    setError("");
    setMessage("");
  };

  const closeDeleteConfirm = () => {
    if (!saving) setDeleteTarget(null);
  };

  const filteredRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      if (kind === "houses") {
        const r = row as RowHouse;
        return [r.house_name, r.description, r.is_active ? "yes" : "no", formatDt(r.created_at)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }
      if (kind === "blood-groups") {
        const r = row as RowBlood;
        return [r.blood_group, r.description, r.is_active ? "yes" : "no", formatDt(r.created_at)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }
      if (kind === "mother-tongues") {
        const r = row as RowMother;
        return [r.language_name, r.description, r.is_active ? "yes" : "no", formatDt(r.created_at)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }
      const r = row as RowCast;
      return [
        r.cast_name,
        r.religion_name,
        r.description,
        r.is_active ? "yes" : "no",
        formatDt(r.created_at),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, listSearch, kind]);

  const buildExportPayload = useCallback((): {
    columns: { title: string; dataKey: string }[];
    data: Record<string, string>[];
  } => {
    const fr = filteredRows;
    switch (kind) {
      case "houses":
        return {
          columns: [
            { title: "House name", dataKey: "House name" },
            { title: "Description", dataKey: "Description" },
            { title: "Active", dataKey: "Active" },
            { title: "Created", dataKey: "Created" },
          ],
          data: (fr as RowHouse[]).map((r) => ({
            "House name": r.house_name,
            Description: r.description ?? "",
            Active: r.is_active ? "Yes" : "No",
            Created: formatDt(r.created_at),
          })),
        };
      case "blood-groups":
        return {
          columns: [
            { title: "Blood group", dataKey: "Blood group" },
            { title: "Description", dataKey: "Description" },
            { title: "Active", dataKey: "Active" },
            { title: "Created", dataKey: "Created" },
          ],
          data: (fr as RowBlood[]).map((r) => ({
            "Blood group": r.blood_group,
            Description: r.description ?? "",
            Active: r.is_active ? "Yes" : "No",
            Created: formatDt(r.created_at),
          })),
        };
      case "mother-tongues":
        return {
          columns: [
            { title: "Language", dataKey: "Language" },
            { title: "Description", dataKey: "Description" },
            { title: "Active", dataKey: "Active" },
            { title: "Created", dataKey: "Created" },
          ],
          data: (fr as RowMother[]).map((r) => ({
            Language: r.language_name,
            Description: r.description ?? "",
            Active: r.is_active ? "Yes" : "No",
            Created: formatDt(r.created_at),
          })),
        };
      default:
        return {
          columns: [
            { title: "Cast", dataKey: "Cast" },
            { title: "Religion", dataKey: "Religion" },
            { title: "Description", dataKey: "Description" },
            { title: "Active", dataKey: "Active" },
            { title: "Created", dataKey: "Created" },
          ],
          data: (fr as RowCast[]).map((r) => ({
            Cast: r.cast_name,
            Religion: r.religion_name ?? "",
            Description: r.description ?? "",
            Active: r.is_active ? "Yes" : "No",
            Created: formatDt(r.created_at),
          })),
        };
    }
  }, [kind, filteredRows]);

  const handleExportPdf = useCallback(() => {
    const { columns, data } = buildExportPayload();
    if (data.length === 0) return;
    const base = `${meta.title.replace(/\s+/g, "_")}_export_${new Date().toISOString().slice(0, 10)}`;
    exportToPDF(data, meta.title, base, columns);
  }, [buildExportPayload, meta.title]);

  const handleExportExcel = useCallback(() => {
    const { data } = buildExportPayload();
    if (data.length === 0) return;
    const base = `${meta.title.replace(/\s+/g, "_")}_export_${new Date().toISOString().slice(0, 10)}`;
    exportToExcel(data, base, meta.title);
  }, [buildExportPayload, meta.title]);

  const handleExportPrint = useCallback(() => {
    const { columns, data } = buildExportPayload();
    if (data.length === 0) return;
    printData(meta.title, columns, data);
  }, [buildExportPayload, meta.title]);

  const loadReligions = useCallback(async () => {
    if (kind !== "casts") return;
    try {
      setReligionsError("");
      const res = await apiService.getReligions({ includeInactive: false });
      setReligions(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setReligions([]);
      setReligionsError((e as Error)?.message || "Failed to load religions for cast linking.");
    }
  }, [kind]);

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      let res;
      switch (kind) {
        case "houses":
          res = await apiService.getHouses({ includeInactive: true });
          break;
        case "blood-groups":
          res = await apiService.getBloodGroups({ includeInactive: true });
          break;
        case "mother-tongues":
          res = await apiService.getMotherTongues({ includeInactive: true });
          break;
        case "casts":
          res = await apiService.getCasts({ includeInactive: true });
          break;
        default:
          res = { data: [] };
      }
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError((e as Error)?.message || "Failed to load data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    loadReligions();
  }, [loadReligions]);

  const validate = (): string => {
    if (newDescription.length > MASTER_DESCRIPTION_MAX) {
      return `Description must be ${MASTER_DESCRIPTION_MAX} characters or fewer.`;
    }
    if (kind === "houses") {
      const n = newPrimary.trim();
      if (!n) return "House name is required.";
      if (n.length > 50) return "House name must be 50 characters or fewer.";
      return "";
    }
    if (kind === "blood-groups") {
      const n = newPrimary.trim().toUpperCase();
      if (!n) return "Blood group is required.";
      if (n.length > 10) return "Blood group must be 10 characters or fewer.";
      return "";
    }
    if (kind === "mother-tongues") {
      const n = newPrimary.trim();
      if (!n) return "Language name is required.";
      if (n.length > 50) return "Language name must be 50 characters or fewer.";
      return "";
    }
    if (kind === "casts") {
      const n = newPrimary.trim();
      if (!n) return "Cast name is required.";
      if (n.length > 100) return "Cast name must be 100 characters or fewer.";
      return "";
    }
    return "";
  };

  const validateEdit = (): string => {
    if (editDescription.length > MASTER_DESCRIPTION_MAX) {
      return `Description must be ${MASTER_DESCRIPTION_MAX} characters or fewer.`;
    }
    if (kind === "houses") {
      const n = editPrimary.trim();
      if (!n) return "House name is required.";
      if (n.length > 50) return "House name must be 50 characters or fewer.";
      return "";
    }
    if (kind === "blood-groups") {
      const n = editPrimary.trim().toUpperCase();
      if (!n) return "Blood group is required.";
      if (n.length > 10) return "Blood group must be 10 characters or fewer.";
      return "";
    }
    if (kind === "mother-tongues") {
      const n = editPrimary.trim();
      if (!n) return "Language name is required.";
      if (n.length > 50) return "Language name must be 50 characters or fewer.";
      return "";
    }
    if (kind === "casts") {
      const n = editPrimary.trim();
      if (!n) return "Cast name is required.";
      if (n.length > 100) return "Cast name must be 100 characters or fewer.";
      return "";
    }
    return "";
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (controlsLocked) return;
    const ve = validate();
    if (ve) {
      setError(ve);
      return;
    }
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const desc = newDescription.trim() || null;
      if (kind === "houses") {
        await apiService.createHouse({
          house_name: newPrimary.trim(),
          description: desc,
          is_active: newIsActive,
        });
      } else if (kind === "blood-groups") {
        await apiService.createBloodGroup({
          blood_group_name: newPrimary.trim().toUpperCase(),
          description: desc,
          is_active: newIsActive,
        });
      } else if (kind === "mother-tongues") {
        await apiService.createMotherTongue({
          language_name: newPrimary.trim(),
          description: desc,
          is_active: newIsActive,
        });
      } else {
        await apiService.createCast({
          cast_name: newPrimary.trim(),
          description: desc,
          is_active: newIsActive,
          religion_id: newReligionId ? Number(newReligionId) : null,
        });
      }
      setNewPrimary("");
      setNewDescription("");
      setNewReligionId("");
      setNewIsActive(true);
      setMessage("Record created successfully.");
      await loadRows();
    } catch (err) {
      setError((err as Error)?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: AnyRow) => {
    setEditingId(row.id);
    setError("");
    setMessage("");
    if (kind === "houses") {
      const r = row as RowHouse;
      setEditPrimary(r.house_name || "");
      setEditDescription(r.description || "");
      setEditReligionId("");
    } else if (kind === "blood-groups") {
      const r = row as RowBlood;
      setEditPrimary(r.blood_group || "");
      setEditDescription(r.description || "");
      setEditReligionId("");
    } else if (kind === "mother-tongues") {
      const r = row as RowMother;
      setEditPrimary(r.language_name || "");
      setEditDescription(r.description || "");
      setEditReligionId("");
    } else {
      const r = row as RowCast;
      setEditPrimary(r.cast_name || "");
      setEditDescription(r.description || "");
      setEditReligionId(r.religion_id != null ? String(r.religion_id) : "");
    }
    setEditIsActive(Boolean(row.is_active));
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (controlsLocked || editingId == null) return;
    const ve = validateEdit();
    if (ve) {
      setError(ve);
      return;
    }
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const desc = editDescription.trim() || null;
      if (kind === "houses") {
        await apiService.updateHouse(editingId, {
          house_name: editPrimary.trim(),
          description: desc,
          is_active: editIsActive,
        });
      } else if (kind === "blood-groups") {
        await apiService.updateBloodGroup(editingId, {
          blood_group_name: editPrimary.trim().toUpperCase(),
          description: desc,
          is_active: editIsActive,
        });
      } else if (kind === "mother-tongues") {
        await apiService.updateMotherTongue(editingId, {
          language_name: editPrimary.trim(),
          description: desc,
          is_active: editIsActive,
        });
      } else {
        await apiService.updateCast(editingId, {
          cast_name: editPrimary.trim(),
          description: desc,
          is_active: editIsActive,
          religion_id: editReligionId ? Number(editReligionId) : null,
        });
      }
      setEditingId(null);
      setMessage("Record updated successfully.");
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
      if (kind === "houses") await apiService.toggleHouseStatus(id);
      else if (kind === "blood-groups") await apiService.toggleBloodGroupStatus(id);
      else if (kind === "mother-tongues") await apiService.toggleMotherTongueStatus(id);
      else await apiService.toggleCastStatus(id);
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
    const id = deleteTarget.id;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      if (kind === "houses") await apiService.deleteHouse(id);
      else if (kind === "blood-groups") await apiService.deleteBloodGroup(id);
      else if (kind === "mother-tongues") await apiService.deleteMotherTongue(id);
      else await apiService.deleteCast(id);
      setDeleteTarget(null);
      setMessage("Record deleted.");
      if (editingId === id) setEditingId(null);
      await loadRows();
    } catch (err) {
      setError((err as Error)?.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const primaryLabel =
    kind === "houses"
      ? "House name"
      : kind === "blood-groups"
        ? "Blood group"
        : kind === "mother-tongues"
          ? "Language name"
          : "Cast name";

  const primaryMax =
    kind === "houses" ? 50 : kind === "blood-groups" ? 10 : kind === "mother-tongues" ? 50 : 100;

  return (
    <div>
      <div className="page-wrapper">
        <div className="content bg-white">
          <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">{meta.title}</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={route.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <span className="text-muted">Settings</span>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    {meta.title}
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
                <p className="text-muted mb-4">{meta.description}</p>

                {sessionPending && <div className="alert alert-info">Loading your session…</div>}
                {!sessionPending && controlsLocked && (
                  <div className="alert alert-warning">
                    You can view this page, but create/edit/delete actions are available only for Headmaster or Administrative role.
                  </div>
                )}
                {loading && <div className="alert alert-info">Loading…</div>}
                {!!message && <div className="alert alert-success">{message}</div>}
                {!!error && <div className="alert alert-danger">{error}</div>}
                {kind === "casts" && !!religionsError && (
                  <div className="alert alert-warning">{religionsError}</div>
                )}

                <form onSubmit={handleAdd} className="border rounded p-3 mb-4">
                  <h6 className="mb-3">Add new</h6>
                  <div className="row">
                    <div className={kind === "casts" ? "col-md-4" : "col-md-5"}>
                      <label className="form-label">{primaryLabel}</label>
                      <input
                        type="text"
                        className="form-control"
                        maxLength={primaryMax}
                        value={newPrimary}
                        onChange={(e) => setNewPrimary(e.target.value)}
                        disabled={controlsLocked || saving || loading}
                      />
                    </div>
                    {kind === "casts" && (
                      <div className="col-md-4">
                        <label className="form-label">Religion (optional)</label>
                        <select
                          className="form-select"
                          value={newReligionId}
                          onChange={(e) => setNewReligionId(e.target.value)}
                          disabled={controlsLocked || saving || loading}
                        >
                          <option value="">— None —</option>
                          {religions.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.religion_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={kind === "casts" ? "col-md-4" : "col-md-5"}>
                      <label className="form-label">Description (optional, max {MASTER_DESCRIPTION_MAX})</label>
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
                  <button type="submit" className="btn btn-primary mt-2" disabled={controlsLocked || saving || loading}>
                    Create
                  </button>
                </form>

                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <div className="flex-grow-1" style={{ minWidth: 220, maxWidth: 420 }}>
                    <label className="form-label visually-hidden" htmlFor="master-list-search">
                      Search list
                    </label>
                    <input
                      id="master-list-search"
                      type="search"
                      className="form-control"
                      placeholder="Search…"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <Dropdown>
                    <Dropdown.Toggle
                      variant="outline-primary"
                      id={`export-master-${kind}`}
                      disabled={loading || filteredRows.length === 0}
                    >
                      <i className="ti ti-download me-1" aria-hidden />
                      Export
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                      <Dropdown.Item as="button" type="button" onClick={handleExportPdf}>
                        PDF
                      </Dropdown.Item>
                      <Dropdown.Item as="button" type="button" onClick={handleExportExcel}>
                        Excel
                      </Dropdown.Item>
                      <Dropdown.Item as="button" type="button" onClick={handleExportPrint}>
                        Print
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>

                <div className="table-responsive border rounded">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        {kind === "houses" && (
                          <>
                            <th>House name</th>
                            <th>Description</th>
                            <th>Active</th>
                            <th>Created</th>
                            <th className="text-end">Actions</th>
                          </>
                        )}
                        {kind === "blood-groups" && (
                          <>
                            <th>Blood group</th>
                            <th>Description</th>
                            <th>Active</th>
                            <th>Created</th>
                            <th className="text-end">Actions</th>
                          </>
                        )}
                        {kind === "mother-tongues" && (
                          <>
                            <th>Language</th>
                            <th>Description</th>
                            <th>Active</th>
                            <th>Created</th>
                            <th className="text-end">Actions</th>
                          </>
                        )}
                        {kind === "casts" && (
                          <>
                            <th>Cast</th>
                            <th>Religion</th>
                            <th>Description</th>
                            <th>Active</th>
                            <th>Created</th>
                            <th className="text-end">Actions</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {!loading && rows.length === 0 && (
                        <tr>
                          <td colSpan={kind === "casts" ? 6 : 5} className="text-center text-muted py-4">
                            No records yet. Add one above.
                          </td>
                        </tr>
                      )}
                      {!loading && rows.length > 0 && filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={kind === "casts" ? 6 : 5} className="text-center text-muted py-4">
                            No rows match your search.
                          </td>
                        </tr>
                      )}
                      {kind === "houses" &&
                        (filteredRows as RowHouse[]).map((r) => (
                          <tr key={r.id}>
                            <td>{r.house_name}</td>
                            <td>{r.description || "—"}</td>
                            <td>
                              <span className={r.is_active ? "text-success" : "text-muted"}>
                                {r.is_active ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>{formatDt(r.created_at)}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-light me-1"
                                onClick={() => handleToggle(r.id)}
                                disabled={controlsLocked || saving}
                              >
                                Toggle
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary me-1"
                                onClick={() => startEdit(r)}
                                disabled={controlsLocked || saving}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => openDeleteConfirm(r)}
                                disabled={controlsLocked || saving}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      {kind === "blood-groups" &&
                        (filteredRows as RowBlood[]).map((r) => (
                          <tr key={r.id}>
                            <td>{r.blood_group}</td>
                            <td>{r.description || "—"}</td>
                            <td>
                              <span className={r.is_active ? "text-success" : "text-muted"}>
                                {r.is_active ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>{formatDt(r.created_at)}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-light me-1"
                                onClick={() => handleToggle(r.id)}
                                disabled={controlsLocked || saving}
                              >
                                Toggle
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary me-1"
                                onClick={() => startEdit(r)}
                                disabled={controlsLocked || saving}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => openDeleteConfirm(r)}
                                disabled={controlsLocked || saving}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      {kind === "mother-tongues" &&
                        (filteredRows as RowMother[]).map((r) => (
                          <tr key={r.id}>
                            <td>{r.language_name}</td>
                            <td>{r.description || "—"}</td>
                            <td>
                              <span className={r.is_active ? "text-success" : "text-muted"}>
                                {r.is_active ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>{formatDt(r.created_at)}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-light me-1"
                                onClick={() => handleToggle(r.id)}
                                disabled={controlsLocked || saving}
                              >
                                Toggle
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary me-1"
                                onClick={() => startEdit(r)}
                                disabled={controlsLocked || saving}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => openDeleteConfirm(r)}
                                disabled={controlsLocked || saving}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      {kind === "casts" &&
                        (filteredRows as RowCast[]).map((r) => (
                          <tr key={r.id}>
                            <td>{r.cast_name}</td>
                            <td>{r.religion_name || "—"}</td>
                            <td>{r.description || "—"}</td>
                            <td>
                              <span className={r.is_active ? "text-success" : "text-muted"}>
                                {r.is_active ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>{formatDt(r.created_at)}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-light me-1"
                                onClick={() => handleToggle(r.id)}
                                disabled={controlsLocked || saving}
                              >
                                Toggle
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary me-1"
                                onClick={() => startEdit(r)}
                                disabled={controlsLocked || saving}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => openDeleteConfirm(r)}
                                disabled={controlsLocked || saving}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <Modal
                  show={editingId != null}
                  onHide={() => {
                    if (!saving) setEditingId(null);
                  }}
                  size="lg"
                  centered
                  backdrop={saving ? "static" : true}
                >
                  <Modal.Header closeButton={!saving}>
                    <Modal.Title>Edit record</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <form id="school-master-edit-form" onSubmit={handleEdit}>
                      <div className="row g-3">
                        <div className={kind === "casts" ? "col-md-6" : "col-md-12"}>
                          <label className="form-label">{primaryLabel}</label>
                          <input
                            type="text"
                            className="form-control"
                            maxLength={primaryMax}
                            value={editPrimary}
                            onChange={(e) => setEditPrimary(e.target.value)}
                            disabled={saving || loading}
                          />
                        </div>
                        {kind === "casts" && (
                          <div className="col-md-6">
                            <label className="form-label">Religion (optional)</label>
                            <select
                              className="form-select"
                              value={editReligionId}
                              onChange={(e) => setEditReligionId(e.target.value)}
                              disabled={saving || loading}
                            >
                              <option value="">— None —</option>
                              {religions.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.religion_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="col-12">
                          <label className="form-label">Description (max {MASTER_DESCRIPTION_MAX})</label>
                          <input
                            type="text"
                            className="form-control"
                            maxLength={MASTER_DESCRIPTION_MAX}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            disabled={saving || loading}
                          />
                        </div>
                        <div className="col-12">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="edit-active"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                              disabled={saving || loading}
                            />
                            <label className="form-check-label" htmlFor="edit-active">
                              Active
                            </label>
                          </div>
                        </div>
                      </div>
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setEditingId(null)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="school-master-edit-form"
                      className="btn btn-primary"
                      disabled={controlsLocked || saving || loading}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </Modal.Footer>
                </Modal>

                <Modal
                  show={deleteTarget != null}
                  onHide={closeDeleteConfirm}
                  centered
                  backdrop={saving ? "static" : true}
                  contentClassName="border-0 shadow rounded-3"
                >
                  <Modal.Header closeButton={!saving} className="border-0 pb-0 pt-4 px-4">
                    <Modal.Title className="d-flex align-items-start gap-3 w-100 fw-semibold">
                      <span
                        className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0 bg-danger bg-opacity-10 text-danger"
                        style={{ width: 48, height: 48 }}
                        aria-hidden
                      >
                        <i className="ti ti-trash fs-4" />
                      </span>
                      <span className="pt-1">
                        <span className="d-block fs-5 text-dark">Delete this {deleteEntityLabel}?</span>
                        <span className="d-block small fw-normal text-muted mt-1">
                          This will remove it from {meta.title}. You can only delete if the server allows it (e.g. not in use).
                        </span>
                      </span>
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body className="px-4 pt-2 pb-0">
                    <div className="rounded-3 bg-light border px-3 py-3">
                      <span className="text-muted small text-uppercase d-block mb-1">Item</span>
                      <span className="fw-medium text-dark text-break">{deleteTarget?.label}</span>
                    </div>
                  </Modal.Body>
                  <Modal.Footer className="border-0 px-4 pb-4 pt-3 gap-2">
                    <button type="button" className="btn btn-light px-4" onClick={closeDeleteConfirm} disabled={saving}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger px-4" onClick={() => void confirmDelete()} disabled={saving}>
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                          Deleting…
                        </>
                      ) : (
                        <>
                          <i className="ti ti-trash me-1" aria-hidden />
                          Delete
                        </>
                      )}
                    </button>
                  </Modal.Footer>
                </Modal>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchoolMasterSettingsPage;
