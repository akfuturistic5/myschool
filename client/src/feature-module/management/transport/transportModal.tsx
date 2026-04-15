
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { driverName, PickupPoint2, routesList, VehicleNumber } from "../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../core/common/commonSelect";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import dayjs from "dayjs";
import { DatePicker } from "antd";

interface TransportModalProps {
  selectedRoute?: any;
  selectedPickupPoint?: any;
  selectedDriver?: any;
  selectedAssignment?: any;
  selectedVehicle?: any;
  editRouteName?: string;
  setEditRouteName?: (value: string) => void;
  editRouteStatus?: boolean;
  setEditRouteStatus?: (value: boolean) => void;
  editPickupAddress?: string;
  setEditPickupAddress?: (value: string) => void;
  editPickupStatus?: boolean;
  setEditPickupStatus?: (value: boolean) => void;
  editDriverName?: string;
  setEditDriverName?: (value: string) => void;
  editDriverPhone?: string;
  setEditDriverPhone?: (value: string) => void;
  editDriverLicense?: string;
  setEditDriverLicense?: (value: string) => void;
  editDriverAddress?: string;
  setEditDriverAddress?: (value: string) => void;
  editDriverStatus?: boolean;
  setEditDriverStatus?: (value: boolean) => void;
  editAssignStatus?: boolean;
  setEditAssignStatus?: (value: boolean) => void;
  editVehicleStatus?: boolean;
  setEditVehicleStatus?: (value: boolean) => void;
  isUpdating?: boolean;
  setIsUpdating?: (value: boolean) => void;
  onRouteUpdate?: () => Promise<void>;
  onPickupUpdate?: () => Promise<void>;
  onDriverUpdate?: () => Promise<void>;
  onAssignUpdate?: () => Promise<void>;
  onVehicleUpdate?: () => Promise<void>;
}

