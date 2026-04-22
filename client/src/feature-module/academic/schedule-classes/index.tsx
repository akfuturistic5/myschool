import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { TimePicker } from "antd";
import Table from "../../../core/common/dataTable/index";
import { useSchedules } from "../../../core/hooks/useSchedules";
import { apiService } from "../../../core/services/apiService";
import PredefinedDateRanges from "../../../core/common/datePicker";
import { activeList } from "../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

/** Parse API / table display time into Dayjs (today’s date, time only). */
function parseDisplayTimeToDayjs(t: string | undefined | null): Dayjs | null {
  if (t == null || t === "" || t === "Select" || t === "N/A") return null;
  const s = String(t).trim();
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    const ap = m12[3].toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return dayjs().hour(h).minute(min).second(0).millisecond(0);
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    return dayjs()
      .hour(parseInt(m24[1], 10))
      .minute(parseInt(m24[2], 10))
      .second(m24[3] ? parseInt(m24[3], 10) : 0)
      .millisecond(0);
  }
  const d = dayjs(s);
  return d.isValid() ? d : null;
}

function dayjsToApiTime(d: Dayjs | null): string | undefined {
  if (!d || !d.isValid()) return undefined;
  return d.format("HH:mm:ss");
}

function parsePgTimeToDayjs(t: string): Dayjs | null {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return dayjs()
    .hour(parseInt(m[1], 10))
    .minute(parseInt(m[2], 10))
    .second(m[3] ? parseInt(m[3], 10) : 0)
    .millisecond(0);
}

/** Half-open style: overlap when start < otherEnd && otherStart < end (touching boundaries allowed). */
function findLocalTimeOverlap(
  start: Dayjs,
  end: Dayjs,
  rows: any[],
  excludeId: string | number | null
): string | null {
  for (const row of rows) {
    const o = row?.originalData || {};
    const rid = o.id ?? row.id;
    if (excludeId != null && String(rid) === String(excludeId)) continue;
    let s: Dayjs | null = null;
    let e: Dayjs | null = null;
    if (o.start_time != null) s = parsePgTimeToDayjs(String(o.start_time));
    if (o.end_time != null) e = parsePgTimeToDayjs(String(o.end_time));
    if (!s || !e) {
      s = parseDisplayTimeToDayjs(row.startTime);
      e = parseDisplayTimeToDayjs(row.endTime);
    }
    if (!s || !e || !s.isValid() || !e.isValid()) continue;
    if (start.isBefore(e) && s.isBefore(end)) {
      return String(o.slot_name || row.type || `slot #${rid}`);
    }
  }
  return null;
}

/** Remove stray Bootstrap modal backdrops / body lock (fixes stuck grey overlay after hide). */
function cleanupBootstrapModalBackdrop() {
  document.querySelectorAll(".modal-backdrop").forEach((n) => n.remove());
  document.body.classList.remove("modal-open");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
}

function hideBootstrapModalById(modalId: string) {
  const el = document.getElementById(modalId);
  if (!el) {
    cleanupBootstrapModalBackdrop();
    return;
  }
  const Bs = (window as any).bootstrap?.Modal;
  if (Bs) {
    const inst = Bs.getInstance(el) ?? Bs.getOrCreateInstance(el);
    inst?.hide();
  }
  setTimeout(() => cleanupBootstrapModalBackdrop(), 350);
}

