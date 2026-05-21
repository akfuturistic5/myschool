import { useCallback, useEffect, useMemo, useState } from "react";
import CommonSelect from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import { HostelRecordStatusToggle } from "./hostelUiUtils";
import Swal from "sweetalert2";

const HOSTEL_TYPE_OPTIONS = [
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "mixed", label: "Mixed" },
];

const HOSTEL_CATEGORY_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
];

const ROOM_STATUS_SELECT = [
  { value: "available", label: "Available" },
  { value: "full", label: "Full" },
  { value: "maintenance", label: "Maintenance" },
  { value: "blocked", label: "Blocked" },
];

export type SelectOption = { value: string; label: string };

interface HostelModalProps {
  selectedHostel?: any;
  selectedRoom?: any;
  selectedRoomType?: any;
  onSuccess?: () => void;
  hostelSelectOptions?: SelectOption[];
  roomTypeSelectOptions?: SelectOption[];
  formResetKey?: number;
}

const hideBsModal = (id: string) => {
  const modalElement = document.getElementById(id);
  if (!modalElement) return;
  const bootstrap = (window as any).bootstrap;
  if (bootstrap?.Modal) {
    const inst = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    inst.hide();
  }
};

const HostelModal = ({
  selectedHostel,
  selectedRoom,
  selectedRoomType,
  onSuccess,
  hostelSelectOptions = [],
  roomTypeSelectOptions = [],
  formResetKey = 0,
}: HostelModalProps) => {
  const [wardenStaffOptions, setWardenStaffOptions] = useState<SelectOption[]>([]);

  const [addHostelName, setAddHostelName] = useState("");
  const [addHostelType, setAddHostelType] = useState<string | null>("boys");
  const [addHostelIntake, setAddHostelIntake] = useState("");
  const [addHostelAddress, setAddHostelAddress] = useState("");
  const [addHostelDesc, setAddHostelDesc] = useState("");
  const [addHostelFacilities, setAddHostelFacilities] = useState("");
  const [addHostelRules, setAddHostelRules] = useState("");
  const [addHostelCategory, setAddHostelCategory] = useState<string>("student");
  const [addHostelCode, setAddHostelCode] = useState("");
  const [addHostelFloorsCount, setAddHostelFloorsCount] = useState("1");
  const [addHostelContact, setAddHostelContact] = useState("");
  const [addHostelEmail, setAddHostelEmail] = useState("");
  const [addHostelWarden, setAddHostelWarden] = useState("");
  const [addHostelActive, setAddHostelActive] = useState(true);
  const [addHostelSaving, setAddHostelSaving] = useState(false);

  const [editHostelName, setEditHostelName] = useState("");
  const [editHostelType, setEditHostelType] = useState<string | null>(null);
  const [editHostelCategory, setEditHostelCategory] = useState<string>("student");
  const [editHostelCode, setEditHostelCode] = useState("");
  const [editHostelIntake, setEditHostelIntake] = useState("");
  const [editHostelAddress, setEditHostelAddress] = useState("");
  const [editHostelDesc, setEditHostelDesc] = useState("");
  const [editHostelFacilities, setEditHostelFacilities] = useState("");
  const [editHostelRules, setEditHostelRules] = useState("");
  const [editHostelFloorsCount, setEditHostelFloorsCount] = useState("1");
  const [editHostelContact, setEditHostelContact] = useState("");
  const [editHostelEmail, setEditHostelEmail] = useState("");
  const [editHostelWarden, setEditHostelWarden] = useState("");
  const [editHostelActive, setEditHostelActive] = useState(true);
  const [editHostelSaving, setEditHostelSaving] = useState(false);

  const [addRoomNo, setAddRoomNo] = useState("");
  const [addRoomHostelId, setAddRoomHostelId] = useState<string | null>(null);
  const [addRoomFloorId, setAddRoomFloorId] = useState<string | null>(null);
  const [addRoomFloorOptions, setAddRoomFloorOptions] = useState<SelectOption[]>([]);
  const [addRoomTypeId, setAddRoomTypeId] = useState<string | null>(null);
  const [addRoomCost, setAddRoomCost] = useState("");
  const [addRoomNotes, setAddRoomNotes] = useState("");
  const [addRoomStatus, setAddRoomStatus] = useState("available");
  const [addRoomActive, setAddRoomActive] = useState(true);
  const [addRoomSaving, setAddRoomSaving] = useState(false);

  const [editRoomNo, setEditRoomNo] = useState("");
  const [editRoomHostelId, setEditRoomHostelId] = useState<string | null>(null);
  const [editRoomFloorId, setEditRoomFloorId] = useState<string | null>(null);
  const [editRoomFloorOptions, setEditRoomFloorOptions] = useState<SelectOption[]>([]);
  const [editRoomTypeId, setEditRoomTypeId] = useState<string | null>(null);
  const [editRoomCost, setEditRoomCost] = useState("");
  const [editRoomNotes, setEditRoomNotes] = useState("");
  const [editRoomStatus, setEditRoomStatus] = useState("available");
  const [editRoomActive, setEditRoomActive] = useState(true);
  const [editRoomSaving, setEditRoomSaving] = useState(false);

  const [addRtName, setAddRtName] = useState("");
  const [addRtDesc, setAddRtDesc] = useState("");
  const [addRtCapacity, setAddRtCapacity] = useState("2");
  const [addRtHasAc, setAddRtHasAc] = useState(false);
  const [addRtHasWifi, setAddRtHasWifi] = useState(false);
  const [addRtHasBath, setAddRtHasBath] = useState(false);
  const [addRtActive, setAddRtActive] = useState(true);
  const [addRtSaving, setAddRtSaving] = useState(false);

  const [editRtName, setEditRtName] = useState("");
  const [editRtDesc, setEditRtDesc] = useState("");
  const [editRtCapacity, setEditRtCapacity] = useState("2");
  const [editRtBedType, setEditRtBedType] = useState("single");
  const [editRtHasAc, setEditRtHasAc] = useState(false);
  const [editRtHasWifi, setEditRtHasWifi] = useState(false);
  const [editRtHasBath, setEditRtHasBath] = useState(false);
  const [editRtActive, setEditRtActive] = useState(true);
  const [editRtSaving, setEditRtSaving] = useState(false);

  const listStaffFromResponse = (res: unknown): any[] => {
    if (res == null || typeof res !== "object") return [];
    const r = res as Record<string, unknown>;
    if (r.status === "ERROR" || r.success === false) return [];
    const d = r.data;
    return Array.isArray(d) ? d : [];
  };

  const isWardenStaffRow = (s: Record<string, unknown>, wardenRoleId: number | null) => {
    const roleName = String(s.user_role_name ?? s.role_name ?? "")
      .trim()
      .toLowerCase();
    if (roleName === "warden") return true;
    const rid = s.role_id != null ? Number(s.role_id) : null;
    return wardenRoleId != null && rid != null && !Number.isNaN(rid) && rid === wardenRoleId;
  };

  const loadWardenStaff = useCallback(async () => {
    try {
      const [staffRes, rolesRes] = await Promise.all([
        apiService.getStaff(),
        apiService.getUserRoles(),
      ]);
      const rows = listStaffFromResponse(staffRes);
      let wardenRoleId: number | null = null;
      const rolesPayload = rolesRes as { status?: string; data?: { id?: number; role_name?: string }[] };
      if (rolesPayload?.status === "SUCCESS" && Array.isArray(rolesPayload.data)) {
        const wardenRole = rolesPayload.data.find(
          (r) => String(r.role_name ?? "").trim().toLowerCase() === "warden"
        );
        if (wardenRole?.id != null) wardenRoleId = Number(wardenRole.id);
      }
      const opts: SelectOption[] = rows
        .filter(
          (s: any) =>
            s.user_id != null &&
            String(s.user_id).trim() !== "" &&
            isWardenStaffRow(s, wardenRoleId)
        )
        .map((s: any) => ({
          value: String(s.user_id),
          label:
            [s.first_name, s.last_name].filter(Boolean).join(" ").trim() ||
            (s.employee_code ? String(s.employee_code) : `User #${s.user_id}`),
        }));
      setWardenStaffOptions(opts);
    } catch {
      setWardenStaffOptions([]);
    }
  }, []);

  useEffect(() => {
    void loadWardenStaff();
  }, [loadWardenStaff]);

  const wardenOptionsForAdd = useMemo(
    () => [{ value: "", label: "No warden" }, ...wardenStaffOptions],
    [wardenStaffOptions]
  );

  const wardenOptionsForEdit = useMemo(() => {
    const head: SelectOption[] = [{ value: "", label: "No warden" }];
    const uid = editHostelWarden.trim();
    const merged = [...wardenStaffOptions];
    if (uid && !merged.some((o) => o.value === uid)) {
      merged.unshift({ value: uid, label: `Warden (user #${uid})` });
    }
    return [...head, ...merged];
  }, [wardenStaffOptions, editHostelWarden]);

  useEffect(() => {
    setAddHostelName("");
    setAddHostelType("boys");
    setAddHostelIntake("");
    setAddHostelAddress("");
    setAddHostelDesc("");
    setAddHostelFacilities("");
    setAddHostelRules("");
    setAddHostelCategory("student");
    setAddHostelCode("");
    setAddHostelFloorsCount("1");
    setAddHostelContact("");
    setAddHostelEmail("");
    setAddHostelWarden("");
    setAddHostelActive(true);
    setAddRoomNo("");
    setAddRoomHostelId(null);
    setAddRoomFloorId(null);
    setAddRoomFloorOptions([]);
    setAddRoomTypeId(null);
    setAddRoomCost("");
    setAddRoomNotes("");
    setAddRoomStatus("available");
    setAddRoomActive(true);
    setAddRtName("");
    setAddRtDesc("");
    setAddRtCapacity("2");
    setAddRtHasAc(false);
    setAddRtHasWifi(false);
    setAddRtHasBath(false);
    setAddRtActive(true);
  }, [formResetKey]);

  useEffect(() => {
    const h = selectedHostel?.originalData || selectedHostel;
    if (!h?.id && !selectedHostel?.dbId) {
      return;
    }
    setEditHostelName(h.hostel_name || selectedHostel?.hostelName || "");
    const t = (h.gender || h.hostel_type || "").toString().toLowerCase();
    setEditHostelType(["boys", "girls", "mixed"].includes(t) ? t : "boys");
    const hc = (h.hostel_category || "student").toString().toLowerCase();
    setEditHostelCategory(hc === "staff" ? "staff" : "student");
    setEditHostelCode(h.code != null ? String(h.code) : "");
    const intake =
      h.intake_capacity ??
      h.intake ??
      h.total_rooms ??
      (selectedHostel?.inTake && selectedHostel.inTake !== "N/A" ? selectedHostel.inTake : "");
    setEditHostelIntake(intake !== "" && intake != null ? String(intake) : "");
    setEditHostelAddress(h.address || selectedHostel?.address || "");
    setEditHostelDesc(h.description != null ? String(h.description) : "");
    setEditHostelFacilities(h.facilities != null ? String(h.facilities) : "");
    setEditHostelRules(h.rules != null ? String(h.rules) : "");
    setEditHostelFloorsCount(
      h.total_floors != null && h.total_floors !== "" ? String(h.total_floors) : "1"
    );
    setEditHostelContact(h.contact_number != null ? String(h.contact_number) : "");
    setEditHostelEmail(h.email != null ? String(h.email) : "");
    setEditHostelWarden(h.warden_user_id != null ? String(h.warden_user_id) : "");
    setEditHostelActive(h.is_active !== false && h.is_active !== 0);
  }, [selectedHostel]);

  useEffect(() => {
    let cancelled = false;
    if (!addRoomHostelId) {
      setAddRoomFloorOptions([]);
      setAddRoomFloorId(null);
      return undefined;
    }
    (async () => {
      try {
        const res = await apiService.getHostelFloors(Number(addRoomHostelId));
        const raw = res?.data ?? (Array.isArray(res) ? res : []);
        const rows = Array.isArray(raw) ? raw : [];
        const opts: SelectOption[] = rows.map((f: any) => ({
          value: String(f.id),
          label: `${f.floor_name} (#${f.floor_number})`,
        }));
        if (cancelled) return;
        setAddRoomFloorOptions(opts);
        setAddRoomFloorId((prev) =>
          prev && opts.some((o) => o.value === prev) ? prev : opts[0]?.value ?? null
        );
      } catch {
        if (!cancelled) {
          setAddRoomFloorOptions([]);
          setAddRoomFloorId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addRoomHostelId]);

  useEffect(() => {
    let cancelled = false;
    if (!editRoomHostelId) {
      setEditRoomFloorOptions([]);
      setEditRoomFloorId(null);
      return undefined;
    }
    (async () => {
      try {
        const res = await apiService.getHostelFloors(Number(editRoomHostelId));
        const raw = res?.data ?? (Array.isArray(res) ? res : []);
        const rows = Array.isArray(raw) ? raw : [];
        const opts: SelectOption[] = rows.map((f: any) => ({
          value: String(f.id),
          label: `${f.floor_name} (#${f.floor_number})`,
        }));
        if (cancelled) return;
        setEditRoomFloorOptions(opts);
        const r = selectedRoom?.originalData || selectedRoom;
        const preferred =
          r?.hostel_id != null &&
          Number(r.hostel_id) === Number(editRoomHostelId) &&
          r?.floor_id != null
            ? String(r.floor_id)
            : null;
        setEditRoomFloorId((cur) => {
          if (preferred && opts.some((o) => o.value === preferred)) return preferred;
          if (cur && opts.some((o) => o.value === cur)) return cur;
          return opts[0]?.value ?? null;
        });
      } catch {
        if (!cancelled) {
          setEditRoomFloorOptions([]);
          setEditRoomFloorId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editRoomHostelId, selectedRoom]);

  useEffect(() => {
    const r = selectedRoom?.originalData || selectedRoom;
    if (!r?.id && !selectedRoom?.dbId) return;
    setEditRoomNo(String(r.room_number ?? selectedRoom?.roomNo ?? ""));
    setEditRoomHostelId(r.hostel_id != null ? String(r.hostel_id) : null);
    setEditRoomTypeId(
      r.hostel_room_type_id != null
        ? String(r.hostel_room_type_id)
        : r.room_type_id != null
          ? String(r.room_type_id)
          : null
    );
    const cost = r.monthly_rent ?? r.monthly_fee ?? r.monthly_fees;
    setEditRoomCost(
      cost != null && cost !== ""
        ? String(typeof cost === "number" ? cost : String(cost).replace(/[^\d.]/g, ""))
        : ""
    );
    setEditRoomNotes(r.notes != null ? String(r.notes) : "");
    const st = String(r.room_status ?? "available").toLowerCase();
    setEditRoomStatus(["available", "full", "maintenance", "blocked"].includes(st) ? st : "available");
    setEditRoomActive(r.is_active !== false && r.is_active !== 0);
  }, [selectedRoom]);

  useEffect(() => {
    const rt = selectedRoomType?.originalData || selectedRoomType;
    if (!rt?.id && !selectedRoomType?.dbId) return;
    setEditRtName(rt.name || rt.room_type || selectedRoomType?.roomType || "");
    setEditRtDesc(rt.description && rt.description !== "N/A" ? rt.description : "");
    setEditRtCapacity(
      rt.sharing_capacity != null && rt.sharing_capacity !== "" ? String(rt.sharing_capacity) : "2"
    );
    setEditRtHasAc(Boolean(rt.has_ac));
    setEditRtHasWifi(Boolean(rt.has_wifi));
    setEditRtHasBath(Boolean(rt.has_attached_bathroom));
    setEditRtActive(rt.is_active !== false && rt.is_active !== 0);
  }, [selectedRoomType]);

  const hostelIdForEdit = selectedHostel?.originalData?.id ?? selectedHostel?.dbId;
  const roomIdForEdit = selectedRoom?.originalData?.id ?? selectedRoom?.dbId;
  const roomTypeIdForEdit = selectedRoomType?.originalData?.id ?? selectedRoomType?.dbId;

  const saveAddHostel = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!addHostelName.trim()) {
      Swal.fire({ icon: "warning", title: "Hostel name is required" });
      return;
    }
    setAddHostelSaving(true);
    try {
      const body: Record<string, unknown> = {
        hostel_name: addHostelName.trim(),
        hostel_type: addHostelType || "boys",
        gender: addHostelType || "boys",
        hostel_category: addHostelCategory || "student",
        address: addHostelAddress.trim() || null,
        description: addHostelDesc.trim() || null,
        facilities: addHostelFacilities.trim() || null,
        rules: addHostelRules.trim() || null,
      };
      if (addHostelCode.trim() !== "") body.code = addHostelCode.trim().toUpperCase();
      if (addHostelFloorsCount.trim() !== "") {
        const f = Number(addHostelFloorsCount);
        if (!Number.isNaN(f)) body.total_floors = f;
      }
      if (addHostelContact.trim() !== "") body.contact_number = addHostelContact.trim();
      if (addHostelEmail.trim() !== "") body.email = addHostelEmail.trim();
      if (addHostelWarden.trim() !== "") {
        const w = Number(addHostelWarden);
        if (!Number.isNaN(w)) body.warden_user_id = w;
      }
      if (addHostelIntake.trim() !== "") {
        const n = Number(addHostelIntake);
        if (!Number.isNaN(n)) body.intake_capacity = n;
      }
      body.is_active = addHostelActive;
      const res = await apiService.createHostel(body);
      if (res?.status === "SUCCESS" || res?.success) {
        hideBsModal("add_hostel");
        onSuccess?.();
        Swal.fire({ icon: "success", title: "Hostel added", timer: 1400, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed to add hostel" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed to add hostel" });
    } finally {
      setAddHostelSaving(false);
    }
  };

  const saveEditHostel = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!hostelIdForEdit) return;
    if (!editHostelName.trim()) {
      Swal.fire({ icon: "warning", title: "Hostel name is required" });
      return;
    }
    setEditHostelSaving(true);
    try {
      const body: Record<string, unknown> = {
        hostel_name: editHostelName.trim(),
        hostel_type: editHostelType || "boys",
        gender: editHostelType || "boys",
        hostel_category: editHostelCategory || "student",
        address: editHostelAddress.trim() || null,
        description: editHostelDesc.trim() || null,
        facilities: editHostelFacilities.trim() || null,
        rules: editHostelRules.trim() || null,
      };
      if (editHostelCode.trim() !== "") body.code = editHostelCode.trim().toUpperCase();
      {
        const f = Number(editHostelFloorsCount);
        body.total_floors = !Number.isNaN(f) && f >= 1 ? f : 1;
      }
      body.contact_number = editHostelContact.trim() || null;
      body.email = editHostelEmail.trim() || null;
      if (editHostelWarden.trim() === "") {
        body.warden_user_id = null;
      } else {
        const w = Number(editHostelWarden);
        if (!Number.isNaN(w)) body.warden_user_id = w;
      }
      if (editHostelIntake.trim() === "") {
        body.intake_capacity = null;
      } else {
        const n = Number(editHostelIntake);
        if (!Number.isNaN(n)) body.intake_capacity = n;
      }
      body.is_active = editHostelActive;
      const res = await apiService.updateHostel(hostelIdForEdit, body);
      if (res?.status === "SUCCESS" || res?.success) {
        hideBsModal("edit_hostel");
        onSuccess?.();
        Swal.fire({ icon: "success", title: "Hostel updated", timer: 1400, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed to update" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed to update" });
    } finally {
      setEditHostelSaving(false);
    }
  };

  const saveAddRoom = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!addRoomNo.trim() || !addRoomHostelId || !addRoomTypeId) {
      Swal.fire({ icon: "warning", title: "Room number, hostel, and room type are required" });
      return;
    }
    setAddRoomSaving(true);
    try {
      const body: Record<string, unknown> = {
        room_number: addRoomNo.trim(),
        hostel_id: Number(addRoomHostelId),
        hostel_room_type_id: Number(addRoomTypeId),
      };
      if (addRoomCost.trim() !== "") {
        const c = Number(addRoomCost.replace(/[^\d.]/g, ""));
        if (!Number.isNaN(c)) body.monthly_rent = c;
      }
      if (addRoomNotes.trim() !== "") body.notes = addRoomNotes.trim();
      if (addRoomStatus) body.room_status = addRoomStatus;
      if (addRoomFloorId) {
        body.floor_id = Number(addRoomFloorId);
      }
      body.is_active = addRoomActive;
      const res = await apiService.createHostelRoom(body);
      if (res?.status === "SUCCESS" || res?.success) {
        hideBsModal("add_hostel_rooms");
        onSuccess?.();
        Swal.fire({ icon: "success", title: "Room added", timer: 1400, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed to add room" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed to add room" });
    } finally {
      setAddRoomSaving(false);
    }
  };

  const saveEditRoom = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!roomIdForEdit) return;
    if (!editRoomNo.trim() || !editRoomHostelId || !editRoomTypeId) {
      Swal.fire({ icon: "warning", title: "Room number, hostel, and room type are required" });
      return;
    }
    setEditRoomSaving(true);
    try {
      const body: Record<string, unknown> = {
        room_number: editRoomNo.trim(),
        hostel_id: Number(editRoomHostelId),
        hostel_room_type_id: Number(editRoomTypeId),
      };
      if (editRoomCost.trim() !== "") {
        const c = Number(editRoomCost.replace(/[^\d.]/g, ""));
        if (!Number.isNaN(c)) body.monthly_rent = c;
      }
      body.notes = editRoomNotes.trim() || null;
      body.room_status = editRoomStatus;
      if (editRoomFloorId) {
        body.floor_id = Number(editRoomFloorId);
      }
      body.is_active = editRoomActive;
      const res = await apiService.updateHostelRoom(roomIdForEdit, body);
      if (res?.status === "SUCCESS" || res?.success) {
        hideBsModal("edit_hostel_rooms");
        onSuccess?.();
        Swal.fire({ icon: "success", title: "Room updated", timer: 1400, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed to update room" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed to update room" });
    } finally {
      setEditRoomSaving(false);
    }
  };

  const saveAddRoomType = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!addRtName.trim()) {
      Swal.fire({ icon: "warning", title: "Room type name is required" });
      return;
    }
    setAddRtSaving(true);
    try {
      const cap = Number(addRtCapacity);
      const res = await apiService.createHostelRoomType({
        name: addRtName.trim(),
        description: addRtDesc.trim() || null,
        sharing_capacity: !Number.isNaN(cap) && cap >= 1 ? cap : 2,
        has_ac: addRtHasAc,
        has_wifi: addRtHasWifi,
        has_attached_bathroom: addRtHasBath,
        is_active: addRtActive,
      });
      if (res?.status === "SUCCESS" || res?.success) {
        hideBsModal("add_hostel_room_type");
        onSuccess?.();
        Swal.fire({ icon: "success", title: "Room type added", timer: 1400, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed to add" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed to add" });
    } finally {
      setAddRtSaving(false);
    }
  };

  const saveEditRoomType = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!roomTypeIdForEdit) return;
    if (!editRtName.trim()) {
      Swal.fire({ icon: "warning", title: "Room type name is required" });
      return;
    }
    setEditRtSaving(true);
    try {
      const cap = Number(editRtCapacity);
      const res = await apiService.updateHostelRoomType(roomTypeIdForEdit, {
        name: editRtName.trim(),
        description: editRtDesc.trim() || null,
        sharing_capacity: !Number.isNaN(cap) && cap >= 1 ? cap : 2,
        has_ac: editRtHasAc,
        has_wifi: editRtHasWifi,
        has_attached_bathroom: editRtHasBath,
        is_active: editRtActive,
      });
      if (res?.status === "SUCCESS" || res?.success) {
        hideBsModal("edit_hostel_room_type");
        onSuccess?.();
        Swal.fire({ icon: "success", title: "Room type updated", timer: 1400, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "error", title: res?.message || "Failed to update" });
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Failed to update" });
    } finally {
      setEditRtSaving(false);
    }
  };

  return (
    <>
      <div className="modal fade" id="add_hostel_rooms">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Hostel Room</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-0">
                Choose hostel first to load floors. Room type sets sharing capacity; beds are managed on the Hostel Beds page.
              </p>
              <div className="row g-3 mt-2">
                <div className="col-12 col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Room No</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addRoomNo}
                      onChange={(e) => setAddRoomNo(e.target.value)}
                      placeholder="e.g. 101"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Hostel</label>
                    <CommonSelect
                      className="select"
                      options={hostelSelectOptions}
                      value={addRoomHostelId || undefined}
                      onChange={(v) => setAddRoomHostelId(v)}
                      placeholder="Select hostel"
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Floor</label>
                    <CommonSelect
                      className="select"
                      options={addRoomFloorOptions}
                      value={addRoomFloorId || undefined}
                      onChange={(v) => setAddRoomFloorId(v ?? null)}
                      placeholder={addRoomHostelId ? "Select floor" : "Select hostel first"}
                    />
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Room type</label>
                    <CommonSelect
                      className="select"
                      options={roomTypeSelectOptions}
                      value={addRoomTypeId || undefined}
                      onChange={(v) => setAddRoomTypeId(v)}
                      placeholder="Select room type"
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="form-label">Monthly rent</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Amount"
                        value={addRoomCost}
                        onChange={(e) => setAddRoomCost(e.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label">Room state</label>
                      <CommonSelect
                        className="select"
                        options={ROOM_STATUS_SELECT}
                        value={addRoomStatus}
                        onChange={(v) => setAddRoomStatus(v || "available")}
                        placeholder="Status"
                      />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-top">
                    <HostelRecordStatusToggle
                      id="add_hostel_room_status"
                      checked={addRoomActive}
                      onChange={setAddRoomActive}
                    />
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={addRoomNotes}
                    onChange={(e) => setAddRoomNotes(e.target.value)}
                    placeholder="Optional internal notes"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={addRoomSaving} onClick={saveAddRoom}>
                {addRoomSaving ? "Saving..." : "Add Hostel Room"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_hostel_rooms">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Hostel Room</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-0">
                Changing hostel reloads floors. Occupancy and beds are updated from assignments and the Beds screen.
              </p>
              <div className="row g-3 mt-2">
                <div className="col-12 col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Room No</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editRoomNo}
                      onChange={(e) => setEditRoomNo(e.target.value)}
                      placeholder="e.g. 101"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Hostel</label>
                    <CommonSelect
                      className="select"
                      options={hostelSelectOptions}
                      value={editRoomHostelId || undefined}
                      onChange={(v) => setEditRoomHostelId(v)}
                      placeholder="Select hostel"
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Floor</label>
                    <CommonSelect
                      className="select"
                      options={editRoomFloorOptions}
                      value={editRoomFloorId || undefined}
                      onChange={(v) => setEditRoomFloorId(v ?? null)}
                      placeholder={editRoomHostelId ? "Select floor" : "Select hostel first"}
                    />
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Room type</label>
                    <CommonSelect
                      className="select"
                      options={roomTypeSelectOptions}
                      value={editRoomTypeId || undefined}
                      onChange={(v) => setEditRoomTypeId(v)}
                      placeholder="Select room type"
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="form-label">Monthly rent</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editRoomCost}
                        onChange={(e) => setEditRoomCost(e.target.value)}
                        placeholder="Amount"
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label">Room state</label>
                      <CommonSelect
                        className="select"
                        options={ROOM_STATUS_SELECT}
                        value={editRoomStatus}
                        onChange={(v) => setEditRoomStatus(v || "available")}
                        placeholder="Status"
                      />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-top">
                    <HostelRecordStatusToggle
                      id="edit_hostel_room_status"
                      checked={editRoomActive}
                      onChange={setEditRoomActive}
                    />
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={editRoomNotes}
                    onChange={(e) => setEditRoomNotes(e.target.value)}
                    placeholder="Optional internal notes"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={editRoomSaving} onClick={saveEditRoom}>
                {editRoomSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_hostel_room_type">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Room Type</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Room Type</label>
                  <input
                    type="text"
                    className="form-control"
                    value={addRtName}
                    onChange={(e) => setAddRtName(e.target.value)}
                    placeholder="e.g. Double sharing"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Sharing capacity (beds per room)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="form-control"
                    value={addRtCapacity}
                    onChange={(e) => setAddRtCapacity(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label d-block mb-2">Amenities</label>
                  <div className="d-flex flex-wrap gap-3">
                    <label className="form-check-label d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={addRtHasAc}
                        onChange={(e) => setAddRtHasAc(e.target.checked)}
                      />
                      AC
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={addRtHasWifi}
                        onChange={(e) => setAddRtHasWifi(e.target.checked)}
                      />
                      Wi‑Fi
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={addRtHasBath}
                        onChange={(e) => setAddRtHasBath(e.target.checked)}
                      />
                      Attached bath
                    </label>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={addRtDesc}
                    onChange={(e) => setAddRtDesc(e.target.value)}
                    placeholder="Optional details for staff"
                  />
                </div>
                <div className="col-12 border-top pt-3 mt-1">
                  <HostelRecordStatusToggle
                    id="add_hostel_room_type_status"
                    checked={addRtActive}
                    onChange={setAddRtActive}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={addRtSaving} onClick={saveAddRoomType}>
                {addRtSaving ? "Saving..." : "Add Room Type"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_hostel_room_type">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Room Type</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12 col-md-8">
                  <label className="form-label">Room Type</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editRtName}
                    onChange={(e) => setEditRtName(e.target.value)}
                    placeholder="e.g. Double sharing"
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Sharing capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="form-control"
                    value={editRtCapacity}
                    onChange={(e) => setEditRtCapacity(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label d-block mb-2">Amenities</label>
                  <div className="d-flex flex-wrap gap-3">
                    <label className="form-check-label d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={editRtHasAc}
                        onChange={(e) => setEditRtHasAc(e.target.checked)}
                      />
                      AC
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={editRtHasWifi}
                        onChange={(e) => setEditRtHasWifi(e.target.checked)}
                      />
                      Wi‑Fi
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2 mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={editRtHasBath}
                        onChange={(e) => setEditRtHasBath(e.target.checked)}
                      />
                      Attached bath
                    </label>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={editRtDesc}
                    onChange={(e) => setEditRtDesc(e.target.value)}
                    placeholder="Optional details for staff"
                  />
                </div>
                <div className="col-12 border-top pt-3 mt-1">
                  <HostelRecordStatusToggle
                    id="edit_hostel_room_type_status"
                    checked={editRtActive}
                    onChange={setEditRtActive}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={editRtSaving} onClick={saveEditRoomType}>
                {editRtSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_hostel">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Hostel</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                Hostels are school-wide. Assignments to beds still use the academic year selected in the app header.
              </p>
              <div className="row">
                <div className="col-12">
                  <div className="mb-3">
                    <label className="form-label">Hostel name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addHostelName}
                      onChange={(e) => setAddHostelName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Category</label>
                    <CommonSelect
                      className="select"
                      options={HOSTEL_CATEGORY_OPTIONS}
                      value={addHostelCategory || undefined}
                      onChange={(v) => setAddHostelCategory(v || "student")}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Gender (hostel)</label>
                    <CommonSelect
                      className="select"
                      options={HOSTEL_TYPE_OPTIONS}
                      value={addHostelType || undefined}
                      onChange={(v) => setAddHostelType(v || "boys")}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Code (optional — auto if empty)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addHostelCode}
                      onChange={(e) => setAddHostelCode(e.target.value)}
                      placeholder="e.g. BOYS_A"
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Total floors (planned)</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={addHostelFloorsCount}
                      onChange={(e) => setAddHostelFloorsCount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Intake (student capacity)</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      value={addHostelIntake}
                      onChange={(e) => setAddHostelIntake(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Warden (staff login)</label>
                    <CommonSelect
                      className="select"
                      options={wardenOptionsForAdd}
                      value={addHostelWarden === "" ? "" : addHostelWarden}
                      onChange={(v) => setAddHostelWarden(v ?? "")}
                      placeholder={wardenStaffOptions.length ? "Select warden" : "No warden staff found"}
                    />
                  </div>
                </div>
                <div className="col-12">
                  <div className="mb-3">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addHostelAddress}
                      onChange={(e) => setAddHostelAddress(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Contact number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addHostelContact}
                      onChange={(e) => setAddHostelContact(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={addHostelEmail}
                      onChange={(e) => setAddHostelEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-12">
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={addHostelDesc}
                      onChange={(e) => setAddHostelDesc(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Facilities</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={addHostelFacilities}
                      onChange={(e) => setAddHostelFacilities(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Rules</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={addHostelRules}
                      onChange={(e) => setAddHostelRules(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-12 border-top pt-3 mt-1">
                  <HostelRecordStatusToggle
                    id="add_hostel_status"
                    checked={addHostelActive}
                    onChange={setAddHostelActive}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={addHostelSaving} onClick={saveAddHostel}>
                {addHostelSaving ? "Saving..." : "Add Hostel"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_hostel">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Hostel</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-12">
                  <div className="mb-3">
                    <label className="form-label">Hostel name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editHostelName}
                      onChange={(e) => setEditHostelName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Category</label>
                    <CommonSelect
                      className="select"
                      options={HOSTEL_CATEGORY_OPTIONS}
                      value={editHostelCategory || undefined}
                      onChange={(v) => setEditHostelCategory(v || "student")}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Gender (hostel)</label>
                    <CommonSelect
                      className="select"
                      options={HOSTEL_TYPE_OPTIONS}
                      value={editHostelType || undefined}
                      onChange={(v) => setEditHostelType(v || "boys")}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Code</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editHostelCode}
                      onChange={(e) => setEditHostelCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Total floors</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={editHostelFloorsCount}
                      onChange={(e) => setEditHostelFloorsCount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Intake (student capacity)</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      value={editHostelIntake}
                      onChange={(e) => setEditHostelIntake(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Warden (staff login)</label>
                    <CommonSelect
                      className="select"
                      options={wardenOptionsForEdit}
                      value={editHostelWarden === "" ? "" : editHostelWarden}
                      onChange={(v) => setEditHostelWarden(v ?? "")}
                      placeholder={wardenStaffOptions.length ? "Select warden" : "No warden staff found"}
                    />
                  </div>
                </div>
                <div className="col-12">
                  <div className="mb-3">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editHostelAddress}
                      onChange={(e) => setEditHostelAddress(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Contact number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editHostelContact}
                      onChange={(e) => setEditHostelContact(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editHostelEmail}
                      onChange={(e) => setEditHostelEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-12">
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={editHostelDesc}
                      onChange={(e) => setEditHostelDesc(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Facilities</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={editHostelFacilities}
                      onChange={(e) => setEditHostelFacilities(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Rules</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={editHostelRules}
                      onChange={(e) => setEditHostelRules(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-12 border-top pt-3 mt-1">
                  <HostelRecordStatusToggle
                    id="edit_hostel_status"
                    checked={editHostelActive}
                    onChange={setEditHostelActive}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={editHostelSaving} onClick={saveEditHostel}>
                {editHostelSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HostelModal;

