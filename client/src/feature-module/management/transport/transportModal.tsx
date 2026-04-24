
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { driverName, PickupPoint2, routesList, VehicleNumber } from "../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../core/common/commonSelect";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import dayjs from "dayjs";
import { DatePicker } from "antd";

import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

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
  onSuccess?: () => void;
  deleteId?: number | string | null;
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
  onVehicleUpdate,
  onSuccess,
  deleteId
}: TransportModalProps) => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  // State for Add/Edit Route
  const [routeName, setRouteName] = useState("");
  const [distanceKm, setDistanceKm] = useState<string | number>("");
  const [routeStatus, setRouteStatus] = useState(true);
  const [stops, setStops] = useState<any[]>([{ pickup_point_id: "", pickup_time: "", drop_time: "", order_index: 0 }]);

  // State for Assign Vehicle
  const [assignRouteId, setAssignRouteId] = useState("");
  const [assignVehicleId, setAssignVehicleId] = useState("");
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignStatus, setAssignStatus] = useState(true);

  // Lists for dropdowns
  const [pickupsData, setPickupsData] = useState<any[]>([]);
  const [vehiclesData, setVehiclesData] = useState<any[]>([]);
  const [routesData, setRoutesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch initial data for dropdowns
  useEffect(() => {
    const fetchSelectData = async () => {
      try {
        const [pickups, vehicles, routes] = await Promise.all([
          apiService.getTransportPickupPoints({ status: 'active', limit: 1000, academic_year_id: academicYearId ?? undefined }),
          apiService.getTransportVehicles({ status: 'active', limit: 1000, academic_year_id: academicYearId ?? undefined }),
          apiService.getTransportRoutes({ limit: 1000, academic_year_id: academicYearId ?? undefined })
        ]);
        if (pickups.status === "SUCCESS") setPickupsData(pickups.data);
        if (vehicles.status === "SUCCESS") setVehiclesData(vehicles.data);
        if (routes.status === "SUCCESS") setRoutesData(routes.data);
      } catch (err) {
        console.error("Failed to fetch select data:", err);
      }
    };
    fetchSelectData();
  }, [academicYearId]);

  // Update form fields when selectedRoute changes
  useEffect(() => {
    if (selectedRoute) {
      const route = selectedRoute.originalData || selectedRoute;
      setRouteName(route.route_name || "");
      setDistanceKm(route.distance_km || "");
      setRouteStatus(route.is_active === 1 || route.is_active === true || route.status === "Active");

      if (route.stops && Array.isArray(route.stops)) {
        setStops(route.stops.map((s: any) => ({
          id: s.id,
          pickup_point_id: String(s.pickup_point_id || ""),
          pickup_time: s.pickup_time || "",
          drop_time: s.drop_time || "",
          order_index: s.order_index
        })));
      } else {
        setStops([{ pickup_point_id: "", pickup_time: "", drop_time: "", order_index: 0 }]);
      }
    } else {
      setRouteName("");
      setDistanceKm("");
      setRouteStatus(true);
      setStops([{ pickup_point_id: "", pickup_time: "", drop_time: "", order_index: 0 }]);
    }
  }, [selectedRoute]);

  // Update Assign Vehicle form
  useEffect(() => {
    if (selectedAssignment) {
      const assign = selectedAssignment.originalData || selectedAssignment;
      setAssignRouteId(String(assign.route_id || ""));
      setAssignVehicleId(String(assign.vehicle_id || ""));
      setAssignDriverId(String(assign.driver_id || ""));
      setAssignStatus(assign.is_active === 1 || assign.is_active === true || assign.status === "Active");
    } else {
      setAssignRouteId("");
      setAssignVehicleId("");
      setAssignDriverId("");
      setAssignStatus(true);
    }
  }, [selectedAssignment]);

  const handleAddStop = () => {
    setStops([...stops, { pickup_point_id: "", pickup_time: "", drop_time: "", order_index: stops.length }]);
  };

  const handleRemoveStop = (index: number) => {
    const newStops = [...stops];
    newStops.splice(index, 1);
    setStops(newStops);
  };

  const handleStopChange = (index: number, field: string, value: any) => {
    const newStops = [...stops];
    newStops[index] = { ...newStops[index], [field]: value };
    setStops(newStops);
  };

  const handleFormError = (err: any, defaultTitle = "Error") => {
    console.error(`${defaultTitle}:`, err);
    let errorMessage = err.message || "An unexpected error occurred";
    
    // Attempt to extract message from our API error format: "HTTP error! status: 400, message: {...}"
    if (errorMessage.includes('message: ')) {
      try {
        const jsonPart = errorMessage.split('message: ')[1];
        const parsed = JSON.parse(jsonPart);
        errorMessage = parsed.message || errorMessage;
      } catch (e) {
        // Fallback to original if parse fails
      }
    }

    Swal.fire({
      icon: 'error',
      title: defaultTitle,
      text: errorMessage
    });
  };

  const handleAddRoute = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        route_name: routeName,
        distance_km: distanceKm,
        academic_year_id: academicYearId ?? undefined,
        is_active: !!routeStatus,
        stops: stops.filter(s => s.pickup_point_id) // Only send stops with a selected point
      };

      let res;
      // Robust updateId detection
      const updateId = selectedRoute?.originalData?.id || 
                       (selectedRoute?.id && !isNaN(Number(selectedRoute.id)) ? Number(selectedRoute.id) : null);

      if (updateId) {
        res = await apiService.updateTransportRoute(updateId, payload);
      } else {
        res = await apiService.createTransportRoute(payload);
      }

      if (res?.status === "SUCCESS") {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: updateId ? 'Route updated successfully' : 'Route created successfully',
          timer: 1500,
          showConfirmButton: false
        });
        
        await handleCallback('route');
        
        // Close modal
        const modalId = updateId ? 'edit_routes' : 'add_routes';
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
          const bootstrap = (window as any).bootstrap;
          if (bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
          }
        }
      } else {
        throw new Error(res?.message || 'Failed to save route');
      }
    } catch (err: any) {
      console.error('Route Save Error:', err);
      handleFormError(err, "Failed to save route");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!assignRouteId || !assignVehicleId || !assignDriverId) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Please select route, vehicle and driver'
        });
        setLoading(false);
        return;
      }

      const payload = {
        vehicle_id: Number(assignVehicleId),
        route_id: Number(assignRouteId),
        driver_id: Number(assignDriverId),
        academic_year_id: academicYearId ?? undefined,
        is_active: !!assignStatus
      };

      let res;
      const assignmentId = selectedAssignment?.originalData?.id || selectedAssignment?.id || null;
      if (assignmentId) {
        res = await apiService.updateTransportAssignment(assignmentId, payload);
      } else {
        res = await apiService.createTransportAssignment(payload);
      }

      if (res?.status === "SUCCESS") {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Vehicle assigned successfully',
          timer: 1500,
          showConfirmButton: false
        });
        
        await handleCallback('assign');
        
        const modalId = selectedAssignment ? 'edit_assign_vehicle' : 'add_assign_vehicle';
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
          const bootstrap = (window as any).bootstrap;
          if (bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
          }
        }
      } else {
        throw new Error(res?.message || 'Failed to assign vehicle');
      }
    } catch (err: any) {
      console.error('Assign Error:', err);
      handleFormError(err, "Failed to save assignment");
    } finally {
      setLoading(false);
    }
  };

  // State for Pickup Points
  const [pointName, setPointName] = useState("");
  const [pointStatus, setPointStatus] = useState(true);

  useEffect(() => {
    if (selectedPickupPoint) {
      const p = selectedPickupPoint.originalData || selectedPickupPoint;
      setPointName(p.point_name || "");
      setPointStatus(p.is_active === 1 || p.is_active === true || p.status === "Active");
    } else {
      setPointName("");
      setPointStatus(true);
    }
  }, [selectedPickupPoint]);

  const handleAddPickupPoint = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Robust updateId detection
      const updateId = selectedPickupPoint?.originalData?.id || 
                       (selectedPickupPoint?.id && !isNaN(Number(selectedPickupPoint.id)) ? Number(selectedPickupPoint.id) : null);

      // Frontend Duplicate Check
      const isDuplicate = pickupsData.some(p =>
        p.point_name.toLowerCase() === pointName.trim().toLowerCase() &&
        p.id !== updateId
      );

      if (isDuplicate) {
        Swal.fire({
          icon: 'warning',
          title: 'Duplicate Name',
          text: 'A pickup point with this name already exists.'
        });
        setLoading(false);
        return;
      }

      const payload = {
        point_name: pointName.trim(),
        academic_year_id: academicYearId ?? undefined,
        is_active: !!pointStatus
      };

      let res;
      if (updateId) {
        res = await apiService.updateTransportPickupPoint(updateId, payload);
      } else {
        res = await apiService.createTransportPickupPoint(payload);
      }

      if (res?.status === "SUCCESS") {
        await handleCallback('pickup');
        
        // Close modal
        const modalId = updateId ? 'edit_pickup' : 'add_pickup';
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
          const bootstrap = (window as any).bootstrap;
          if (bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
          }
        }

        Swal.fire({
          icon: 'success',
          title: updateId ? 'Updated!' : 'Created!',
          text: res.message || `Pickup point ${updateId ? 'updated' : 'created'} successfully`,
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        throw new Error(res?.message || 'Failed to save pickup point');
      }
    } catch (err: any) {
      console.error('Pickup Save Error:', err);
      handleFormError(err, "Failed to save pickup point");
    } finally {
      setLoading(false);
    }
  };

  // State for Drivers
  const [driverNameInput, setDriverNameInput] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [driverRole, setDriverRole] = useState("driver");
  const [driverAddressInput, setDriverAddressInput] = useState("");
  const [driverStatus, setDriverStatus] = useState(true);

  useEffect(() => {
    if (selectedDriver) {
      const d = selectedDriver.originalData || selectedDriver;
      setDriverNameInput(d.name || d.driver_name || "");
      setDriverPhone(d.phone || d.driver_phone || "");
      setDriverLicense(d.license_number || d.driverLicenseNo || "");
      setDriverRole((d.role || "driver").toLowerCase());
      setDriverAddressInput(d.address || "");
      setDriverStatus(d.is_active === 1 || d.is_active === true || d.status === "Active");
    } else {
      setDriverNameInput("");
      setDriverPhone("");
      setDriverLicense("");
      setDriverRole("driver");
      setDriverAddressInput("");
      setDriverStatus(true);
    }
  }, [selectedDriver]);

  const handleAddDriver = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 10-digit phone validation
      const phoneDigits = driverPhone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: 'Phone number must be exactly 10 digits'
        });
        setLoading(false);
        return;
      }
      if (driverRole === "driver" && !driverLicense.trim()) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: 'Driving license number is required for driver role'
        });
        setLoading(false);
        return;
      }

      const payload = {
        name: driverNameInput,
        phone: phoneDigits, // Send clean 10-digit phone
        role: driverRole,
        academic_year_id: academicYearId ?? undefined,
        license_number: driverRole === "conductor" ? null : driverLicense,
        address: driverAddressInput,
        is_active: !!driverStatus
      };

      let res;
      // More robust updateId detection
      const updateId = selectedDriver?.originalData?.id || 
                       (selectedDriver?.id && !isNaN(Number(selectedDriver.id)) ? Number(selectedDriver.id) : null);
      
      console.log('Driver operation:', { isUpdate: !!updateId, updateId, payload });

      if (updateId) {
        res = await apiService.updateTransportDriver(updateId, payload);
      } else {
        res = await apiService.createTransportDriver(payload);
      }

      if (res?.status === "SUCCESS") {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: updateId ? 'Driver updated successfully' : 'Driver added successfully',
          timer: 1500,
          showConfirmButton: false
        });
        
        handleCallback('driver');

        // Close modal
        const modalId = updateId ? 'edit_driver' : 'add_driver';
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
          const bootstrap = (window as any).bootstrap;
          if (bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
          }
        }
      } else {
        throw new Error(res?.message || 'Failed to save driver');
      }
    } catch (err: any) {
      console.error('Driver Save Error details:', err);
      handleFormError(err, "Failed to save driver");
    } finally {
      setLoading(false);
    }
  };

  // State for Vehicles
  const [vehicleNo, setVehicleNo] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [chassisNo, setChassisNo] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [seatCapacity, setSeatCapacity] = useState("");
  const [gpsTrackingId, setGpsTrackingId] = useState("");
  const [madeOfYear, setMadeOfYear] = useState<any>(null);
  const [vehicleStatus, setVehicleStatusState] = useState(true);

  useEffect(() => {
    if (selectedVehicle) {
      const v = selectedVehicle.originalData || selectedVehicle;
      setVehicleNo(v.vehicle_number || "");
      setVehicleModel(v.vehicle_model || v.model || "");
      setChassisNo(v.chassis_number || "");
      setRegistrationNo(v.registration_number || "");
      setSeatCapacity(v.seat_capacity || v.seating_capacity || "");
      setGpsTrackingId(v.gps_device_id || v.gps_tracking_id || "");
      setMadeOfYear(v.made_of_year ? dayjs(`01-01-${v.made_of_year}`) : null);
      setVehicleStatusState(v.is_active === 1 || v.is_active === true || v.status === "Active");
    } else {
      setVehicleNo("");
      setVehicleModel("");
      setChassisNo("");
      setRegistrationNo("");
      setSeatCapacity("");
      setGpsTrackingId("");
      setMadeOfYear(null);
      setVehicleStatusState(true);
    }
  }, [selectedVehicle]);

  const handleAddVehicle = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        vehicle_number: vehicleNo,
        vehicle_model: vehicleModel,
        chassis_number: chassisNo,
        registration_number: registrationNo,
        seat_capacity: seatCapacity,
        gps_device_id: gpsTrackingId,
        made_of_year: madeOfYear ? madeOfYear.year() : null,
        academic_year_id: academicYearId ?? undefined,
        is_active: !!vehicleStatus
      };

      let res;
      // Robust updateId detection
      const updateId = selectedVehicle?.originalData?.id || 
                       (selectedVehicle?.id && !isNaN(Number(selectedVehicle.id)) ? Number(selectedVehicle.id) : null);

      if (updateId) {
        res = await apiService.updateTransportVehicle(updateId, payload);
      } else {
        res = await apiService.createTransportVehicle(payload);
      }

      if (res?.status === "SUCCESS") {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: updateId ? 'Vehicle updated successfully' : 'Vehicle added successfully',
          timer: 1500,
          showConfirmButton: false
        });
        
        handleCallback('vehicle');

        // Close modal
        const modalId = updateId ? 'edit_vehicle' : 'add_vehicle';
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
          const bootstrap = (window as any).bootstrap;
          if (bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
          }
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: res?.message || 'Failed to save vehicle'
        });
      }
    } catch (err: any) {
      handleFormError(err, "Failed to save vehicle");
    } finally {
      setLoading(false);
    }
  };

  const getDriversOptions = () => {
    // We already fetch drivers list indirectly via vehicle response or I should fetch it separately?
    // In useEffect I'm not fetching drivers separately. I'll add drivers fetch to the same useEffect.
  };

  // Update initial fetch to include drivers
  const [driversData, setDriversData] = useState<any[]>([]);
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await apiService.getTransportDrivers({ status: 'active', limit: 1000 });
        if (res.status === "SUCCESS") setDriversData(res.data);
      } catch (err) {
        console.error("Failed to fetch drivers:", err);
      }
    };
    fetchDrivers();
  }, []);

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

  const handleDelete = async (e: any) => {
    e.preventDefault();
    if (!deleteId) return;
    setLoading(true);
    try {
      let res;
      
      // We check the states in a specific order. 
      // To be safe, we prioritize Vehicles and Drivers as they are most active.
      if (selectedVehicle && (selectedVehicle.dbId === deleteId || selectedVehicle.id === deleteId || selectedVehicle.originalData?.id === deleteId)) {
        res = await apiService.deleteTransportVehicle(deleteId);
      } else if (selectedDriver && (selectedDriver.dbId === deleteId || selectedDriver.id === deleteId || selectedDriver.originalData?.id === deleteId)) {
        res = await apiService.deleteTransportDriver(deleteId);
      } else if (selectedRoute && (selectedRoute.dbId === deleteId || selectedRoute.id === deleteId || selectedRoute.originalData?.id === deleteId)) {
        res = await apiService.deleteTransportRoute(deleteId);
      } else if (selectedPickupPoint && (selectedPickupPoint.dbId === deleteId || selectedPickupPoint.id === deleteId || selectedPickupPoint.originalData?.id === deleteId)) {
        res = await apiService.deleteTransportPickupPoint(deleteId);
      } else if (selectedAssignment) {
        res = await apiService.deleteTransportAssignment(deleteId);
      } else {
        // Fallback for cases where direct matching might fail due to ID types
        if (selectedVehicle) res = await apiService.deleteTransportVehicle(deleteId);
        else if (selectedDriver) res = await apiService.deleteTransportDriver(deleteId);
        else if (selectedRoute) res = await apiService.deleteTransportRoute(deleteId);
        else if (selectedPickupPoint) res = await apiService.deleteTransportPickupPoint(deleteId);
      }

      if (res?.status === "SUCCESS") {
        if (onSuccess) onSuccess();
        if (selectedRoute && onRouteUpdate) await onRouteUpdate();
        if (selectedPickupPoint && onPickupUpdate) await onPickupUpdate();
        if (selectedDriver && onDriverUpdate) await onDriverUpdate();
        if (selectedAssignment && onAssignUpdate) await onAssignUpdate();
        if (selectedVehicle && onVehicleUpdate) await onVehicleUpdate();

        // Close modal
        const modalElement = document.getElementById('delete-modal');
        if (modalElement) {
          const bootstrap = (window as any).bootstrap;
          if (bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
          }
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: res?.message || 'Failed to delete item'
        });
      }
    } catch (err: any) {
      handleFormError(err, "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCallback = async (type: string) => {
    if (onSuccess) onSuccess();
    if (type === 'route' && onRouteUpdate) await onRouteUpdate();
    if (type === 'pickup' && onPickupUpdate) await onPickupUpdate();
    if (type === 'driver' && onDriverUpdate) await onDriverUpdate();
    if (type === 'assign' && onAssignUpdate) await onAssignUpdate();
    if (type === 'vehicle' && onVehicleUpdate) await onVehicleUpdate();
  };
  return (
    <>
      <>
        {/* Add Route */}
        <div className="modal fade" id="add_routes">
          <div className="modal-dialog modal-dialog-centered modal-lg">
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
              <form onSubmit={handleAddRoute}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Route Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. North Route"
                          value={routeName}
                          onChange={(e) => setRouteName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Distance (KM)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-control"
                          placeholder="Enter Distance"
                          value={distanceKm}
                          onChange={(e) => setDistanceKm(e.target.value)}
                        />
                      </div>

                      <div className="mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <label className="form-label mb-0">Route Stops</label>
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddStop}>
                            <i className="ti ti-plus me-1"></i>Add Stop
                          </button>
                        </div>
                        <div className="table-responsive border rounded">
                          <table className="table table-nowrap mb-0">
                            <thead className="thead-light">
                              <tr>
                                <th style={{ width: '40%' }}>Pickup Point</th>
                                <th>Pickup Time</th>
                                <th>Drop Time</th>
                                <th style={{ width: '50px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {stops.map((stop, index) => (
                                <tr key={`stop-add-${index}`}>
                                  <td>
                                    <CommonSelect
                                      className="select"
                                      options={[{ value: "", label: "Select Point" }, ...pickupsData.map(p => ({ value: String(p.id), label: p.point_name }))]}
                                      value={String(stop.pickup_point_id || "")}
                                      onChange={(v: any) => handleStopChange(index, 'pickup_point_id', v || "")}
                                      placeholder="Point"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="time"
                                      className="form-control form-control-sm"
                                      value={stop.pickup_time}
                                      onChange={(e) => handleStopChange(index, 'pickup_time', e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="time"
                                      className="form-control form-control-sm"
                                      value={stop.drop_time}
                                      onChange={(e) => handleStopChange(index, 'drop_time', e.target.value)}
                                    />
                                  </td>
                                  <td className="text-center">
                                    <Link to="#" className="text-danger" onClick={() => handleRemoveStop(index)}>
                                      <i className="ti ti-trash"></i>
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                        <div className="status-title">
                          <h5>Status</h5>
                          <label className="form-label mb-0" htmlFor="add_route_status">
                            {routeStatus ? "Active" : "Inactive"}
                          </label>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            id="add_route_status"
                            className="form-check-input"
                            type="checkbox"
                            checked={routeStatus}
                            onChange={(e) => setRouteStatus(e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Adding..." : "Add Route Stop"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Route*/}
        {/* Edit Route */}
        <div className="modal fade" id="edit_routes">
          <div className="modal-dialog modal-dialog-centered modal-lg">
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
              <form onSubmit={handleAddRoute}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Route Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Route Name"
                          value={routeName}
                          onChange={(e) => setRouteName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <label className="form-label mb-0">Route Stops</label>
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddStop}>
                            <i className="ti ti-plus me-1"></i>Add Stop
                          </button>
                        </div>
                        <div className="table-responsive border rounded">
                          <table className="table table-nowrap mb-0">
                            <thead className="thead-light">
                              <tr>
                                <th style={{ width: '40%' }}>Pickup Point</th>
                                <th>Pickup Time</th>
                                <th>Drop Time</th>
                                <th style={{ width: '50px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {stops.map((stop, index) => (
                                <tr key={`stop-edit-${index}`}>
                                  <td>
                                    <CommonSelect
                                      className="select"
                                      options={[{ value: "", label: "Select Point" }, ...pickupsData.map(p => ({ value: String(p.id), label: p.point_name }))]}
                                      value={String(stop.pickup_point_id || "")}
                                      onChange={(v: any) => handleStopChange(index, 'pickup_point_id', v || "")}
                                      placeholder="Point"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="time"
                                      className="form-control form-control-sm"
                                      value={stop.pickup_time}
                                      onChange={(e) => handleStopChange(index, 'pickup_time', e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="time"
                                      className="form-control form-control-sm"
                                      value={stop.drop_time}
                                      onChange={(e) => handleStopChange(index, 'drop_time', e.target.value)}
                                    />
                                  </td>
                                  <td className="text-center">
                                    <Link to="#" className="text-danger" onClick={() => handleRemoveStop(index)}>
                                      <i className="ti ti-trash"></i>
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Distance (KM)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-control"
                          placeholder="Enter Distance"
                          value={distanceKm}
                          onChange={(e) => setDistanceKm(e.target.value)}
                        />
                      </div>
                      <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                        <div className="status-title">
                          <h5>Status</h5>
                          <label className="form-label mb-0" htmlFor="edit_route_status">
                            {routeStatus ? "Active" : "Inactive"}
                          </label>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            id="edit_route_status"
                            className="form-check-input"
                            type="checkbox"
                            checked={routeStatus}
                            onChange={(e) => setRouteStatus(e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Save Changes"}
                  </button>
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
                <h4 className="modal-title">Assign Vehicle</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleAddAssignment}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Select Route</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: "", label: "Select Route" }, ...routesData.map(r => ({
                            value: String(r.id),
                            label: `${r.route_name}`
                          }))]}
                          value={String(assignRouteId || "")}
                          onChange={(v: any) => setAssignRouteId(v || "")}
                          placeholder="Select Route"
                        />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Select Vehicle</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: "", label: "Select Vehicle" }, ...vehiclesData.map(v => ({ value: String(v.id), label: `${v.vehicle_number}` }))]}
                          value={String(assignVehicleId || "")}
                          onChange={(v: any) => setAssignVehicleId(v || "")}
                          placeholder="Select Vehicle"
                        />
                      </div>
                      <div className="mb-0 mt-3">
                        <label className="form-label">Select Driver</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: "", label: "Select Driver" }, ...driversData.map(d => ({ value: String(d.id), label: `${d.name || d.driver_name} (${d.phone || d.driver_phone})` }))]}
                          value={String(assignDriverId || "")}
                          onChange={(v: any) => setAssignDriverId(v || "")}
                          placeholder="Select Driver"
                        />
                      </div>
                    </div>
                      <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                        <div className="status-title">
                          <h5>Status</h5>
                          <label className="form-label mb-0" htmlFor="add_assign_status">
                            {assignStatus ? "Active" : "Inactive"}
                          </label>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            id="add_assign_status"
                            className="form-check-input"
                            type="checkbox"
                            checked={assignStatus}
                            onChange={(e) => setAssignStatus(e.target.checked)}
                          />
                        </div>
                      </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Assigning..." : "Assign Now"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

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
              <form onSubmit={handleAddAssignment}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Select Route</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: "", label: "Select Route" }, ...routesData.map(r => ({
                            value: String(r.id),
                            label: `${r.route_name} (${r.stops?.map((s: any) => s.point_name).join(', ') || 'No Stops'})`
                          }))]}
                          value={String(assignRouteId || "")}
                          onChange={(v: any) => setAssignRouteId(v || "")}
                          key={`route-sel-edit-${assignRouteId}`}
                          placeholder="Select Route"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Select Vehicle</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: "", label: "Select Vehicle" }, ...vehiclesData.map(v => ({ value: String(v.id || v.vehicle_id), label: `${v.vehicle_number}` }))]}
                          value={String(assignVehicleId || "")}
                          onChange={(v: any) => setAssignVehicleId(v || "")}
                          key={`vehicle-sel-edit-${assignVehicleId}`}
                          placeholder="Select Vehicle"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Select Driver</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: "", label: "Select Driver" }, ...driversData.map(d => ({ value: String(d.id), label: `${d.name || d.driver_name} (${d.phone || d.driver_phone})` }))]}
                          value={String(assignDriverId || "")}
                          onChange={(v: any) => setAssignDriverId(v || "")}
                          key={`driver-sel-edit-${assignDriverId}`}
                          placeholder="Select Driver"
                        />
                      </div>
                      <div className="assigned-driver">
                        <h6>Assigned Driver</h6>
                        <div className="assigned-driver-info">
                          <span className="driver-img">
                            <ImageWithBasePath
                              src={selectedAssignment?.originalData?.photo_url || "assets/img/parents/parent-01.jpg"}
                              alt="Img"
                            />
                          </span>
                          <div>
                            <h5>{selectedAssignment?.originalData?.driver_name || "N/A"}</h5>
                            <span>{selectedAssignment?.originalData?.driver_phone || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                        <div className="status-title">
                          <h5>Status</h5>
                          <label className="form-label mb-0" htmlFor="edit_assign_status">
                            {assignStatus ? "Active" : "Inactive"}
                          </label>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            id="edit_assign_status"
                            className="form-check-input"
                            type="checkbox"
                            checked={assignStatus}
                            onChange={(e) => setAssignStatus(e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Save Changes"}
                  </button>
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
              <form onSubmit={handleAddPickupPoint}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Pickup Point Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Central Station"
                          value={pointName}
                          onChange={(e) => setPointName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                      <div className="status-title">
                        <h5>Status</h5>
                        <label className="form-label mb-0" htmlFor="add_pickup_status">
                          {pointStatus ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="add_pickup_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={pointStatus}
                          onChange={(e) => setPointStatus(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Adding..." : "Add Pickup Point"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

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
              <form onSubmit={handleAddPickupPoint}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Pickup Point Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Pickup Point"
                          value={pointName}
                          onChange={(e) => setPointName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                      <div className="status-title">
                        <h5>Status</h5>
                        <label className="form-label mb-0" htmlFor="edit_pickup_status">
                          {pointStatus ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="edit_pickup_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={pointStatus}
                          onChange={(e) => setPointStatus(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Save Changes"}
                  </button>
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
              <form onSubmit={handleAddDriver}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. John Doe"
                          value={driverNameInput}
                          onChange={(e) => setDriverNameInput(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. +1234567890"
                          value={driverPhone}
                          onChange={(e) => setDriverPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Role</label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "driver", label: "Driver" },
                            { value: "conductor", label: "Conductor" }
                          ]}
                          value={driverRole}
                          onChange={(v: string | null) => setDriverRole(v || "driver")}
                        />
                      </div>
                      {driverRole === "driver" && (
                      <div className="mb-3">
                        <label className="form-label">Driving License Number</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Driving License Number"
                          value={driverLicense}
                          onChange={(e) => setDriverLicense(e.target.value)}
                          required
                        />
                      </div>
                      )}
                      <div className="mb-3">
                        <label className="form-label">Address</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder="Enter Address"
                          value={driverAddressInput}
                          onChange={(e) => setDriverAddressInput(e.target.value)}
                        ></textarea>
                      </div>
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-1 mx-2">
                      <div className="status-title">
                        <h5>Status</h5>
                        <label className="form-label mb-0" htmlFor="add_driver_status">
                          {driverStatus ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="add_driver_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={driverStatus}
                          onChange={(e) => setDriverStatus(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Adding..." : "Add Driver"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

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
              <form onSubmit={handleAddDriver}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Name"
                          value={driverNameInput}
                          onChange={(e) => setDriverNameInput(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Phone Number"
                          value={driverPhone}
                          onChange={(e) => setDriverPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Role</label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "driver", label: "Driver" },
                            { value: "conductor", label: "Conductor" }
                          ]}
                          value={driverRole}
                          onChange={(v: string | null) => setDriverRole(v || "driver")}
                        />
                      </div>
                      {driverRole === "driver" && (
                      <div className="mb-3">
                        <label className="form-label">Driving License Number</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Driving License Number"
                          value={driverLicense}
                          onChange={(e) => setDriverLicense(e.target.value)}
                          required
                        />
                      </div>
                      )}
                      <div className="mb-3">
                        <label className="form-label">Address</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder="Enter Address"
                          value={driverAddressInput}
                          onChange={(e) => setDriverAddressInput(e.target.value)}
                        ></textarea>
                      </div>
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-1 mx-2">
                      <div className="status-title">
                        <h5>Status</h5>
                        <label className="form-label mb-0" htmlFor="edit_driver_status">
                          {driverStatus ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="edit_driver_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={driverStatus}
                          onChange={(e) => setDriverStatus(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Save Changes"}
                  </button>
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
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <div className="d-flex align-items-center">
                  <h4 className="modal-title">Add New Vehicle</h4>
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
              <form onSubmit={handleAddVehicle}>
                <div className="modal-body" id='modal-datepicker'>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Vehicle No</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. SC-1234"
                          value={vehicleNo}
                          onChange={(e) => setVehicleNo(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Vehicle Model</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Scania G-Series"
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Made of Year</label>
                        <div className="date-pic">
                          <DatePicker
                            className="form-control datetimepicker"
                            picker="year"
                            format="YYYY"
                            getPopupContainer={getModalContainer}
                            value={madeOfYear}
                            onChange={(date) => setMadeOfYear(date)}
                            placeholder="Select Year"
                          />
                          <span className="cal-icon">
                            <i className="ti ti-calendar" />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Registration No</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Registration No"
                          value={registrationNo}
                          onChange={(e) => setRegistrationNo(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Chassis No</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Chassis No"
                          value={chassisNo}
                          onChange={(e) => setChassisNo(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Seat Capacity</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="e.g. 50"
                          value={seatCapacity}
                          onChange={(e) => setSeatCapacity(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">GPS Tracking ID</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter GPS Tracking ID"
                          value={gpsTrackingId}
                          onChange={(e) => setGpsTrackingId(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                      <div className="status-title">
                        <h5>Vehicle Status</h5>
                        <label className="form-label mb-0" htmlFor="add_vehicle_status">
                          {vehicleStatus ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="add_vehicle_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={vehicleStatus}
                          onChange={(e) => setVehicleStatusState(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Adding..." : "Add Vehicle"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="modal fade" id="edit_vehicle">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <div className="d-flex align-items-center">
                  <h4 className="modal-title">Edit Vehicle</h4>
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
              <form onSubmit={handleAddVehicle}>
                <div className="modal-body" id='modal-datepicker2'>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Vehicle No</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. SC-1234"
                          value={vehicleNo}
                          onChange={(e) => setVehicleNo(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Vehicle Model</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Scania G-Series"
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Made of Year</label>
                        <div className="date-pic">
                          <DatePicker
                            className="form-control datetimepicker"
                            picker="year"
                            format="YYYY"
                            getPopupContainer={getModalContainer2}
                            value={madeOfYear}
                            onChange={(date) => setMadeOfYear(date)}
                            key={`edit-year-v-${selectedVehicle?.id}`}
                          />
                          <span className="cal-icon">
                            <i className="ti ti-calendar" />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Registration No</label>
                        <input
                          type="text"
                          className="form-control"
                          value={registrationNo}
                          onChange={(e) => setRegistrationNo(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Chassis No</label>
                        <input
                          type="text"
                          className="form-control"
                          value={chassisNo}
                          onChange={(e) => setChassisNo(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Seat Capacity</label>
                        <input
                          type="number"
                          className="form-control"
                          value={seatCapacity}
                          onChange={(e) => setSeatCapacity(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">GPS Tracking ID</label>
                        <input
                          type="text"
                          className="form-control"
                          value={gpsTrackingId}
                          onChange={(e) => setGpsTrackingId(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                      <div className="status-title">
                        <h5>Vehicle Status</h5>
                        <label className="form-label mb-0" htmlFor="edit_vehicle_status">
                          {vehicleStatus ? "Active" : "Inactive"}
                        </label>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          id="edit_vehicle_status"
                          className="form-check-input"
                          type="checkbox"
                          checked={vehicleStatus}
                          onChange={(e) => setVehicleStatusState(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Save Changes"}
                  </button>
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
                    onClick={handleDelete}
                  >
                    {loading ? "Deleting..." : "Yes, Delete"}
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

