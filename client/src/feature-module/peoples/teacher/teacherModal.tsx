
import { useState } from "react";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { Link } from "react-router-dom";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Select from "react-select";
import type { SingleValue } from "react-select";
import { apiService } from "../../../core/services/apiService";
import { useLeaveTypes } from "../../../core/hooks/useLeaveTypes";

interface TeacherModalProps {
  staffId?: number | null;
  onLeaveApplied?: () => void;
}

const TeacherModal = ({ staffId, onLeaveApplied }: TeacherModalProps) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Month is zero-based, so we add 1
  const day = String(today.getDate()).padStart(2, "0");
  const formattedDate = `${month}-${day}-${year}`;
  const defaultValue = dayjs(formattedDate);
  const { leaveTypes: leaveTypeOptions } = useLeaveTypes();
  const [applyLeaveType, setApplyLeaveType] = useState<SingleValue<{ value: string; label: string }>>(null);
  const [applyFromDate, setApplyFromDate] = useState<Dayjs | null>(null);
  const [applyToDate, setApplyToDate] = useState<Dayjs | null>(null);
  const [applyReason, setApplyReason] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);

  const getModalContainer = () => document.body;

  const hideApplyLeaveModal = () => {
    const el = document.getElementById("apply_leave_teacher");
    if (el) {
      const bsModal = (window as any).bootstrap?.Modal?.getInstance(el);
      if (bsModal) bsModal.hide();
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) {
      alert("Unable to apply leave: teacher/staff not selected.");
      return;
    }
    const typeId = applyLeaveType?.value;
    if (!typeId) {
      alert("Please select Leave Type.");
      return;
    }
    if (!applyFromDate || !applyToDate) {
      alert("Please select From Date and To Date.");
      return;
    }
    const fromStr = applyFromDate.format("YYYY-MM-DD");
    const toStr = applyToDate.format("YYYY-MM-DD");
    if (toStr < fromStr) {
      alert("To Date must be on or after From Date.");
      return;
    }
    setApplySubmitting(true);
    try {
      const res = await apiService.createLeaveApplication({
        leave_type_id: Number(typeId),
        staff_id: staffId,
        start_date: fromStr,
        end_date: toStr,
        reason: applyReason.trim() || null,
      });
      if (res?.status === "SUCCESS") {
        onLeaveApplied?.();
        hideApplyLeaveModal();
        setApplyLeaveType(null);
        setApplyFromDate(null);
        setApplyToDate(null);
        setApplyReason("");
      } else {
        alert(res?.message || "Failed to apply leave.");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to apply leave.");
    } finally {
      setApplySubmitting(false);
    }
  };
  return (
    <>
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
                    data-bs-dismiss="modal"
                    className="btn btn-danger"
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
      <>
        {/* Login Details */}
        <div className="modal fade" id="login_detail">
          <div className="modal-dialog modal-dialog-centered  modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Login Details</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <div className="modal-body">
                <div className="student-detail-info">
                  <span className="student-img">
                    <ImageWithBasePath
                      src="assets/img/teachers/teacher-01.jpg"
                      alt="img"
                    />
                  </span>
                  <div className="name-info">
                    <h6>
                      Teresa <span>III, A</span>
                    </h6>
                  </div>
                </div>
                <div className="table-responsive custom-table no-datatable_length">
                  <table className="table datanew">
                    <thead className="thead-light">
                      <tr>
                        <th>User Type</th>
                        <th>User Name</th>
                        <th>Password </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Teacher</td>
                        <td>teacher20</td>
                        <td>teacher@53</td>
                      </tr>
                      <tr>
                        <td>Parent</td>
                        <td>parent53</td>
                        <td>parent@53</td>
                      </tr>
                    </tbody>
                  </table>
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
              </div>
            </div>
          </div>
        </div>
        {/* /Login Details */}
      </>
      {/* Apply Leave */}
      <div className="modal fade" id="apply_leave_teacher">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Apply Leave</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleApplyLeaveSubmit}>
              <div id="modal-datepicker-teacher" className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Leave Type</label>
                      <Select
                        classNamePrefix="react-select"
                        className="select"
                        options={leaveTypeOptions}
                        value={applyLeaveType}
                        onChange={setApplyLeaveType}
                        placeholder="Select Leave Type"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Leave From Date</label>
                      <div className="date-pic">
                        <DatePicker
                          className="form-control datetimepicker"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          value={applyFromDate}
                          onChange={(d) => setApplyFromDate(d)}
                          placeholder="Select date"
                        />
                        <span className="cal-icon"><i className="ti ti-calendar" /></span>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Leave To Date</label>
                      <div className="date-pic">
                        <DatePicker
                          className="form-control datetimepicker"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          value={applyToDate}
                          onChange={(d) => setApplyToDate(d)}
                          placeholder="Select date"
                        />
                        <span className="cal-icon"><i className="ti ti-calendar" /></span>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter reason (optional)"
                        value={applyReason}
                        onChange={(e) => setApplyReason(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={applySubmitting || !staffId}>
                  {applySubmitting ? "Submitting..." : "Apply Leave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Apply Leave */}
    </>
  );
};

export default TeacherModal;
