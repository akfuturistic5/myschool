
import { useEffect, useMemo, useState } from "react";
import Table from "../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../core/common/datePicker";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { Link } from "react-router-dom";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const DeleteRequest = () => {
  const routes = all_routes;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const normalizeStatus = (raw: string | null | undefined) => {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "confirmed") return "Confirm";
    if (value === "rejected") return "Rejected";
    if (value === "cancelled") return "Cancelled";
    return "Pending";
  };

  const fetchDeleteRequests = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getDeleteAccountRequests();
      const apiRows = Array.isArray(response?.data) ? response.data : [];
      const mapped = apiRows.map((item: any, idx: number) => ({
        key: item.id ?? idx + 1,
        id: String(item.user_id ?? "-"),
        name: String(item.name || "").trim() || "Unknown user",
        requisitionDate: formatDate(item.requisition_date),
        deleteRequestDate: formatDate(item.delete_request_date),
        status: normalizeStatus(item.status),
        img:
          typeof item.avatar === "string" && item.avatar.trim().length > 0
            ? item.avatar.trim()
            : "assets/img/profiles/avatar-01.jpg",
      }));
      setRows(mapped);
    } catch (err: any) {
      setError(err?.message || "Failed to load delete account requests.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeleteRequests();
  }, []);

  const exportColumns = [
    { title: "User ID", dataKey: "id" },
    { title: "Name", dataKey: "name" },
    { title: "Requisition Date", dataKey: "requisitionDate" },
    { title: "Delete Request Date", dataKey: "deleteRequestDate" },
    { title: "Status", dataKey: "status" },
  ];

  const exportRows = useMemo(
    () =>
      rows.map((item) => ({
        id: item.id,
        name: item.name,
        requisitionDate: item.requisitionDate,
        deleteRequestDate: item.deleteRequestDate,
        status: item.status,
      })),
    [rows]
  );

  const handleExportExcel = () => {
    if (!exportRows.length) return;
    exportToExcel(exportRows, "delete-account-requests", "Delete Requests");
  };

  const handleExportPdf = () => {
    if (!exportRows.length) return;
    exportToPDF(exportRows, "Delete Account Requests", "delete-account-requests", exportColumns);
  };

  const handlePrint = () => {
    if (!exportRows.length) return;
    printData("Delete Account Requests", exportColumns, exportRows);
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (record: any) => (
        <>
          <Link to="#" className="link-primary">{record.id}</Link>
        </>
      ),
      sorter: (a: any, b: any) => String(a.id).localeCompare(String(b.id)),
    },

    {
      title: "Name",
      dataIndex: "name",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link to="#" className="avatar avatar-md">
            <ImageWithBasePath
              src={record.img}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to={routes.studentDetail}>{text}</Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: any, b: any) => String(a.name).localeCompare(String(b.name)),
    },
    {
      title: "Requisition Date",
      dataIndex: "requisitionDate",
      sorter: (a: any, b: any) => String(a.requisitionDate).localeCompare(String(b.requisitionDate)),
    },
    {
      title: "Delete RequestDate",
      dataIndex: "deleteRequestDate",
      sorter: (a: any, b: any) => String(a.deleteRequestDate).localeCompare(String(b.deleteRequestDate)),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Confirm" ? (
            <span
              className="badge badge-soft-success d-inline-flex align-items-center"
            >
              <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
            </span>
          ) : (
            <span
              className="badge badge-soft-warning d-inline-flex align-items-center"
            >
              <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
            </span>
          )}
        </>
      ),
      sorter: (a: any, b: any) => a.status.length - b.status.length,
    },
   
  ];
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Delete Account Request</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">User Management</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Delete Account Request
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
                <TooltipOption
                  onRefresh={fetchDeleteRequests}
                  onPrint={handlePrint}
                  onExportPdf={handleExportPdf}
                  onExportExcel={handleExportExcel}
                />
              </div>
            </div>
            {/* Page Header */}
            {/* Filter Section */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Delete Account Request List</h4>
                <div className="d-flex align-items-center flex-wrap">
                  <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
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
                        <Link
                          to="#"
                          className="dropdown-item rounded-1 active"
                        >
                          Ascending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Descending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Viewed
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Added
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="card-body p-0 py-3">
                {loading && (
                  <div className="text-center p-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading delete account requests...</p>
                  </div>
                )}
                {!loading && error && (
                  <div className="text-center p-4">
                    <div className="alert alert-danger" role="alert">
                      <i className="ti ti-alert-circle me-2"></i>
                      {error}
                      <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchDeleteRequests}>
                        Retry
                      </button>
                    </div>
                  </div>
                )}
                {!loading && !error && rows.length === 0 && (
                  <div className="text-center p-4">
                    <div className="text-muted">No delete account requests found.</div>
                  </div>
                )}
                {!loading && !error && rows.length > 0 && (
                  <Table columns={columns} dataSource={rows} Selection={true} />
                )}
              </div>
            </div>
            {/* /Filter Section */}
            <div className="row align-items-center">
              <div className="col-md-12">
                <div className="datatable-paginate mt-4" />
              </div>
            </div>
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Delete Modal */}
        <div className="modal fade" id="delete-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form >
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
                    <button type="submit" className="btn btn-danger">
                      Yes, Delete
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Delete Modal */}
      </>
    </div>
  );
};

export default DeleteRequest;
