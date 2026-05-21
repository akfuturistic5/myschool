
import { useState, useEffect, useMemo } from "react";
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
  const { leaveTypes: leaveTypeOptions } = useLeaveTypes({ applicableFor: "staff" });
  const [applyLeaveType, setApplyLeaveType] = useState<any>(null);
  const [applyFromDate, setApplyFromDate] = useState<Dayjs | null>(null);
  const [applyToDate, setApplyToDate] = useState<Dayjs | null>(null);
  const [applyReason, setApplyReason] = useState("");
  const [applyDocument, setApplyDocument] = useState<File | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const todayStart = dayjs().startOf("day");

  // Dynamic credentials fetching state
  const [loginRows, setLoginRows] = useState<Array<{ userType: string; username: string | null; phone?: string | null; email?: string | null }>>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<any>(null);

  useEffect(() => {
    if (!staffId) {
      setLoginRows([]);
      setLoginError(null);
      setLoginLoading(false);
      setTeacher(null);
      return;
    }
    let mounted = true;
    setLoginLoading(true);
    setLoginError(null);
    apiService
      .getTeacherById(staffId)
      .then((res: any) => {
        if (!mounted) return;
        if (res?.data) {
          const d = res.data;
          setTeacher(d);
          const rows: Array<{ userType: string; username: string | null; phone?: string | null; email?: string | null }> = [
            {
              userType: 'Teacher',
              username: d.username ?? null,
              phone: d.phone ?? null,
              email: d.email ?? null,
            }
          ];
          setLoginRows(rows);
        } else {
          setLoginRows([]);
          setTeacher(null);
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setLoginError(err?.message || 'Failed to fetch login details');
        setLoginRows([]);
        setTeacher(null);
      })
      .finally(() => {
        if (mounted) setLoginLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [staffId]);

  const maskedLoginRows = useMemo(
    () =>
      loginRows.map((row) => {
        return {
          ...row,
          passwordHint: 'Password configured during registration',
        };
      }),
    [loginRows]
  );
  const [applySubmitting, setApplySubmitting] = useState(false);

  const getModalContainer = () => document.body;

  const hideApplyLeaveModal = () => {
    setApplyError(null);
    const el = document.getElementById("apply_leave_teacher");
    if (el) {
      const bsModal = (window as any).bootstrap?.Modal?.getInstance(el);
      if (bsModal) bsModal.hide();
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError(null);
    if (!staffId) {
      setApplyError("Unable to apply leave: teacher/staff not selected.");
      return;
    }
    const typeId = applyLeaveType?.value;
    if (!typeId) {
      setApplyError("Please select Leave Type.");
      return;
    }
    const isDocRequired = (applyLeaveType as any)?.requires_medical_certificate;
    if (isDocRequired && !applyDocument) {
      setApplyError("An attachment/document is required for this leave type.");
      return;
    }
    if (!applyFromDate || !applyToDate) {
      setApplyError("Please select From Date and To Date.");
      return;
    }
    if (!applyReason.trim()) {
      setApplyError("Please enter a reason.");
      return;
    }
    const fromStr = applyFromDate.format("YYYY-MM-DD");
    const toStr = applyToDate.format("YYYY-MM-DD");
    if (applyFromDate.startOf("day").isBefore(todayStart)) {
      setApplyError("Leave From Date cannot be in the past.");
      return;
    }
    if (toStr < fromStr) {
      setApplyError("To Date must be on or after From Date.");
      return;
    }
    setApplySubmitting(true);
    try {
      let document_url = null;
      if (applyDocument) {
        const uploadRes = await apiService.uploadSchoolStorageFile(applyDocument, 'documents');
        if (uploadRes?.status === 'SUCCESS' && uploadRes?.data?.url) {
          document_url = uploadRes.data.url;
        } else {
          setApplyError('Failed to upload document.');
          setApplySubmitting(false);
          return;
        }
      }

      const res = await apiService.createLeaveApplication({
        leave_type_id: Number(typeId),
        staff_id: staffId,
        start_date: fromStr,
        end_date: toStr,
        reason: applyReason.trim(),
        document_url,
      });
      if (res?.status === "SUCCESS") {
        onLeaveApplied?.();
        hideApplyLeaveModal();
        setApplyLeaveType(null);
        setApplyFromDate(null);
        setApplyToDate(null);
        setApplyReason("");
        setApplyDocument(null);
        setApplyError(null);
      } else {
        setApplyError(res?.message || "Failed to apply leave.");
      }
    } catch (err: any) {
      let msg = err?.message || "Failed to apply leave.";
      try {
        const m = msg.match(/\{[\s\S]*\}/);
        if (m) {
          const j = JSON.parse(m[0]);
          if (j.detail) msg = `${j.message || msg}\n\nDetail: ${j.detail}`;
        }
      } catch (_) {
        // ignore
      }
      if (msg.includes("HTTP error! status: 400, message: ")) {
        msg = msg.replace("HTTP error! status: 400, message: ", "");
      }
      setApplyError(msg);
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
          <div className="modal-dialog modal-dialog-centered modal-lg">
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
                      src={teacher?.photo_url || "assets/img/teachers/teacher-01.jpg"}
                      alt="img"
                    />
                  </span>
                  <div className="name-info">
                    <h6>
                      {teacher ? `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() : "Teacher"}
                      {teacher?.employee_code && (
                        <span> {teacher.employee_code}</span>
                      )}
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
                      {loginLoading && (
                        <tr>
                          <td colSpan={3} className="text-center py-3">Loading login details...</td>
                        </tr>
                      )}
                      {!loginLoading && loginError && (
                        <tr>
                          <td colSpan={3} className="text-center text-danger py-3">{loginError}</td>
                        </tr>
                      )}
                      {!loginLoading && !loginError && maskedLoginRows.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-3">No login account found.</td>
                        </tr>
                      )}
                      {!loginLoading && !loginError && maskedLoginRows.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.userType}</td>
                          <td>{row.username || '—'}</td>
                          <td>
                            <span className="text-muted small">
                              {row.passwordHint}
                            </span>
                          </td>
                        </tr>
                      ))}
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
                    {applyError && (
                      <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-3" role="alert" style={{ gap: '8px' }}>
                        <i className="ti ti-alert-circle" style={{ fontSize: '18px' }} />
                        <div style={{ flex: 1, fontSize: '13px', lineHeight: '1.4' }}>{applyError}</div>
                        <button type="button" className="btn-close ms-auto" style={{ position: 'relative', top: 'auto', right: 'auto', padding: '0.5rem' }} onClick={() => setApplyError(null)} aria-label="Close" />
                      </div>
                    )}
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
                          disabledDate={(current) => !!current && current.startOf("day").isBefore(todayStart)}
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
                          disabledDate={(current) => {
                            if (!current) return false;
                            const inPast = current.startOf("day").isBefore(todayStart);
                            const beforeFrom = applyFromDate ? current.startOf("day").isBefore(applyFromDate.startOf("day")) : false;
                            return inPast || beforeFrom;
                          }}
                        />
                        <span className="cal-icon"><i className="ti ti-calendar" /></span>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter reason"
                        value={applyReason}
                        onChange={(e) => setApplyReason(e.target.value)}
                      />
                    </div>
                    <div className="mb-0 mt-3">
                      <label className="form-label">
                        Attachment { (applyLeaveType as any)?.requires_medical_certificate ? <span className="text-danger">(Required) *</span> : '(Optional)' }
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setApplyDocument(e.target.files[0])
                          } else {
                            setApplyDocument(null)
                          }
                        }}
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

