import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

interface Props {
  selectedFee?: any;
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

const TransportFeesModal = ({ selectedFee, deleteId, onSuccess }: Props) => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [loading, setLoading] = useState(false);
  const [pickupPoints, setPickupPoints] = useState<any[]>([]);

  const [pickupPointId, setPickupPointId] = useState("");
  const [planName, setPlanName] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [studentAmount, setStudentAmount] = useState("");
  const [staffAmount, setStaffAmount] = useState("");
  const [status, setStatus] = useState("Active");

  const resetAddForm = () => {
    setPickupPointId("");
    setPlanName("");
    setDurationDays("");
    setStudentAmount("");
    setStaffAmount("");
    setStatus("Active");
  };

  useEffect(() => {
    apiService
      .getTransportPickupPoints({ limit: 1000, status: "active", academic_year_id: academicYearId ?? undefined })
      .then((res: any) => {
        if (res?.status === "SUCCESS") setPickupPoints(res.data || []);
      })
      .catch(() => {});
  }, [academicYearId]);

  useEffect(() => {
    if (selectedFee?.originalData) {
      const row = selectedFee.originalData;
      setPickupPointId(String(row.pickup_point_id || ""));
      setPlanName(row.plan_name || "");
      setDurationDays(row.duration_days == null ? "" : String(row.duration_days));
      setStudentAmount(String(row.amount ?? ""));
      setStaffAmount(String(row.staff_amount ?? row.amount ?? ""));
      setStatus(row.status || "Active");
      return;
    }
    resetAddForm();
  }, [selectedFee]);

  useEffect(() => {
    const addEl = document.getElementById("add_transport_fee");
    const onShow = () => resetAddForm();
    addEl?.addEventListener("show.bs.modal", onShow as any);
    return () => addEl?.removeEventListener("show.bs.modal", onShow as any);
  }, []);

  const handleSave = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        pickup_point_id: Number(pickupPointId),
        plan_name: planName.trim(),
        duration_days: durationDays ? Number(durationDays) : null,
        amount: Number(studentAmount),
        staff_amount: Number(staffAmount),
        status,
      };

      const id = selectedFee?.originalData?.id;
      const res = id
        ? await apiService.updateTransportFee(id, payload)
        : await apiService.createTransportFee(payload);

      if (res?.status === "SUCCESS") {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: id ? "Transport fee updated successfully" : "Transport fee created successfully",
          timer: 1500,
          showConfirmButton: false,
        });
        hideModal(id ? "edit_transport_fee" : "add_transport_fee");
        if (!id) resetAddForm();
        onSuccess?.();
      } else {
        throw new Error(res?.message || "Failed to save transport fee");
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err?.message || "Failed to save transport fee" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: any) => {
    e.preventDefault();
    if (!deleteId) return;
    setLoading(true);
    try {
      const res = await apiService.deleteTransportFee(deleteId);
      if (res?.status === "SUCCESS") {
        Swal.fire({
          icon: "success",
          title: "Deleted",
          text: "Transport fee deleted successfully",
          timer: 1500,
          showConfirmButton: false,
        });
        hideModal("delete-transport-fee-modal");
        onSuccess?.();
      } else {
        throw new Error(res?.message || "Failed to delete transport fee");
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err?.message || "Failed to delete transport fee" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal fade" id="add_transport_fee">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Transport Fee</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Pickup Point</label>
                  <CommonSelect
                    className="select"
                    options={pickupPoints.map((p: any) => ({ value: String(p.id), label: p.point_name }))}
                    value={pickupPointId}
                    onChange={(v: string | null) => setPickupPointId(v || "")}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Plan Name</label>
                  <input className="form-control" value={planName} onChange={(e) => setPlanName(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Duration Days (Optional)</label>
                  <input type="number" min="1" className="form-control" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Student Amount</label>
                  <input type="number" min="0" step="0.01" className="form-control" value={studentAmount} onChange={(e) => setStudentAmount(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Staff Amount</label>
                  <input type="number" min="0" step="0.01" className="form-control" value={staffAmount} onChange={(e) => setStaffAmount(e.target.value)} required />
                </div>
                <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                  <div className="status-title">
                    <h5>Status</h5>
                    <label className="form-label mb-0" htmlFor="transport_fee_add_status_toggle">
                      {status === "Active" ? "Active" : "Inactive"}
                    </label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      id="transport_fee_add_status_toggle"
                      className="form-check-input"
                      type="checkbox"
                      checked={status === "Active"}
                      onChange={(e) => setStatus(e.target.checked ? "Active" : "Inactive")}
                    />
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

      <div className="modal fade" id="edit_transport_fee">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Transport Fee</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Pickup Point</label>
                  <CommonSelect
                    className="select"
                    options={pickupPoints.map((p: any) => ({ value: String(p.id), label: p.point_name }))}
                    value={pickupPointId}
                    onChange={(v: string | null) => setPickupPointId(v || "")}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Plan Name</label>
                  <input className="form-control" value={planName} onChange={(e) => setPlanName(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Duration Days (Optional)</label>
                  <input type="number" min="1" className="form-control" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Student Amount</label>
                  <input type="number" min="0" step="0.01" className="form-control" value={studentAmount} onChange={(e) => setStudentAmount(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Staff Amount</label>
                  <input type="number" min="0" step="0.01" className="form-control" value={staffAmount} onChange={(e) => setStaffAmount(e.target.value)} required />
                </div>
                <div className="modal-status-toggle d-flex align-items-center justify-content-between mt-3 mx-2">
                  <div className="status-title">
                    <h5>Status</h5>
                    <label className="form-label mb-0" htmlFor="transport_fee_edit_status_toggle">
                      {status === "Active" ? "Active" : "Inactive"}
                    </label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      id="transport_fee_edit_status_toggle"
                      className="form-check-input"
                      type="checkbox"
                      checked={status === "Active"}
                      onChange={(e) => setStatus(e.target.checked ? "Active" : "Inactive")}
                    />
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

      <div className="modal fade" id="delete-transport-fee-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon"><i className="ti ti-trash-x" /></span>
              <h4>Confirm Deletion</h4>
              <p>This action cannot be undone.</p>
              <div className="d-flex justify-content-center">
                <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">Cancel</Link>
                <Link to="#" className="btn btn-danger" onClick={handleDelete}>{loading ? "Deleting..." : "Yes, Delete"}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransportFeesModal;
