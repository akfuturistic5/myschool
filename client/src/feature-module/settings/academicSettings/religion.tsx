import { Link } from "react-router-dom";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { apiService } from "../../../core/services/apiService";
import { useCurrentUser } from "../../../core/hooks/useCurrentUser";
import { isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";

type ReligionItem = {
  id: number;
  religion_name: string;
  description?: string | null;
  is_active: boolean;
};

const Religion = () => {
  const route = all_routes;
  const { user } = useCurrentUser();
  const isAdmin = useMemo(
    () => isHeadmasterRole(user) || isAdministrativeRole(user),
    [user]
  );
  const [religions, setReligions] = useState<ReligionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const loadReligions = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiService.getReligions({ includeInactive: true });
      setReligions(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError((e as Error)?.message || "Failed to load religions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReligions();
  }, []);

  const validatePayload = (name: string, description: string) => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) return "Religion name is required.";
    if (trimmedName.length > 50) return "Religion name must be 50 characters or fewer.";
    if (trimmedDescription.length > 200) return "Description must be 200 characters or fewer.";
    return "";
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const validationError = validatePayload(newName, newDescription);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.createReligion({
        religion_name: newName.trim(),
        description: newDescription.trim() || null,
        is_active: newIsActive,
      });
      setNewName("");
      setNewDescription("");
      setNewIsActive(true);
      setMessage("Religion added successfully.");
      await loadReligions();
    } catch (e) {
      setError((e as Error)?.message || "Failed to create religion");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: ReligionItem) => {
    setEditingId(item.id);
    setEditName(item.religion_name || "");
    setEditDescription(item.description || "");
    setEditIsActive(Boolean(item.is_active));
    setError("");
    setMessage("");
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || editingId == null) return;
    const validationError = validatePayload(editName, editDescription);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.updateReligion(editingId, {
        religion_name: editName.trim(),
        description: editDescription.trim() || null,
        is_active: editIsActive,
      });
      setEditingId(null);
      setMessage("Religion updated successfully.");
      await loadReligions();
    } catch (e) {
      setError((e as Error)?.message || "Failed to update religion");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.toggleReligionStatus(id);
      setMessage("Religion status updated successfully.");
      await loadReligions();
    } catch (e) {
      setError((e as Error)?.message || "Failed to toggle religion status");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this religion? This action cannot be undone.")) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await apiService.deleteReligion(id);
      setMessage("Religion deleted successfully.");
      await loadReligions();
    } catch (e) {
      setError((e as Error)?.message || "Failed to delete religion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content bg-white">
          <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Academic Settings</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={route.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Settings</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Academic Settings
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <div className="pe-1 mb-2">
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip id="tooltip-top">Refresh</Tooltip>}
                >
                  <button
                    type="button"
                    className="btn btn-outline-light bg-white btn-icon me-1"
                    onClick={() => loadReligions()}
                    disabled={saving || loading}
                  >
                    <i className="ti ti-refresh" />
                  </button>
                </OverlayTrigger>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xxl-2 col-xl-3">
              <div className="pt-3 d-flex flex-column list-group mb-4">
                <Link
                  to={route.religion}
                  className="d-block rounded active p-2"
                >
                  Religion
                </Link>
              </div>
            </div>
            <div className="col-xxl-10 col-xl-9">
              <div className="border-start ps-3">
                <form onSubmit={handleAdd}>
                  <div className="d-flex align-items-center justify-content-between flex-wrap border-bottom pt-3 mb-3">
                    <div className="mb-3">
                      <h5 className="mb-1">Religion</h5>
                      <p>Manage active and inactive religions</p>
                    </div>
                    <div className="mb-3">
                      <button
                        className="btn btn-light me-2"
                        type="button"
                        onClick={() => loadReligions()}
                        disabled={saving || loading}
                      >
                        Refresh
                      </button>
                      <button className="btn btn-primary" type="submit" disabled={!isAdmin || saving || loading}>
                        Add Religion
                      </button>
                    </div>
                  </div>
                  {loading && <div className="alert alert-info">Loading religions...</div>}
                  {!!message && <div className="alert alert-success">{message}</div>}
                  {!!error && <div className="alert alert-danger">{error}</div>}
                  {!isAdmin && <div className="alert alert-warning">Only Headmaster or Administrative can manage religions.</div>}
                  <div className="border rounded p-3 mb-3">
                    <div className="row">
                      <div className="col-md-5">
                        <div className="mb-3">
                          <label className="form-label">Religion Name</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter religion name"
                            value={newName}
                            maxLength={50}
                            onChange={(e) => setNewName(e.target.value)}
                            disabled={!isAdmin || saving || loading}
                          />
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="mb-3">
                          <label className="form-label">Description (Optional)</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter description"
                            value={newDescription}
                            maxLength={200}
                            onChange={(e) => setNewDescription(e.target.value)}
                            disabled={!isAdmin || saving || loading}
                          />
                        </div>
                      </div>
                      <div className="col-md-2 d-flex align-items-center">
                        <div className="form-check mt-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="religion-active"
                            checked={newIsActive}
                            onChange={(e) => setNewIsActive(e.target.checked)}
                            disabled={!isAdmin || saving || loading}
                          />
                          <label className="form-check-label" htmlFor="religion-active">
                            Active
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="d-md-flex">
                    <div className="row flex-fill">
                      {religions.map((item) => (
                        <div className="col-xxl-4 col-md-6" key={item.id}>
                          <div className="bg-white p-3 border rounded mb-3">
                            <div className="d-flex align-items-center justify-content-between">
                              <div>
                                <h5 className="fs-15 fw-normal mb-1">{item.religion_name}</h5>
                                <small className={item.is_active ? "text-success" : "text-muted"}>
                                  {item.is_active ? "Active" : "Inactive"}
                                </small>
                              </div>
                              <div className="d-flex align-items-center">
                                <div className="status-toggle modal-status">
                                  <input
                                    type="checkbox"
                                    id={`religion-${item.id}`}
                                    className="check"
                                    checked={item.is_active}
                                    onChange={() => handleToggleStatus(item.id)}
                                    disabled={!isAdmin || saving || loading}
                                  />
                                  <label htmlFor={`religion-${item.id}`} className="checktoggle">
                                    {" "}
                                  </label>
                                </div>
                                <div className="d-flex align-items-center ms-3">
                                  <button
                                    type="button"
                                    className="btn btn-link p-0 text-dark"
                                    onClick={() => startEdit(item)}
                                    disabled={!isAdmin || saving || loading}
                                  >
                                    <i className="ti ti-edit me-2" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-link p-0 text-danger"
                                    onClick={() => handleDelete(item.id)}
                                    disabled={!isAdmin || saving || loading}
                                  >
                                    <i className="ti ti-trash" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {!!item.description && (
                              <p className="mb-0 text-muted mt-2">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
                {editingId != null && (
                  <form className="border rounded p-3 mt-3" onSubmit={handleEdit}>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="mb-0">Edit Religion</h6>
                      <button
                        type="button"
                        className="btn btn-sm btn-light"
                        onClick={() => setEditingId(null)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="row">
                      <div className="col-md-5">
                        <div className="mb-3">
                          <label className="form-label">Religion Name</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editName}
                            maxLength={50}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={saving || loading}
                          />
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="mb-3">
                          <label className="form-label">Description</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editDescription}
                            maxLength={200}
                            onChange={(e) => setEditDescription(e.target.value)}
                            disabled={saving || loading}
                          />
                        </div>
                      </div>
                      <div className="col-md-2 d-flex align-items-center">
                        <div className="form-check mt-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="edit-religion-active"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                            disabled={saving || loading}
                          />
                          <label className="form-check-label" htmlFor="edit-religion-active">
                            Active
                          </label>
                        </div>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={!isAdmin || saving || loading}>
                      Save Changes
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Religion;