function formatDurationMinutes(m: unknown): string {
  if (m == null || m === "") return "—";
  const n = Number(m);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0 min";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const mm = n % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

/** Pull `message` from API JSON body embedded in ApiService errors (`... message: {...}`). */
function extractHttpJsonMessage(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const raw = err.message;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const j = JSON.parse(raw.slice(start, end + 1)) as { message?: string };
      if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
    } catch {
      /* fall through */
    }
  }
  const idx = raw.indexOf("message:");
  if (idx === -1) return null;
  const jsonPart = raw.slice(idx + "message:".length).trim();
  try {
    const j = JSON.parse(jsonPart) as { message?: string };
    return typeof j.message === "string" ? j.message.trim() : null;
  } catch {
    return null;
  }
}

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
  const [addSlotError, setAddSlotError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<{
    slotName: string;
    startTime: Dayjs | null;
    endTime: Dayjs | null;
    isActive: boolean;
  }>({ slotName: "", startTime: null, endTime: null, isActive: true });
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<{
    slotName: string;
    startTime: Dayjs | null;
    endTime: Dayjs | null;
    isActive: boolean;
  }>({
    slotName: "",
    startTime: null,
    endTime: null,
    isActive: true,
  });

  useEffect(() => {
    if (editingRow) {
      setEditForm({
        slotName: editingRow.type || "",
        startTime: parseDisplayTimeToDayjs(editingRow.startTime),
        endTime: parseDisplayTimeToDayjs(editingRow.endTime),
        isActive: editingRow.status === "Active",
      });
    }
  }, [editingRow]);

  /** After any Bootstrap modal hides (delete/add/edit/cancel), strip stray backdrops so the page stays clickable. */
  useEffect(() => {
    const modalIds = ["delete-modal", "add_Schedule", "edit_Schedule"];
    const cleanups: Array<{ el: HTMLElement; fn: () => void }> = [];
    for (const id of modalIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const fn = () => {
        requestAnimationFrame(() => cleanupBootstrapModalBackdrop());
      };
      el.addEventListener("hidden.bs.modal", fn);
      cleanups.push({ el, fn });
    }
    return () => {
      for (const { el, fn } of cleanups) {
        el.removeEventListener("hidden.bs.modal", fn);
      }
    };
  }, []);

  const handleEditClick = (record: EditRow) => {
    setEditingRow(record);
    setSaveError(null);
    const el = document.getElementById("edit_Schedule");
    if (el) {
      const modal = (window as any).bootstrap?.Modal?.getOrCreateInstance(el);
      if (modal) modal.show();
    }
  };

  const closeEditModalAndCleanup = () => {
    hideBootstrapModalById("edit_Schedule");
    setEditingRow(null);
    setSaveError(null);
  };

  const handleEditSave = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!editingRow) return;
    const slotLabel = editForm.slotName?.trim();
    if (!slotLabel) {
      setSaveError("Slot name is required.");
      return;
    }
    if (!editForm.startTime || !editForm.endTime) {
      setSaveError("Start and end time are required.");
      return;
    }
    const startApi = dayjsToApiTime(editForm.startTime);
    const endApi = dayjsToApiTime(editForm.endTime);
    if (!startApi || !endApi) {
      setSaveError("Invalid start or end time.");
      return;
    }
    if (!editForm.endTime.isAfter(editForm.startTime)) {
      await Swal.fire({
        icon: "warning",
        title: "Invalid range",
        text: "End time must be after start time.",
      });
      return;
    }
    const overlapLabel = findLocalTimeOverlap(
      editForm.startTime,
      editForm.endTime,
      Array.isArray(data) ? data : [],
      editingRow.originalData?.id ?? editingRow.id
    );
    if (overlapLabel) {
      await Swal.fire({
        icon: "warning",
        title: "Time overlap",
        text: `This range overlaps with "${overlapLabel}". Choose a different start or end time.`,
      });
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const scheduleId = editingRow.originalData?.id ?? editingRow.id;
      await apiService.updateSchedule(String(scheduleId), {
        slot_name: slotLabel,
        start_time: startApi,
        end_time: endApi,
        status: editForm.isActive ? "Active" : "Inactive",
        is_active: editForm.isActive,
      });
      await refetch();
      closeEditModalAndCleanup();
    } catch (err: any) {
      console.error("Failed to save time slot:", err);
      const apiMsg = extractHttpJsonMessage(err);
      const fallback = err?.message ?? "Failed to update time slot. Please try again.";
      if (apiMsg?.includes("overlap") || fallback.includes("409")) {
        await Swal.fire({
          icon: "error",
          title: "Cannot save time slot",
          text: apiMsg || "This time overlaps with another slot.",
        });
      }
      setSaveError(apiMsg || fallback);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = addForm.slotName?.trim();
    if (!name) {
      setAddSlotError("Slot name is required.");
      return;
    }
    if (!addForm.startTime || !addForm.endTime) {
      setAddSlotError("Start and end time are required.");
      return;
    }
    const startApi = dayjsToApiTime(addForm.startTime);
    const endApi = dayjsToApiTime(addForm.endTime);
    if (!startApi || !endApi) {
      setAddSlotError("Invalid start or end time.");
      return;
    }
    if (!addForm.endTime.isAfter(addForm.startTime)) {
      await Swal.fire({
        icon: "warning",
        title: "Invalid range",
        text: "End time must be after start time.",
      });
      return;
    }
    const overlapLabel = findLocalTimeOverlap(
      addForm.startTime,
      addForm.endTime,
      Array.isArray(data) ? data : [],
      null
    );
    if (overlapLabel) {
      await Swal.fire({
        icon: "warning",
        title: "Time overlap",
        text: `This range overlaps with "${overlapLabel}". Choose a different start or end time.`,
      });
      return;
    }
    setSaving(true);
    setAddSlotError(null);
    setSaveError(null);
    try {
      await apiService.createSchedule({
        slot_name: name,
        start_time: startApi,
        end_time: endApi,
        is_active: addForm.isActive,
      });
      await refetch();
      hideBootstrapModalById("add_Schedule");
      setAddForm({ slotName: "", startTime: null, endTime: null, isActive: true });
    } catch (err: any) {
      const apiMsg = extractHttpJsonMessage(err);
      const rawMsg = typeof err?.message === "string" ? err.message : "";
      const userMsg =
        apiMsg ??
        (/^\s*HTTP error/i.test(rawMsg) ? "Failed to add time slot" : rawMsg || "Failed to add time slot");
      if (
        userMsg.includes("overlap") ||
        rawMsg.includes("409") ||
        userMsg.includes("overlaps")
      ) {
        await Swal.fire({
          icon: "error",
          title: "Cannot add time slot",
          text: apiMsg || userMsg || "This time overlaps with another slot.",
        });
      }
      setAddSlotError(userMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!selectedDeleteId) return;
    setSaving(true);
    try {
      await apiService.deleteSchedule(String(selectedDeleteId));
      await refetch();
      hideBootstrapModalById("delete-modal");
      setSelectedDeleteId(null);
    } catch (err: any) {
      setSaveError(extractHttpJsonMessage(err) ?? err?.message ?? "Failed to delete time slot");
    } finally {
      setSaving(false);
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
      title: "Slot name",
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
      title: "Duration",
      dataIndex: "duration",
      render: (_: unknown, record: any) => (
        <span>{formatDurationMinutes(record?.duration ?? record?.originalData?.duration)}</span>
      ),
      sorter: (a: TableData, b: TableData) =>
        Number((a as any).duration ?? 0) - Number((b as any).duration ?? 0),
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
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedDeleteId(record.originalData?.id ?? record.id);
                      (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("delete-modal"))?.show();
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
      ),
    },
  ];

  const exportColumns = useMemo(
    () => [
      { title: "ID", dataKey: "id" },
      { title: "Slot name", dataKey: "slotName" },
      { title: "Start time", dataKey: "startTime" },
      { title: "End time", dataKey: "endTime" },
      { title: "Duration", dataKey: "duration" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const exportRows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.map((row: any) => ({
      id: String(row.id ?? ""),
      slotName: String(row.type ?? row.originalData?.slot_name ?? ""),
      startTime: String(row.startTime ?? ""),
      endTime: String(row.endTime ?? ""),
      duration: formatDurationMinutes(row.duration ?? row.originalData?.duration),
      status: String(row.status ?? ""),
    }));
  }, [data]);

  const handleExportExcel = useCallback(() => {
    if (!exportRows.length) return;
    exportToExcel(exportRows, "time-slots", "Time slots");
  }, [exportRows]);

  const handleExportPdf = useCallback(() => {
    if (!exportRows.length) return;
    exportToPDF(exportRows, "Time slots", "time-slots", exportColumns);
  }, [exportRows, exportColumns]);

  const handlePrintSlots = useCallback(() => {
    if (!exportRows.length) return;
    printData("Time slots", exportColumns, exportRows);
  }, [exportRows, exportColumns]);

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
              <h3 className="page-title mb-1">Time slots</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={route.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Academic</li>
                  <li className="breadcrumb-item">Timetable</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Time slots
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={() => void refetch()}
                onPrint={handlePrintSlots}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_Schedule"
                  onClick={() => setAddSlotError(null)}
                >
                  <i className="ti ti-square-rounded-plus-filled me-2" />
                  Add time slot
                </Link>
              </div>
            </div>
          </div>
          {error && (
            <div className="alert alert-warning mx-0 mb-3" role="alert">
              Could not load time slots from server. Showing fallback data.
            </div>
          )}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Periods (time_slots)</h4>
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
                              <label className="form-label">Slot name</label>
                              <input type="text" className="form-control" placeholder="e.g. Period 1" />
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
                    data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
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
                <h4 className="modal-title">Add time slot</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleCreateSchedule}>
                <div className="modal-body" id="add_schedule_modal_body">
                  {addSlotError ? (
                    <div className="alert alert-danger py-2 mb-3" role="alert">
                      {addSlotError}
                    </div>
                  ) : null}
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Slot name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Period 1, Assembly, Break"
                          maxLength={100}
                          value={addForm.slotName}
                          onChange={(e) => setAddForm((f) => ({ ...f, slotName: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Start time</label>
                        <TimePicker
                          use12Hours
                          format="h:mm A"
                          minuteStep={1}
                          value={addForm.startTime}
                          onChange={(v) => setAddForm((f) => ({ ...f, startTime: v }))}
                          className="w-100"
                          style={{ width: "100%" }}
                          placeholder="e.g. 9:00 AM"
                          changeOnScroll
                          getPopupContainer={(trigger) =>
                            document.getElementById("add_schedule_modal_body") ??
                            trigger.parentElement ??
                            document.body
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">End time</label>
                        <TimePicker
                          use12Hours
                          format="h:mm A"
                          minuteStep={1}
                          value={addForm.endTime}
                          onChange={(v) => setAddForm((f) => ({ ...f, endTime: v }))}
                          className="w-100"
                          style={{ width: "100%" }}
                          placeholder="e.g. 10:00 AM"
                          changeOnScroll
                          getPopupContainer={(trigger) =>
                            document.getElementById("add_schedule_modal_body") ??
                            trigger.parentElement ??
                            document.body
                          }
                        />
                      </div>
                      <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="status-toggle modal-status">
                          <input type="checkbox" id="user1" className="check" checked={addForm.isActive} onChange={(e) => setAddForm((f) => ({ ...f, isActive: e.target.checked }))} />
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
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Add time slot"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="modal fade" id="edit_Schedule" ref={editModalRef}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit time slot</h4>
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
                <div className="modal-body" id="edit_schedule_modal_body">
                  {saveError && (
                    <div className="alert alert-danger py-2 mb-3" role="alert">
                      {saveError}
                    </div>
                  )}
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Slot name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Period 1, Assembly, Break"
                          maxLength={100}
                          value={editForm.slotName}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              slotName: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Start time</label>
                        <TimePicker
                          key={`edit-start-${editingRow?.id ?? "new"}`}
                          use12Hours
                          format="h:mm A"
                          minuteStep={1}
                          value={editForm.startTime}
                          onChange={(v) => setEditForm((f) => ({ ...f, startTime: v }))}
                          className="w-100"
                          style={{ width: "100%" }}
                          placeholder="e.g. 9:00 AM"
                          changeOnScroll
                          getPopupContainer={(trigger) =>
                            document.getElementById("edit_schedule_modal_body") ??
                            trigger.parentElement ??
                            document.body
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">End time</label>
                        <TimePicker
                          key={`edit-end-${editingRow?.id ?? "new"}`}
                          use12Hours
                          format="h:mm A"
                          minuteStep={1}
                          value={editForm.endTime}
                          onChange={(v) => setEditForm((f) => ({ ...f, endTime: v }))}
                          className="w-100"
                          style={{ width: "100%" }}
                          placeholder="e.g. 10:00 AM"
                          changeOnScroll
                          getPopupContainer={(trigger) =>
                            document.getElementById("edit_schedule_modal_body") ??
                            trigger.parentElement ??
                            document.body
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
                    <button type="button" className="btn btn-danger" onClick={handleDeleteSchedule} disabled={saving}>
                      {saving ? "Deleting..." : "Yes, Delete"}
                    </button>
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





