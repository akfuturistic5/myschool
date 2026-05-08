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
    isBreak: boolean;
    isActive: boolean;
  }>({ slotName: "", startTime: null, endTime: null, isBreak: false, isActive: true });
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<{
    slotName: string;
    startTime: Dayjs | null;
    endTime: Dayjs | null;
    isBreak: boolean;
    isActive: boolean;
  }>({
    slotName: "",
    startTime: null,
    endTime: null,
    isBreak: false,
    isActive: true,
  });

  const [genForm, setGenForm] = useState<{
    startTime: Dayjs | null;
    endTime: Dayjs | null;
    duration: number;
    prefix: string;
    includeBreaks: boolean;
    breaks: { afterPeriod: number; duration: number }[];
  }>({
    startTime: dayjs().hour(8).minute(0),
    endTime: dayjs().hour(14).minute(0),
    duration: 45,
    prefix: "Period",
    includeBreaks: false,
    breaks: [{ afterPeriod: 2, duration: 15 }],
  });

  useEffect(() => {
    if (editingRow) {
      setEditForm({
        slotName: editingRow.type || "",
        startTime: parseDisplayTimeToDayjs(editingRow.startTime),
        endTime: parseDisplayTimeToDayjs(editingRow.endTime),
        isBreak: Boolean(editingRow.originalData?.isBreak ?? editingRow.originalData?.is_break),
        isActive: editingRow.status === "Active",
      });
    }
  }, [editingRow]);

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
        is_break: editForm.isBreak,
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
        is_break: addForm.isBreak,
        is_active: addForm.isActive,
      });
      await refetch();
      hideBootstrapModalById("add_Schedule");
      setAddForm({ slotName: "", startTime: null, endTime: null, isBreak: false, isActive: true });
    } catch (err: any) {
      const apiMsg = extractHttpJsonMessage(err);
      const rawMsg = typeof err?.message === "string" ? err.message : "";
      const userMsg =
        apiMsg ??
        (/^s*HTTP error/i.test(rawMsg) ? "Failed to add time slot" : rawMsg || "Failed to add time slot");
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
    setSaving(true);
    try {
      if (selectedDeleteId) {
        await apiService.deleteSchedule(String(selectedDeleteId));
      } else if (selectedRowKeys.length > 0) {
        await apiService.bulkDeleteSchedules(selectedRowKeys);
      } else {
        setSaving(false);
        return;
      }
      await refetch();
      hideBootstrapModalById("delete-modal");
      setSelectedDeleteId(null);
      setSelectedRowKeys([]);
    } catch (err: any) {
      setSaveError(extractHttpJsonMessage(err) ?? err?.message ?? "Failed to delete time slot");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!genForm.startTime || !genForm.endTime) {
      await Swal.fire({
        icon: "warning",
        title: "Missing times",
        text: "Please select both start and end times.",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        startTime: genForm.startTime.format("HH:mm"),
        endTime: genForm.endTime.format("HH:mm"),
        duration: genForm.duration,
        prefix: genForm.prefix,
        includeBreaks: genForm.includeBreaks,
        breaks: genForm.breaks,
      };
      const res = await apiService.generateSchedules(payload);
      await Swal.fire({
        icon: "success",
        title: "Success",
        text: res.message || "Slots generated successfully.",
      });
      await refetch();
      hideBootstrapModalById("bulk_generate");
    } catch (err: any) {
      const apiMsg = extractHttpJsonMessage(err);
      await Swal.fire({
        icon: "error",
        title: "Generation failed",
        text: apiMsg || "Failed to generate slots. Check for overlaps.",
      });
    } finally {
      setSaving(false);
    }
  };

  const exportData = useMemo(
    () =>
      (Array.isArray(data) ? data : []).map((row: any) => {
        const original = row?.originalData ?? {};
        const isBreak = Boolean(original.is_break ?? original.isBreak);
        return {
          id: row?.id ?? "-",
          type: row?.type ?? "-",
          startTime: row?.startTime ?? "-",
          endTime: row?.endTime ?? "-",
          slotType: isBreak ? "Break" : "Period",
          duration: formatDurationMinutes(original.duration),
          status: row?.status ?? "-",
        };
      }),
    [data]
  );

  const exportColumns = useMemo(
    () => [
      { title: "ID", dataKey: "id" },
      { title: "Slot Name", dataKey: "type" },
      { title: "Start Time", dataKey: "startTime" },
      { title: "End Time", dataKey: "endTime" },
      { title: "Type", dataKey: "slotType" },
      { title: "Duration", dataKey: "duration" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const handleRefresh = useCallback(async () => {
    await refetch();
    await Swal.fire({
      icon: "success",
      title: "Refreshed",
      text: "Time slots updated successfully.",
      timer: 1200,
      showConfirmButton: false,
    });
  }, [refetch]);

  const handlePrint = useCallback(() => {
    printData("Time Slots", exportColumns, exportData);
  }, [exportColumns, exportData]);

  const handleExportPdf = useCallback(() => {
    exportToPDF(
      exportData,
      "Time Slots",
      `Time_Slots_${new Date().toISOString().split("T")[0]}`,
      exportColumns
    );
  }, [exportColumns, exportData]);

  const handleExportExcel = useCallback(() => {
    exportToExcel(
      exportData.map((row) => ({
        ID: row.id,
        "Slot Name": row.type,
        "Start Time": row.startTime,
        "End Time": row.endTime,
        Type: row.slotType,
        Duration: row.duration,
        Status: row.status,
      })),
      `Time_Slots_${new Date().toISOString().split("T")[0]}`
    );
  }, [exportData]);

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
      title: "Type",
      dataIndex: "originalData",
      render: (val: any) => {
        const isBr = val?.is_break || val?.isBreak;
        return (
          <span className="d-flex align-items-center">
            <i className={`ti ti-${isBr ? "coffee" : "calendar-time"} me-1`} />
            {isBr ? "Break" : "Period"}
          </span>
        );
      },
    },
    {
      title: "Duration",
      dataIndex: "originalData",
      render: (val: any) => (
        <span className="d-flex align-items-center">
          <i className="ti ti-clock me-1" />
          {formatDurationMinutes(val?.duration)}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <span className={`badge badge-soft-${text === "Active" ? "success" : "danger"} d-inline-flex align-items-center`}>
          <i className="ti ti-circle-filled fs-5 me-1" />
          {text}
        </span>
      ),
      sorter: (a: TableData, b: TableData) =>
        String(a.status || "").length - String(b.status || "").length,
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
          >
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-end p-2">
            <li>
              <Link
                className="dropdown-item rounded-1"
                to="#"
                onClick={() => handleEditClick(record)}
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
                onClick={() => setSelectedDeleteId(record.originalData?.id ?? record.id)}
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

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
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
                onRefresh={handleRefresh}
                onPrint={handlePrint}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />
              <div className="ms-2 d-flex align-items-center">
                <Link
                  to="#"
                  className="btn btn-primary me-2"
                  data-bs-toggle="modal"
                  data-bs-target="#bulk_generate"
                >
                  <i className="ti ti-layout-grid-add me-2" />
                  Bulk Generate
                </Link>
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_Schedule"
                  onClick={() => setAddSlotError(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Time Slot
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
                    data-bs-toggle="dropdown"
                    data-bs-boundary="viewport"
                    data-bs-popper-config='{"strategy":"fixed"}'
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
                              <label className="form-label">Slot name</label>
                              <input type="text" className="form-control" placeholder="e.g. Period 1" />
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
                    data-bs-boundary="viewport"
                    data-bs-popper-config='{"strategy":"fixed"}'
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
              {selectedRowKeys.length > 0 && (
                <div className="mx-3 mb-3 p-2 bg-danger-light border-danger rounded d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-sm bg-danger rounded-circle me-2">
                      <i className="ti ti-trash text-white" />
                    </span>
                    <h6 className="mb-0 text-danger">{selectedRowKeys.length} items selected</h6>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#delete-modal"
                    onClick={() => setSelectedDeleteId(null)}
                  >
                    Delete Selected
                  </button>
                </div>
              )}
              <Table
                columns={columns}
                dataSource={Array.isArray(data) ? data : []}
                Selection={true}
                selectedRowKeys={selectedRowKeys}
                onSelectionChange={(keys) => setSelectedRowKeys(keys)}
              />
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}

      {/* Add Schedule Modal */}
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
                      <label className="form-label">Start Time</label>
                      <div className="input-icon-end">
                        <TimePicker
                          className="form-control"
                          format="h:mm A"
                          use12Hours
                          allowClear={false}
                          value={addForm.startTime}
                          onChange={(v) => setAddForm((f) => ({ ...f, startTime: v }))}
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-clock" />
                        </span>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">End Time</label>
                      <div className="input-icon-end">
                        <TimePicker
                          className="form-control"
                          format="h:mm A"
                          use12Hours
                          allowClear={false}
                          value={addForm.endTime}
                          onChange={(v) => setAddForm((f) => ({ ...f, endTime: v }))}
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-clock" />
                        </span>
                      </div>
                    </div>
                    <div className="d-flex align-items-center mb-0">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={addForm.isBreak}
                          onChange={(e) => setAddForm((f) => ({ ...f, isBreak: e.target.checked }))}
                        />
                        <label className="form-check-label">Is this a break?</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Add Time Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Schedule Modal */}

      {/* Edit Schedule Modal */}
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
                onClick={closeEditModalAndCleanup}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body">
                {saveError ? (
                  <div className="alert alert-danger py-2 mb-3" role="alert">
                    {saveError}
                  </div>
                ) : null}
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Slot name</label>
                      <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={editForm.slotName}
                        onChange={(e) => setEditForm((f) => ({ ...f, slotName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Start Time</label>
                      <div className="input-icon-end">
                        <TimePicker
                          className="form-control"
                          format="h:mm A"
                          use12Hours
                          allowClear={false}
                          value={editForm.startTime}
                          onChange={(v) => setEditForm((f) => ({ ...f, startTime: v }))}
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-clock" />
                        </span>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">End Time</label>
                      <div className="input-icon-end">
                        <TimePicker
                          className="form-control"
                          format="h:mm A"
                          use12Hours
                          allowClear={false}
                          value={editForm.endTime}
                          onChange={(v) => setEditForm((f) => ({ ...f, endTime: v }))}
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-clock" />
                        </span>
                      </div>
                    </div>
                    <div className="d-flex align-items-center mb-3">
                      <div className="form-check form-switch me-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={editForm.isBreak}
                          onChange={(e) => setEditForm((f) => ({ ...f, isBreak: e.target.checked }))}
                        />
                        <label className="form-check-label">Is Break</label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                        />
                        <label className="form-check-label">Active</label>
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Edit Schedule Modal */}

      {/* Delete Schedule Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form>
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>
                  {selectedDeleteId
                    ? "Are you sure you want to delete this time slot?"
                    : `Are you sure you want to delete the selected ${selectedRowKeys.length} time slots?`}
                </h4>
                <p>This action cannot be undone and will remove the selected slot(s) permanently.</p>
                <div className="d-flex justify-content-center">
                  <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">
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
      {/* /Delete Schedule Modal */}

      {/* Bulk Generate Modal */}
      <div className="modal fade" id="bulk_generate">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="d-flex align-items-center">
                <div className="modal-icon me-2">
                  <i className="ti ti-layout-grid-add" />
                </div>
                <h4 className="modal-title">Bulk Generate Time Slots</h4>
              </div>
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
                handleBulkGenerate();
              }}
            >
              <div className="modal-body">
                <div className="alert alert-info d-flex align-items-center mb-3">
                  <i className="ti ti-info-circle me-2 fs-18" />
                  <p className="mb-0 small">
                    This will automatically generate a sequence of periods. Any overlapping existing slots will be
                    skipped.
                  </p>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Day Start Time</label>
                    <TimePicker
                      className="form-control"
                      format="h:mm A"
                      use12Hours
                      value={genForm.startTime}
                      onChange={(v) => setGenForm((f) => ({ ...f, startTime: v }))}
                      allowClear={false}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Day End Time</label>
                    <TimePicker
                      className="form-control"
                      format="h:mm A"
                      use12Hours
                      value={genForm.endTime}
                      onChange={(v) => setGenForm((f) => ({ ...f, endTime: v }))}
                      allowClear={false}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Period Duration (min)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={genForm.duration}
                      onChange={(e) => setGenForm((f) => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                      min={1}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Prefix (e.g. Period)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={genForm.prefix}
                      onChange={(e) => setGenForm((f) => ({ ...f, prefix: e.target.value }))}
                    />
                  </div>

                  <div className="col-12 mb-3">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="includeBreaks"
                        checked={genForm.includeBreaks}
                        onChange={(e) => setGenForm((f) => ({ ...f, includeBreaks: e.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="includeBreaks">
                        Add Breaks between periods
                      </label>
                    </div>
                  </div>

                  {genForm.includeBreaks && (
                    <div className="col-12">
                      <div className="bg-light p-3 rounded border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Break Rules</h6>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-xs"
                            onClick={() =>
                              setGenForm((f) => ({
                                ...f,
                                breaks: [...f.breaks, { afterPeriod: f.breaks.length + 1, duration: 15 }],
                              }))
                            }
                          >
                            <i className="ti ti-plus me-1" />
                            Add Break
                          </button>
                        </div>
                        {genForm.breaks.map((br, idx) => (
                          <div key={idx} className="row g-2 mb-2 align-items-end">
                            <div className="col-5">
                              <label className="form-label small mb-1">After Period</label>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={br.afterPeriod}
                                onChange={(e) => {
                                  const newBreaks = [...genForm.breaks];
                                  newBreaks[idx].afterPeriod = parseInt(e.target.value) || 0;
                                  setGenForm((f) => ({ ...f, breaks: newBreaks }));
                                }}
                              />
                            </div>
                            <div className="col-5">
                              <label className="form-label small mb-1">Duration (m)</label>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={br.duration}
                                onChange={(e) => {
                                  const newBreaks = [...genForm.breaks];
                                  newBreaks[idx].duration = parseInt(e.target.value) || 0;
                                  setGenForm((f) => ({ ...f, breaks: newBreaks }));
                                }}
                              />
                            </div>
                            <div className="col-2">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm w-100"
                                onClick={() => {
                                  const newBreaks = genForm.breaks.filter((_, i) => i !== idx);
                                  setGenForm((f) => ({ ...f, breaks: newBreaks }));
                                }}
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Generating..." : "Generate Slots"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Bulk Generate Modal */}
    </>
  );
};

export default ScheduleClasses;
