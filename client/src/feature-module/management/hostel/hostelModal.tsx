import { useEffect, useState } from "react";
import CommonSelect from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";

const HOSTEL_TYPE_OPTIONS = [
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "mixed", label: "Mixed" },
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
  const [addHostelName, setAddHostelName] = useState("");
  const [addHostelType, setAddHostelType] = useState<string | null>("boys");
  const [addHostelIntake, setAddHostelIntake] = useState("");
  const [addHostelAddress, setAddHostelAddress] = useState("");
  const [addHostelDesc, setAddHostelDesc] = useState("");
  const [addHostelSaving, setAddHostelSaving] = useState(false);

  const [editHostelName, setEditHostelName] = useState("");
  const [editHostelType, setEditHostelType] = useState<string | null>(null);
  const [editHostelIntake, setEditHostelIntake] = useState("");
  const [editHostelAddress, setEditHostelAddress] = useState("");
  const [editHostelDesc, setEditHostelDesc] = useState("");
  const [editHostelSaving, setEditHostelSaving] = useState(false);

  const [addRoomNo, setAddRoomNo] = useState("");
  const [addRoomHostelId, setAddRoomHostelId] = useState<string | null>(null);
  const [addRoomTypeId, setAddRoomTypeId] = useState<string | null>(null);
  const [addRoomBeds, setAddRoomBeds] = useState("");
  const [addRoomCost, setAddRoomCost] = useState("");
  const [addRoomSaving, setAddRoomSaving] = useState(false);

  const [editRoomNo, setEditRoomNo] = useState("");
  const [editRoomHostelId, setEditRoomHostelId] = useState<string | null>(null);
  const [editRoomTypeId, setEditRoomTypeId] = useState<string | null>(null);
  const [editRoomBeds, setEditRoomBeds] = useState("");
  const [editRoomCost, setEditRoomCost] = useState("");
  const [editRoomSaving, setEditRoomSaving] = useState(false);

  const [addRtName, setAddRtName] = useState("");
  const [addRtDesc, setAddRtDesc] = useState("");
  const [addRtSaving, setAddRtSaving] = useState(false);

  const [editRtName, setEditRtName] = useState("");
  const [editRtDesc, setEditRtDesc] = useState("");
  const [editRtSaving, setEditRtSaving] = useState(false);

  useEffect(() => {
    setAddHostelName("");
    setAddHostelType("boys");
    setAddHostelIntake("");
    setAddHostelAddress("");
    setAddHostelDesc("");
    setAddRoomNo("");
    setAddRoomHostelId(null);
    setAddRoomTypeId(null);
    setAddRoomBeds("");
    setAddRoomCost("");
    setAddRtName("");
    setAddRtDesc("");
  }, [formResetKey]);

  useEffect(() => {
    const h = selectedHostel?.originalData || selectedHostel;
    if (!h?.id && !selectedHostel?.dbId) {
      return;
    }
    setEditHostelName(h.hostel_name || selectedHostel?.hostelName || "");
    const t = (h.hostel_type || "").toString().toLowerCase();
    setEditHostelType(["boys", "girls", "mixed"].includes(t) ? t : "boys");
    const intake =
      h.intake_capacity ??
      h.intake ??
      h.total_rooms ??
      (selectedHostel?.inTake && selectedHostel.inTake !== "N/A" ? selectedHostel.inTake : "");
    setEditHostelIntake(intake !== "" && intake != null ? String(intake) : "");
    setEditHostelAddress(h.address || selectedHostel?.address || "");
    setEditHostelDesc(
      h.description || h.facilities || (selectedHostel?.description !== "N/A" ? selectedHostel.description : "") || ""
    );
  }, [selectedHostel]);

  useEffect(() => {
    const r = selectedRoom?.originalData || selectedRoom;
    if (!r?.id && !selectedRoom?.dbId) return;
    setEditRoomNo(String(r.room_number ?? selectedRoom?.roomNo ?? ""));
    setEditRoomHostelId(r.hostel_id != null ? String(r.hostel_id) : null);
    setEditRoomTypeId(r.room_type_id != null ? String(r.room_type_id) : null);
    const beds =
      r.max_occupancy ??
      r.current_occupancy ??
      (selectedRoom?.noofBed && selectedRoom.noofBed !== "N/A" ? selectedRoom.noofBed : "");
    setEditRoomBeds(beds != null && beds !== "" ? String(beds) : "");
    const cost = r.monthly_fee ?? r.monthly_fees;
    setEditRoomCost(
      cost != null && cost !== ""
        ? String(typeof cost === "number" ? cost : String(cost).replace(/[^\d.]/g, ""))
        : ""
    );
  }, [selectedRoom]);

  useEffect(() => {
    const rt = selectedRoomType?.originalData || selectedRoomType;
    if (!rt?.id && !selectedRoomType?.dbId) return;
    setEditRtName(rt.room_type || selectedRoomType?.roomType || "");
    setEditRtDesc(rt.description && rt.description !== "N/A" ? rt.description : "");
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
        address: addHostelAddress.trim() || null,
        description: addHostelDesc.trim() || null,
      };
      if (addHostelIntake.trim() !== "") {
        const n = Number(addHostelIntake);
        if (!Number.isNaN(n)) body.intake_capacity = n;
      }
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
        address: editHostelAddress.trim() || null,
        description: editHostelDesc.trim() || null,
      };
      if (editHostelIntake.trim() !== "") {
        const n = Number(editHostelIntake);
        if (!Number.isNaN(n)) body.intake_capacity = n;
      }
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
        room_type_id: Number(addRoomTypeId),
      };
      if (addRoomBeds.trim() !== "") {
        const b = Number(addRoomBeds);
        if (!Number.isNaN(b)) body.max_occupancy = b;
      }
      if (addRoomCost.trim() !== "") {
        const c = Number(addRoomCost.replace(/[^\d.]/g, ""));
        if (!Number.isNaN(c)) body.monthly_fee = c;
      }
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
        room_type_id: Number(editRoomTypeId),
      };
      if (editRoomBeds.trim() !== "") {
        const b = Number(editRoomBeds);
        if (!Number.isNaN(b)) body.max_occupancy = b;
      }
      if (editRoomCost.trim() !== "") {
        const c = Number(editRoomCost.replace(/[^\d.]/g, ""));
        if (!Number.isNaN(c)) body.monthly_fee = c;
      }
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
      const res = await apiService.createRoomType({
        room_type: addRtName.trim(),
        description: addRtDesc.trim() || null,
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
      const res = await apiService.updateRoomType(roomTypeIdForEdit, {
        room_type: editRtName.trim(),
        description: editRtDesc.trim() || null,
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Hostel Room</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-12">
                  <div className="mb-3">
                    <label className="form-label">Room No</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addRoomNo}
                      onChange={(e) => setAddRoomNo(e.target.value)}
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
                  <div className="mb-3">
                    <label className="form-label">No. of beds (capacity)</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={addRoomBeds}
                      onChange={(e) => setAddRoomBeds(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Monthly fee (per room)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Amount"
                      value={addRoomCost}
                      onChange={(e) => setAddRoomCost(e.target.value)}
                    />
                  </div>
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Hostel Room</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-12">
                  <div className="mb-3">
                    <label className="form-label">Room No</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editRoomNo}
                      onChange={(e) => setEditRoomNo(e.target.value)}
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
                  <div className="mb-3">
                    <label className="form-label">No. of beds (capacity)</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={editRoomBeds}
                      onChange={(e) => setEditRoomBeds(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Monthly fee (per room)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editRoomCost}
                      onChange={(e) => setEditRoomCost(e.target.value)}
                    />
                  </div>
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
              <div className="row">
                <div className="col-md-12">
                  <div className="mb-3">
                    <label className="form-label">Room Type</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addRtName}
                      onChange={(e) => setAddRtName(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={addRtDesc}
                      onChange={(e) => setAddRtDesc(e.target.value)}
                    />
                  </div>
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
              <div className="row">
                <div className="col-md-12">
                  <div className="mb-3">
                    <label className="form-label">Room Type</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editRtName}
                      onChange={(e) => setEditRtName(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={editRtDesc}
                      onChange={(e) => setEditRtDesc(e.target.value)}
                    />
                  </div>
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Hostel</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-12">
                  <div className="mb-3">
                    <label className="form-label">Hostel Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addHostelName}
                      onChange={(e) => setAddHostelName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Hostel Type</label>
                    <CommonSelect
                      className="select"
                      options={HOSTEL_TYPE_OPTIONS}
                      value={addHostelType || undefined}
                      onChange={(v) => setAddHostelType(v || "boys")}
                    />
                  </div>
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
                  <div className="mb-3">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addHostelAddress}
                      onChange={(e) => setAddHostelAddress(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={addHostelDesc}
                      onChange={(e) => setAddHostelDesc(e.target.value)}
                    />
                  </div>
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Hostel</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-12">
                  <div className="mb-3">
                    <label className="form-label">Hostel Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editHostelName}
                      onChange={(e) => setEditHostelName(e.target.value)}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="form-label">Hostel Type</label>
                    <CommonSelect
                      className="select"
                      options={HOSTEL_TYPE_OPTIONS}
                      value={editHostelType || undefined}
                      onChange={(v) => setEditHostelType(v || "boys")}
                    />
                  </div>
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
                  <div className="mb-3">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editHostelAddress}
                      onChange={(e) => setEditHostelAddress(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={editHostelDesc}
                      onChange={(e) => setEditHostelDesc(e.target.value)}
                    />
                  </div>
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

