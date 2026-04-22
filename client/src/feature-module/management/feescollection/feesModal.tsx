import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import CommonSelect from "../../../core/common/commonSelect";
import dayjs from "dayjs";
import Swal from "sweetalert2";

interface FeesModalProps {
  onSuccess?: (isManualRefresh?: boolean) => void;
  editGroupData?: any;
  editTypeData?: any;
  editMasterData?: any;
  deleteId?: number | null;
  onDeleteSuccess?: () => void;
}

const FeesModal = ({ onSuccess, editGroupData, editTypeData, editMasterData, deleteId, onDeleteSuccess }: FeesModalProps) => {
    const academicYearId = useSelector(selectSelectedAcademicYearId);
    const [activeContent, setActiveContent] = useState('none');
    
    // Fees Group Form State
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [groupStatus, setGroupStatus] = useState(true);

    // Fees Type Form State
    const [typeName, setTypeName] = useState("");
    const [typeCode, setTypeCode] = useState("");
    const [typeDescription, setTypeDescription] = useState("");
    const [typeStatus, setTypeStatus] = useState(true);

    // Fees Master Form State
    const [masterGroupId, setMasterGroupId] = useState<number | null>(null);
    const [masterTypeId, setMasterTypeId] = useState<number | null>(null);
    const [masterAmount, setMasterAmount] = useState<string>("");
    const [masterDueDate, setMasterDueDate] = useState<string>("");
    const [masterFineAmount, setMasterFineAmount] = useState<string>("0");
    const [masterFinePercentage, setMasterFinePercentage] = useState<string>("0");
    const [masterStatus, setMasterStatus] = useState(true);

    // Dropdown Data
    const [groups, setGroups] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);

    const fetchDropdowns = async () => {
      try {
        const gRes = await apiService.getFeesGroups({ academic_year_id: academicYearId });
        if (gRes.status === "SUCCESS") {
          setGroups(gRes.data.filter((g: any) => g.status === 'Active'));
        }
        
        const tRes = await apiService.getFeesTypes();
        if (tRes.status === "SUCCESS") setTypes(tRes.data);
      } catch (err) {
        console.error(err);
      }
    };

    useEffect(() => {
      if (academicYearId) fetchDropdowns();
    }, [academicYearId]);

    useEffect(() => {
      if (editGroupData) {
        setGroupName(editGroupData.name || "");
        setGroupDescription(editGroupData.description || "");
        setGroupStatus(editGroupData.status?.toLowerCase() === "active");
      } else {
        setGroupName("");
        setGroupDescription("");
        setGroupStatus(true);
      }
    }, [editGroupData]);

    useEffect(() => {
      if (editMasterData) {
        setMasterGroupId(editMasterData.fees_group_id || null);
        setMasterTypeId(editMasterData.fees_type_id || null);
        setMasterAmount(editMasterData.amount?.toString() || "");
        setMasterDueDate(editMasterData.due_date ? dayjs(editMasterData.due_date).format("YYYY-MM-DD") : "");
        setMasterFineAmount(editMasterData.fine_amount?.toString() || "0");
        setMasterFinePercentage(editMasterData.fine_percentage?.toString() || "0");
        setActiveContent(editMasterData.fine_type || "None");
        setMasterStatus(editMasterData.status?.toLowerCase() === "active");
      } else {
        setMasterGroupId(null);
        setMasterTypeId(null);
        setMasterAmount("");
        setMasterDueDate("");
        setMasterFineAmount("0");
        setMasterFinePercentage("0");
        setActiveContent("None");
        setMasterStatus(true);
      }
    }, [editMasterData]);

    useEffect(() => {
      if (editTypeData) {
        setTypeName(editTypeData.name || "");
        setTypeCode(editTypeData.code || "");
        setTypeDescription(editTypeData.description || "");
        setTypeStatus(editTypeData.status?.toLowerCase() === "active");
        if (editTypeData.fees_group_id) setMasterGroupId(editTypeData.fees_group_id);
      } else {
        setTypeName("");
        setTypeCode("");
        setTypeDescription("");
        setTypeStatus(true);
      }
    }, [editTypeData]);

    const handleAddFeesGroup = async (e: any) => {
        e.preventDefault();
        try {
          if (!groupName) {
            Swal.fire("Error", "Name is required", "error");
            return;
          }
          
          const payload = {
            name: groupName,
            description: groupDescription,
            status: groupStatus ? "Active" : "Inactive",
            academic_year_id: academicYearId
          };
  
          let res;
          if (editGroupData?.id) {
            res = await apiService.updateFeesGroup(editGroupData.id, payload);
          } else {
            res = await apiService.createFeesGroup(payload);
          }
  
          if (res.status === "SUCCESS") {
            Swal.fire("Success", `Fees Group ${editGroupData?.id ? 'updated' : 'added'} successfully`, "success");
            setGroupName("");
            setGroupDescription("");
            if (onSuccess) onSuccess();
            
            const activeModal = document.querySelector('.modal.show')?.id;
            if (activeModal) {
                const modalElement = document.getElementById(activeModal);
                if (modalElement) (window as any).bootstrap?.Modal?.getInstance(modalElement)?.hide();
            }
          }
        } catch (err: any) {
          Swal.fire("Error", err.message || "Operation failed", "error");
        }
      };

    const handleAddFeesType = async (e: any) => {
      if (e) e.preventDefault();
      try {
        if (!typeName) {
          Swal.fire("Error", "Fees Type name is required", "error");
          return;
        }
        
        const payload = {
          name: typeName,
          code: typeCode,
          description: typeDescription,
          status: typeStatus ? "Active" : "Inactive",
          fees_group_id: masterGroupId // Included for backward compatibility or simple association
        };

        let res;
        if (editTypeData?.id) {
          res = await apiService.updateFeesType(editTypeData.id, payload);
        } else {
          res = await apiService.createFeesType(payload);
        }

        if (res.status === "SUCCESS") {
          Swal.fire("Success", `Fees Type ${editTypeData?.id ? 'updated' : 'added'} successfully`, "success");
          setTypeName("");
          setTypeCode("");
          setTypeDescription("");
          if (onSuccess) onSuccess();
          const activeModal = document.querySelector('.modal.show')?.id;
          if (activeModal) {
              const modalElement = document.getElementById(activeModal);
              if (modalElement) (window as any).bootstrap?.Modal?.getInstance(modalElement)?.hide();
          }
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Operation failed", "error");
      }
    };

    const handleAddFeesMaster = async (e: any) => {
      e.preventDefault();
      try {
        if (!masterGroupId || !masterTypeId || !masterAmount || !academicYearId) {
          Swal.fire("Error", "Please fill required fields", "error");
          return;
        }
        
        const payload = {
          fees_group_id: Number(masterGroupId),
          fees_type_id: Number(masterTypeId),
          amount: parseFloat(masterAmount),
          due_date: masterDueDate || null,
          fine_type: activeContent || "None",
          fine_amount: activeContent === "fixed" ? parseFloat(masterFineAmount) : 0,
          fine_percentage: activeContent === "percentage" ? parseFloat(masterFinePercentage) : 0,
          academic_year_id: academicYearId,
          status: masterStatus ? "Active" : "Inactive"
        };

        let res;
        if (editMasterData?.id) {
          res = await apiService.updateFeesMaster(editMasterData.id, payload);
        } else {
          res = await apiService.createFeesMaster(payload);
        }

        if (res.status === "SUCCESS") {
          Swal.fire("Success", `Fees Master ${editMasterData?.id ? 'updated' : 'added'} successfully`, "success");
          setMasterAmount("");
          setMasterGroupId(null);
          setMasterTypeId(null);
          if (onSuccess) onSuccess();
          const activeModal = document.querySelector('.modal.show')?.id;
          if (activeModal) {
              const modalElement = document.getElementById(activeModal);
              if (modalElement) (window as any).bootstrap?.Modal?.getInstance(modalElement)?.hide();
          }
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Operation failed", "error");
      }
    };

    const handleDelete = async (e: any) => {
      e.preventDefault();
      if (!deleteId) return;

      try {
        let res;
        if (editMasterData) res = await apiService.deleteFeesMaster(deleteId);
        else if (editGroupData) res = await apiService.deleteFeesGroup(deleteId);
        else if (editTypeData) res = await apiService.deleteFeesType(deleteId);
        else res = await apiService.deleteFeesType(deleteId); 

        if (res && res.status === "SUCCESS") {
          Swal.fire("Deleted!", "Record has been deleted.", "success");
          if (onDeleteSuccess) onDeleteSuccess();
          const modalElement = document.getElementById('delete-modal');
          if (modalElement) {
            (window as any).bootstrap?.Modal?.getInstance(modalElement)?.hide();
          }
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Failed to delete record", "error");
      }
    };

    const defaultValue = dayjs();
    const getModalContainer = () => document.getElementById('modal-datepicker') || document.body;

  return (
    <>
      {/* Fees Master Modals */}
      <div className="modal fade" id="add_fees_master">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
                <h4 className="modal-title">Add Fees Master</h4>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleAddFeesMaster}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Fees Group</label>
                      <CommonSelect
                        className="select"
                        options={groups.map(g => ({ value: g.id.toString(), label: g.name }))}
                        value={masterGroupId?.toString()}
                        onChange={(val: any) => setMasterGroupId(Number(val))}
                        />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Fees Type</label>
                      <CommonSelect
                        className="select"
                        options={types.map(t => ({ value: t.id.toString(), label: t.name }))}
                        value={masterTypeId?.toString()}
                        onChange={(val: any) => setMasterTypeId(Number(val))}
                        />
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                        <label className="form-label">Amount</label>
                        <input type="text" className="form-control" placeholder="Enter Amount" value={masterAmount} onChange={(e) => setMasterAmount(e.target.value)} />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Due Date</label>
                        <input type="date" className="form-control" value={masterDueDate} onChange={(e) => setMasterDueDate(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Fine Type</label>
                      <div className="d-flex align-items-center check-radio-group">
                        <label className="custom-radio">
                          <input type="radio" name="radio-mf-add" value="None" checked={activeContent === 'None'} onChange={() => setActiveContent('None')} />
                          <span className="checkmark" /> None
                        </label>
                        <label className="custom-radio ms-2">
                          <input type="radio" name="radio-mf-add" value="percentage" checked={activeContent === 'percentage'} onChange={() => setActiveContent('percentage')} />
                          <span className="checkmark" /> Percentage
                        </label>
                        <label className="custom-radio ms-2">
                          <input type="radio" name="radio-mf-add" value="fixed" checked={activeContent === 'fixed'} onChange={() => setActiveContent('fixed')} />
                          <span className="checkmark" /> Fixed
                        </label>
                      </div>
                    </div>
                    {activeContent === 'percentage' && (
                      <div className="mb-3">
                          <label className="form-label">Fine Percentage (%)</label>
                          <input type="text" className="form-control" placeholder="Enter Percentage" value={masterFinePercentage} onChange={(e) => setMasterFinePercentage(e.target.value)} />
                      </div>
                    )}
                    {activeContent === 'fixed' && (
                      <div className="mb-3">
                          <label className="form-label">Fine Amount (Fixed)</label>
                          <input type="text" className="form-control" placeholder="Enter Fine Amount" value={masterFineAmount} onChange={(e) => setMasterFineAmount(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="status-title"><h5>Status</h5><p>{masterStatus ? "Active" : "Inactive"}</p></div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={masterStatus} onChange={(e) => setMasterStatus(e.target.checked)} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_fees_master">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
                <h4 className="modal-title">Edit Fees Master</h4>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleAddFeesMaster}>
              <div className="modal-body">
                <div className="row">
                    <div className="col-md-12">
                        <div className="mb-3">
                            <label className="form-label">Fees Group</label>
                            <input type="text" className="form-control" value={groups.find(g => g.id === masterGroupId)?.name || ""} disabled />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Fees Type</label>
                            <input type="text" className="form-control" value={types.find(t => t.id === masterTypeId)?.name || ""} disabled />
                        </div>
                    </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                        <label className="form-label">Amount</label>
                        <input type="text" className="form-control" value={masterAmount} onChange={(e) => setMasterAmount(e.target.value)} />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Due Date</label>
                        <input type="date" className="form-control" value={masterDueDate} onChange={(e) => setMasterDueDate(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Fine Type</label>
                      <div className="d-flex align-items-center check-radio-group">
                        <label className="custom-radio">
                          <input type="radio" name="radio-mf-edit" value="None" checked={activeContent === 'None'} onChange={() => setActiveContent('None')} />
                          <span className="checkmark" /> None
                        </label>
                        <label className="custom-radio ms-2">
                          <input type="radio" name="radio-mf-edit" value="percentage" checked={activeContent === 'percentage'} onChange={() => setActiveContent('percentage')} />
                          <span className="checkmark" /> Percentage
                        </label>
                        <label className="custom-radio ms-2">
                          <input type="radio" name="radio-mf-edit" value="fixed" checked={activeContent === 'fixed'} onChange={() => setActiveContent('fixed')} />
                          <span className="checkmark" /> Fixed
                        </label>
                      </div>
                    </div>
                    {activeContent === 'percentage' && (
                      <div className="mb-3">
                          <label className="form-label">Fine Percentage (%)</label>
                          <input type="text" className="form-control" value={masterFinePercentage} onChange={(e) => setMasterFinePercentage(e.target.value)} />
                      </div>
                    )}
                    {activeContent === 'fixed' && (
                      <div className="mb-3">
                          <label className="form-label">Fine Amount (Fixed)</label>
                          <input type="text" className="form-control" value={masterFineAmount} onChange={(e) => setMasterFineAmount(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="status-title"><h5>Status</h5><p>{masterStatus ? "Active" : "Inactive"}</p></div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={masterStatus} onChange={(e) => setMasterStatus(e.target.checked)} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Fees Type Modals */}
      <div className="modal fade" id="add_fees_Type">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
                <h4 className="modal-title">Add Fees Type</h4>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleAddFeesType}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input type="text" className="form-control" placeholder="Enter Name" value={typeName} onChange={(e) => setTypeName(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Fees Code</label>
                  <input type="text" className="form-control" placeholder="Enter Code" value={typeCode} onChange={(e) => setTypeCode(e.target.value)} />
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label">Fees Group</label>
                    <Link to="#" className="text-primary mb-2" data-bs-toggle="modal" data-bs-target="#add_fees_group">
                        <i className="ti ti-square-rounded-plus-filled me-1" /> Add New
                    </Link>
                  </div>
                  <CommonSelect
                    className="select"
                    options={groups.map(g => ({ value: g.id.toString(), label: g.name }))}
                    value={masterGroupId?.toString()}
                    onChange={(val: any) => setMasterGroupId(Number(val.value))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} placeholder="Add Description" value={typeDescription} onChange={(e) => setTypeDescription(e.target.value)} />
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <h5>Status</h5>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={typeStatus} onChange={(e) => setTypeStatus(e.target.checked)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Fees Type</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_fees_Type">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
                <h4 className="modal-title">Edit Fees Type</h4>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleAddFeesType}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input type="text" className="form-control" placeholder="Enter Name" value={typeName} onChange={(e) => setTypeName(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Fees Code</label>
                  <input type="text" className="form-control" placeholder="Enter Code" value={typeCode} onChange={(e) => setTypeCode(e.target.value)} />
                </div>
                <div className="mb-3">
                   <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label">Fees Group</label>
                    <Link to="#" className="text-primary mb-2" data-bs-toggle="modal" data-bs-target="#add_fees_group">
                        <i className="ti ti-square-rounded-plus-filled me-1" /> Add New
                    </Link>
                  </div>
                  <CommonSelect
                    className="select"
                    options={groups.map(g => ({ value: g.id.toString(), label: g.name }))}
                    value={masterGroupId?.toString()}
                    onChange={(val: any) => setMasterGroupId(Number(val.value))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} placeholder="Add Description" value={typeDescription} onChange={(e) => setTypeDescription(e.target.value)} />
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <h5>Status</h5>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={typeStatus} onChange={(e) => setTypeStatus(e.target.checked)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Fees Group Modals */}
      <div className="modal fade" id="add_fees_group">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
                <h4 className="modal-title">Add Fees Group</h4>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleAddFeesGroup}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input type="text" className="form-control" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} />
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <h5>Status</h5>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={groupStatus} onChange={(e) => setGroupStatus(e.target.checked)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Group</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="edit_fees_group">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
                <h4 className="modal-title">Edit Fees Group</h4>
                <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleAddFeesGroup}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input type="text" className="form-control" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} />
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <h5>Status</h5>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={groupStatus} onChange={(e) => setGroupStatus(e.target.checked)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={handleDelete}>
              <div className="modal-body text-center">
                <span className="delete-icon"><i className="ti ti-trash-x" /></span>
                <h4>Confirm Deletion</h4>
                <p>You want to delete this item, this cannot be undone.</p>
                <div className="d-flex justify-content-center">
                  <button type="button" className="btn btn-light me-3" data-bs-dismiss="modal">Cancel</button>
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

