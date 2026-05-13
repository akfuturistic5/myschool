import { useMemo, useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import HostelModal from "./hostelModal";
import { ActiveInactiveBadge } from "./hostelUiUtils";
import { useHostelRoomTypes } from "../../../core/hooks/useHostelRoomTypes";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { apiService } from "../../../core/services/apiService";

import CommonSelect from "../../../core/common/commonSelect";

const CAPACITY_FILTER = [
  { value: "all", label: "Any capacity" },
  ...Array.from({ length: 20 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

const HostelType = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { roomTypes, loading, error, refetch } = useHostelRoomTypes({ includeInactive: true });
  const [selectedRoomType, setSelectedRoomType] = useState<any>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftCapacity, setDraftCapacity] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCapacity, setFilterCapacity] = useState("all");

  const filtered = useMemo(() => {
    return roomTypes.filter((row: any) => {
      const od = row.originalData || {};
      if (filterCapacity !== "all") {
        const cap = od.sharing_capacity ?? row.sharing_capacity;
        if (cap == null || String(cap) !== filterCapacity) return false;
      }
      const q = filterSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        String(row.roomType || "").toLowerCase().includes(q) ||
        String(row.description || "").toLowerCase().includes(q) ||
        String(row.id || "").toLowerCase().includes(q)
      );
    });
  }, [roomTypes, filterSearch, filterCapacity]);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterSearch(draftSearch);
    setFilterCapacity(draftCapacity);
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
        roomType: r.roomType,
        sharing:
          r.originalData?.sharing_capacity != null
            ? String(r.originalData.sharing_capacity)
            : r.sharing_capacity != null
              ? String(r.sharing_capacity)
              : "",
        hasAc: r.hasAc ? "Yes" : "No",
        hasWifi: r.hasWifi ? "Yes" : "No",
        hasBath: r.hasBath ? "Yes" : "No",
        description: r.description,
        addedOn: r.addedOn,
        recordStatus: r.isActive === true ? "Active" : r.isActive === false ? "Inactive" : "—",
      })),
    [filtered]
  );

  const handleExportExcel = () => {
    exportToExcel(
      exportRows.map((r) => ({
        ID: r.id,
        "Room Type": r.roomType,
        Capacity: r.sharing ?? "",
        AC: r.hasAc,
        "Wi‑Fi": r.hasWifi,
        "Attached bath": r.hasBath,
        Description: r.description,
        "Add On": r.addedOn,
        Status: r.recordStatus,
      })),
      `Room_Types_${new Date().toISOString().split("T")[0]}`
    );
  };

  const pdfCols = [
    { title: "ID", dataKey: "id" },
    { title: "Room Type", dataKey: "roomType" },
    { title: "Capacity", dataKey: "sharing" },
    { title: "AC", dataKey: "hasAc" },
    { title: "Wi‑Fi", dataKey: "hasWifi" },
    { title: "Bath", dataKey: "hasBath" },
    { title: "Description", dataKey: "description" },
    { title: "Add On", dataKey: "addedOn" },
    { title: "Status", dataKey: "recordStatus" },
  ];

  const handleExportPDF = () => {
    exportToPDF(exportRows, "Room types", `Room_Types_${new Date().toISOString().split("T")[0]}`, pdfCols);
  };

  const handlePrint = () => {
    printData("Room types", pdfCols, exportRows);
  };

  const confirmDelete = async (record: any) => {
    const id = record?.originalData?.id ?? record?.dbId;
    if (id == null) return;
    const r = await Swal.fire({
      title: "Delete room type?",
      text: "You cannot delete a type that is still used by hostel rooms.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.deleteHostelRoomType(id);
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
      title: "Room Type",
      dataIndex: "roomType",
      sorter: (a: TableData, b: TableData) => String(a.roomType || "").localeCompare(String(b.roomType || "")),
    },
    {
      title: "Sharing capacity",
      dataIndex: "sharing_capacity",
      render: (_: any, record: any) =>
        record?.originalData?.sharing_capacity ?? record?.sharing_capacity ?? "—",
    },
    {
      title: "Amenities",
      dataIndex: "amenities",
      render: (_: any, record: any) => {
        const tags: string[] = [];
        if (record?.hasAc ?? record?.originalData?.has_ac) tags.push("AC");
        if (record?.hasWifi ?? record?.originalData?.has_wifi) tags.push("Wi‑Fi");
        if (record?.hasBath ?? record?.originalData?.has_attached_bathroom) tags.push("Bath");
        return tags.length ? tags.join(" · ") : "—";
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      sorter: (a: TableData, b: TableData) =>
        String(a.description || "").localeCompare(String(b.description || "")),
    },
    {
      title: "Add On",
      dataIndex: "addedOn",
      sorter: (a: TableData, b: TableData) => String(a.addedOn || "").localeCompare(String(b.addedOn || "")),
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
                    setSelectedRoomType(record);
                    setTimeout(() => {
                      const modalElement = document.getElementById("edit_hostel_room_type");
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
              <h3 className="page-title mb-1">Room Type</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Room Type
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
                  data-bs-target="#add_hostel_room_type"
                  onClick={() => setFormResetKey((k) => k + 1)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Room Type
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Room Type</h4>
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
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-12">
                            <div className="mb-3">
                              <label className="form-label">Search</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Room type or description…"
                                value={draftSearch}
                                onChange={(e) => setDraftSearch(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="mb-0">
                              <label className="form-label">Sharing capacity</label>
                              <CommonSelect
                                className="select"
                                options={CAPACITY_FILTER}
                                value={draftCapacity}
                                onChange={(v) => setDraftCapacity(v || "all")}
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
                            setDraftSearch("");
                            setDraftCapacity("all");
                            setFilterSearch("");
                            setFilterCapacity("all");
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
                  <p className="mt-2">Loading room types data...</p>
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

      <HostelModal selectedRoomType={selectedRoomType} onSuccess={refetch} formResetKey={formResetKey} />
    </>
  );
};

export default HostelType;

