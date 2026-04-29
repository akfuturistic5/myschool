import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

interface Props {
  selectedAllocation?: any;
  deleteId?: number | null;
  onSuccess?: () => void;
}

const hideModal = (id: string) => {
  const el = document.getElementById(id);
  const bootstrap = (window as any).bootstrap;
  if (!el || !bootstrap?.Modal) return;
  const m = bootstrap.Modal.getInstance(el);
  if (m) m.hide();
};

const today = () => new Date().toISOString().slice(0, 10);

const TransportAllocationModal = ({ selectedAllocation, deleteId, onSuccess }: Props) => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [pickupPoints, setPickupPoints] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);

  const [singleUserType, setSingleUserType] = useState("student");
  const [singleUserId, setSingleUserId] = useState("");
  const [singlePickupPointId, setSinglePickupPointId] = useState("");
  const [singleRouteId, setSingleRouteId] = useState("");
  const [singleVehicleId, setSingleVehicleId] = useState("");
  const [singleAssignedFeeId, setSingleAssignedFeeId] = useState("");
  const [singleIsFree, setSingleIsFree] = useState(false);
  const [singleStartDate, setSingleStartDate] = useState(today());
  const [singleStatus, setSingleStatus] = useState("Active");
  const [singleAvailableRoutes, setSingleAvailableRoutes] = useState<any[]>([]);
  const [singleAvailableVehicles, setSingleAvailableVehicles] = useState<any[]>([]);

  const [bulkUserType, setBulkUserType] = useState("student");
  const [bulkPickupPointId, setBulkPickupPointId] = useState("");
  const [bulkRouteId, setBulkRouteId] = useState("");
  const [bulkVehicleId, setBulkVehicleId] = useState("");
  const [bulkAssignedFeeId, setBulkAssignedFeeId] = useState("");
  const [bulkIsFree, setBulkIsFree] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState(today());
  const [bulkStatus, setBulkStatus] = useState("Active");
  const [bulkAvailableRoutes, setBulkAvailableRoutes] = useState<any[]>([]);
  const [bulkAvailableVehicles, setBulkAvailableVehicles] = useState<any[]>([]);
  const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState<number[]>([]);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkClassFilter, setBulkClassFilter] = useState("all");
  const [bulkSectionFilter, setBulkSectionFilter] = useState("all");
  const [bulkDepartmentFilter, setBulkDepartmentFilter] = useState("all");
  const hydratingSinglePickupRef = useRef(false);
  const hydratingSingleRouteRef = useRef(false);
  const isEditMode = Boolean(selectedAllocation?.originalData?.id);

  const toErrorText = (err: any, fallback: string) => {
    let msg = err?.message || fallback;
    if (typeof msg === "string" && msg.includes("message:")) {
      try {
        const raw = msg.split("message:")[1].trim();
        const parsed = JSON.parse(raw);
        msg = parsed?.message || msg;
      } catch {
        // keep original
      }
    }
    return msg;
  };

  useEffect(() => {
    const loadBase = async () => {
      try {
        const [sRes, stRes, pRes, fRes] = await Promise.all([
          apiService.getStudents(),
          apiService.getStaff(),
          apiService.getTransportPickupPoints({ limit: 1000, status: "active", academic_year_id: academicYearId ?? undefined }),
          apiService.getTransportFees({ limit: 1000, status: "active", academic_year_id: academicYearId ?? undefined }),
        ]);
        if (sRes?.status === "SUCCESS") setStudents(sRes.data || []);
        if (stRes?.status === "SUCCESS") setStaff(stRes.data || []);
        if (pRes?.status === "SUCCESS") setPickupPoints(pRes.data || []);
        if (fRes?.status === "SUCCESS") setFees(fRes.data || []);
      } catch {
        // ignore
      }
    };
    loadBase();
  }, [academicYearId]);

  useEffect(() => {
    if (selectedAllocation?.originalData) {
      const row = selectedAllocation.originalData;
      hydratingSinglePickupRef.current = true;
      hydratingSingleRouteRef.current = true;
      setSingleUserType(row.user_type || "student");
      setSingleUserId(String(row.student_id || row.staff_id || row.user_id || ""));
      setSinglePickupPointId(String(row.pickup_point_id || ""));
      setSingleRouteId(String(row.route_id || ""));
      setSingleVehicleId(String(row.vehicle_id || ""));
      setSingleAssignedFeeId(String(row.assigned_fee_id || ""));
      setSingleIsFree(Boolean(row.is_free));
      setSingleStartDate(row.start_date || today());
      setSingleStatus(row.status || "Active");
      return;
    }
    setSingleUserType("student");
    setSingleUserId("");
    setSinglePickupPointId("");
    setSingleRouteId("");
    setSingleVehicleId("");
    setSingleAssignedFeeId("");
    setSingleIsFree(false);
    setSingleStartDate(today());
    setSingleStatus("Active");
  }, [selectedAllocation]);

  useEffect(() => {
    if (singleUserType !== "staff") setSingleIsFree(false);
  }, [singleUserType]);
  useEffect(() => {
    if (bulkUserType !== "staff") setBulkIsFree(false);
  }, [bulkUserType]);

  const loadRoutesForPickup = async (pickupPointId: string, setRoutes: (rows: any[]) => void) => {
    if (!pickupPointId) {
      setRoutes([]);
      return;
    }
    const res = await apiService.getTransportRoutes({ limit: 1000, status: "active", pickup_point_id: pickupPointId, academic_year_id: academicYearId ?? undefined });
    setRoutes(res?.status === "SUCCESS" ? res.data || [] : []);
  };

  const loadVehiclesForRoute = async (routeId: string, setVehicles: (rows: any[]) => void) => {
    if (!routeId) {
      setVehicles([]);
      return;
    }
    const res = await apiService.getTransportVehicles({ limit: 1000, status: "active", route_id: routeId, academic_year_id: academicYearId ?? undefined });
    setVehicles(res?.status === "SUCCESS" ? res.data || [] : []);
  };

  useEffect(() => {
    const isHydrating = hydratingSinglePickupRef.current;
    if (!isHydrating) {
      setSingleRouteId("");
      setSingleVehicleId("");
    }
    if (!isHydrating) {
      setSingleAssignedFeeId("");
    }
    loadRoutesForPickup(singlePickupPointId, setSingleAvailableRoutes);
    if (isHydrating) hydratingSinglePickupRef.current = false;
  }, [singlePickupPointId, academicYearId]);
  useEffect(() => {
    const isHydrating = hydratingSingleRouteRef.current;
    if (!isHydrating) {
      setSingleVehicleId("");
    }
    loadVehiclesForRoute(singleRouteId, setSingleAvailableVehicles);
    if (isHydrating) hydratingSingleRouteRef.current = false;
  }, [singleRouteId, academicYearId]);

  useEffect(() => {
    if (isEditMode) return;
    if (!singleRouteId) {
      setSingleVehicleId("");
      return;
    }
    const defaultVehicleId = singleAvailableVehicles[0]?.id;
    setSingleVehicleId(defaultVehicleId ? String(defaultVehicleId) : "");
  }, [singleAvailableVehicles, singleRouteId, isEditMode]);

  useEffect(() => {
    setBulkRouteId("");
    setBulkVehicleId("");
    setBulkAssignedFeeId("");
    loadRoutesForPickup(bulkPickupPointId, setBulkAvailableRoutes);
  }, [bulkPickupPointId, academicYearId]);
  useEffect(() => {
    setBulkVehicleId("");
    loadVehiclesForRoute(bulkRouteId, setBulkAvailableVehicles);
  }, [bulkRouteId, academicYearId]);

  useEffect(() => {
    if (!bulkRouteId) {
      setBulkVehicleId("");
      return;
    }
    const defaultVehicleId = bulkAvailableVehicles[0]?.id;
    setBulkVehicleId(defaultVehicleId ? String(defaultVehicleId) : "");
  }, [bulkAvailableVehicles, bulkRouteId]);

  const resetSingleAddForm = () => {
    setSingleUserType("student");
    setSingleUserId("");
    setSinglePickupPointId("");
    setSingleRouteId("");
    setSingleVehicleId("");
    setSingleAssignedFeeId("");
    setSingleIsFree(false);
    setSingleStartDate(today());
    setSingleStatus("Active");
    setSingleAvailableRoutes([]);
    setSingleAvailableVehicles([]);
  };

  const resetBulkForm = () => {
    setBulkUserType("student");
    setBulkPickupPointId("");
    setBulkRouteId("");
    setBulkVehicleId("");
    setBulkAssignedFeeId("");
    setBulkIsFree(false);
    setBulkStartDate(today());
    setBulkStatus("Active");
    setBulkAvailableRoutes([]);
    setBulkAvailableVehicles([]);
    setBulkSelectedUserIds([]);
    setBulkSearch("");
    setBulkClassFilter("all");
    setBulkSectionFilter("all");
    setBulkDepartmentFilter("all");
  };

  useEffect(() => {
    const addEl = document.getElementById("add_transport_allocation");
    const bulkEl = document.getElementById("add_transport_allocation_bulk");
    const onAddShow = () => resetSingleAddForm();
    const onBulkShow = () => resetBulkForm();
    addEl?.addEventListener("show.bs.modal", onAddShow as any);
    bulkEl?.addEventListener("show.bs.modal", onBulkShow as any);
    return () => {
      addEl?.removeEventListener("show.bs.modal", onAddShow as any);
      bulkEl?.removeEventListener("show.bs.modal", onBulkShow as any);
    };
  }, []);

  const singleUserOptions =
    singleUserType === "student"
      ? students.filter((s: any) => s.id != null).map((s: any) => ({
          value: String(s.id),
          label: `${s.first_name || ""} ${s.last_name || ""} (${s.admission_number || s.id})`,
        }))
      : staff.filter((s: any) => s.id != null).map((s: any) => ({
          value: String(s.id),
          label: `${s.first_name || ""} ${s.last_name || ""} (${s.employee_code || s.id})`,
        }));

  const filteredSingleFees = useMemo(
    () => fees.filter((f: any) => String(f.pickup_point_id) === String(singlePickupPointId)),
    [fees, singlePickupPointId]
  );
  const filteredBulkFees = useMemo(
    () => fees.filter((f: any) => String(f.pickup_point_id) === String(bulkPickupPointId)),
    [fees, bulkPickupPointId]
  );

  const feeLabel = (fee: any, userType: string) =>
    userType === "staff"
      ? `${fee.plan_name} - Staff: ${fee.staff_amount ?? fee.amount}`
      : `${fee.plan_name} - Student: ${fee.amount}`;

  const saveSingleAllocation = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!singleUserId || !singleRouteId || !singlePickupPointId || !singleVehicleId) {
        throw new Error("Please select user, pickup point and route");
      }
      if (!singleStartDate) {
        throw new Error("Please select a start date");
      }
      if (!singleIsFree && !singleAssignedFeeId) {
        throw new Error("Please select a fee plan");
      }
      const payload: any = {
        user_type: singleUserType,
        ...(singleUserType === "student"
          ? { student_id: Number(singleUserId) }
          : { staff_id: Number(singleUserId) }),
        route_id: Number(singleRouteId),
        pickup_point_id: Number(singlePickupPointId),
        vehicle_id: Number(singleVehicleId),
        assigned_fee_id:
          singleUserType === "staff" && singleIsFree
            ? null
            : (singleAssignedFeeId ? Number(singleAssignedFeeId) : null),
        is_free: singleUserType === "staff" ? singleIsFree : false,
        start_date: singleStartDate,
        status: singleStatus,
        academic_year_id: academicYearId ?? undefined,
      };
      const id = selectedAllocation?.originalData?.id;
      const res = id
        ? await apiService.updateTransportAllocation(id, payload)
        : await apiService.createTransportAllocation(payload);
      if (res?.status !== "SUCCESS") throw new Error(res?.message || "Failed to save allocation");
      Swal.fire({
        icon: "success",
        title: "Success",
        text: id ? "Allocation updated successfully" : "Allocation created successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      hideModal(id ? "edit_transport_allocation" : "add_transport_allocation");
      if (!id) resetSingleAddForm();
      onSuccess?.();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: toErrorText(err, "Failed to save allocation") });
    } finally {
      setLoading(false);
    }
  };

  const bulkUsersSource = bulkUserType === "student" ? students : staff;
  const bulkClasses = Array.from(new Set(students.map((s: any) => s.class_name).filter(Boolean)));
  const bulkSections = Array.from(
    new Set(
      students
        .filter((s: any) => bulkClassFilter === "all" || String(s.class_name || "") === bulkClassFilter)
        .map((s: any) => s.section_name || s.section)
        .filter(Boolean)
    )
  );
  const bulkDepartments = Array.from(new Set(staff.map((s: any) => s.department_name || s.department).filter(Boolean)));

  const bulkFilteredUsers = useMemo(() => {
    let rows = bulkUsersSource.filter((u: any) => u.id != null);
    if (bulkSearch.trim()) {
      const q = bulkSearch.trim().toLowerCase();
      rows = rows.filter((u: any) =>
        `${u.first_name || ""} ${u.last_name || ""} ${u.admission_number || ""} ${u.employee_code || ""}`
          .toLowerCase()
          .includes(q)
      );
    }
    if (bulkUserType === "student" && bulkClassFilter !== "all") {
      rows = rows.filter((u: any) => String(u.class_name || "") === bulkClassFilter);
    }
    if (bulkUserType === "student" && bulkSectionFilter !== "all") {
      rows = rows.filter((u: any) => String(u.section_name || u.section || "") === bulkSectionFilter);
    }
    if (bulkUserType === "staff" && bulkDepartmentFilter !== "all") {
      rows = rows.filter((u: any) => String(u.department_name || u.department || "") === bulkDepartmentFilter);
    }
    return rows;
  }, [bulkUsersSource, bulkSearch, bulkUserType, bulkClassFilter, bulkSectionFilter, bulkDepartmentFilter]);

  const saveBulkAllocation = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!bulkPickupPointId || !bulkRouteId || !bulkVehicleId) {
        throw new Error("Please select pickup point and route");
      }
      if (!bulkStartDate) {
        throw new Error("Please select a start date");
      }
      if (!bulkIsFree && !bulkAssignedFeeId) {
        throw new Error("Please select a fee plan");
      }
      if (bulkSelectedUserIds.length === 0) {
        throw new Error(`Please select at least one ${bulkUserType}`);
      }

      let successCount = 0;
      const failures: string[] = [];
      for (const uid of bulkSelectedUserIds) {
        const payload = {
          user_type: bulkUserType,
          ...(bulkUserType === "student"
            ? { student_id: Number(uid) }
            : { staff_id: Number(uid) }),
          route_id: Number(bulkRouteId),
          pickup_point_id: Number(bulkPickupPointId),
          vehicle_id: Number(bulkVehicleId),
          assigned_fee_id:
            bulkUserType === "staff" && bulkIsFree
              ? null
              : (bulkAssignedFeeId ? Number(bulkAssignedFeeId) : null),
          is_free: bulkUserType === "staff" ? bulkIsFree : false,
          start_date: bulkStartDate,
          status: bulkStatus,
          academic_year_id: academicYearId ?? undefined,
        };
        try {
          const res = await apiService.createTransportAllocation(payload);
          if (res?.status === "SUCCESS") successCount += 1;
          else failures.push(`User ${uid}: ${res?.message || "failed"}`);
        } catch (err: any) {
          failures.push(`User ${uid}: ${toErrorText(err, "failed")}`);
        }
      }

      if (successCount === 0) {
        throw new Error(`No allocations created.\n${failures.slice(0, 3).join("\n")}`);
      }
      Swal.fire({
        icon: failures.length ? "warning" : "success",
        title: failures.length ? "Partial Success" : "Success",
        text: failures.length
          ? `Created ${successCount} allocations. ${failures.length} failed.`
          : `Created ${successCount} allocations successfully.`,
      });
      hideModal("add_transport_allocation_bulk");
      resetBulkForm();
      onSuccess?.();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: toErrorText(err, "Failed to save bulk allocations") });
    } finally {
      setLoading(false);
    }
  };

  const deleteAllocation = async (e: any) => {
    e.preventDefault();
    if (!deleteId) return;
    setLoading(true);
    try {
      const res = await apiService.deleteTransportAllocation(deleteId);
      if (res?.status !== "SUCCESS") throw new Error(res?.message || "Failed to close allocation");
      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Allocation closed successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      hideModal("delete-transport-allocation-modal");
      onSuccess?.();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: toErrorText(err, "Failed to close allocation") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal fade" id="add_transport_allocation">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Transport Allocation</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={saveSingleAllocation}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">User Type</label>
                    <CommonSelect className="select" options={[{ value: "student", label: "Student" }, { value: "staff", label: "Staff" }]} value={singleUserType} onChange={(v: string | null) => { setSingleUserType(v || "student"); setSingleUserId(""); }} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">User</label>
                    <CommonSelect className="select" options={singleUserOptions} value={singleUserId} onChange={(v: string | null) => setSingleUserId(v || "")} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Pickup Point</label>
                    <CommonSelect
                      className="select"
                      options={pickupPoints.map((p: any) => ({ value: String(p.id), label: p.point_name }))}
                      value={singlePickupPointId}
                      onChange={(v: string | null) => {
                        setSinglePickupPointId(v || "");
                        setSingleRouteId("");
                        setSingleVehicleId("");
                        setSingleAssignedFeeId("");
                      }}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Route (for selected pickup)</label>
                    <CommonSelect
                      className="select"
                      options={singleAvailableRoutes.map((r: any) => ({ value: String(r.id), label: r.route_name }))}
                      value={singleRouteId}
                      onChange={(v: string | null) => {
                        setSingleRouteId(v || "");
                        setSingleVehicleId("");
                      }}
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Vehicle (for selected route)</label>
                    <CommonSelect
                      className="select"
                      options={singleAvailableVehicles.map((v: any) => ({
                        value: String(v.id),
                        label: `${v.vehicle_number} (${v.seat_capacity || v.seating_capacity || 0})`,
                      }))}
                      value={singleVehicleId}
                      onChange={(v: string | null) => setSingleVehicleId(v || "")}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Start Date</label>
                    <DatePicker
                      className="form-control datetimepicker"
                      format="DD MMM YYYY"
                      value={singleStartDate ? dayjs(singleStartDate) : null}
                      onChange={(d) => setSingleStartDate(d ? d.format("YYYY-MM-DD") : "")}
                    />
                  </div>
                </div>
                {singleUserType === "staff" && (
                  <div className="mb-3">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="single_is_free_allocation" checked={singleIsFree} onChange={(e) => setSingleIsFree(e.target.checked)} />
                      <label className="form-check-label" htmlFor="single_is_free_allocation">Mark as free allocation</label>
                    </div>
                  </div>
                )}
                {!singleIsFree && (
                  <div className="mb-3">
                    <label className="form-label">Fee Plan</label>
                    <CommonSelect className="select" options={filteredSingleFees.map((f: any) => ({ value: String(f.id), label: feeLabel(f, singleUserType) }))} value={singleAssignedFeeId} onChange={(v: string | null) => setSingleAssignedFeeId(v || "")} />
                  </div>
                )}
                <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                  <div className="status-title">
                    <h5>Status</h5>
                    <label className="form-label mb-0" htmlFor="single_allocation_status_toggle">{singleStatus}</label>
                  </div>
                  <div className="form-check form-switch">
                    <input id="single_allocation_status_toggle" className="form-check-input" type="checkbox" checked={singleStatus === "Active"} onChange={(e) => setSingleStatus(e.target.checked ? "Active" : "Inactive")} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_transport_allocation">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Transport Allocation</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={saveSingleAllocation}>
              <div className="modal-body">{/* same fields as add */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">User Type</label>
                    <CommonSelect className="select" options={[{ value: "student", label: "Student" }, { value: "staff", label: "Staff" }]} value={singleUserType} isDisabled={isEditMode} onChange={(v: string | null) => { setSingleUserType(v || "student"); setSingleUserId(""); }} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">User</label>
                    <CommonSelect className="select" options={singleUserOptions} value={singleUserId} isDisabled={isEditMode} onChange={(v: string | null) => setSingleUserId(v || "")} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Pickup Point</label>
                    <CommonSelect
                      className="select"
                      options={pickupPoints.map((p: any) => ({ value: String(p.id), label: p.point_name }))}
                      value={singlePickupPointId}
                      onChange={(v: string | null) => {
                        setSinglePickupPointId(v || "");
                        setSingleRouteId("");
                        setSingleVehicleId("");
                        setSingleAssignedFeeId("");
                      }}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Route (for selected pickup)</label>
                    <CommonSelect
                      className="select"
                      options={singleAvailableRoutes.map((r: any) => ({ value: String(r.id), label: r.route_name }))}
                      value={singleRouteId}
                      onChange={(v: string | null) => {
                        setSingleRouteId(v || "");
                        setSingleVehicleId("");
                      }}
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Vehicle (for selected route)</label>
                    <CommonSelect className="select" options={singleAvailableVehicles.map((v: any) => ({ value: String(v.id), label: `${v.vehicle_number} (${v.seat_capacity || v.seating_capacity || 0})` }))} value={singleVehicleId} onChange={(v: string | null) => setSingleVehicleId(v || "")} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Start Date</label>
                    <DatePicker
                      className="form-control datetimepicker"
                      format="DD MMM YYYY"
                      value={singleStartDate ? dayjs(singleStartDate) : null}
                      onChange={(d) => setSingleStartDate(d ? d.format("YYYY-MM-DD") : "")}
                    />
                  </div>
                </div>
                {singleUserType === "staff" && (
                  <div className="mb-3">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="edit_single_is_free_allocation" checked={singleIsFree} onChange={(e) => setSingleIsFree(e.target.checked)} />
                      <label className="form-check-label" htmlFor="edit_single_is_free_allocation">Mark as free allocation</label>
                    </div>
                  </div>
                )}
                {!singleIsFree && (
                  <div className="mb-3">
                    <label className="form-label">Fee Plan</label>
                    <CommonSelect className="select" options={filteredSingleFees.map((f: any) => ({ value: String(f.id), label: feeLabel(f, singleUserType) }))} value={singleAssignedFeeId} onChange={(v: string | null) => setSingleAssignedFeeId(v || "")} />
                  </div>
                )}
                <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                  <div className="status-title">
                    <h5>Status</h5>
                    <label className="form-label mb-0" htmlFor="edit_single_allocation_status_toggle">{singleStatus}</label>
                  </div>
                  <div className="form-check form-switch">
                    <input id="edit_single_allocation_status_toggle" className="form-check-input" type="checkbox" checked={singleStatus === "Active"} onChange={(e) => setSingleStatus(e.target.checked ? "Active" : "Inactive")} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_transport_allocation_bulk">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Bulk Transport Allocation</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={saveBulkAllocation}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-12 mb-3">
                    <label className="form-label">User Type</label>
                    <CommonSelect className="select" options={[{ value: "student", label: "Student" }, { value: "staff", label: "Staff" }]} value={bulkUserType} onChange={(v: string | null) => { setBulkUserType(v || "student"); setBulkSelectedUserIds([]); setBulkClassFilter("all"); setBulkSectionFilter("all"); setBulkDepartmentFilter("all"); }} />
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Pickup Point</label>
                    <CommonSelect
                      className="select"
                      options={pickupPoints.map((p: any) => ({ value: String(p.id), label: p.point_name }))}
                      value={bulkPickupPointId}
                      onChange={(v: string | null) => {
                        setBulkPickupPointId(v || "");
                        setBulkRouteId("");
                        setBulkVehicleId("");
                        setBulkAssignedFeeId("");
                      }}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Route (for selected pickup)</label>
                    <CommonSelect
                      className="select"
                      options={bulkAvailableRoutes.map((r: any) => ({ value: String(r.id), label: r.route_name }))}
                      value={bulkRouteId}
                      onChange={(v: string | null) => {
                        setBulkRouteId(v || "");
                        setBulkVehicleId("");
                      }}
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Start Date</label>
                    <DatePicker
                      className="form-control datetimepicker"
                      format="DD MMM YYYY"
                      value={bulkStartDate ? dayjs(bulkStartDate) : null}
                      onChange={(d) => setBulkStartDate(d ? d.format("YYYY-MM-DD") : "")}
                    />
                  </div>
                </div>
                {bulkUserType === "staff" && (
                  <div className="mb-3">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="bulk_is_free" checked={bulkIsFree} onChange={(e) => setBulkIsFree(e.target.checked)} />
                      <label className="form-check-label" htmlFor="bulk_is_free">Mark as free allocation</label>
                    </div>
                  </div>
                )}
                {!bulkIsFree && (
                  <div className="mb-3">
                    <label className="form-label">Fee Plan</label>
                    <CommonSelect className="select" options={filteredBulkFees.map((f: any) => ({ value: String(f.id), label: feeLabel(f, bulkUserType) }))} value={bulkAssignedFeeId} onChange={(v: string | null) => setBulkAssignedFeeId(v || "")} />
                  </div>
                )}

                <div className="row">
                  <div className={bulkUserType === "student" ? "col-md-4 mb-3" : "col-md-6 mb-3"}>
                    <label className="form-label">Search User</label>
                    <input className="form-control" value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} placeholder="Search users..." />
                  </div>
                  {bulkUserType === "student" ? (
                    <>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Class Filter</label>
                        <CommonSelect className="select" options={[{ value: "all", label: "All Classes" }, ...bulkClasses.map((c: any) => ({ value: c, label: c }))]} value={bulkClassFilter} onChange={(v: string | null) => { setBulkClassFilter(v || "all"); setBulkSectionFilter("all"); }} />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Section Filter</label>
                        <CommonSelect className="select" options={[{ value: "all", label: "All Sections" }, ...bulkSections.map((s: any) => ({ value: s, label: s }))]} value={bulkSectionFilter} onChange={(v: string | null) => setBulkSectionFilter(v || "all")} />
                      </div>
                    </>
                  ) : (
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Department Filter</label>
                      <CommonSelect className="select" options={[{ value: "all", label: "All Departments" }, ...bulkDepartments.map((d: any) => ({ value: d, label: d }))]} value={bulkDepartmentFilter} onChange={(v: string | null) => setBulkDepartmentFilter(v || "all")} />
                    </div>
                  )}
                </div>

                <div className="table-responsive border rounded" style={{ maxHeight: "250px", overflowY: "auto" }}>
                  <table className="table mb-0">
                    <thead className="thead-light">
                      <tr>
                        <th style={{ width: "50px" }}>
                          <input
                            type="checkbox"
                            checked={bulkFilteredUsers.length > 0 && bulkSelectedUserIds.length === bulkFilteredUsers.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBulkSelectedUserIds(bulkFilteredUsers.map((u: any) => Number(u.id)));
                              } else {
                                setBulkSelectedUserIds([]);
                              }
                            }}
                          />
                        </th>
                        <th>Name</th>
                        <th>{bulkUserType === "student" ? "Admission No" : "Employee Code"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkFilteredUsers.map((u: any) => {
                        const uid = Number(u.id);
                        const checked = bulkSelectedUserIds.includes(uid);
                        return (
                          <tr key={uid}>
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) setBulkSelectedUserIds((prev) => [...prev, uid]);
                                  else setBulkSelectedUserIds((prev) => prev.filter((id) => id !== uid));
                                }}
                              />
                            </td>
                            <td>{`${u.first_name || ""} ${u.last_name || ""}`.trim() || "N/A"}</td>
                            <td>{bulkUserType === "student" ? (u.admission_number || "-") : (u.employee_code || "-")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2">
                  <span className="badge bg-soft-primary">{bulkSelectedUserIds.length} users selected</span>
                </div>

                <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                  <div className="status-title">
                    <h5>Status</h5>
                    <label className="form-label mb-0" htmlFor="bulk_status_toggle">{bulkStatus}</label>
                  </div>
                  <div className="form-check form-switch">
                    <input id="bulk_status_toggle" className="form-check-input" type="checkbox" checked={bulkStatus === "Active"} onChange={(e) => setBulkStatus(e.target.checked ? "Active" : "Inactive")} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Allocate Selected Users"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="delete-transport-allocation-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon"><i className="ti ti-trash-x" /></span>
              <h4>Close Allocation</h4>
              <p>This will mark the allocation inactive and set end date.</p>
              <div className="d-flex justify-content-center">
                <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">Cancel</Link>
                <Link to="#" className="btn btn-danger" onClick={deleteAllocation}>{loading ? "Closing..." : "Yes, Close"}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransportAllocationModal;
