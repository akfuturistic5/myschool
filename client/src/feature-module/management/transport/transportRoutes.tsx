import { useRef, useState, useEffect } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import {
  status as statusOptions,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import TransportModal from "./transportModal";
import { useTransportRoutes } from "../../../core/hooks/useTransportRoutes";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const TransportRoutes = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  
  const { 
    data, 
    loading, 
    error, 
    total, 
    params, 
    setParams, 
    refetch 
  } = useTransportRoutes();

  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [pickupsData, setPickupsData] = useState<any[]>([]);
  const [draftFilters, setDraftFilters] = useState({
    pickup_point_id: "all",
    status: "all",
  });

  // Fetch Pickup Points for Filter
  useEffect(() => {
    const fetchPickups = async () => {
      try {
        const res = await apiService.getTransportPickupPoints({ status: 'active', limit: 1000, academic_year_id: academicYearId ?? undefined });
        if (res.status === "SUCCESS") {
          setPickupsData(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch pickup points:", err);
      }
    };
    fetchPickups();
  }, [academicYearId]);

  useEffect(() => {
    setParams({ ...params, academic_year_id: academicYearId ?? undefined, page: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId]);

  const handleSearch = (val: string) => {
    setParams({ ...params, search: val, page: 1 });
  };

  const handleApplyClick = (e: any) => {
    e.preventDefault();
    setParams({
      ...params,
      page: 1,
      pickup_point_id: draftFilters.pickup_point_id,
      status: draftFilters.status,
    });
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
    const exportData = data.map(item => ({
      ID: item.id,
      Route: item.routes,
      "Distance (KM)": item.distance_km,
      Stops: item.stopsSummary,
      Status: item.status,
      "Added On": item.addedOn
    }));
    exportToExcel(exportData, `Transport_Routes_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Route", dataKey: "routes" },
      { title: "Distance (KM)", dataKey: "distance_km" },
      { title: "Stops", dataKey: "stopsSummary" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(data, "Transport Routes List", `Transport_Routes_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Route", dataKey: "routes" },
      { title: "Distance (KM)", dataKey: "distance_km" },
      { title: "Stops", dataKey: "stopsSummary" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Transport Routes List", cols, data);
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
      title: "Routes",
      dataIndex: "routes",
      sorter: true,
    },
    {
      title: "Distance (KM)",
      dataIndex: "distance_km",
      sorter: true,
    },
    {
      title: "Stops",
      dataIndex: "stopsSummary",
      sorter: true,
      render: (text: string) => (
        <span className="text-truncate d-inline-block" style={{ maxWidth: '200px' }} title={text}>
          {text}
        </span>
      )
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
                  data-bs-target="#edit_routes"
                  onClick={() => setSelectedRoute(record)}
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
                    setSelectedRoute(record);
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

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setParams({
      ...params,
      page: pagination.current,
      limit: pagination.pageSize,
      sortField: sorter.field || params.sortField,
      sortOrder: sorter.order === 'descend' ? 'DESC' : 'ASC'
    });
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Routes</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Routes
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
                  data-bs-target="#add_routes"
                  onClick={() => setSelectedRoute(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Route Stop
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Routes List</h4>
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
                            <div className="mb-3">
                              <label className="form-label">Pickup Point</label>
                              <CommonSelect
                                className="select"
                                options={[{ value: 'all', label: 'All Points' }, ...pickupsData.map(p => ({ value: p.id.toString(), label: p.point_name })) ]}
                                value={draftFilters.pickup_point_id}
                                onChange={(val: string | null) => {
                                  const newVal = val === 'all' || val === 'All' ? 'all' : (val || 'all');
                                  setDraftFilters((prev) => ({ ...prev, pickup_point_id: newVal }));
                                }}
                              />
                            </div>
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[{ value: 'all', label: 'All Status' }, ...statusOptions.map(s => ({ value: s.value.toLowerCase(), label: s.label } ))]}
                                value={draftFilters.status}
                                onChange={(val: string | null) => {
                                  setDraftFilters((prev) => ({ ...prev, status: val === 'All' || val === 'all' ? 'all' : (val?.toLowerCase() || 'all') }));
                                }}
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
                            setDraftFilters({ status: 'all', pickup_point_id: 'all' });
                            setParams({ ...params, status: 'all', search: '', page: 1, pickup_point_id: 'all' });
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
                  total: total,
                  current: params.page,
                  pageSize: params.limit,
                  showSizeChanger: true,
                }}
                onChange={handleTableChange}
              />
            </div>
          </div>
        </div>
      </div>

      <TransportModal
        selectedRoute={selectedRoute}
        deleteId={deleteId}
        onSuccess={() => {
          refetch();
          setSelectedRoute(null);
          setDeleteId(null);
        }}
      />
    </>
  );
};

export default TransportRoutes;

