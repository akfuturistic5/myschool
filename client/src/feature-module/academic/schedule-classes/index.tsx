import { useRef, useState, useEffect } from "react";
import Table from "../../../core/common/dataTable/index";
import { useSchedules } from "../../../core/hooks/useSchedules";
import { apiService } from "../../../core/services/apiService";
import PredefinedDateRanges from "../../../core/common/datePicker";
import {
  activeList,
  classselect,
} from "../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";

type EditRow = {
  id: number | string;
  type: string;
  startTime: string;
  endTime: string;
  status: string;
  originalData?: any;
};

const ScheduleClasses = () => {
  const { data: apiData, loading, error, refetch, fallbackData } = useSchedules();
  const data = loading ? fallbackData : (apiData ?? fallbackData ?? []);
  const route = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const editModalRef = useRef<HTMLDivElement | null>(null);
  const [editingRow, setEditingRow] = useState<EditRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    type: "",
    startTime: "",
    endTime: "",
    isActive: true,
  });

  const normalizeTimeForSelect = (t: string) => {
    if (!t || t === "Select") return "";
    const s = String(t).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (m) {
      const h = parseInt(m[1], 10);
      return `${String(h).padStart(2, "0")}:${m[2]} ${m[3].toUpperCase()}`;
    }
    return s;
  };

  // Full time options for schedule: 08:00 AM to 06:30 PM at 15-min intervals
  const SCHEDULE_TIME_OPTIONS = (() => {
    const opts: { value: string; label: string }[] = [];
    for (let h = 8; h <= 18; h++) {
      for (const m of [0, 15, 30, 45]) {
        if (h === 18 && m > 30) break;
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const ampm = h >= 12 ? "PM" : "AM";
        const val = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
        opts.push({ value: val, label: val });
      }
    }
    return opts;
  })();
  const uniqueTimeOptions = [
    { value: "Select", label: "Select" },
    ...SCHEDULE_TIME_OPTIONS,
  ];

  const getTimeOptionsWithValue = (currentVal: string) => {
    const norm = normalizeTimeForSelect(currentVal);
    if (!norm) return uniqueTimeOptions;
    const exists = uniqueTimeOptions.some((o) => o.value === norm);
    if (exists) return uniqueTimeOptions;
    return [...uniqueTimeOptions, { value: norm, label: norm }];
  };

  const getTypeOptionsWithValue = (currentVal: string) => {
    if (!currentVal) return classselect;
    const exists = classselect.some(
      (o) => o.value === currentVal || o.value?.toLowerCase() === currentVal?.toLowerCase()
    );
    if (exists) return classselect;
    return [...classselect, { value: currentVal, label: currentVal }];
  };

  useEffect(() => {
    if (editingRow) {
      setEditForm({
        type: editingRow.type || "Class",
        startTime: normalizeTimeForSelect(editingRow.startTime || ""),
        endTime: normalizeTimeForSelect(editingRow.endTime || ""),
        isActive: editingRow.status === "Active",
      });
    }
  }, [editingRow]);

  const handleEditClick = (record: EditRow) => {
    setEditingRow(record);
    setEditForm({
      type: record.type || "Class",
      startTime: normalizeTimeForSelect(record.startTime || ""),
      endTime: normalizeTimeForSelect(record.endTime || ""),
      isActive: record.status === "Active",
    });
    setSaveError(null);
    const el = document.getElementById("edit_Schedule");
    if (el) {
      const modal = (window as any).bootstrap?.Modal?.getOrCreateInstance(el);
      if (modal) modal.show();
    }
  };

  const closeEditModalAndCleanup = () => {
    const el = document.getElementById("edit_Schedule");
    if (el) {
      const modal = (window as any).bootstrap?.Modal?.getInstance(el);
      if (modal) modal.hide();
    }
    setEditingRow(null);
    setSaveError(null);
    setTimeout(() => {
      document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
    }, 150);
  };

  // Convert "09:30 AM" to "09:30" or "09:30:00" for API
  const timeToApiFormat = (t: string) => {
    if (!t || t === "Select") return undefined;
    const s = String(t).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (m) {
      let h = parseInt(m[1], 10);
      if (m[3].toUpperCase() === "PM" && h < 12) h += 12;
      if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${m[2]}:00`;
    }
    return s;
  };

  const handleEditSave = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!editingRow) return;
    setSaveError(null);
    setSaving(true);
    try {
      const scheduleId = editingRow.originalData?.id ?? editingRow.id;
      await apiService.updateSchedule(String(scheduleId), {
        type: editForm.type || undefined,
        pass_key: editForm.type || undefined,
        start_time: timeToApiFormat(editForm.startTime),
        end_time: timeToApiFormat(editForm.endTime),
        status: editForm.isActive ? "Active" : "Inactive",
        is_active: editForm.isActive,
      });
      await refetch();
      closeEditModalAndCleanup();
    } catch (err: any) {
      console.error("Failed to save schedule:", err);
      setSaveError(err?.message ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (value: any, record: any) => (
        <>
          <Link to="#" className="link-primary">
            {value ?? record.id ?? "-"}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) =>
        String(a.id || "").length - String(b.id || "").length,
    },
    {
      title: "Type",
      dataIndex: "type",
      sorter: (a: TableData, b: TableData) =>
        String(a.type || "").length - String(b.type || "").length,
    },
    {
      title: "Start Time",
      dataIndex: "startTime",
      sorter: (a: TableData, b: TableData) =>
        String(a.startTime || "").length - String(b.startTime || "").length,
    },
    {
      title: "End Time",
      dataIndex: "endTime",
      sorter: (a: TableData, b: TableData) =>
        String(a.endTime || "").length - String(b.endTime || "").length,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : (
            <span className="badge badge-soft-danger d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text || "Inactive"}
            </span>
          )}
        </>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
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
                    to="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleEditClick(record as EditRow);
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
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ minHeight: "400px" }}
          >
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
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
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Schedule</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={route.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Classes </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Schedule
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
                  data-bs-target="#add_Schedule"
                >
                  <i className="ti ti-square-rounded-plus-filled me-2" />
                  Add Schedule
                </Link>
              </div>
            </div>
          </div>
          {error && (
            <div className="alert alert-warning mx-0 mb-3" role="alert">
              Could not load schedules from server. Showing fallback data.
            </div>
          )}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Schedule Classes</h4>
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
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                  >
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom pb-0">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Type</label>
                              <CommonSelect
                                className="select"
                                options={classselect}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={activeList}
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
              <Table
                columns={columns}
                dataSource={Array.isArray(data) ? data : []}
                Selection={true}
              />
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="modal fade" id="add_Schedule">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Schedule</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Type</label>
                        <CommonSelect
                          className="select"
                          options={classselect}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Start Time </label>
                        <CommonSelect className="select" options={uniqueTimeOptions} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">End Time </label>
                        <CommonSelect className="select" options={uniqueTimeOptions} />
                      </div>
                      <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="status-toggle modal-status">
                          <input type="checkbox" id="user1" className="check" />
                          <label htmlFor="user1" className="checktoggle">
                            {" "}
                          </label>
                        </div>
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
                    data-bs-dismiss="modal"
                  >
                    Add Schedule
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="modal fade" id="edit_Schedule" ref={editModalRef}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Schedule</h4>
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
                  handleEditSave(e);
                }}
              >
                <div className="modal-body">
                  {saveError && (
                    <div className="alert alert-danger py-2 mb-3" role="alert">
                      {saveError}
                    </div>
                  )}
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Type</label>
                        <CommonSelect
                          key={`edit-type-${editingRow?.id ?? "new"}`}
                          className="select"
                          options={getTypeOptionsWithValue(editForm.type)}
                          value={editForm.type || null}
                          defaultValue={
                            editForm.type
                              ? getTypeOptionsWithValue(editForm.type).find(
                                  (o) => o.value === editForm.type
                                )
                              : undefined
                          }
                          onChange={(val) =>
                            setEditForm((f) => ({
                              ...f,
                              type: val ?? "",
                            }))
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Start Time </label>
                        <CommonSelect
                          key={`edit-start-${editingRow?.id ?? "new"}`}
                          className="select"
                          options={getTimeOptionsWithValue(editForm.startTime)}
                          value={editForm.startTime || null}
                          defaultValue={
                            editForm.startTime
                              ? getTimeOptionsWithValue(editForm.startTime).find(
                                  (o) => o.value === editForm.startTime
                                )
                              : undefined
                          }
                          onChange={(val) =>
                            setEditForm((f) => ({
                              ...f,
                              startTime: val ?? "",
                            }))
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">End Time </label>
                        <CommonSelect
                          key={`edit-end-${editingRow?.id ?? "new"}`}
                          className="select"
                          options={getTimeOptionsWithValue(editForm.endTime)}
                          value={editForm.endTime || null}
                          defaultValue={
                            editForm.endTime
                              ? getTimeOptionsWithValue(editForm.endTime).find(
                                  (o) => o.value === editForm.endTime
                                )
                              : undefined
                          }
                          onChange={(val) =>
                            setEditForm((f) => ({
                              ...f,
                              endTime: val ?? "",
                            }))
                          }
                        />
                      </div>
                      <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="user2"
                            checked={editForm.isActive}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                isActive: e.target.checked,
                              }))
                            }
                          />
                          <label
                            htmlFor="user2"
                            className="form-check-label"
                          >
                            {" "}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                    onClick={closeEditModalAndCleanup}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="modal fade" id="delete-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form>
                <div className="modal-body text-center">
                  <span className="delete-icon">
                    <i className="ti ti-trash-x" />
                  </span>
                  <h4>Confirm Deletion</h4>
                  <p>
                    You want to delete all the marked items, this cant be undone
                    once you delete.
                  </p>
                  <div className="d-flex justify-content-center">
                    <Link
                      to="#"
                      className="btn btn-light me-3"
                      data-bs-dismiss="modal"
                    >
                      Cancel
                    </Link>
                    <Link
                      to="#"
                      className="btn btn-danger"
                      data-bs-dismiss="modal"
                    >
                      Yes, Delete
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleClasses;
