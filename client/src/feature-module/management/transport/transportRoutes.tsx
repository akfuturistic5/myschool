import { useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  routesList,
  status,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import TransportModal from "./transportModal";
import { useTransportRoutes } from "../../../core/hooks/useTransportRoutes";
import { apiService } from "../../../core/services/apiService";

const TransportRoutes = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: apiData, loading, error, fallbackData, refetch } = useTransportRoutes();
  const data = apiData?.length ? apiData : fallbackData;
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [editRouteName, setEditRouteName] = useState('');
  const [editRouteStatus, setEditRouteStatus] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: any, record: any) => (
        <Link to="#" className="link-primary">
          {text || record.id || 'N/A'}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => String(a.id || '').length - String(b.id || '').length,
    },
    {
      title: "Routes",
      dataIndex: "routes",

      sorter: (a: TableData, b: TableData) =>
        a.routes.length - b.routes.length,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span
              className="badge badge-soft-success d-inline-flex align-items-center"
            >
              <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
            </span>
          ) :
            (
              <span
                className="badge badge-soft-danger d-inline-flex align-items-center"
              >
                <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
              </span>
            )}
        </>
      ),
      sorter: (a: TableData, b: TableData) =>
        a.status.length - b.status.length,
    },
    {
      title: "Added On",
      dataIndex: "addedOn",
      sorter: (a: TableData, b: TableData) =>
        a.addedOn.length - b.addedOn.length,
    },

    {
      title: "Action",
      dataIndex: "action",
      render: (text: any, record: any) => (
        <>
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
              <ul className="dropdown-menu dropdown-menu-right p-3">
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // Set form data from record
                      const route = record.originalData || record;
                      // Use route_name from originalData, or fallback to mapped routes property
                      const routeName = route.route_name || record.routes || '';
                      // Check is_active from originalData (true/1 = active, false/0 = inactive)
                      // Fallback to status string if is_active is not available
                      let routeStatus = true; // default to active
                      if (Object.prototype.hasOwnProperty.call(route, 'is_active')) {
                        routeStatus = route.is_active === true || route.is_active === 1 || route.is_active === 'true';
                      } else if (record.status) {
                        routeStatus = record.status === 'Active';
                      }

                      setEditRouteName(routeName);
                      setEditRouteStatus(routeStatus);
                      setSelectedRoute(record);

                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_routes');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                            modal.show();
                          }
                        }
                      }, 100);
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
                    data-bs-toggle="modal"
                    data-bs-target="#delete-modal"
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </>
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
              <TooltipOption />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_routes"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Route
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Routes</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
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
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                  >
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Routes</label>
                              <CommonSelect
                                className="select"
                                options={routesList}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={status}
                                defaultValue={status[0]}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3">
                          Reset
                        </Link>
                        <Link
                          to="#"
                          className="btn btn-primary"
                          onClick={handleApplyClick}
                        >
                          Apply
                        </Link>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="dropdown mb-3">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-sort-ascending-2 me-2" />
                    Sort by A-Z{" "}
                  </Link>
                  <ul className="dropdown-menu p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Descending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Viewed
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {error && (
                <div className="alert alert-warning mx-3 mt-3 mb-0" role="alert">
                  Could not load routes from server. Showing sample data. Check that the server is running on port 5000.
                </div>
              )}
              {loading && (
                <div className="text-center py-4">
                  <span className="spinner-border spinner-border-sm me-2" />
                  Loading routes...
                </div>
              )}
              {!loading && (
                <Table dataSource={data} columns={columns} Selection={true} />
              )}
              {/* /Student List */}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <TransportModal
        selectedRoute={selectedRoute}
        editRouteName={editRouteName}
        setEditRouteName={setEditRouteName}
        editRouteStatus={editRouteStatus}
        setEditRouteStatus={setEditRouteStatus}
        isUpdating={isUpdating}
        setIsUpdating={setIsUpdating}
        onRouteUpdate={async () => {
          const routeId = selectedRoute?.originalData?.id || selectedRoute?.id;
          if (!routeId || isUpdating) return;

          setIsUpdating(true);
          try {
            const updateData = {
              route_name: editRouteName.trim(),
              is_active: editRouteStatus
            };

            const response = await apiService.updateTransportRoute(routeId, updateData);

            if (response && response.status === 'SUCCESS') {
              // Close modal
              const modalElement = document.getElementById('edit_routes');
              if (modalElement) {
                const bootstrap = (window as any).bootstrap;
                if (bootstrap && bootstrap.Modal) {
                  const modal = bootstrap.Modal.getInstance(modalElement);
                  if (modal) modal.hide();
                }
              }
              // Refetch list
              await refetch();
              // Reset form
              setSelectedRoute(null);
              setEditRouteName('');
              setEditRouteStatus(true);
            } else {
              alert(response?.message || 'Failed to update route');
            }
          } catch (error: any) {
            console.error('Error updating route:', error);
            alert(error?.message || 'Failed to update route. Please try again.');
          } finally {
            setIsUpdating(false);
          }
        }}
      />
    </>
  );
};

export default TransportRoutes;
