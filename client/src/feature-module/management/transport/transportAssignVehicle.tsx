
import { useRef, useState, useEffect } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import TransportModal from "./transportModal";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useTransportAssignments } from "../../../core/hooks/useTransportAssignments";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const TransportAssignVehicle = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  
  // State for search/filters
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: "",
    status: "",
    route_id: "all",
    sortField: "id",
    sortOrder: "ASC",
  });

  // Use the dynamic hook
  const { 
    data, 
    loading, 
    metadata, 
    refetch 
  } = useTransportAssignments(params);

  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [routesData, setRoutesData] = useState<any[]>([]);
  const [draftRouteId, setDraftRouteId] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");

  // Fetch routes for filter
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await apiService.getTransportRoutes({ status: 'active', limit: 1000, academic_year_id: academicYearId ?? undefined });
        if (res.status === "SUCCESS") setRoutesData(res.data);
      } catch (err) {
        console.error("Failed to fetch routes for filter:", err);
      }
    };
    fetchFilters();
  }, [academicYearId]);

  useEffect(() => {
    setParams((prev) => ({ ...prev, academic_year_id: academicYearId ?? undefined, page: 1 }));
  }, [academicYearId]);

  const handleSearch = (val: string) => {
    setParams((prev) => ({ ...prev, search: val, page: 1 }));
  };

  const handleFilterApply = () => {
    setParams((prev) => ({
      ...prev,
      route_id: draftRouteId,
      status: draftStatus === "all" ? "" : draftStatus,
      page: 1
    }));
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = () => {
    setParams((prev) => ({
      ...prev,
      page: 1,
      limit: 10,
      search: "",
      status: "",
      route_id: "all",
      sortField: "id",
      sortOrder: "ASC",
    }));
    setDraftRouteId("all");
    setDraftStatus("all");
  };

  const handleRefresh = () => {
    refetch();
  };

  const handlePageChange = (page: number, limit: number) => {
    setParams((prev) => ({ ...prev, page, limit }));
  };

  const handleSort = (field: string, order: 'ASC' | 'DESC') => {
    const fieldMap: Record<string, string> = {
      id: "id",
      route: "route_name",
      pickupPoint: "point_name",
      vehicle: "vehicle_number",
      name: "driver_name",
      status: "is_active",
    };
    setParams((prev) => ({
      ...prev,
      sortField: fieldMap[field] || prev.sortField,
      sortOrder: order,
      page: 1,
    }));
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: true,
      render: (text: string) => (
        <Link to="#" className="link-primary">{text}</Link>
      ),
    },
    {
      title: "Route",
      dataIndex: "route",
      sorter: true,
    },
    {
      title: "Pickup Point",
      dataIndex: "pickupPoint",
      sorter: true,
    },
    {
      title: "Vehicle",
      dataIndex: "vehicle",
      sorter: true,
    },
    {
      title: "Driver",
      dataIndex: "name",
      sorter: true,
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <div className="avatar avatar-md me-2">
            <ImageWithBasePath
              src={record.img || "assets/img/parents/parent-01.jpg"}
              className="rounded-circle"
              alt="img"
            />
          </div>
          <div>
            <p className="text-dark mb-0 fw-medium">{text}</p>
            <span className="fs-12 text-muted">{record.phone}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      sorter: true,
      render: (text: string) => (
        <span className={`badge ${text === "Active" ? "badge-soft-success" : "badge-soft-danger"} d-inline-flex align-items-center`}>
          <i className="ti ti-circle-filled fs-5 me-1"></i>
          {text}
        </span>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
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
              <Link
                className="dropdown-item rounded-1"
                to="#"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedAssignment(record);
                  const modalElement = document.getElementById('edit_assign_vehicle');
                  if (modalElement) {
                    const bootstrap = (window as any).bootstrap;
                    const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                    modal.show();
                  }
                }}
              >
                <i className="ti ti-edit-circle me-2" />
                Edit
              </Link>
            </li>
            <li>
              <Link
                className="dropdown-item rounded-1"
                to="#"
                onClick={(e) => {
                   e.preventDefault();
                   Swal.fire({
                     title: 'Are you sure?',
                     text: "This will remove the route assignment from this vehicle.",
                     icon: 'warning',
                     showCancelButton: true,
                     confirmButtonColor: '#3085d6',
                     cancelButtonColor: '#d33',
                     confirmButtonText: 'Yes, unassign!'
                   }).then(async (result) => {
                     if (result.isConfirmed) {
                       try {
                         await apiService.deleteTransportAssignment(record.originalData.id);
                         Swal.fire('Unassigned!', 'The vehicle has been unassigned.', 'success');
                         refetch();
                       } catch (err) {
                         Swal.fire('Error', 'Failed to unassign.', 'error');
                       }
                     }
                   });
                }}
              >
                <i className="ti ti-trash-x me-2" />
                Unassign
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
              <h3 className="page-title mb-1">Assign Vehicle</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Assign Vehicle
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <div className="pe-1 mb-2">
                <button
                  type="button"
                  className="btn btn-outline-light bg-white btn-icon me-1"
                  onClick={handleRefresh}
                  title="Refresh"
                >
                  <i className="ti ti-refresh" />
                </button>
              </div>
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_assign_vehicle"
                  onClick={() => setSelectedAssignment(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Assign Vehicle
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Assign Vehicle List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <span className="input-icon-addon">
                    <i className="ti ti-search" />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search Vehicle/Route"
                    value={params.search}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
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
                    <div className="d-flex align-items-center border-bottom p-3">
                      <h4>Filter</h4>
                    </div>
                    <div className="p-3 border-bottom">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Route</label>
                            <CommonSelect
                              className="select"
                              options={[{ value: "all", label: "All Routes" }, ...routesData.map(r => ({ value: r.id.toString(), label: r.route_name }))]}
                              value={draftRouteId}
                              onChange={(val: string | null) => setDraftRouteId(val || "all")}
                            />
                          </div>
                        </div>
                        <div className="col-md-12">
                          <div className="mb-0">
                            <label className="form-label">Status</label>
                            <CommonSelect
                              className="select"
                              options={[
                                { value: "all", label: "All Status" },
                                { value: "active", label: "Active" },
                                { value: "inactive", label: "Inactive" },
                              ]}
                              value={draftStatus}
                              onChange={(val: string | null) => setDraftStatus(val || "all")}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 d-flex align-items-center justify-content-end">
                      <button className="btn btn-light me-3" onClick={handleResetFilters}>
                        Reset
                      </button>
                      <button className="btn btn-primary" onClick={handleFilterApply}>
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              <Table
                dataSource={data}
                columns={columns}
                Selection={true}
                loading={loading}
                pagination={{
                  current: params.page,
                  pageSize: params.limit,
                  total: metadata.totalCount,
                  onChange: (page, limit) => handlePageChange(page, limit),
                  showSizeChanger: true,
                }}
                onTableChange={(pagination: any, filters: any, sorter: any) => {
                  handlePageChange(pagination.current, pagination.pageSize);
                  if (sorter.field) {
                    handleSort(sorter.field, sorter.order === 'descend' ? 'DESC' : 'ASC');
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <TransportModal
        selectedAssignment={selectedAssignment}
        onSuccess={handleRefresh}
      />
    </>
  );
};

export default TransportAssignVehicle;

