import { useMemo, useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import HostelModal from "./hostelModal";
import { ActiveInactiveBadge } from "./hostelUiUtils";
import { useHostelRooms } from "../../../core/hooks/useHostelRooms";
import { useHostels } from "../../../core/hooks/useHostels";
import { useHostelRoomTypes } from "../../../core/hooks/useHostelRoomTypes";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { apiService } from "../../../core/services/apiService";

const HostelRooms = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { hostelRooms, loading, error, refetch } = useHostelRooms(undefined, { includeInactive: true });
  const { hostels } = useHostels();
  const { roomTypes } = useHostelRoomTypes();
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [draftHostelId, setDraftHostelId] = useState<string | null>("all");
  const [draftRoomTypeId, setDraftRoomTypeId] = useState<string | null>("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [filterHostelId, setFilterHostelId] = useState<string | null>("all");
  const [filterRoomTypeId, setFilterRoomTypeId] = useState<string | null>("all");
  const [filterSearch, setFilterSearch] = useState("");

  const hostelSelectOptions = useMemo(
    () => hostels.map((h: any) => ({ value: String(h.dbId), label: h.hostelName })),
    [hostels]
  );

  const roomTypeFilterOptions = useMemo(
    () => [
      { value: "all", label: "All room types" },
      ...roomTypes.map((rt: any) => ({
        value: String(rt.originalData?.id ?? rt.dbId),
        label: rt.roomType,
      })),
    ],
    [roomTypes]
  );

  const hostelFilterOptions = useMemo(
    () => [{ value: "all", label: "All hostels" }, ...hostelSelectOptions],
    [hostelSelectOptions]
  );

  const roomTypeSelectOptions = useMemo(
    () =>
      roomTypes.map((rt: any) => ({
        value: String(rt.originalData?.id ?? rt.dbId),
        label: rt.roomType,
      })),
    [roomTypes]
  );

  const filtered = useMemo(() => {
    return hostelRooms.filter((row: any) => {
      const od = row.originalData || {};
      if (filterHostelId && filterHostelId !== "all") {
        if (String(od.hostel_id) !== filterHostelId) return false;
      }
      if (filterRoomTypeId && filterRoomTypeId !== "all") {
        const tid = od.hostel_room_type_id ?? od.room_type_id;
        if (String(tid) !== filterRoomTypeId) return false;
      }
      const q = filterSearch.trim().toLowerCase();
      if (q) {
        const blob = `${row.roomNo} ${row.hostelName} ${row.roomType} ${row.id}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [hostelRooms, filterHostelId, filterRoomTypeId, filterSearch]);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterHostelId(draftHostelId);
    setFilterRoomTypeId(draftRoomTypeId);
    setFilterSearch(draftSearch);
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const onRefresh = async () => {
    await refetch();
    Swal.fire({ icon: "success", title: "Refreshed", timer: 1200, showConfirmButton: false });
  };

  const exportRows = useMemo(
    () =>
      filtered.map((r: any) => ({
        id: r.id,
        roomNo: r.roomNo,
        hostelName: r.hostelName,
        floorName: r.floorName,
        roomType: r.roomType,
        noofBed: r.noofBed,
        occupancyShort: r.occupancyShort,
        roomStatus: r.roomStatus,
        notesShort: r.notesShort,
        amount: r.amount,
        addedOn: r.addedOn,
        recordStatus: r.isActive === true ? "Active" : r.isActive === false ? "Inactive" : "—",
      })),
    [filtered]
  );

  const handleExportExcel = () => {
    exportToExcel(
      exportRows.map((r) => ({
        ID: r.id,
        "Room No": r.roomNo,
        Hostel: r.hostelName,
        Floor: r.floorName,
        "Room Type": r.roomType,
        Capacity: r.noofBed,
        Occupied: r.occupancyShort,
        "Room status": r.roomStatus,
        Notes: r.notesShort,
        "Monthly rent": r.amount,
        "Add On": r.addedOn,
        Status: r.recordStatus,
      })),
      `Hostel_Rooms_${new Date().toISOString().split("T")[0]}`
    );
  };

  const pdfCols = [
    { title: "ID", dataKey: "id" },
    { title: "Room No", dataKey: "roomNo" },
    { title: "Hostel", dataKey: "hostelName" },
    { title: "Floor", dataKey: "floorName" },
    { title: "Room Type", dataKey: "roomType" },
    { title: "Capacity", dataKey: "noofBed" },
    { title: "Occ.", dataKey: "occupancyShort" },
    { title: "Room status", dataKey: "roomStatus" },
    { title: "Notes", dataKey: "notesShort" },
    { title: "Monthly rent", dataKey: "amount" },
    { title: "Add On", dataKey: "addedOn" },
    { title: "Status", dataKey: "recordStatus" },
  ];

  const handleExportPDF = () => {
    exportToPDF(exportRows, "Hostel rooms", `Hostel_Rooms_${new Date().toISOString().split("T")[0]}`, pdfCols);
  };

  const handlePrint = () => {
    printData("Hostel rooms", pdfCols, exportRows);
  };

  const confirmDelete = async (record: any) => {
    const id = record?.originalData?.id ?? record?.dbId;
    if (id == null) return;
    const r = await Swal.fire({
      title: "Delete room?",
      text: "This room will be deactivated. It cannot be deleted if students are assigned.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.deleteHostelRoom(id);
      if (res?.status === "SUCCESS" || res?.success) {
        await refetch();
        Swal.fire({ icon: "success", title: "Deleted", timer: 1200, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Delete failed" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Delete failed" });
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: any) => (
        <Link to="#" className="link-primary" onClick={(e) => e.preventDefault()}>
          {text || "N/A"}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => String(a.id || "").localeCompare(String(b.id || "")),
    },
    {
      title: "Room No",
      dataIndex: "roomNo",
      sorter: (a: TableData, b: TableData) => String(a.roomNo || "").localeCompare(String(b.roomNo || "")),
    },
    {
      title: "Hostel Name",
      dataIndex: "hostelName",
      sorter: (a: TableData, b: TableData) =>
        String(a.hostelName || "").localeCompare(String(b.hostelName || "")),
    },
    {
      title: "Floor",
      dataIndex: "floorName",
      sorter: (a: any, b: any) => String(a.floorName || "").localeCompare(String(b.floorName || "")),
    },
    {
      title: "Room Type",
      dataIndex: "roomType",
      sorter: (a: TableData, b: TableData) => String(a.roomType || "").localeCompare(String(b.roomType || "")),
    },
    {
      title: "Capacity",
      dataIndex: "noofBed",
      sorter: (a: TableData, b: TableData) => String(a.noofBed || "").localeCompare(String(b.noofBed || "")),
    },
    {
      title: "Occupied",
      dataIndex: "occupancyShort",
      sorter: (a: any, b: any) =>
        String(a.occupancyShort || "").localeCompare(String(b.occupancyShort || "")),
    },
    {
      title: "Room status",
      dataIndex: "roomStatus",
      sorter: (a: any, b: any) => String(a.roomStatus || "").localeCompare(String(b.roomStatus || "")),
    },
    {
      title: "Notes",
      dataIndex: "notesShort",
      sorter: (a: any, b: any) => String(a.notesShort || "").localeCompare(String(b.notesShort || "")),
    },
    {
      title: "Monthly rent",
      dataIndex: "amount",
      sorter: (a: TableData, b: TableData) => String(a.amount || "").localeCompare(String(b.amount || "")),
    },
    {
      title: "Add On",
      dataIndex: "addedOn",
      sorter: (a: any, b: any) => String(a.addedOn || "").localeCompare(String(b.addedOn || "")),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      render: (_: unknown, record: any) => <ActiveInactiveBadge isActive={record.isActive} />,
      sorter: (a: any, b: any) => Number(a.isActive === true) - Number(b.isActive === true),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
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
            <ul className="dropdown-menu dropdown-menu-end p-2">
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedRoom(record);
                    setTimeout(() => {
                      const modalElement = document.getElementById("edit_hostel_rooms");
                      if (modalElement) {
                        const bootstrap = (window as any).bootstrap;
                        if (bootstrap?.Modal) {
                          const modal =
                            bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                          modal.show();
                        }
                      }
                    }, 50);
                  }}
                >
                  <i className="ti ti-edit-circle me-2" />
                  Edit
                </Link>
              </li>
              <li>
                <Link className="dropdown-item rounded-1" to="#" onClick={(e) => { e.preventDefault(); confirmDelete(record); }}>
                  <i className="ti ti-trash-x me-2" />
                  Delete
                </Link>
              </li>
            </ul>
          </div>
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
              <h3 className="page-title mb-1">Hostel Rooms</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Hostel Rooms
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
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
                  data-bs-target="#add_hostel_rooms"
                  onClick={() => setFormResetKey((k) => k + 1)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Hostel Rooms
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Hostel Rooms</h4>
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
                    <form onSubmit={(e) => e.preventDefault()}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4 className="mb-0">Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <p className="text-muted small mb-3">
                          Hostels are school-wide. Assignments still filter by the academic year in the app header when set.
                        </p>
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">

                              <label className="form-label">Hostel</label>
                              <CommonSelect
                                className="select"
                                options={hostelFilterOptions}
                                value={draftHostelId || "all"}
                                onChange={(v) => setDraftHostelId(v || "all")}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Room type</label>
                              <CommonSelect
                                className="select"
                                options={roomTypeFilterOptions}
                                value={draftRoomTypeId || "all"}
                                onChange={(v) => setDraftRoomTypeId(v || "all")}
                              />
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="mb-0">
                              <label className="form-label">Search</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Room no, hostel, type…"
                                value={draftSearch}
                                onChange={(e) => setDraftSearch(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button
                          type="button"
                          className="btn btn-light me-3"
                          onClick={() => {
                            setDraftHostelId("all");
                            setDraftRoomTypeId("all");
                            setDraftSearch("");
                            setFilterHostelId("all");
                            setFilterRoomTypeId("all");
                            setFilterSearch("");
                          }}
                        >
                          Reset
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleApplyClick}>
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
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading hostel rooms data...</p>
                </div>
              )}

              {error && (
                <div className="text-center p-4">
                  <div className="alert alert-danger" role="alert">
                    <i className="ti ti-alert-circle me-2" />
                    {error}
                    <button className="btn btn-sm btn-outline-danger ms-3" onClick={() => refetch()}>
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && <Table dataSource={filtered} columns={columns} Selection={true} />}
            </div>
          </div>
        </div>
      </div>

      <HostelModal
        selectedRoom={selectedRoom}
        onSuccess={refetch}
        formResetKey={formResetKey}
        hostelSelectOptions={hostelSelectOptions}
        roomTypeSelectOptions={roomTypeSelectOptions}
      />
    </>
  );
};

export default HostelRooms;

