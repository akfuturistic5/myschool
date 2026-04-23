import { useMemo, useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import HostelModal from "./hostelModal";
import { useRoomTypes } from "../../../core/hooks/useRoomTypes";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { apiService } from "../../../core/services/apiService";

const HostelType = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { roomTypes, loading, error, refetch } = useRoomTypes();
  const [selectedRoomType, setSelectedRoomType] = useState<any>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [draftSearch, setDraftSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const filtered = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return roomTypes;
    return roomTypes.filter(
      (row: any) =>
        String(row.roomType || "").toLowerCase().includes(q) ||
        String(row.description || "").toLowerCase().includes(q) ||
        String(row.id || "").toLowerCase().includes(q)
    );
  }, [roomTypes, filterSearch]);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault();
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
        roomType: r.roomType,
        description: r.description,
      })),
    [filtered]
  );

  const handleExportExcel = () => {
    exportToExcel(
      exportRows.map((r) => ({
        ID: r.id,
        "Room Type": r.roomType,
        Description: r.description,
      })),
      `Room_Types_${new Date().toISOString().split("T")[0]}`
    );
  };

  const pdfCols = [
    { title: "ID", dataKey: "id" },
    { title: "Room Type", dataKey: "roomType" },
    { title: "Description", dataKey: "description" },
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
      const res = await apiService.deleteRoomType(id);
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
      title: "Description",
      dataIndex: "description",
      sorter: (a: TableData, b: TableData) =>
        String(a.description || "").localeCompare(String(b.description || "")),
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
                          <div className="col-md-12">
                            <div className="mb-0">
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
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button
                          type="button"
                          className="btn btn-light me-3"
                          onClick={() => {
                            setDraftSearch("");
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

