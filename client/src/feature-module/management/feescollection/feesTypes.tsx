import { useRef, useState, useEffect } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { apiService } from "../../../core/services/apiService";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import FeesModal from "./feesModal";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const FeesTypes = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState("All");

  // Modal
  const [selectedType, setSelectedType] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchFeesTypes = async (isManualRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      // fees_types are global (no academic_year_id filter needed)
      // pass include_inactive to show all, filter in UI
      const res = await apiService.getFeesTypes({ include_inactive: 'true' });
      if (res.status === "SUCCESS") {
        const mappedData = res.data.map((item: any) => ({
          ...item,
          key: item.id,
        }));
        setData(mappedData);
        setFilteredData(mappedData);
        if (isManualRefresh) {
          Swal.fire({ icon: 'success', title: 'Refreshed', timer: 1200, showConfirmButton: false });
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch fee types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeesTypes();
  }, []);

  const handleApplyClick = (e: any) => {
    e.preventDefault();
    let filtered = [...data];

    if (filterStatus !== "All") {
      const isActive = filterStatus === "active";
      filtered = filtered.filter(item => item.is_active === isActive);
    }

    setFilteredData(filtered);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleReset = () => {
    setFilterStatus("All");
    setFilteredData(data);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      "Fee Type": item.name,
      Code: item.code || "",
      Description: item.description || "",
      "Used In (configs)": item.usage_count ?? 0,
      Status: item.is_active ? "Active" : "Inactive"
    }));
    exportToExcel(exportData, `FeesTypes_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const columns = [
      { title: "Fee Type", dataKey: "name" },
      { title: "Code", dataKey: "code" },
      { title: "Description", dataKey: "description" },
      { title: "Status", dataKey: "status_label" },
    ];
    const rows = filteredData.map((r: any) => ({ ...r, status_label: r.is_active ? "Active" : "Inactive" }));
    exportToPDF(rows, "Fee Type List", `FeesTypes_${new Date().toISOString().split('T')[0]}`, columns);
  };

  const handlePrint = () => {
    const columns = [
      { title: "Fee Type", dataKey: "name" },
      { title: "Code", dataKey: "code" },
      { title: "Description", dataKey: "description" },
      { title: "Status", dataKey: "status_label" },
    ];
    const rows = filteredData.map((r: any) => ({ ...r, status_label: r.is_active ? "Active" : "Inactive" }));
    printData("Fee Type List", columns, rows);
  };

  const handleEdit = (type: any) => {
    setSelectedType(type);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
  };

  const handleDeleteSuccess = () => {
    fetchFeesTypes();
    setDeleteId(null);
  };
  const columns = [
    {
      title: "Fee Type",
      dataIndex: "name",
      sorter: (a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""),
      render: (text: string) => <span className="fw-medium">{text}</span>
    },
    {
      title: "Code",
      dataIndex: "code",
      render: (val: string) => val || <span className="text-muted">—</span>
    },
    {
      title: "Description",
      dataIndex: "description",
      render: (val: string) => val || <span className="text-muted">—</span>
    },
    {
      title: "Used In",
      dataIndex: "usage_count",
      render: (val: number) => (
        <span className={`badge ${Number(val) > 0 ? 'badge-soft-primary' : 'badge-soft-secondary'}`}>
          {val ?? 0} config{Number(val) !== 1 ? 's' : ''}
        </span>
      )
    },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (val: boolean) => (
        val
          ? <span className="badge badge-soft-success d-inline-flex align-items-center"><i className="ti ti-circle-filled fs-5 me-1" />Active</span>
          : <span className="badge badge-soft-danger d-inline-flex align-items-center"><i className="ti ti-circle-filled fs-5 me-1" />Inactive</span>
      ),
      sorter: (a: any, b: any) => Number(b.is_active) - Number(a.is_active),
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
                  data-bs-toggle="modal"
                  data-bs-target="#edit_fees_Type"
                  onClick={() => handleEdit(record)}
                >
                  <i className="ti ti-edit-circle me-2" />Edit
                </Link>
              </li>
              <li>
                <Link
                  className="dropdown-item rounded-1 text-danger"
                  to="#"
                  data-bs-toggle="modal"
                  data-bs-target="#delete-modal"
                  onClick={() => handleDeleteClick(record.id)}
                >
                  <i className="ti ti-trash-x me-2" />Delete
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
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Fees Collection</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Fees Collection</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Fees Type
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                onRefresh={() => fetchFeesTypes(true)}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_fees_Type"
                  onClick={() => setSelectedType(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Fees Type
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees Type List</h4>
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
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                  >
                    <form onSubmit={handleApplyClick}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All" },
                                  { value: "active", label: "Active" },
                                  { value: "inactive", label: "Inactive" }
                                ]}
                                defaultValue={{ value: "All", label: "All" }}
                                value={filterStatus}
                                onChange={(val: any) => setFilterStatus(val)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={handleReset}>
                          Reset
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                        >
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              <Table dataSource={filteredData} columns={columns} Selection={true} />
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <FeesModal
        onSuccess={fetchFeesTypes}
        editTypeData={selectedType}
        deleteId={deleteId}
        deleteContext="type"
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  );
};

export default FeesTypes;

