import { useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  driverFilter3,
  driverName,
  PickupPoint2,
  routesList,
  status,
  VehicleNumber,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import TransportModal from "./transportModal";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useTransportAssignments } from "../../../core/hooks/useTransportAssignments";
import { apiService } from "../../../core/services/apiService";

const TransportAssignVehicle = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: apiData, loading, error, fallbackData, refetch } = useTransportAssignments();
  const data = apiData?.length ? apiData : fallbackData;
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [editAssignStatus, setEditAssignStatus] = useState(true);
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
      title: "Route",
      dataIndex: "route",
      sorter: (a: TableData, b: TableData) => a.route.length - b.route.length,
    },
    {
      title: "Pickup Point",
      dataIndex: "pickupPoint",
      sorter: (a: TableData, b: TableData) =>
        a.pickupPoint.length - b.pickupPoint.length,
    },
    {
      title: "Vehicle",
      dataIndex: "vehicle",
      sorter: (a: TableData, b: TableData) =>
        a.vehicle.length - b.vehicle.length,
    },
    {
      title: "Driver",
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
              <Link to="#">{text}</Link>
            </p>
            <span className="fs-12">{record.phone}</span>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => a.name.length - b.name.length,
    },

    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : (
            <span className="badge badge-soft-danger d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          )}
        </>
      ),
      sorter: (a: TableData, b: TableData) => a.status.length - b.status.length,
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
                      const assignment = record.originalData || record;
                      // Determine current status from is_active or status text
                      let status = true;
                      if (assignment && Object.prototype.hasOwnProperty.call(assignment, "is_active")) {
                        status =
                          assignment.is_active === true ||
                          assignment.is_active === 1 ||
                          assignment.is_active === "true";
                      } else if (record.status) {
                        status = record.status === "Active";
                      }
                      setEditAssignStatus(status);
                      setSelectedAssignment(record);
                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_assign_vehicle');
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
              <TooltipOption />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_assign_vehicle"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Assign New Vehicle
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Assign Vehicle List</h4>
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
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Route</label>
                              <CommonSelect
                                className="select"
                                options={routesList}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">
                                Pickup Points
                              </label>
                              <CommonSelect
                                className="select"
                                options={PickupPoint2}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">
                                Vehicle Number
                              </label>
                              <CommonSelect
                                className="select"
                                options={VehicleNumber}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Driver</label>
                              <CommonSelect
                                className="select"
                                options={driverName}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={status}
                                defaultValue={status[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">More Filter</label>
                              <CommonSelect
                                className="select"
                                options={driverFilter3}
                                defaultValue={undefined}
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
                  Could not load assignments from server. Showing sample data. Check that the server is running on port 5000.
                </div>
              )}
              {loading && (
                <div className="text-center py-4">
                  <span className="spinner-border spinner-border-sm me-2" />
                  Loading assignments...
                </div>
              )}
              {!loading && (
                <Table dataSource={data} columns={columns} Selection={true} />
              )}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <TransportModal
        selectedAssignment={selectedAssignment}
        editAssignStatus={editAssignStatus}
        setEditAssignStatus={setEditAssignStatus}
        isUpdating={isUpdating}
        setIsUpdating={setIsUpdating}
        onAssignUpdate={async () => {
          const vehicleId = selectedAssignment?.originalData?.id || selectedAssignment?.id;
          if (!vehicleId || isUpdating) return;

          setIsUpdating(true);
          try {
            const updateData = {
              is_active: editAssignStatus,
            };

            const response = await apiService.updateTransportVehicle(vehicleId, updateData);

            if (response && response.status === "SUCCESS") {
              const modalElement = document.getElementById("edit_assign_vehicle");
              if (modalElement) {
                const bootstrap = (window as any).bootstrap;
                if (bootstrap && bootstrap.Modal) {
                  const modal = bootstrap.Modal.getInstance(modalElement);
                  if (modal) modal.hide();
                }
              }
              await refetch();
              setSelectedAssignment(null);
            } else {
              alert(response?.message || "Failed to update assignment");
            }
          } catch (err: any) {
            console.error("Error updating assignment:", err);
            alert(err?.message || "Failed to update assignment. Please try again.");
          } finally {
            setIsUpdating(false);
          }
        }}
      />
    </>
  );
};

export default TransportAssignVehicle;
