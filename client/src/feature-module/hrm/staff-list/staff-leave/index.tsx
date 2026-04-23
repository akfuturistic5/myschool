import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import { all_routes } from "../../../router/all_routes";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import Select from "react-select";
import type { SingleValue } from "react-select";
import { apiService } from "../../../../core/services/apiService";
import { useLeaveTypes } from "../../../../core/hooks/useLeaveTypes";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import { useStaffProfileLoader } from "../useStaffProfileLoader";
import { StaffProfileSidebar } from "../StaffProfileSidebar";
import { StaffProfilePageHeader } from "../StaffProfilePageHeader";

const StaffLeave = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const canManageDirectory = canManageStaffDirectory(user);
  const { staffId, staff, loading, error, detailSearch, navState, pk } =
    useStaffProfileLoader();

  const isOwnProfile =
    staff != null &&
    staff.user_id != null &&
    String(staff.user_id) === String(user?.id ?? "");

  const { leaveApplications, loading: leaveLoading, refetch } =
    useLeaveApplications({
      limit: 100,
      studentOnly: isOwnProfile,
      staffId:
        !isOwnProfile && Number.isFinite(pk) && pk > 0 ? pk : null,
      canUseAdminList: canManageDirectory,
    });

  const data = (Array.isArray(leaveApplications) ? leaveApplications : []).map(
    (l: any) => ({ ...l, leaveDate: l.leaveRange })
  );
  const { leaveTypes } = useLeaveTypes();
  const [applyType, setApplyType] = useState<SingleValue<{ value: string; label: string }>>(null);
  const [applyFrom, setApplyFrom] = useState<Dayjs | null>(null);
  const [applyTo, setApplyTo] = useState<Dayjs | null>(null);
  const [applyReason, setApplyReason] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [cancelingLeaveId, setCancelingLeaveId] = useState<number | null>(null);

  const leaveSummary = useMemo(() => {
    const leaves = Array.isArray(leaveApplications) ? leaveApplications : [];
    return (Array.isArray(leaveTypes) ? leaveTypes : []).map((t: any) => {
      const typeId = Number(t?.id ?? t?.value);
      const typeLabel = String(t?.label ?? t?.leave_type ?? "Leave");
      const yearlyLimit = Number(t?.max_days_per_year ?? t?.max_days ?? 0);
      const used = leaves
        .filter((l: any) => {
          const status = String(l?.status || "").toLowerCase();
          const includeByStatus = ["pending", "approved"].includes(status);
          const byId =
            Number.isFinite(typeId) &&
            typeId > 0 &&
            Number(l?.leaveTypeId) === typeId;
          const byName =
            !byId &&
            String(l?.leaveType || "")
              .trim()
              .toLowerCase() === typeLabel.toLowerCase();
          return includeByStatus && (byId || byName);
        })
        .reduce((sum: number, l: any) => sum + Number(l?.noOfDays || 0), 0);
      const available = Number.isFinite(yearlyLimit)
        ? Math.max(yearlyLimit - used, 0)
        : 0;
      return {
        key: String(typeId || typeLabel),
        leaveType: typeLabel,
        yearlyLimit: Number.isFinite(yearlyLimit) ? yearlyLimit : 0,
        used,
        available,
      };
    });
  }, [leaveApplications, leaveTypes]);

  const getModalContainer = () => document.body;

  const hideModal = () => {
    const el = document.getElementById("apply_leave_staff");
    if (el) (window as any).bootstrap?.Modal?.getInstance(el)?.hide();
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typeId = applyType?.value;
    if (!typeId) {
      alert("Select Leave Type");
      return;
    }
    if (!applyFrom || !applyTo) {
      alert("Select From and To dates");
      return;
    }
    if (!applyReason.trim()) {
      alert("Reason is required");
      return;
    }
    const fromStr = applyFrom.format("YYYY-MM-DD");
    const toStr = applyTo.format("YYYY-MM-DD");
    if (toStr < fromStr) {
      alert("To date must be on or after From date");
      return;
    }
    setApplySubmitting(true);
    try {
      const res = await apiService.createLeaveApplication({
        leave_type_id: Number(typeId),
        start_date: fromStr,
        end_date: toStr,
        reason: applyReason.trim(),
      });
      if (res?.status === "SUCCESS") {
        refetch();
        hideModal();
        setApplyType(null);
        setApplyFrom(null);
        setApplyTo(null);
        setApplyReason("");
      } else alert(res?.message || "Failed to apply leave");
    } catch (err: any) {
      alert(err?.message || "Failed to apply leave");
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleCancelLeave = async (id?: number) => {
    if (!id || cancelingLeaveId != null) return;
    const ok = window.confirm("Cancel this pending leave request?");
    if (!ok) return;
    setCancelingLeaveId(id);
    try {
      const res = await apiService.cancelLeaveApplication(id);
      if (res?.status === "SUCCESS") refetch();
      else alert(res?.message || "Failed to cancel leave");
    } catch (err: any) {
      alert(err?.message || "Failed to cancel leave");
    } finally {
      setCancelingLeaveId(null);
    }
  };

  const columns = [
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      sorter: (a: TableData, b: TableData) =>
        String(a.leaveType).localeCompare(String(b.leaveType)),
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
      sorter: (a: TableData, b: TableData) =>
        String(a.leaveDate).localeCompare(String(b.leaveDate)),
    },
    {
      title: "No Of Days",
      dataIndex: "noOfDays",
      sorter: (a: TableData, b: TableData) =>
        String(a.noOfDays).localeCompare(String(b.noOfDays)),
    },
    {
      title: "AppliedOn",
      dataIndex: "appliedOn",
      sorter: (a: TableData, b: TableData) =>
        String(a.appliedOn).localeCompare(String(b.appliedOn)),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => {
        const status = String(text || "").toLowerCase();
        const badgeClass =
          status === "approved"
            ? "badge-soft-success"
            : status === "rejected"
              ? "badge-soft-danger"
              : status === "cancelled"
                ? "badge-soft-secondary"
                : "badge-soft-pending";
        const label = status
          ? status.charAt(0).toUpperCase() + status.slice(1)
          : "Pending";
        return (
          <span
            className={`badge ${badgeClass} d-inline-flex align-items-center`}
          >
            <i className="ti ti-circle-filled fs-5 me-1"></i>
            {label}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) =>
        String(a.status).localeCompare(String(b.status)),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: any) => (
        <div className="d-flex align-items-center">
          {String(record?.status || "").toLowerCase() === "pending" &&
            isOwnProfile && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleCancelLeave(record?.id)}
                disabled={cancelingLeaveId != null}
              >
                {cancelingLeaveId === record?.id ? "Cancelling..." : "Cancel"}
              </button>
            )}
        </div>
      ),
    },
  ];

  if (staffId == null) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="p-5 text-muted text-center">Redirecting…</div>
        </div>
      </div>
    );
  }

  if (loading || (!staff && !error)) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading staff…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger">{error || "Staff not found."}</div>
          <Link to={routes.staff} className="btn btn-primary">
            Back to staff list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StaffProfilePageHeader
              routes={routes}
              canShowEdit={canManageDirectory}
              editTo={{ pathname: routes.editStaff, search: detailSearch }}
              editState={navState}
            />
            <div className="col-xxl-3 col-lg-4 theiaStickySidebar">
              <div className="stickybar">
                <StaffProfileSidebar staff={staff} />
              </div>
            </div>
            <div className="col-xxl-9 col-lg-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffDetails,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-info-square-rounded me-2" />
                        Basic Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffPayroll,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-file-dollar me-2" />
                        Payroll
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffLeave,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link active"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leaves
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffsAttendance,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Attendance
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="tab-content">
                <div
                  className="tab-pane fade show active"
                  id="pills-leave"
                  role="tabpanel"
                  aria-labelledby="pills-leave"
                >
                  <div className="row gx-3">
                    {leaveSummary.map((s) => (
                      <div className="col-lg-6 col-xxl-3 d-flex" key={s.key}>
                        <div className="card flex-fill">
                          <div className="card-body">
                            <h5 className="mb-2">{`${s.leaveType} (${s.yearlyLimit})`}</h5>
                            <div className="d-flex align-items-center flex-wrap">
                              <p className="border-end pe-2 me-2 mb-0">{`Used : ${s.used}`}</p>
                              <p className="mb-0">{`Available : ${s.available}`}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <h4 className="mb-3">Leaves</h4>
                      {isOwnProfile && (
                        <Link
                          to="#"
                          data-bs-target="#apply_leave_staff"
                          data-bs-toggle="modal"
                          className="btn btn-primary d-inline-flex align-items-center mb-3"
                        >
                          <i className="ti ti-calendar-event me-2" />
                          Apply Leave
                        </Link>
                      )}
                    </div>
                    <div className="card-body p-0 py-3">
                      {leaveLoading && (
                        <div className="p-4 text-center text-muted">Loading...</div>
                      )}
                      {!leaveLoading && (
                        <Table
                          columns={columns}
                          dataSource={data}
                          Selection={false}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal fade" id="apply_leave_staff">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Apply Leave</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleApplySubmit}>
              <div id="modal-datepicker-staff" className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-4">
                      <label className="form-label">Leave Type</label>
                      <Select
                        classNamePrefix="react-select"
                        className="select"
                        options={leaveTypes}
                        value={applyType}
                        onChange={setApplyType}
                        placeholder="Select Leave Type"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="form-label">Leave From Date</label>
                      <div className="date-pic">
                        <DatePicker
                          className="form-control datetimepicker"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          value={applyFrom}
                          onChange={(d) => setApplyFrom(d)}
                          placeholder="Select date"
                        />
                        <span className="cal-icon">
                          <i className="ti ti-calendar" />
                        </span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="form-label">Leave To Date</label>
                      <div className="date-pic">
                        <DatePicker
                          className="form-control datetimepicker"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          value={applyTo}
                          onChange={(d) => setApplyTo(d)}
                          placeholder="Select date"
                        />
                        <span className="cal-icon">
                          <i className="ti ti-calendar" />
                        </span>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Required"
                        value={applyReason}
                        onChange={(e) => setApplyReason(e.target.value)}
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
                  disabled={applySubmitting}
                >
                  {applySubmitting ? "Submitting..." : "Apply Leave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLeave;





