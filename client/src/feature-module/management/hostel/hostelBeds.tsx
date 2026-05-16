import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import { useHostels } from "../../../core/hooks/useHostels";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { ActiveInactiveBadge, HostelRecordStatusToggle } from "./hostelUiUtils";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

type BedRow = {
  key: string;
  dbId: number;
  hostelName: string;
  floorLabel: string;
  roomNumber: string;
  bedNumber: string;
  positionLabel: string;
  bedStatus: string;
  addedOn: string;
  isActive: boolean | undefined;
  originalData: Record<string, unknown>;
};

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "maintenance", label: "Maintenance" },
];

/** Room-scoped codes: bed-1, bed-2, … Unique vs existing bed_number (case-insensitive). */
function suggestNextBedLabel(
  beds: { id?: number; bed_number?: string | null }[],
  excludeBedId?: number | null
): string {
  const others = beds.filter((b: any) => (excludeBedId == null ? true : Number(b.id) !== excludeBedId));
  const used = new Set(
    others.map((b: any) => String(b?.bed_number ?? "").trim().toLowerCase()).filter(Boolean)
  );

  let maxSeq = 0;
  const seqRe = /^bed[-_\s]?(\d+)$/i;
  for (const row of others) {
    const s = String(row?.bed_number ?? "").trim();
    const m = s.match(seqRe);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
    }
  }

  const labelFor = (n: number) => `bed-${n}`;

  for (let n = maxSeq + 1; n <= maxSeq + 500; n++) {
    const label = labelFor(n);
    if (!used.has(label.toLowerCase())) return label;
  }
  for (let n = 1; n <= 9999; n++) {
    const label = labelFor(n);
    if (!used.has(label.toLowerCase())) return label;
  }
  return `bed-${Date.now().toString(36).slice(-6)}`;
}

