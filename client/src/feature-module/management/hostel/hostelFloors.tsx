import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import { useHostels } from "../../../core/hooks/useHostels";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import { ActiveInactiveBadge, HostelRecordStatusToggle } from "./hostelUiUtils";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

type FloorRow = {
  key: string;
  dbId: number;
  hostelName: string;
  floorName: string;
  floorNumber: string;
  wingName: string;
  addedOn: string;
  isActive: boolean | undefined;
  originalData: Record<string, unknown>;
};

const HostelFloors = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { hostels, loading: hostelsLoading } = useHostels();
  const [draftHostelId, setDraftHostelId] = useState<string | null>("__all");
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [rows, setRows] = useState<FloorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addName, setAddName] = useState("");
  const [addNum, setAddNum] = useState("");
  const [addWing, setAddWing] = useState("");
  const [addFloorHostelId, setAddFloorHostelId] = useState<string | null>(null);
  const [addActive, setAddActive] = useState(true);
  const [addSaving, setAddSaving] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNum, setEditNum] = useState("");
  const [editWing, setEditWing] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const hostelOptions = useMemo(
    () => hostels.map((h: any) => ({ value: String(h.dbId), label: h.hostelName })),
    [hostels]
  );

  const hostelFilterOptions = useMemo(
    () => [{ value: "__all", label: "All hostels" }, ...hostelOptions],
    [hostelOptions]
  );

  const loadFloors = async (hid: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = hid
        ? await apiService.getHostelFloors({ hostel_id: Number(hid), include_inactive: true })
        : await apiService.getHostelFloors({ include_inactive: true });
      const raw = res?.data ?? (Array.isArray(res) ? res : []);
      const list = Array.isArray(raw) ? raw : [];
      const mapped: FloorRow[] = list.map((f: any, i: number) => ({
        key: String(f.id ?? i),
        dbId: f.id,
        hostelName: f.hostel_name != null ? String(f.hostel_name) : "—",
        floorName: f.floor_name || "—",
        floorNumber: f.floor_number != null ? String(f.floor_number) : "—",
        wingName: f.wing_name || "—",
        addedOn: formatDateDMY(f.created_at),
        isActive: f.is_active === true ? true : f.is_active === false ? false : undefined,
        originalData: f,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message || "Failed to load floors");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloors(hostelId);
  }, [hostelId]);

  const applyFilter = (e: React.MouseEvent) => {
    e.preventDefault();
    setHostelId(draftHostelId === "__all" || draftHostelId == null ? null : draftHostelId);
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const resetFilter = () => {
    setDraftHostelId("__all");
    setHostelId(null);
  };

  const onRefresh = async () => {
    await loadFloors(hostelId);
    Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
  };

  const handleExportExcel = () => {
    exportToExcel(
      rows.map((r) => ({
        ID: r.dbId,
        Hostel: r.hostelName,
        "Floor name": r.floorName,
        "Floor #": r.floorNumber,
        Wing: r.wingName,
        "Add On": r.addedOn,
        Status: r.isActive ? "Active" : "Inactive",
      })),
      `Hostel_Floors_${new Date().toISOString().split("T")[0]}`
    );
  };

  const pdfCols = [
    { title: "ID", dataKey: "dbId" },
    { title: "Hostel", dataKey: "hostelName" },
    { title: "Floor name", dataKey: "floorName" },
    { title: "Floor #", dataKey: "floorNumber" },
    { title: "Wing", dataKey: "wingName" },
    { title: "Add On", dataKey: "addedOn" },
    { title: "Status", dataKey: "isActiveStr" },
  ];

  const handleExportPDF = () => {
    exportToPDF(
      rows.map((r) => ({ ...r, isActiveStr: r.isActive ? "Active" : "Inactive" })),
      "Hostel Floors",
      `Hostel_Floors_${new Date().toISOString().split("T")[0]}`,
      pdfCols
    );
  };

  const handlePrint = () => {
    printData(
      "Hostel Floors",
      pdfCols,
      rows.map((r) => ({ ...r, isActiveStr: r.isActive ? "Active" : "Inactive" }))
    );
  };

  const openEdit = (record: FloorRow) => {
    const f = record.originalData;
    setEditId(record.dbId);
    setEditName(String(f.floor_name ?? ""));
    setEditNum(f.floor_number != null ? String(f.floor_number) : "");
    setEditWing(f.wing_name != null ? String(f.wing_name) : "");
    setEditActive(f.is_active !== false && f.is_active !== 0);
    setTimeout(() => {
      const el = document.getElementById("edit_hostel_floor");
      const bootstrap = (window as any).bootstrap;
      if (el && bootstrap?.Modal) {
        const m = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        m.show();
      }
    }, 50);
  };

  const saveAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    const targetHid = hostelId ?? addFloorHostelId;
    if (!targetHid) {
      Swal.fire({
        icon: "warning",
        title: "Select a hostel",
        text: "Choose a hostel in the filter (single hostel) or in the form below.",
      });
      return;
    }
    if (!addName.trim() || !addNum.trim()) {
      Swal.fire({ icon: "warning", title: "Floor name and floor number are required" });
      return;
    }
    const n = Number(addNum);
    if (Number.isNaN(n)) {
      Swal.fire({ icon: "warning", title: "Floor number must be a number" });
      return;
    }
    setAddSaving(true);
    try {
      const res = await apiService.createHostelFloor({
        hostel_id: Number(targetHid),
        floor_name: addName.trim(),
        floor_number: n,
        wing_name: addWing.trim() || null,
        is_active: addActive,
      });
      if (res?.status === "SUCCESS" || res?.success) {
        setAddName("");
        setAddNum("");
        setAddWing("");
        const el = document.getElementById("add_hostel_floor");
        const bootstrap = (window as any).bootstrap;
        if (el && bootstrap?.Modal) bootstrap.Modal.getInstance(el)?.hide();
        await loadFloors(hostelId);
        setAddFloorHostelId(null);
        Swal.fire({ icon: "success", title: "Floor added", timer: 1200, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed" });
    } finally {
      setAddSaving(false);
    }
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editId) return;
    if (!editName.trim() || !editNum.trim()) {
      Swal.fire({ icon: "warning", title: "Floor name and number required" });
      return;
    }
    const n = Number(editNum);
    if (Number.isNaN(n)) {
      Swal.fire({ icon: "warning", title: "Invalid floor number" });
      return;
    }
    setEditSaving(true);
    try {
      const res = await apiService.updateHostelFloor(editId, {
        floor_name: editName.trim(),
        floor_number: n,
        wing_name: editWing.trim() || null,
        is_active: editActive,
      });
      if (res?.status === "SUCCESS" || res?.success) {
        const el = document.getElementById("edit_hostel_floor");
        const bootstrap = (window as any).bootstrap;
        if (el && bootstrap?.Modal) bootstrap.Modal.getInstance(el)?.hide();
        await loadFloors(hostelId);
        Swal.fire({ icon: "success", title: "Updated", timer: 1200, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed" });
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async (record: FloorRow) => {
    const r = await Swal.fire({
      title: "Remove floor?",
      text: "Only allowed when no rooms use this floor.",
      icon: "warning",
      showCancelButton: true,
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.deleteHostelFloor(record.dbId);
      if (res?.status === "SUCCESS" || res?.success) {
        await loadFloors(hostelId);
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
      sorter: (a: any, b: any) => String(a.hostelName || "").localeCompare(String(b.hostelName || "")),
    },
    {
      title: "Floor name",
      dataIndex: "floorName",
      sorter: (a: any, b: any) => String(a.floorName || "").localeCompare(String(b.floorName || "")),
    },
    {
      title: "Floor #",
      dataIndex: "floorNumber",
      sorter: (a: any, b: any) => Number(a.floorNumber) - Number(b.floorNumber),
    },
    {
      title: "Wing",
      dataIndex: "wingName",
    },
    {
      title: "Add On",
      dataIndex: "addedOn",
      sorter: (a: FloorRow, b: FloorRow) => String(a.addedOn || "").localeCompare(String(b.addedOn || "")),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      render: (_: unknown, record: FloorRow) => <ActiveInactiveBadge isActive={record.isActive} />,
      sorter: (a: FloorRow, b: FloorRow) =>
        Number(a.isActive === true) - Number(b.isActive === true),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: FloorRow) => (
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
              <h3 className="page-title mb-1">Hostel Floors</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Hostel Floors
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
                  data-bs-target="#add_hostel_floor"
                  onClick={() => {
                    setAddName("");
                    setAddNum("");
                    setAddWing("");
                    setAddActive(true);
                    setAddFloorHostelId(hostelId && hostelId !== "__all" ? hostelId : null);
                  }}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add floor
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Hostel Floors</h4>
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
                        <p className="text-muted small mb-3 mb-md-3">
                          Hostels are school-wide. Choose <strong>All hostels</strong> to see every floor, or pick one
                          hostel to narrow the list.
                        </p>
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Hostel</label>
                              <CommonSelect
                                className="select"
                                options={hostelFilterOptions}
                                value={draftHostelId === null ? "__all" : draftHostelId || undefined}
                                onChange={(v) => setDraftHostelId(v === "__all" || v == null || v === "" ? "__all" : v)}
                                placeholder={hostelsLoading ? "Loading…" : "All hostels"}
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

      <div className="modal fade" id="add_hostel_floor">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add floor</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              {!hostelId && (
                <div className="mb-3">
                  <label className="form-label">Hostel</label>
                  <CommonSelect
                    className="select"
                    options={hostelOptions}
                    value={addFloorHostelId || undefined}
                    onChange={(v) => setAddFloorHostelId(v ?? null)}
                    placeholder={hostelsLoading ? "Loading…" : "Select hostel"}
                  />
                  <p className="text-muted small mt-2 mb-0">
                    Required when viewing all hostels. Hidden when a single hostel filter is applied.
                  </p>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Floor name</label>
                <input className="form-control" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. First floor" />
              </div>
              <div className="mb-3">
                <label className="form-label">Floor number</label>
                <input type="number" className="form-control" value={addNum} onChange={(e) => setAddNum(e.target.value)} placeholder="e.g. 1" />
              </div>
              <div className="mb-3">
                <label className="form-label">Wing (optional)</label>
                <input className="form-control" value={addWing} onChange={(e) => setAddWing(e.target.value)} />
              </div>
              <HostelRecordStatusToggle
                id="add_hostel_floor_status"
                checked={addActive}
                onChange={setAddActive}
              />
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

      <div className="modal fade" id="edit_hostel_floor">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit floor</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Floor name</label>
                <input className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Floor number</label>
                <input type="number" className="form-control" value={editNum} onChange={(e) => setEditNum(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Wing (optional)</label>
                <input className="form-control" value={editWing} onChange={(e) => setEditWing(e.target.value)} />
              </div>
              <HostelRecordStatusToggle
                id="edit_hostel_floor_status"
                checked={editActive}
                onChange={setEditActive}
              />
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

export default HostelFloors;