const TransportModal = ({
  selectedRoute,
  selectedPickupPoint,
  selectedDriver,
  selectedAssignment,
  selectedVehicle,
  editRouteName = '',
  setEditRouteName,
  editRouteStatus = true,
  setEditRouteStatus,
  editPickupAddress = '',
  setEditPickupAddress,
  editPickupStatus = true,
  setEditPickupStatus,
  editDriverName = '',
  setEditDriverName,
  editDriverPhone = '',
  setEditDriverPhone,
  editDriverLicense = '',
  setEditDriverLicense,
  editDriverAddress = '',
  setEditDriverAddress,
  editDriverStatus = true,
  setEditDriverStatus,
  editAssignStatus = true,
  setEditAssignStatus,
  editVehicleStatus = true,
  setEditVehicleStatus,
  isUpdating = false,
  setIsUpdating,
  onRouteUpdate,
  onPickupUpdate,
  onDriverUpdate,
  onAssignUpdate,
  onVehicleUpdate
}: TransportModalProps) => {
  // Update form fields when selectedRoute changes
  useEffect(() => {
    if (selectedRoute && setEditRouteName && setEditRouteStatus) {
      const route = selectedRoute.originalData || selectedRoute;
      // Use route_name from originalData, or fallback to mapped routes property
      const routeName = route.route_name || selectedRoute.routes || '';
      // Check is_active from originalData (true/1 = active, false/0 = inactive)
      // Fallback to status string if is_active is not available
      let routeStatus = true; // default to active
      if (Object.prototype.hasOwnProperty.call(route, 'is_active')) {
        routeStatus = route.is_active === true || route.is_active === 1 || route.is_active === 'true';
      } else if (selectedRoute.status) {
        routeStatus = selectedRoute.status === 'Active';
      }

      setEditRouteName(routeName);
      setEditRouteStatus(routeStatus);
    }
  }, [selectedRoute, setEditRouteName, setEditRouteStatus]);

  // Update form fields when selectedPickupPoint changes
  useEffect(() => {
    if (selectedPickupPoint && setEditPickupAddress && setEditPickupStatus) {
      const pickup = selectedPickupPoint.originalData || selectedPickupPoint;
      // Use address from originalData, or fallback to mapped pickupPoint property
      const pickupAddress = pickup.address || selectedPickupPoint.pickupPoint || '';
      // Check is_active from originalData (true/1 = active, false/0 = inactive)
      // Fallback to status string if is_active is not available
      let pickupStatus = true; // default to active
      if (Object.prototype.hasOwnProperty.call(pickup, 'is_active')) {
        pickupStatus = pickup.is_active === true || pickup.is_active === 1 || pickup.is_active === 'true';
      } else if (selectedPickupPoint.status) {
        pickupStatus = selectedPickupPoint.status === 'Active';
      }

      setEditPickupAddress(pickupAddress);
      setEditPickupStatus(pickupStatus);
    }
  }, [selectedPickupPoint, setEditPickupAddress, setEditPickupStatus]);

  // Update status when selectedAssignment changes (assign vehicle page)
  useEffect(() => {
    if (selectedAssignment && setEditAssignStatus) {
      const assignment = selectedAssignment.originalData || selectedAssignment;
      let status = true;
      if (assignment && Object.prototype.hasOwnProperty.call(assignment, "is_active")) {
        status =
          assignment.is_active === true ||
          assignment.is_active === 1 ||
          assignment.is_active === "true";
      } else if (selectedAssignment.status) {
        status = selectedAssignment.status === "Active";
      }
      setEditAssignStatus(status);
    }
  }, [selectedAssignment, setEditAssignStatus]);

  // Update status when selectedVehicle changes
  useEffect(() => {
    if (selectedVehicle && setEditVehicleStatus) {
      const vehicle = selectedVehicle.originalData || selectedVehicle;
      let status = true;
      if (vehicle && Object.prototype.hasOwnProperty.call(vehicle, "is_active")) {
        status =
          vehicle.is_active === true ||
          vehicle.is_active === 1 ||
          vehicle.is_active === "true";
      } else if (selectedVehicle.status) {
        status = selectedVehicle.status === "Active";
      }
      setEditVehicleStatus(status);
    }
  }, [selectedVehicle, setEditVehicleStatus]);

  // Update form fields when selectedDriver changes
  useEffect(() => {
    if (selectedDriver && setEditDriverName && setEditDriverPhone && setEditDriverLicense && setEditDriverAddress && setEditDriverStatus) {
      const driver = selectedDriver.originalData || selectedDriver;
      // Get driver name (could be from name, driver_name, or first_name + last_name)
      const driverName = driver.name || driver.driver_name || selectedDriver.name || '';
      const driverPhone = driver.phone || selectedDriver.phone || '';
      const driverLicense = driver.license_number || selectedDriver.driverLicenseNo || '';
      const driverAddress = driver.address || selectedDriver.address || '';
      // Check is_active from originalData (true/1 = active, false/0 = inactive)
      // Fallback to status string if is_active is not available
      let driverStatus = true; // default to active
      if (Object.prototype.hasOwnProperty.call(driver, 'is_active')) {
        driverStatus = driver.is_active === true || driver.is_active === 1 || driver.is_active === 'true';
      } else if (selectedDriver.status) {
        driverStatus = selectedDriver.status === 'Active';
      }

      setEditDriverName(driverName);
      setEditDriverPhone(driverPhone);
      setEditDriverLicense(driverLicense);
      setEditDriverAddress(driverAddress);
      setEditDriverStatus(driverStatus);
    }
  }, [selectedDriver, setEditDriverName, setEditDriverPhone, setEditDriverLicense, setEditDriverAddress, setEditDriverStatus]);

  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0') // Month is zero-based, so we add 1
  const day = String(today.getDate()).padStart(2, '0')
  const formattedDate = `${month}-${day}-${year}`
  const defaultValue = dayjs(formattedDate);
  const getModalContainer = () => {
    const modalElement = document.getElementById('modal-datepicker');
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  const getModalContainer2 = () => {
    const modalElement = document.getElementById('modal-datepicker2');
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  return (
    <>
      <>
        {/* Add Route */}
        <div className="modal fade" id="add_routes">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Route</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Route Name</label>
                        <input type="text" className="form-control" />
                      </div>
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input type="checkbox" id="user1" className="check" />
                        <label htmlFor="user1" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    data-bs-dismiss="modal"
                    className="btn btn-primary"
                  >
                    Add Route
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Route*/}
        {/* Edit Route */}
        <div className="modal fade" id="edit_routes">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Route</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Route Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Route Name"
                          value={editRouteName || ''}
                          onChange={(e) => setEditRouteName && setEditRouteName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="user2"
                          className="check"
                          checked={editRouteStatus}
                          onChange={(e) => setEditRouteStatus && setEditRouteStatus(e.target.checked)}
                        />
                        <label htmlFor="user2" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (onRouteUpdate) {
                        await onRouteUpdate();
                      } else {
                        // Fallback: just close modal
                        const modalElement = document.getElementById('edit_routes');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement);
                            if (modal) modal.hide();
                          }
                        }
                      }
                    }}
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Route */}
      </>
      <>
        {/* Add Assign New Vehicle */}
        <div className="modal fade" id="add_assign_vehicle">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Assign New Vehicle</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Select Route</label>

                        <CommonSelect
                          className="select"
                          options={routesList}
                          defaultValue={undefined}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">
                          Select Pickup Point
                        </label>
                        <CommonSelect
                          className="select"
                          options={PickupPoint2}
                          defaultValue={undefined}
                        />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Select Vehicle</label>
                        <CommonSelect
                          className="select"
                          options={VehicleNumber}
                          defaultValue={undefined}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    data-bs-dismiss="modal"
                    className="btn btn-primary"
                  >
                    Assign Now
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Assign New Vehicle */}
        {/* Edit Assign New Vehicle */}
        <div className="modal fade" id="edit_assign_vehicle">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Assign Vehicle</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Select Route</label>
                        <CommonSelect
                          className="select"
                          options={routesList}
                          defaultValue={selectedAssignment?.originalData?.route || selectedAssignment?.route ? routesList.find((r: any) => r.value === selectedAssignment.originalData?.route || r.label === selectedAssignment.route) || routesList[0] : routesList[0]}
                          key={`assign-route-${selectedAssignment?.id || 'new'}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">
                          Select Pickup Point
                        </label>
                        <CommonSelect
                          className="select"
                          options={PickupPoint2}
                          defaultValue={selectedAssignment?.originalData?.pickup_point || selectedAssignment?.pickupPoint ? PickupPoint2.find((p: any) => p.value === selectedAssignment.originalData?.pickup_point || p.label === selectedAssignment.pickupPoint) || PickupPoint2[0] : PickupPoint2[0]}
                          key={`assign-pickup-${selectedAssignment?.id || 'new'}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Select Vehicle</label>
                        <CommonSelect
                          className="select"
                          options={VehicleNumber}
                          defaultValue={selectedAssignment?.originalData?.vehicle_number || selectedAssignment?.vehicle ? VehicleNumber.find((v: any) => v.value === selectedAssignment.originalData?.vehicle_number || v.label === selectedAssignment.vehicle) || VehicleNumber[0] : VehicleNumber[0]}
                          key={`assign-vehicle-${selectedAssignment?.id || 'new'}`}
                        />
                      </div>
                      <div className="assigned-driver">
                        <h6>Assigned Driver</h6>
                        <div className="assigned-driver-info">
                          <span className="driver-img">
                            <ImageWithBasePath
                              src={selectedAssignment?.originalData?.driver_photo_url || selectedAssignment?.originalData?.photo_url || selectedAssignment?.img || "assets/img/parents/parent-01.jpg"}
                              alt="Img"
                            />
                          </span>
                          <div>
                            <h5>{selectedAssignment?.originalData?.driver_name || selectedAssignment?.name || "N/A"}</h5>
                            <span>{selectedAssignment?.originalData?.driver_phone || selectedAssignment?.phone || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="modal-satus-toggle d-flex align-items-center justify-content-between mt-2">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="status-toggle modal-status">
                          <input
                            type="checkbox"
                            id="assign-status"
                            className="check"
                            checked={editAssignStatus}
                            onChange={(e) => setEditAssignStatus && setEditAssignStatus(e.target.checked)}
                          />
                          <label htmlFor="assign-status" className="checktoggle">
                            {" "}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (onAssignUpdate) {
                        await onAssignUpdate();
                      } else {
                        const modalElement = document.getElementById('edit_assign_vehicle');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement);
                            if (modal) modal.hide();
                          }
                        }
                      }
                    }}
                  >
                    {isUpdating ? 'Updating...' : 'Assign Now'}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Assign New Vehicle */}
      </>
      <>
        {/* Add Pickup */}
        <div className="modal fade" id="add_pickup">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Pickup Point</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Pickup Point</label>
                        <input type="text" className="form-control" />
                      </div>
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input type="checkbox" id="user1" className="check" />
                        <label htmlFor="user1" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    data-bs-dismiss="modal"
                    className="btn btn-primary"
                  >
                    Add Pickup Point
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Pickup */}
        {/* Edit Pickup */}
        <div className="modal fade" id="edit_pickup">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Pickup Point</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Pickup Point</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Pickup Point"
                          value={editPickupAddress || ''}
                          onChange={(e) => setEditPickupAddress && setEditPickupAddress(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="pickup-status"
                          className="check"
                          checked={editPickupStatus}
                          onChange={(e) => setEditPickupStatus && setEditPickupStatus(e.target.checked)}
                        />
                        <label htmlFor="pickup-status" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (onPickupUpdate) {
                        await onPickupUpdate();
                      } else {
                        // Fallback: just close modal
                        const modalElement = document.getElementById('edit_pickup');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement);
                            if (modal) modal.hide();
                          }
                        }
                      }
                    }}
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Pickup */}
      </>
      <>
        {/* Add Driver */}
        <div className="modal fade" id="add_driver">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add New Driver</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Name</label>
                        <input type="text" className="form-control" />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Phone Number</label>
                        <input type="text" className="form-control" />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">
                          Driving License Number
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Driving License Number"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Address</label>
                        <input type="text" className="form-control" />
                      </div>
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input type="checkbox" id="user1" className="check" />
                        <label htmlFor="user1" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    data-bs-dismiss="modal"
                    className="btn btn-primary"
                  >
                    Add Driver
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Driver */}
        {/* Edit Driver */}
        <div className="modal fade" id="edit_driver">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Driver</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Name"
                          value={editDriverName || ''}
                          onChange={(e) => setEditDriverName && setEditDriverName(e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Phone Number"
                          value={editDriverPhone || ''}
                          onChange={(e) => setEditDriverPhone && setEditDriverPhone(e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">
                          Driving License Number
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Driving License Number"
                          value={editDriverLicense || ''}
                          onChange={(e) => setEditDriverLicense && setEditDriverLicense(e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Address</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Address"
                          value={editDriverAddress || ''}
                          onChange={(e) => setEditDriverAddress && setEditDriverAddress(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="driver-status"
                          className="check"
                          checked={editDriverStatus}
                          onChange={(e) => setEditDriverStatus && setEditDriverStatus(e.target.checked)}
                        />
                        <label htmlFor="driver-status" className="checktoggle">
                          {" "}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (onDriverUpdate) {
                        await onDriverUpdate();
                      } else {
                        // Fallback: just close modal
                        const modalElement = document.getElementById('edit_driver');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement);
                            if (modal) modal.hide();
                          }
                        }
                      }
                    }}
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Driver */}
      </>
      <>
        {/* Add New Vehicle */}
        <div className="modal fade" id="add_vehicle">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add New Vehicle</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body" id='modal-datepicker'>
                  <div className="row">
                    <div className="col-md-12">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Vehicle No</label>
                            <input type="text" className="form-control" />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Vehicle Model</label>
                            <input type="text" className="form-control" />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Made of Year</label>
                            <div className="date-pic">
                              <DatePicker
                                className="form-control datetimepicker"
                                format={{
                                  format: "DD-MM-YYYY",
                                  type: "mask",
                                }}
                                getPopupContainer={getModalContainer}
                                defaultValue=""
                                placeholder="16 May 2024"
                              />
                              <span className="cal-icon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Registration No
                            </label>
                            <input type="text" className="form-control" />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Chassis No</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter Chassis No"
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Seat Capacity</label>
                            <input type="text" className="form-control" />
                          </div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">GPS Tracking ID</label>
                        <input type="text" className="form-control" />
                      </div>
                      <hr />
                      <div className="mb-3">
                        <h4>Driver details</h4>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Select Driver</label>
                        <CommonSelect
                          className="select"
                          options={driverName}
                          defaultValue={undefined}
                        />
                      </div>
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Driver License</label>
                            <input type="text" className="form-control" />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Driver Contact No
                            </label>
                            <input type="text" className="form-control" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Driver Address</label>
                      <input type="text" className="form-control" />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    data-bs-dismiss="modal"
                    className="btn btn-primary"
                  >
                    Add New Vehicle
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add New Vehicle */}
        {/* Edit New Vehicle */}
        <div className="modal fade" id="edit_vehicle">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header align-items-center">
                <div className="d-flex align-items-center">
                  <h4 className="modal-title">Edit Vehicle</h4>
                  <span className="badge badge-soft-primary ms-2" key={`edit-vehicle-id-${selectedVehicle?.id || 'new'}`}>
                    ID : {selectedVehicle?.originalData?.vehicle_code ?? selectedVehicle?.id ?? '—'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body" id='modal-datepicker2'>
                  <div className="row">
                    <div className="col-md-12">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Vehicle No</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter Vehicle No"
                              defaultValue={selectedVehicle?.originalData?.vehicle_number ?? selectedVehicle?.vehicleNo ?? ''}
                              key={`edit-vehicle-no-${selectedVehicle?.id || 'new'}`}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Vehicle Model</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter Vehicle Model"
                              defaultValue={selectedVehicle?.originalData?.vehicle_model ?? selectedVehicle?.vehicleModel ?? ''}
                              key={`edit-vehicle-model-${selectedVehicle?.id || 'new'}`}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Made of Year</label>
                            <div className="date-pic">
                              <DatePicker
                                className="form-control datetimepicker"
                                format={{
                                  format: "DD-MM-YYYY",
                                  type: "mask",
                                }}
                                getPopupContainer={getModalContainer2}
                                defaultValue={selectedVehicle?.originalData?.year || selectedVehicle?.madeofYear ? dayjs(`${selectedVehicle?.originalData?.year ?? selectedVehicle?.madeofYear}-01-01`) : defaultValue}
                                placeholder="16 May 2024"
                                key={`edit-vehicle-year-${selectedVehicle?.id || 'new'}`}
                              />
                              <span className="cal-icon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Registration No
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter Registration No"
                              defaultValue={selectedVehicle?.originalData?.registration_number ?? selectedVehicle?.registrationNo ?? ''}
                              key={`edit-vehicle-reg-${selectedVehicle?.id || 'new'}`}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Chassis No</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={selectedVehicle?.originalData?.chassis_number ?? selectedVehicle?.chassisNo ?? ''}
                              key={`edit-vehicle-chassis-${selectedVehicle?.id || 'new'}`}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Seat Capacity</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter Seat Capacity"
                              defaultValue={selectedVehicle?.originalData?.seat_capacity ?? ''}
                              key={`edit-vehicle-seat-${selectedVehicle?.id || 'new'}`}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">GPS Tracking ID</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter GPS Tracking ID"
                          defaultValue={selectedVehicle?.originalData?.gps_device_id ?? selectedVehicle?.gps ?? ''}
                          key={`edit-vehicle-gps-${selectedVehicle?.id || 'new'}`}
                        />
                      </div>
                      <hr />
                      <div className="mb-3">
                        <h4>Driver details</h4>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Select Driver</label>
                        <CommonSelect
                          className="select"
                          options={driverName}
                          defaultValue={selectedVehicle?.originalData?.driver_name || selectedVehicle?.name ? driverName.find((d: any) => d.label === (selectedVehicle?.originalData?.driver_name ?? selectedVehicle?.name) || d.value === (selectedVehicle?.originalData?.driver_name ?? selectedVehicle?.name)) || driverName[0] : driverName[0]}
                          key={`edit-vehicle-driver-${selectedVehicle?.id || 'new'}`}
                        />
                      </div>
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Driver License</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter Driver License"
                              defaultValue={selectedVehicle?.originalData?.driver_license ?? ''}
                              key={`edit-vehicle-license-${selectedVehicle?.id || 'new'}`}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Driver Contact No
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter Driver Contact No"
                              defaultValue={selectedVehicle?.originalData?.driver_phone ?? selectedVehicle?.phone ?? ''}
                              key={`edit-vehicle-phone-${selectedVehicle?.id || 'new'}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Driver Address</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Driver Address"
                        defaultValue={selectedVehicle?.originalData?.driver_address ?? ''}
                        key={`edit-vehicle-address-${selectedVehicle?.id || 'new'}`}
                      />
                    </div>
                  </div>
                  <div className="modal-satus-toggle d-flex align-items-center justify-content-between mt-3">
                    <div className="status-title">
                      <h5>Status</h5>
                      <p>Change the Status by toggle </p>
                    </div>
                    <div className="status-toggle modal-status">
                      <input
                        type="checkbox"
                        id="vehicle-status"
                        className="check"
                        checked={editVehicleStatus}
                        onChange={(e) => setEditVehicleStatus && setEditVehicleStatus(e.target.checked)}
                      />
                      <label htmlFor="vehicle-status" className="checktoggle">
                        {" "}
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (onVehicleUpdate) {
                        await onVehicleUpdate();
                      } else {
                        const modalElement = document.getElementById('edit_vehicle');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement);
                            if (modal) modal.hide();
                          }
                        }
                      }
                    }}
                  >
                    {isUpdating ? 'Updating...' : 'Save Vehicle'}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit New Vehicle */}
        {/* Live Track */}
        <div className="modal fade" id="live_track">
          <div className="modal-dialog modal-dialog-centered  modal-xl">
            <div className="modal-content">
              <div className="modal-header align-items-center">
                <div className="d-flex align-items-center">
                  <h4 className="modal-title">Live Tracking Vehicle</h4>
                  <span className="badge badge-soft-primary ms-2">
                    GPS Tracking ID : GPS7899456689
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <div className="modal-body mb-4">
                <ul className="book-taker-info live-track-info justify-content-between">
                  <li>
                    <span>Vehicle No</span>
                    <h6>8930</h6>
                  </li>
                  <li>
                    <span>Vehicle Model</span>
                    <h6>Scania</h6>
                  </li>
                  <li>
                    <span>Driver</span>
                    <h6>Thomas</h6>
                  </li>
                  <li>
                    <span>Driver Contact No</span>
                    <h6>+1 45644 54784</h6>
                  </li>
                </ul>
                <div className="live-track-map w-100">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3321.6088932774796!2d-117.8132203247921!3d33.64138153931407!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80dcddf599c1986f%3A0x6826f6868b4f8e35!2sHillcrest%2C%20Irvine%2C%20CA%2092603%2C%20USA!5e0!3m2!1sen!2sin!4v1706772657955!5m2!1sen!2sin"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Link
                  to="#"
                  className="btn btn-light me-2"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </Link>
                <Link
                  to="#"
                  data-bs-dismiss="modal"
                  className="btn btn-primary"
                >
                  Reset to Live Location
                </Link>
              </div>
            </div>
          </div>
        </div>
        {/* Live Track */}
      </>

      {/* Delete Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form>
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
                  <Link
                    to="#"
                    className="btn btn-danger"
                    data-bs-dismiss="modal"
                  >
                    Yes, Delete
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Delete Modal */}
    </>
  );
};

export default TransportModal;