const HostelBeds = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { hostels, loading: hostelsLoading } = useHostels();

  const [draftHostelId, setDraftHostelId] = useState<string | null>(null);
  const [draftFloorId, setDraftFloorId] = useState<string | null>(null);
  const [draftRoomId, setDraftRoomId] = useState<string | null>(null);
  const [draftFloors, setDraftFloors] = useState<{ value: string; label: string }[]>([]);
  const [draftRoomsRaw, setDraftRoomsRaw] = useState<any[]>([]);

  const [roomId, setRoomId] = useState<string | null>(null);

  const [rows, setRows] = useState<BedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addNum, setAddNum] = useState("");
  const [addPos, setAddPos] = useState("");
  const [addStatus, setAddStatus] = useState("available");
  const [addRecordActive, setAddRecordActive] = useState(true);
  const [addSaving, setAddSaving] = useState(false);
  const [addBedHostelId, setAddBedHostelId] = useState<string | null>(null);
  const [addBedFloorId, setAddBedFloorId] = useState<string | null>(null);
  const [addBedRoomId, setAddBedRoomId] = useState<string | null>(null);
  const [addBedFloors, setAddBedFloors] = useState<{ value: string; label: string }[]>([]);
  const [addBedRoomsRaw, setAddBedRoomsRaw] = useState<any[]>([]);
  const [addBedSuggestKey, setAddBedSuggestKey] = useState(0);

  const [editBedId, setEditBedId] = useState<number | null>(null);
  const [editBedRoomId, setEditBedRoomId] = useState<number | null>(null);
  const [editNum, setEditNum] = useState("");
  const [editPos, setEditPos] = useState("");
  const [editStatus, setEditStatus] = useState("available");
  const [editRecordActive, setEditRecordActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const hostelOptions = useMemo(
    () => hostels.map((h: any) => ({ value: String(h.dbId), label: h.hostelName })),
    [hostels]
  );

  const draftFloorSelectOptions = useMemo(
    () => [{ value: "__all", label: "All floors" }, ...draftFloors],
    [draftFloors]
  );

  const draftRoomOptions = useMemo(() => {
    const list = draftFloorId
      ? draftRoomsRaw.filter((r) => String(r.floor_id) === draftFloorId)
      : draftRoomsRaw;
    return list.map((r: any) => ({
      value: String(r.id),
      label: `${r.floor_name ?? "Floor"} · ${r.room_number ?? r.id}`,
    }));
  }, [draftRoomsRaw, draftFloorId]);

  const addBedFloorSelectOptions = useMemo(
    () => [{ value: "__all", label: "All floors" }, ...addBedFloors],
    [addBedFloors]
  );

  const addBedRoomOptions = useMemo(() => {
    const list = addBedFloorId
      ? addBedRoomsRaw.filter((r) => String(r.floor_id) === addBedFloorId)
      : addBedRoomsRaw;
    return list.map((r: any) => ({
      value: String(r.id),
      label: `${r.floor_name ?? "Floor"} · ${r.room_number ?? r.id}`,
    }));
  }, [addBedRoomsRaw, addBedFloorId]);

  useEffect(() => {
    setDraftFloors([]);
    setDraftRoomsRaw([]);
    setDraftFloorId(null);
    setDraftRoomId(null);
    let cancelled = false;
    if (!draftHostelId) return undefined;
    (async () => {
      try {
        const [fRes, rRes] = await Promise.all([
          apiService.getHostelFloors(Number(draftHostelId)),
          apiService.getHostelRooms({ hostel_id: Number(draftHostelId) }),
        ]);
        const fraw = fRes?.data ?? (Array.isArray(fRes) ? fRes : []);
        const floors = Array.isArray(fraw) ? fraw : [];
        const rraw = rRes?.data ?? (Array.isArray(rRes) ? rRes : []);
        const rooms = Array.isArray(rraw) ? rraw : [];
        if (!cancelled) {
          setDraftFloors(
            floors.map((f: any) => ({
              value: String(f.id),
              label: `${f.floor_name} (#${f.floor_number})`,
            }))
          );
          setDraftRoomsRaw(rooms);
        }
      } catch {
        if (!cancelled) {
          setDraftFloors([]);
          setDraftRoomsRaw([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftHostelId]);

  useEffect(() => {
    if (!addBedHostelId) {
      setAddBedFloors([]);
      setAddBedRoomsRaw([]);
      setAddBedFloorId(null);
      setAddBedRoomId(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const [fRes, rRes] = await Promise.all([
          apiService.getHostelFloors(Number(addBedHostelId)),
          apiService.getHostelRooms({ hostel_id: Number(addBedHostelId) }),
        ]);
        const fraw = fRes?.data ?? (Array.isArray(fRes) ? fRes : []);
        const floors = Array.isArray(fraw) ? fraw : [];
        const rraw = rRes?.data ?? (Array.isArray(rRes) ? rRes : []);
        const rooms = Array.isArray(rraw) ? rraw : [];
        if (cancelled) return;
        const floorOpts = floors.map((f: any) => ({
          value: String(f.id),
          label: `${f.floor_name} (#${f.floor_number})`,
        }));
        setAddBedFloors(floorOpts);
        setAddBedRoomsRaw(rooms);
      } catch {
        if (!cancelled) {
          setAddBedFloors([]);
          setAddBedRoomsRaw([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addBedHostelId]);

  useEffect(() => {
    if (!draftRoomId) return;
    const still = draftRoomOptions.some((o) => o.value === draftRoomId);
    if (!still) setDraftRoomId(draftRoomOptions[0]?.value ?? null);
  }, [draftFloorId, draftRoomOptions, draftRoomId]);

  useEffect(() => {
    if (addBedRoomOptions.length === 0) return;
    if (!addBedRoomId) return;
    const still = addBedRoomOptions.some((o) => o.value === addBedRoomId);
    if (!still) setAddBedRoomId(addBedRoomOptions[0]?.value ?? null);
  }, [addBedFloorId, addBedRoomOptions, addBedRoomId]);

  useEffect(() => {
    if (!addBedRoomId) {
      setAddNum("");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getHostelBeds({ room_id: Number(addBedRoomId), include_inactive: true });
        const raw = res?.data ?? (Array.isArray(res) ? res : []);
        const list = Array.isArray(raw) ? raw : [];
        if (!cancelled) setAddNum(suggestNextBedLabel(list, null));
      } catch {
        if (!cancelled) setAddNum("bed-1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addBedRoomId, addBedSuggestKey]);

  const mapBedRow = (b: Record<string, unknown>, i: number): BedRow => {
    const floorName = b.floor_name != null ? String(b.floor_name).trim() : "";
    const floorNum = b.floor_number != null ? String(b.floor_number) : "";
    let floorLabel = "—";
    if (floorName || floorNum) {
      floorLabel = [floorName, floorNum ? `(#${floorNum})` : ""].filter(Boolean).join(" ").trim();
    }
    return {
      key: String(b.id ?? i),
      dbId: b.id as number,
      hostelName: b.hostel_name != null ? String(b.hostel_name) : "—",
      floorLabel,
      roomNumber: b.room_number != null ? String(b.room_number) : "—",
      bedNumber: b.bed_number != null ? String(b.bed_number) : "—",
      positionLabel: b.position_label != null ? String(b.position_label) : "—",
      bedStatus: b.bed_status != null ? String(b.bed_status) : "—",
      addedOn: formatDateDMY(b.created_at as string | Date | null | undefined),
      isActive: b.is_active === true ? true : b.is_active === false ? false : undefined,
      originalData: b,
    };
  };

  const loadBeds = async (rid: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = rid
        ? await apiService.getHostelBeds({ room_id: Number(rid), include_inactive: true })
        : await apiService.getHostelBeds({ include_inactive: true });
      const raw = res?.data ?? (Array.isArray(res) ? res : []);
      const list = Array.isArray(raw) ? raw : [];
      const mapped: BedRow[] = list.map((b: any, i: number) => mapBedRow(b, i));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message || "Failed to load beds");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBeds(roomId);
  }, [roomId]);

  const applyFilter = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!draftHostelId || !draftRoomId) {
      Swal.fire({ icon: "warning", title: "Select hostel and room, then Apply" });
      return;
    }
    setRoomId(draftRoomId);
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const resetFilter = () => {
    setDraftHostelId(null);
    setDraftFloorId(null);
    setDraftRoomId(null);
    setRoomId(null);
  };

  const onRefresh = async () => {
    await loadBeds(roomId);
    Swal.fire({ icon: "success", title: "Refreshed", timer: 900, showConfirmButton: false });
  };

  const handleExportExcel = () => {
    exportToExcel(
      rows.map((r) => ({
        ID: r.dbId,
        Hostel: r.hostelName,
        Floor: r.floorLabel,
        Room: r.roomNumber,
        "Bed #": r.bedNumber,
        Position: r.positionLabel,
        "Bed status": r.bedStatus,
        "Add On": r.addedOn,
        Status: r.isActive ? "Active" : "Inactive",
      })),
      `Hostel_Beds_${new Date().toISOString().split("T")[0]}`
    );
  };

  const pdfCols = [
    { title: "ID", dataKey: "dbId" },
    { title: "Hostel", dataKey: "hostelName" },
    { title: "Floor", dataKey: "floorLabel" },
    { title: "Room", dataKey: "roomNumber" },
    { title: "Bed #", dataKey: "bedNumber" },
    { title: "Position", dataKey: "positionLabel" },
    { title: "Bed status", dataKey: "bedStatus" },
    { title: "Add On", dataKey: "addedOn" },
    { title: "Status", dataKey: "isActiveStr" },
  ];

  const handleExportPDF = () => {
    exportToPDF(
      rows.map((r) => ({ ...r, isActiveStr: r.isActive ? "Active" : "Inactive" })),
      "Hostel Beds",
      `Hostel_Beds_${new Date().toISOString().split("T")[0]}`,
      pdfCols
    );
  };

  const handlePrint = () => {
    printData(
      "Hostel Beds",
      pdfCols,
      rows.map((r) => ({ ...r, isActiveStr: r.isActive ? "Active" : "Inactive" }))
    );
  };

  const openAddBedModal = () => {
    setAddBedHostelId(draftHostelId);
    setAddBedFloorId(draftFloorId);
    setAddBedRoomId(roomId ?? draftRoomId ?? null);
    setAddPos("");
    setAddStatus("available");
    setAddRecordActive(true);
    setAddBedSuggestKey((k) => k + 1);
  };

  const refreshAddBedSuggestion = () => {
    setAddBedSuggestKey((k) => k + 1);
  };

  const openEdit = (record: BedRow) => {
    const b = record.originalData as any;
    setEditBedId(record.dbId);
    setEditBedRoomId(b.room_id != null ? Number(b.room_id) : null);
    setEditNum(String(b.bed_number ?? ""));
    setEditPos(b.position_label != null ? String(b.position_label) : "");
    setEditStatus(String(b.bed_status ?? "available"));
    setEditRecordActive(b.is_active !== false && b.is_active !== 0);
    setTimeout(() => {
      const el = document.getElementById("edit_hostel_bed");
      const bootstrap = (window as any).bootstrap;
      if (el && bootstrap?.Modal) {
        const m = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        m.show();
      }
    }, 50);
  };

  const saveAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    const targetRoomId = addBedRoomId != null && addBedRoomId !== "" ? addBedRoomId : null;
    if (!targetRoomId) {
      Swal.fire({ icon: "warning", title: "Select a room", text: "Choose hostel, floor (optional), and room in the form." });
      return;
    }
    if (!addNum.trim()) {
      Swal.fire({ icon: "warning", title: "Bed number / code is required" });
      return;
    }
    setAddSaving(true);
    try {
      const res = await apiService.createHostelBed({
        room_id: Number(targetRoomId),
        bed_number: addNum.trim(),
        position_label: addPos.trim() || null,
        bed_status: addStatus,
        is_active: addRecordActive,
      });
      if (res?.status === "SUCCESS" || res?.success) {
        setAddPos("");
        setAddStatus("available");
        setAddRecordActive(true);
        const el = document.getElementById("add_hostel_bed");
        const bootstrap = (window as any).bootstrap;
        if (el && bootstrap?.Modal) bootstrap.Modal.getInstance(el)?.hide();
        await loadBeds(roomId);
        Swal.fire({ icon: "success", title: "Bed added", timer: 1100, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed" });
    } finally {
      setAddSaving(false);
    }
  };

  const applySuggestedEditBedNumber = async () => {
    if (editBedRoomId == null || editBedId == null) return;
    try {
      const res = await apiService.getHostelBeds({ room_id: editBedRoomId, include_inactive: true });
      const raw = res?.data ?? (Array.isArray(res) ? res : []);
      const list = Array.isArray(raw) ? raw : [];
      setEditNum(suggestNextBedLabel(list, editBedId));
    } catch {
      setEditNum("bed-1");
    }
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editBedId) return;
    setEditSaving(true);
    try {
      const res = await apiService.updateHostelBed(editBedId, {
        bed_number: editNum.trim(),
        position_label: editPos.trim() || null,
        bed_status: editStatus,
        is_active: editRecordActive,
      });
      if (res?.status === "SUCCESS" || res?.success) {
        const el = document.getElementById("edit_hostel_bed");
        const bootstrap = (window as any).bootstrap;
        if (el && bootstrap?.Modal) bootstrap.Modal.getInstance(el)?.hide();
        await loadBeds(roomId);
        Swal.fire({ icon: "success", title: "Updated", timer: 1100, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed" });
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async (record: BedRow) => {
    const r = await Swal.fire({
      title: "Remove bed?",
      text: "Not allowed while the bed has an active assignment.",
      icon: "warning",
      showCancelButton: true,
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.deleteHostelBed(record.dbId);
      if (res?.status === "SUCCESS" || res?.success) {
        await loadBeds(roomId);
        Swal.fire({ icon: "success", title: "Removed", timer: 1000, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Delete failed" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Delete failed" });
    }
  };

  const columns = [
    {
      title: "Hostel",
      dataIndex: "hostelName",
      sorter: (a: BedRow, b: BedRow) => String(a.hostelName || "").localeCompare(String(b.hostelName || "")),
    },
    {
      title: "Floor",
      dataIndex: "floorLabel",
      sorter: (a: BedRow, b: BedRow) => String(a.floorLabel || "").localeCompare(String(b.floorLabel || "")),
    },
    {
      title: "Room",
      dataIndex: "roomNumber",
      sorter: (a: BedRow, b: BedRow) => String(a.roomNumber || "").localeCompare(String(b.roomNumber || "")),
    },
    {
      title: "Bed #",
      dataIndex: "bedNumber",
      sorter: (a: BedRow, b: BedRow) => String(a.bedNumber || "").localeCompare(String(b.bedNumber || "")),
    },
    {
      title: "Position",
      dataIndex: "positionLabel",
    },
    {
      title: "Bed status",
      dataIndex: "bedStatus",
      sorter: (a: BedRow, b: BedRow) => String(a.bedStatus || "").localeCompare(String(b.bedStatus || "")),
    },
    {
      title: "Add On",
      dataIndex: "addedOn",
      sorter: (a: BedRow, b: BedRow) => String(a.addedOn || "").localeCompare(String(b.addedOn || "")),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      render: (_: unknown, record: BedRow) => <ActiveInactiveBadge isActive={record.isActive} />,
      sorter: (a: BedRow, b: BedRow) => Number(a.isActive === true) - Number(b.isActive === true),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: BedRow) => (
        <div className="dropdown">
          <Link
            to="#"
            className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
            data-bs-toggle="dropdown"
          >
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-end p-2">
            <li>
              <Link className="dropdown-item rounded-1" to="#" onClick={(e) => { e.preventDefault(); openEdit(record); }}>
                <i className="ti ti-edit-circle me-2" />
                Edit
              </Link>
            </li>
            <li>
              <Link className="dropdown-item rounded-1" to="#" onClick={(e) => { e.preventDefault(); confirmDelete(record); }}>
                <i className="ti ti-trash-x me-2" />
                Remove
              </Link>
            </li>
          </ul>
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
              <h3 className="page-title mb-1">Hostel Beds</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Hostel Beds
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <TooltipOption
                onRefresh={onRefresh}
                onPrint={handlePrint}
                onExportPdf={handleExportPDF}
                onExportExcel={handleExportExcel}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_hostel_bed"
                  onClick={openAddBedModal}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add bed
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Hostel Beds</h4>
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
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form onSubmit={(ev) => ev.preventDefault()}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4 className="mb-0">Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <p className="text-muted small mb-3">
                          Apply <strong>hostel → floor → room</strong> to narrow the list, or leave unapplied to see all beds.
                          When adding a bed, pick the room in the modal if you have not applied a filter.
                        </p>
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Hostel</label>
                              <CommonSelect
                                className="select"
                                options={hostelOptions}
                                value={draftHostelId || undefined}
                                onChange={(v) => {
                                  setDraftHostelId(v ?? null);
                                  setDraftFloorId(null);
                                  setDraftRoomId(null);
                                }}
                                placeholder={hostelsLoading ? "Loading…" : "Select hostel"}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Floor</label>
                              <CommonSelect
                                className="select"
                                options={draftFloorSelectOptions}
                                value={draftFloorId == null ? "__all" : draftFloorId}
                                onChange={(v) => {
                                  setDraftFloorId(v === "__all" || v == null || v === "" ? null : v);
                                  setDraftRoomId(null);
                                }}
                                placeholder={draftHostelId ? "All floors" : "Select hostel first"}
                              />
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="mb-0">
                              <label className="form-label">Room</label>
                              <CommonSelect
                                className="select"
                                options={draftRoomOptions}
                                value={draftRoomId || undefined}
                                onChange={(v) => setDraftRoomId(v ?? null)}
                                placeholder={draftHostelId ? "Select room" : "Select hostel first"}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={resetFilter}>
                          Reset
                        </button>
                        <button type="button" className="btn btn-primary" onClick={applyFilter}>
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading && (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              )}
              {error && (
                <div className="alert alert-danger m-3">{error}</div>
              )}
              {!loading && !error && <Table dataSource={rows} columns={columns} Selection={true} />}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_hostel_bed">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add bed</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3 mb-md-3">
                Select the room this bed belongs to. If you already applied a filter on the page, hostel and room are
                prefilled. The next free <span className="text-nowrap">bed-1</span>-style code is suggested; change it if needed.
              </p>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Hostel</label>
                  <CommonSelect
                    className="select"
                    options={hostelOptions}
                    value={addBedHostelId || undefined}
                    onChange={(v) => {
                      setAddBedHostelId(v ?? null);
                      setAddBedFloorId(null);
                      setAddBedRoomId(null);
                    }}
                    placeholder={hostelsLoading ? "Loading…" : "Select hostel"}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Floor</label>
                  <CommonSelect
                    className="select"
                    options={addBedFloorSelectOptions}
                    value={addBedFloorId == null ? "__all" : addBedFloorId}
                    onChange={(v) => {
                      setAddBedFloorId(v === "__all" || v == null || v === "" ? null : v);
                      setAddBedRoomId(null);
                    }}
                    placeholder={addBedHostelId ? "All floors" : "Select hostel first"}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Room</label>
                  <CommonSelect
                    className="select"
                    options={addBedRoomOptions}
                    value={addBedRoomId || undefined}
                    onChange={(v) => setAddBedRoomId(v ?? null)}
                    placeholder={addBedHostelId ? "Select room" : "Select hostel first"}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Bed number / code</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      value={addNum}
                      onChange={(e) => setAddNum(e.target.value)}
                      placeholder="e.g. bed-1"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      title="Suggest next free bed number"
                      disabled={!addBedRoomId}
                      onClick={refreshAddBedSuggestion}
                    >
                      <i className="ti ti-wand me-1" />
                      Suggest
                    </button>
                  </div>
                  <p className="text-muted small mt-1 mb-0">Uses the next free <code>bed-</code> code in this room (e.g. bed-1, bed-2). You can change it before saving.</p>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Position label (optional)</label>
                  <input
                    className="form-control"
                    value={addPos}
                    onChange={(e) => setAddPos(e.target.value)}
                    placeholder="e.g. Upper bunk"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Bed status</label>
                  <CommonSelect
                    className="select"
                    options={STATUS_OPTIONS}
                    value={addStatus}
                    onChange={(v) => setAddStatus(v || "available")}
                    placeholder="Status"
                  />
                </div>
                <div className="col-12">
                  <HostelRecordStatusToggle
                    id="add_hostel_bed_record_status"
                    checked={addRecordActive}
                    onChange={setAddRecordActive}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={addSaving} onClick={saveAdd}>
                {addSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_hostel_bed">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit bed</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Bed number / code</label>
                  <div className="input-group">
                    <input className="form-control" value={editNum} onChange={(e) => setEditNum(e.target.value)} />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      title="Suggest next free number in this room"
                      onClick={() => void applySuggestedEditBedNumber()}
                    >
                      <i className="ti ti-wand me-1" />
                      Suggest
                    </button>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Position label</label>
                  <input className="form-control" value={editPos} onChange={(e) => setEditPos(e.target.value)} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Bed status</label>
                  <CommonSelect
                    className="select"
                    options={STATUS_OPTIONS}
                    value={editStatus}
                    onChange={(v) => setEditStatus(v || "available")}
                    placeholder="Status"
                  />
                </div>
                <div className="col-12">
                  <HostelRecordStatusToggle
                    id="edit_hostel_bed_record_status"
                    checked={editRecordActive}
                    onChange={setEditRecordActive}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={editSaving} onClick={saveEdit}>
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HostelBeds;
