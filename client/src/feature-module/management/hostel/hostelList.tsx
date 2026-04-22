import { useMemo, useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import HostelModal from "./hostelModal";
import { useHostels } from "../../../core/hooks/useHostels";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";

const TYPE_FILTER = [
  { value: "all", label: "All types" },
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "mixed", label: "Mixed" },
];

const HostelList = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { hostels, loading, error, refetch } = useHostels(academicYearId);
  const [selectedHostel, setSelectedHostel] = useState<any>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [draftType, setDraftType] = useState("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  const filtered = useMemo(() => {
    return hostels.filter((row: any) => {
      if (filterType !== "all") {
        const t = String(row.originalData?.hostel_type || row.hostelType || "").toLowerCase();
        if (t !== filterType) return false;
      }
      const q = filterSearch.trim().toLowerCase();
      if (q) {
        const blob = `${row.hostelName} ${row.address} ${row.description} ${row.id}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [hostels, filterType, filterSearch]);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterType(draftType);
    setFilterSearch(draftSearch);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const onRefresh = async () => {
    await refetch();
    Swal.fire({ icon: "success", title: "Refreshed", timer: 1200, showConfirmButton: false });
  };

  const exportRows = useMemo(
    () =>
      filtered.map((r: any) => ({
        id: r.id,
        hostelName: r.hostelName,
        hostelType: r.hostelType,
        address: r.address,
        inTake: r.inTake,
        description: r.description,
      })),
    [filtered]
  );

  const handleExportExcel = () => {
    exportToExcel(
      exportRows.map((r) => ({
        ID: r.id,
        "Hostel Name": r.hostelName,
        Type: r.hostelType,
        Address: r.address,
        Intake: r.inTake,
        Description: r.description,
      })),
      `Hostels_${new Date().toISOString().split("T")[0]}`
    );
  };

  const pdfCols = [
    { title: "ID", dataKey: "id" },
    { title: "Hostel Name", dataKey: "hostelName" },
    { title: "Type", dataKey: "hostelType" },
    { title: "Address", dataKey: "address" },
    { title: "Intake", dataKey: "inTake" },
    { title: "Description", dataKey: "description" },
  ];

  const handleExportPDF = () => {
    exportToPDF(exportRows, "Hostel list", `Hostels_${new Date().toISOString().split("T")[0]}`, pdfCols);
  };

  const handlePrint = () => {
    printData("Hostel list", pdfCols, exportRows);
  };

  const confirmDelete = async (record: any) => {
    const id = record?.originalData?.id ?? record?.dbId;
    if (id == null) return;
    const r = await Swal.fire({
      title: "Delete hostel?",
      text: "Rooms under this hostel will be deactivated. Students must be unassigned first.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.deleteHostel(id);
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
      title: "Hostel Name",
      dataIndex: "hostelName",
      sorter: (a: TableData, b: TableData) =>
        String(a.hostelName || "").localeCompare(String(b.hostelName || "")),
    },
    {
      title: "Hostel Type",
      dataIndex: "hostelType",
      sorter: (a: TableData, b: TableData) =>
        String(a.hostelType || "").localeCompare(String(b.hostelType || "")),
    },
    {
      title: "Address",
      dataIndex: "address",
      sorter: (a: TableData, b: TableData) => String(a.address || "").localeCompare(String(b.address || "")),
    },
    {
      title: "Intake",
      dataIndex: "inTake",
      sorter: (a: TableData, b: TableData) => String(a.inTake || "").localeCompare(String(b.inTake || "")),
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
                    setSelectedHostel(record);
                    setTimeout(() => {
                      const modalElement = document.getElementById("edit_hostel");
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
              <h3 className="page-title mb-1">Hostel</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Hostel
                  </li>
                </ol>
              </nav>
              {academicYearId != null && (
                <p className="text-muted fs-12 mb-0 mt-1">Showing hostels for the selected academic year (and unassigned legacy rows).</p>
              )}
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
                  data-bs-target="#add_hostel"
                  onClick={() => {
                    setFormResetKey((k) => k + 1);
                  }}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Hostel
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Hostel</h4>
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
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Hostel type</label>
                              <CommonSelect
                                className="select"
                                options={TYPE_FILTER}
                                value={draftType}
                                onChange={(v) => setDraftType(v || "all")}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-0">
                              <label className="form-label">Search</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Name, address, description…"
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
                            setDraftType("all");
                            setDraftSearch("");
                            setFilterType("all");
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
                  <p className="mt-2">Loading hostels data...</p>
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
        selectedHostel={selectedHostel}
        onSuccess={refetch}
        formResetKey={formResetKey}
        hostelSelectOptions={[]}
        roomTypeSelectOptions={[]}
      />
    </>
  );
};

export default HostelList;

