import { useRef, useState } from "react";
import { useClassRooms } from "../../../core/hooks/useClassRooms";
import Table from "../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../core/common/datePicker";
import {
  capacitycount,
  count,
} from "../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";

const ClassRoom = () => {
  const routes = all_routes;
  const {
    classRooms,
    loading,
    error,
    refetch,
    createClassRoom,
    updateClassRoom,
    deleteClassRoom,
  } = useClassRooms();

  const [addForm, setAddForm] = useState({ roomNo: "", capacity: "50", status: true });
  const [editForm, setEditForm] = useState<{ id: number; roomNo: string; capacity: string; status: boolean } | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<{ id: number; room_no: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const data = (classRooms || []).map((r: any) => ({
    id: r.id,
    roomNo: r.room_no ?? r.roomNo ?? "",
    capacity: String(r.capacity ?? ""),
    status: r.status ?? "Active",
    key: r.id,
  }));

  const hideModal = (id: string) => {
    const el = document.getElementById(id);
    if (el && (window as any).bootstrap?.Modal) {
      (window as any).bootstrap.Modal.getInstance(el)?.hide();
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createClassRoom({
        room_no: addForm.roomNo.trim(),
        capacity: parseInt(addForm.capacity, 10) || 50,
        status: addForm.status ? "Active" : "Inactive",
      });
      setAddForm({ roomNo: "", capacity: "50", status: true });
      hideModal("add_class_room");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to add class room");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await updateClassRoom(editForm.id, {
        room_no: editForm.roomNo.trim(),
        capacity: parseInt(editForm.capacity, 10) || 50,
        status: editForm.status ? "Active" : "Inactive",
      });
      setEditForm(null);
      hideModal("edit_class_room");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to update class room");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!roomToDelete) return;
    setSubmitting(true);
    try {
      await deleteClassRoom(roomToDelete.id);
      setRoomToDelete(null);
      hideModal("delete-modal");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to delete class room");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (record: any) => {
    setEditForm({
      id: record.id,
      roomNo: record.roomNo ?? "",
      capacity: record.capacity ?? "50",
      status: String(record.status ?? "Active").toLowerCase() === "active",
    });
    setSubmitError(null);
    const el = document.getElementById("edit_class_room");
    if (el && (window as any).bootstrap?.Modal) {
      const m = (window as any).bootstrap.Modal.getInstance(el) ?? new (window as any).bootstrap.Modal(el);
      m.show();
    }
  };

  const openDeleteModal = (record: any) => {
    setRoomToDelete({ id: record.id, room_no: record.roomNo ?? "" });
    setSubmitError(null);
    const el = document.getElementById("delete-modal");
    if (el && (window as any).bootstrap?.Modal) {
      const m = (window as any).bootstrap.Modal.getInstance(el) ?? new (window as any).bootstrap.Modal(el);
      m.show();
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (value: any, record: any) => (
        <Link to="#" className="link-primary">
          {value ?? record.id ?? "-"}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => (a.id as number) - (b.id as number),
    },
    {
      title: "Room No",
      dataIndex: "roomNo",
      sorter: (a: TableData, b: TableData) => String(a.roomNo).localeCompare(String(b.roomNo)),
    },
    {
      title: "Capacity",
      dataIndex: "capacity",
      sorter: (a: TableData, b: TableData) => Number(a.capacity) - Number(b.capacity),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_: any, record: any) => {
        const isActive = (record.status ?? "Active").toLowerCase() === "active";
        return (
          <span
            className={`badge d-inline-flex align-items-center ${isActive ? "badge-soft-success" : "badge-soft-danger"}`}
          >
            <i className={`ti ti-circle-filled fs-5 me-1`}></i>
            {record.status ?? "Active"}
          </span>
        );
      },
      sorter: (a: any, b: any) => String(a.status).localeCompare(String(b.status)),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="dropdown">
          <Link
            to="#"
            className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            onClick={(e) => e.preventDefault()}
          >
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-right p-3">
            <li>
              <Link
                className="dropdown-item rounded-1"
                to="#"
                onClick={(e) => {
                  e.preventDefault();
                  openEditModal(record);
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
                  openDeleteModal(record);
                }}
              >
                <i className="ti ti-trash-x me-2" />
                Delete
              </Link>
            </li>
          </ul>
        </div>
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
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Class Room</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Academic</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Class Room
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_class_room"
                >
                  <i className="ti ti-square-rounded-plus-filled me-2" />
                  Add Class Room
                </Link>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              {error}
              <button type="button" className="btn-close" onClick={() => refetch()} aria-label="Retry"></button>
            </div>
          )}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Class Room</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
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
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom pb-0">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Room No</label>
                              <CommonSelect className="select" options={count} />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Capacity</label>
                              <CommonSelect className="select" options={capacitycount} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3">
                          Reset
                        </Link>
                        <Link to="#" className="btn btn-primary" onClick={handleApplyClick}>
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
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-sort-ascending-2 me-2" />
                    Sort by A-Z
                  </Link>
                  <ul className="dropdown-menu p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1 active">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Descending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Viewed
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <Table columns={columns} dataSource={data} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Class Room */}
      <div className="modal fade" id="add_class_room">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Class Room</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {submitError && <div className="alert alert-danger">{submitError}</div>}
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Room No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.roomNo}
                        onChange={(e) => setAddForm((p) => ({ ...p, roomNo: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Capacity</label>
                      <input
                        type="number"
                        className="form-control"
                        value={addForm.capacity}
                        onChange={(e) => setAddForm((p) => ({ ...p, capacity: e.target.value }))}
                        min={1}
                      />
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle</p>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="switch-sm"
                          checked={addForm.status}
                          onChange={(e) => setAddForm((p) => ({ ...p, status: e.target.checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Adding..." : "Add Class Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Class Room */}
      <div className="modal fade" id="edit_class_room">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Class Room</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            {editForm && (
              <form key={editForm.id} onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  {submitError && <div className="alert alert-danger">{submitError}</div>}
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Room No</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editForm.roomNo}
                          onChange={(e) => setEditForm((p) => (p ? { ...p, roomNo: e.target.value } : null))}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Capacity</label>
                        <input
                          type="number"
                          className="form-control"
                          value={editForm.capacity}
                          onChange={(e) => setEditForm((p) => (p ? { ...p, capacity: e.target.value } : null))}
                          min={1}
                        />
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle</p>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="switch-sm2"
                            checked={editForm.status}
                            onChange={(e) => setEditForm((p) => (p ? { ...p, status: e.target.checked } : null))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon">
                <i className="ti ti-trash-x" />
              </span>
              <h4>Confirm Deletion</h4>
              <p>
                {roomToDelete
                  ? `Are you sure you want to delete room ${roomToDelete.room_no}? This cannot be undone.`
                  : "You want to delete the selected item. This cannot be undone once you delete."}
              </p>
              {submitError && <div className="alert alert-danger">{submitError}</div>}
              <div className="d-flex justify-content-center">
                <button type="button" className="btn btn-light me-3" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteConfirm}
                  disabled={submitting || !roomToDelete}
                >
                  {submitting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassRoom;
