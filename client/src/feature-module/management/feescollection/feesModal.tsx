import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import CommonSelect from "../../../core/common/commonSelect";
import Swal from "sweetalert2";

interface FeesModalProps {
  onSuccess?: (isManualRefresh?: boolean) => void;
  editFeeData?: any;       // fees (header) record for editing
  editTypeData?: any;      // fees_types record for editing
  editItemData?: any;      // fees_class_types record for editing
  deleteId?: number | null;
  deleteContext?: "fee" | "type" | "item"; // what we're deleting
  onDeleteSuccess?: () => void;
}

const FeesModal = ({
  onSuccess,
  editFeeData,
  editTypeData,
  editItemData,
  deleteId,
  deleteContext,
  onDeleteSuccess
}: FeesModalProps) => {
    const academicYearId = useSelector(selectSelectedAcademicYearId);

    // ── Fee Config (fees header) State ──────────────────────────────────────
    const [feeClassId, setFeeClassId] = useState<number | null>(null);
    const [feeDueDate, setFeeDueDate] = useState("");
    const [feeLateType, setFeeLateType] = useState<"fixed"|"percentage"|"none">("none");
    const [feeLateCharge, setFeeLateCharge] = useState("0");
    const [feeLateFreq, setFeeLateFreq] = useState("once");
    const [feeDescription, setFeeDescription] = useState("");
    // Line items for the fee config
    const [feeItems, setFeeItems] = useState<{ fee_type_id: number; amount: string; is_optional: boolean }[]>([
      { fee_type_id: 0, amount: "", is_optional: false }
    ]);

    // ── Fee Type State ──────────────────────────────────────────────────────
    const [typeName, setTypeName] = useState("");
    const [typeCode, setTypeCode] = useState("");
    const [typeDescription, setTypeDescription] = useState("");
    const [typeIsActive, setTypeIsActive] = useState(true);

    // ── Dropdown data ───────────────────────────────────────────────────────
    const [classes, setClasses] = useState<any[]>([]);
    const [feeTypes, setFeeTypes] = useState<any[]>([]);

    const fetchDropdowns = useCallback(async () => {
      try {
        const [classRes, typeRes] = await Promise.all([
          apiService.getClasses(),
          apiService.getFeesTypes()
        ]);
        if (classRes.status === "SUCCESS") setClasses(classRes.data ?? classRes.classes ?? []);
        if (typeRes.status === "SUCCESS") setFeeTypes(typeRes.data);
      } catch (err) {
        console.error("Dropdown fetch failed:", err);
      }
    }, []);

    useEffect(() => {
      fetchDropdowns();
    }, [fetchDropdowns]);

    // Populate form when editing a fee config
    useEffect(() => {
      if (editFeeData) {
        setFeeClassId(editFeeData.class_id ?? null);
        setFeeDueDate(editFeeData.due_date ?? "");
        setFeeLateType(editFeeData.late_fee_type ?? "none");
        setFeeLateCharge(editFeeData.late_fee_charge?.toString() ?? "0");
        setFeeLateFreq(editFeeData.late_fee_frequency ?? "once");
        setFeeDescription(editFeeData.description ?? "");
        if (Array.isArray(editFeeData.fee_items) && editFeeData.fee_items.length > 0) {
          setFeeItems(editFeeData.fee_items.map((i: any) => ({
            fee_type_id: i.fee_type_id,
            amount: i.amount?.toString() ?? "",
            is_optional: i.is_optional ?? false
          })));
        } else {
          setFeeItems([{ fee_type_id: 0, amount: "", is_optional: false }]);
        }
      } else {
        setFeeClassId(null);
        setFeeDueDate("");
        setFeeLateType("none");
        setFeeLateCharge("0");
        setFeeLateFreq("once");
        setFeeDescription("");
        setFeeItems([{ fee_type_id: 0, amount: "", is_optional: false }]);
      }
    }, [editFeeData]);

    // Populate form when editing a fee type
    useEffect(() => {
      if (editTypeData) {
        setTypeName(editTypeData.name ?? "");
        setTypeCode(editTypeData.code ?? "");
        setTypeDescription(editTypeData.description ?? "");
        setTypeIsActive(editTypeData.is_active !== false);
      } else {
        setTypeName("");
        setTypeCode("");
        setTypeDescription("");
        setTypeIsActive(true);
      }
    }, [editTypeData]);

    // ── Fee Item helpers ────────────────────────────────────────────────────
    const addFeeItem = () => setFeeItems(prev => [...prev, { fee_type_id: 0, amount: "", is_optional: false }]);
    const removeFeeItem = (idx: number) => setFeeItems(prev => prev.filter((_, i) => i !== idx));
    const updateFeeItem = (idx: number, field: string, value: any) =>
      setFeeItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

    const closeActiveModal = () => {
      const activeModal = document.querySelector(".modal.show")?.id;
      if (activeModal) {
        const el = document.getElementById(activeModal);
        if (el) (window as any).bootstrap?.Modal?.getInstance(el)?.hide();
      }
    };

    // ── Save Fee Config ─────────────────────────────────────────────────────
    const handleSaveFeeConfig = async (e: any) => {
      e.preventDefault();
      try {
        if (!feeClassId || !academicYearId) {
          Swal.fire("Validation", "Class and Academic Year are required", "warning");
          return;
        }
        const validItems = feeItems.filter(i => i.fee_type_id > 0 && i.amount !== "");
        if (validItems.length === 0) {
          Swal.fire("Validation", "Add at least one fee item with a type and amount", "warning");
          return;
        }

        const payload = {
          class_id: feeClassId,
          academic_year_id: academicYearId,
          due_date: feeDueDate || null,
          late_fee_type: feeLateType !== "none" ? feeLateType : "fixed",
          late_fee_charge: feeLateType !== "none" ? parseFloat(feeLateCharge) : 0,
          late_fee_frequency: feeLateFreq,
          description: feeDescription || null,
          fee_items: validItems.map(i => ({
            fee_type_id: Number(i.fee_type_id),
            amount: parseFloat(i.amount),
            is_optional: i.is_optional
          }))
        };

        let res;
        if (editFeeData?.id) {
          res = await apiService.updateFeesGroup(editFeeData.id, payload);
        } else {
          res = await apiService.createFeesGroup(payload);
        }

        if (res.status === "SUCCESS") {
          Swal.fire("Success", `Fee configuration ${editFeeData?.id ? "updated" : "created"} successfully`, "success");
          if (onSuccess) onSuccess();
          closeActiveModal();
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Operation failed", "error");
      }
    };

    // ── Save Fee Type ───────────────────────────────────────────────────────
    const handleSaveFeeType = async (e: any) => {
      e.preventDefault();
      try {
        if (!typeName.trim()) {
          Swal.fire("Validation", "Fee type name is required", "warning");
          return;
        }
        const payload = {
          name: typeName.trim(),
          code: typeCode.trim() || null,
          description: typeDescription.trim() || null,
          is_active: typeIsActive
        };

        let res;
        if (editTypeData?.id) {
          res = await apiService.updateFeesType(editTypeData.id, payload);
        } else {
          res = await apiService.createFeesType(payload);
        }

        if (res.status === "SUCCESS") {
          Swal.fire("Success", `Fee type ${editTypeData?.id ? "updated" : "created"} successfully`, "success");
          // Refresh dropdown in case new type was added
          fetchDropdowns();
          if (onSuccess) onSuccess();
          closeActiveModal();
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Operation failed", "error");
      }
    };

    // ── Delete ──────────────────────────────────────────────────────────────
    const handleDelete = async (e: any) => {
      e.preventDefault();
      if (!deleteId) return;
      try {
        let res;
        if (deleteContext === "type") res = await apiService.deleteFeesType(deleteId);
        else if (deleteContext === "item") res = await apiService.deleteFeesMaster(deleteId);
        else res = await apiService.deleteFeesGroup(deleteId); // "fee" or default

        if (res?.status === "SUCCESS") {
          Swal.fire("Deleted!", "Record deleted successfully.", "success");
          if (onDeleteSuccess) onDeleteSuccess();
          const el = document.getElementById("delete-modal");
          if (el) (window as any).bootstrap?.Modal?.getInstance(el)?.hide();
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Failed to delete", "error");
      }
    };

  return (
    <>
      {/* ── Add / Edit Fee Configuration Modal ── */}
      {["add_fees_group", "edit_fees_group"].map((modalId) => (
        <div className="modal fade" id={modalId} key={modalId}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <div>
                  <h4 className="modal-title fw-semibold">
                    {modalId.startsWith("add") ? "Add Fee Configuration" : "Edit Fee Configuration"}
                  </h4>
                  <p className="text-muted small mb-0">Set up fees for a class and academic year</p>
                </div>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal">
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleSaveFeeConfig}>
                <div className="modal-body pt-3">

                  {/* ─ Section 1: Basic Info ─ */}
                  <div className="bg-light rounded-2 p-3 mb-3">
                    <p className="text-uppercase fw-semibold text-muted small mb-3" style={{ letterSpacing: "0.06em" }}>
                      Basic Information
                    </p>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-medium">
                          Class <span className="text-danger">*</span>
                        </label>
                        {editFeeData?.id ? (
                          <input className="form-control" value={editFeeData.class_name ?? ""} disabled />
                        ) : (
                          <CommonSelect
                            className="select"
                            options={classes.map((c: any) => ({ value: c.id.toString(), label: c.class_name }))}
                            value={feeClassId?.toString()}
                            onChange={(val: any) => setFeeClassId(Number(val?.value ?? val))}
                          />
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-medium">Default Due Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={feeDueDate}
                          onChange={(e) => setFeeDueDate(e.target.value)}
                        />
                      </div>
                      <div className="col-md-12">
                        <label className="form-label fw-medium">Description <span className="text-muted fw-normal">(optional)</span></label>
                        <textarea
                          className="form-control"
                          rows={2}
                          placeholder="Any notes about this fee structure..."
                          value={feeDescription}
                          onChange={(e) => setFeeDescription(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ─ Section 2: Late Fee ─ */}
                  <div className="bg-light rounded-2 p-3 mb-3">
                    <p className="text-uppercase fw-semibold text-muted small mb-3" style={{ letterSpacing: "0.06em" }}>
                      Late Fee Settings
                    </p>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-medium">Late Fee Type</label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "none", label: "None" },
                            { value: "fixed", label: "Fixed Amount (₹)" },
                            { value: "percentage", label: "Percentage (%)" }
                          ]}
                          value={feeLateType}
                          onChange={(val: any) => setFeeLateType(val?.value ?? val)}
                        />
                      </div>
                      {feeLateType !== "none" && (
                        <>
                          <div className="col-md-4">
                            <label className="form-label fw-medium">
                              {feeLateType === "percentage" ? "Late Fee %" : "Late Fee Amount (₹)"}
                            </label>
                            <div className="input-group">
                              <span className="input-group-text">
                                {feeLateType === "percentage" ? "%" : "₹"}
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                placeholder="0"
                                value={feeLateCharge}
                                onChange={(e) => setFeeLateCharge(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label fw-medium">Frequency</label>
                            <CommonSelect
                              className="select"
                              options={[
                                { value: "once", label: "Once" },
                                { value: "daily", label: "Daily" },
                                { value: "weekly", label: "Weekly" },
                                { value: "monthly", label: "Monthly" }
                              ]}
                              value={feeLateFreq}
                              onChange={(val: any) => setFeeLateFreq(val?.value ?? val)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ─ Section 3: Fee Items ─ */}
                  <div className="bg-light rounded-2 p-3">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="text-uppercase fw-semibold text-muted small mb-0" style={{ letterSpacing: "0.06em" }}>
                        Fee Items <span className="text-danger">*</span>
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                        onClick={addFeeItem}
                      >
                        <i className="ti ti-plus" /> Add Item
                      </button>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      {feeItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white border rounded-2 p-3 d-flex align-items-center gap-3"
                        >
                          {/* Index badge */}
                          <span
                            className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold flex-shrink-0"
                            style={{ width: 28, height: 28, fontSize: 12, background: "var(--bs-primary, #6366f1)" }}
                          >
                            {idx + 1}
                          </span>

                          {/* Fee Type — native select avoids dropdown overflow */}
                          <div className="flex-grow-1">
                            <label className="form-label small fw-medium mb-1">Fee Type</label>
                            <select
                              className="form-select form-select-sm"
                              value={item.fee_type_id > 0 ? item.fee_type_id.toString() : ""}
                              onChange={(e) => updateFeeItem(idx, "fee_type_id", Number(e.target.value))}
                            >
                              <option value="">-- Select type --</option>
                              {feeTypes
                                .filter((t: any) => t.is_active !== false)
                                .map((t: any) => (
                                  <option key={t.id} value={t.id.toString()}>
                                    {t.name}{t.code ? ` (${t.code})` : ""}
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Amount */}
                          <div style={{ width: 130 }}>
                            <label className="form-label small fw-medium mb-1">Amount</label>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                placeholder="0.00"
                                value={item.amount}
                                onChange={(e) => updateFeeItem(idx, "amount", e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Optional toggle */}
                          <div className="text-center flex-shrink-0">
                            <label className="form-label small fw-medium mb-1 d-block">Optional?</label>
                            <div className="form-check form-switch d-flex justify-content-center mb-0">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                role="switch"
                                checked={item.is_optional}
                                onChange={(e) => updateFeeItem(idx, "is_optional", e.target.checked)}
                              />
                            </div>
                          </div>

                          {/* Remove */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger flex-shrink-0"
                            onClick={() => removeFeeItem(idx)}
                            disabled={feeItems.length <= 1}
                            title="Remove item"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Running total */}
                    <div className="mt-3 pt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                      {/* Sub-totals */}
                      <div className="d-flex gap-3">
                        <div className="text-center px-3 py-2 rounded-2 border bg-white">
                          <div className="text-muted small mb-1">Compulsory</div>
                          <div className="fw-semibold text-primary">
                            ₹{feeItems.filter(i => !i.is_optional).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center px-3 py-2 rounded-2 border bg-white">
                          <div className="text-muted small mb-1">Optional</div>
                          <div className="fw-semibold text-info">
                            ₹{feeItems.filter(i => i.is_optional).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Grand Total — prominent */}
                      <div
                        className="d-flex align-items-center gap-2 px-4 py-2 rounded-2 text-white fw-bold"
                        style={{ background: "var(--bs-primary, #6366f1)" }}
                      >
                        <i className="ti ti-currency-rupee fs-5" />
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: "0.04em" }}>GRAND TOTAL</div>
                          <div style={{ fontSize: 22, lineHeight: 1.1 }}>
                            ₹{feeItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light px-4" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn btn-primary px-4">
                    <i className={`ti ${editFeeData?.id ? "ti-device-floppy" : "ti-circle-plus"} me-2`} />
                    {editFeeData?.id ? "Save Changes" : "Create Fee Config"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ))}


      {/* ── Add / Edit Fee Type Modal ── */}
      {["add_fees_Type", "edit_fees_Type"].map((modalId) => (
        <div className="modal fade" id={modalId} key={modalId}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">
                  {modalId.startsWith("add") ? "Add Fee Type" : "Edit Fee Type"}
                </h4>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal">
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleSaveFeeType}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Tuition Fee, Library Fee"
                      value={typeName}
                      onChange={(e) => setTypeName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. TUI, LIB"
                      value={typeCode}
                      onChange={(e) => setTypeCode(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={typeDescription}
                      onChange={(e) => setTypeDescription(e.target.value)}
                    />
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <h5 className="mb-0">Active</h5>
                      <p className="text-muted small mb-0">{typeIsActive ? "Visible in fee configs" : "Hidden"}</p>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={typeIsActive}
                        onChange={(e) => setTypeIsActive(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {editTypeData?.id ? "Save Changes" : "Add Fee Type"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ))}

      {/* ── Delete Confirmation Modal ── */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={handleDelete}>
              <div className="modal-body text-center py-4">
                <span className="delete-icon mb-3 d-block">
                  <i className="ti ti-trash-x fs-1 text-danger" />
                </span>
                <h4>Confirm Deletion</h4>
                <p className="text-muted">This action cannot be undone.</p>
                <div className="d-flex justify-content-center gap-2">
                  <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn btn-danger">Yes, Delete</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeesModal;
