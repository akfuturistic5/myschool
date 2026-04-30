import { useRef, useState, useEffect } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { status as statusOptions } from "../../../core/common/selectoption/selectoption";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import TransportModal from "./transportModal";
import { useTransportPickupPoints } from "../../../core/hooks/useTransportPickupPoints";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const TransportPickupPoints = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    loading,
    error,
    metadata,
    params,
    setParams,
    refetch,
    handleTableChange
  } = useTransportPickupPoints();

  const [selectedPickupPoint, setSelectedPickupPoint] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState(params.status || "all");

  const handleApplyClick = (e: any) => {
    e.preventDefault();
    setParams((prev: any) => ({ ...prev, status: draftStatus, page: 1 }));
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const onRefresh = async () => {
    await refetch();
    Swal.fire({
      icon: 'success',
      title: 'Refreshed',
      text: 'Data updated successfully',
      timer: 1500,
      showConfirmButton: false
    });
  };

  const handleExportExcel = () => {
    const exportData = (data as any[]).map((item: any) => ({
      ID: item.id,
      "Pickup Point": item.pickupPoint,
      Status: item.status,
      "Added On": item.addedOn
    }));
    exportToExcel(exportData, `Pickup_Points_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Pickup Point", dataKey: "pickupPoint" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(data, "Pickup Points List", `Pickup_Points_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Pickup Point", dataKey: "pickupPoint" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Pickup Points List", cols, data);
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: any) => (
        <Link to="#" className="link-primary">
          {text || 'N/A'}
        </Link>
      ),
      sorter: true,
    },
    {
      title: "Pickup Point",
      dataIndex: "pickupPoint",
      sorter: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
            </span>
          ) : (
            <span className="badge badge-soft-danger d-inline-flex align-items-center">
              <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
            </span>
          )}
        </>
      ),
      sorter: true,
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
                  data-bs-target="#edit_pickup"
                  onClick={() => setSelectedPickupPoint(record)}
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
                  onClick={() => {
                    setDeleteId(record.originalData?.id || record.id);
                    setSelectedPickupPoint(record);
                  }}
                >
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
              <h3 className="page-title mb-1">Pickup Points</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Pickup Points
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={onRefresh}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_pickup"
                  onClick={() => setSelectedPickupPoint(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Pickup Point
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Pickup Points List</h4>
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
                                options={[{ value: 'all', label: 'All Status' }, ...statusOptions.map(s => ({ value: s.value.toLowerCase(), label: s.label }))]}
                                value={draftStatus}
                                onChange={(val: string | null) => setDraftStatus(val === 'All' || val === 'all' ? 'all' : (val?.toLowerCase() || 'all'))}
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
                            setDraftStatus('all');
                            setParams((prev: any) => ({ ...prev, status: 'all', page: 1, limit: 10 }));
                          }}
                        >
                          Reset
                        </button>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {error && (
                <div className="alert alert-warning mx-3" role="alert">
                  {error}.
                </div>
              )}
              <Table
                dataSource={data}
                columns={columns}
                Selection={true}
                loading={loading}
                pagination={{
                  total: metadata.total,
                  current: params.page,
                  pageSize: params.limit,
                  showSizeChanger: true,
                }}
                onTableChange={handleTableChange}
              />
            </div>
          </div>
        </div>
      </div>

      <TransportModal
        selectedPickupPoint={selectedPickupPoint}
        deleteId={deleteId}
        onSuccess={() => {
          refetch();
          setSelectedPickupPoint(null);
          setDeleteId(null);
        }}
      />
    </>
  );
};

export default TransportPickupPoints;

