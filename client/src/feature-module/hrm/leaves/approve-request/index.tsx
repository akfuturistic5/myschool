import { useRef, useMemo, useState } from "react";
import { all_routes } from "../../../router/all_routes";
import { Link } from "react-router-dom";
import type { TableData } from "../../../../core/data/interface";
import Table from "../../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../../core/common/datePicker";
import CommonSelect from "../../../../core/common/commonSelect";
import { activeList, leaveType, MonthDate, Role } from "../../../../core/common/selectoption/selectoption";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { apiService } from "../../../../core/services/apiService";
import { isAdministrativeRole, isHeadmasterRole } from "../../../../core/utils/roleUtils";
import { parseFetchErrorMessage } from "../../../../core/utils/parseFetchErrorMessage";

const toYmd = (dateStr: any) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
};

const ApproveRequest = () => {
  const routes = all_routes;
  const [leaveActionId, setLeaveActionId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"view" | "approve" | "reject">("view");
  const [approvedStartDate, setApprovedStartDate] = useState<string>("");
  const [approvedEndDate, setApprovedEndDate] = useState<string>("");
  const [rejectionInput, setRejectionInput] = useState<string>("");
  const [modalFeedback, setModalFeedback] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const { user: currentUser } = useCurrentUser() as any;
  const roleName = String(currentUser?.role_name || currentUser?.role || "").toLowerCase();
  const roleId = Number(currentUser?.user_role_id);
  const isTeacher = roleId === 2 || roleName === "teacher" || roleName.includes("teacher");
  const canUseAdminList = isTeacher || isHeadmasterRole(currentUser) || isAdministrativeRole(currentUser);
  const applicantType = isTeacher ? "student" : "staff";
  const { leaveApplications, loading: leaveLoading, error: leaveError, refetch: refetchLeaves } = useLeaveApplications({
    limit: 50,
    canUseAdminList,
    pendingOnly: true,
    applicantType,
  }) as any;

  const data = useMemo(() => {
    if (!Array.isArray(leaveApplications)) return [];
    const pendingOnly = leaveApplications.filter((row) =>
      String(row?.status ?? "").toLowerCase() === "pending"
    );
    return pendingOnly.map((row) => ({
      key: row.key ?? String(row.id),
      id: row.id,
      submittedBy: row.name ?? "—",
      leaveType: row.leaveType ?? "—",
      role: row.role ?? "—",
      leaveDate: row.leaveRange ?? row.leaveDate ?? "—",
      noofDays: row.noOfDays ?? "—",
      appliedOn: row.appliedOn ?? "—",
      status: row.status ?? "Pending",
      description: row.description ?? "",
      document_url: row.document_url ?? null,
      photoUrl: row.photoUrl ?? "",
      startDate: row.startDate,
      endDate: row.endDate,
    }));
  }, [leaveApplications]);

  const handleOpenAction = (record: any, type: "view" | "approve" | "reject") => {
    setSelectedRecord(record);
    setActionType(type);
    setApprovedStartDate(toYmd(record.startDate));
    setApprovedEndDate(toYmd(record.endDate));
    setRejectionInput("");
    setModalFeedback(null);
  };

  const handleModalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRecord || leaveActionId != null) return;

    setLeaveActionId(selectedRecord.id);
    setModalFeedback(null);
    setActionFeedback(null);

    try {
      const id = selectedRecord.id;
      if (actionType === "approve") {
        if (!approvedStartDate || !approvedEndDate) {
          setModalFeedback({ type: "danger", text: "Approved start and end dates are required." });
          setLeaveActionId(null);
          return;
        }
        const start = new Date(approvedStartDate);
        const end = new Date(approvedEndDate);
        if (end < start) {
          setModalFeedback({ type: "danger", text: "End date cannot be earlier than start date." });
          setLeaveActionId(null);
          return;
        }

        const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);

        const options: any = {
          start_date: approvedStartDate,
          end_date: approvedEndDate,
          total_days: totalDays
        };
        const res = await apiService.updateLeaveApplicationStatus(id, "approved", options);
        if (res?.status === "SUCCESS") {
          setActionFeedback({
            type: "success",
            text: `Leave approved for ${totalDays} days (${approvedStartDate} to ${approvedEndDate}).`
          });
          setSelectedRecord(null);
          await refetchLeaves();
        } else {
          setModalFeedback({ type: "danger", text: res?.message || "Could not approve leave." });
        }
      } else if (actionType === "reject") {
        const reason = rejectionInput.trim();
        if (!reason) {
          setModalFeedback({ type: "danger", text: "Rejection reason is required." });
          setLeaveActionId(null);
          return;
        }
        const res = await apiService.updateLeaveApplicationStatus(id, "rejected", { rejection_reason: reason });
        if (res?.status === "SUCCESS") {
          setActionFeedback({ type: "success", text: "Leave rejected successfully." });
          setSelectedRecord(null);
          await refetchLeaves();
        } else {
          setModalFeedback({ type: "danger", text: res?.message || "Could not reject leave." });
        }
      }
    } catch (e: unknown) {
      setModalFeedback({ type: "danger", text: parseFetchErrorMessage(e) });
    } finally {
      setLeaveActionId(null);
    }
  };

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const columns = [
    {
      title: "Submitted By",
      dataIndex: "submittedBy",
      sorter: (a: TableData, b: TableData) =>
        String(a?.submittedBy ?? "").localeCompare(String(b?.submittedBy ?? "")),
    },
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      sorter: (a: TableData, b: TableData) =>
        String(a?.leaveType ?? "").localeCompare(String(b?.leaveType ?? "")),
    },
    {
      title: "Role",
      dataIndex: "role",
      sorter: (a: TableData, b: TableData) => String(a?.role ?? "").localeCompare(String(b?.role ?? "")),
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
      sorter: (a: TableData, b: TableData) =>
        String(a?.leaveDate ?? "").localeCompare(String(b?.leaveDate ?? "")),
    },
    {
      title: "No of Days",
      dataIndex: "noofDays",
      sorter: (a: TableData, b: TableData) =>
        String(a?.noofDays ?? "").localeCompare(String(b?.noofDays ?? "")),
    },
    {
      title: "Applied On",
      dataIndex: "appliedOn",
      sorter: (a: TableData, b: TableData) =>
        String(a?.appliedOn ?? "").localeCompare(String(b?.appliedOn ?? "")),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => {
        const t = (text ?? "").toString();
        const isApproved = t.toLowerCase().includes("approv");
        const isRejected = t.toLowerCase().includes("reject") || t.toLowerCase().includes("declin");
        const badgeClass = isApproved ? "badge-soft-success" : isRejected ? "badge-soft-danger" : "badge-soft-pending";
        return (
          <span className={`badge ${badgeClass} d-inline-flex align-items-center`}>
            <i className="ti ti-circle-filled fs-5 me-1" />
            {t || "Pending"}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) =>
        String(a?.status ?? "").localeCompare(String(b?.status ?? "")),
    },
    {
      title: "Action",
      dataIndex: "id",
      render: (_: unknown, record: { id?: number; status?: string; noofDays?: string | number }) => {
        const id = record?.id;
        const statusLower = (record?.status ?? "").toString().toLowerCase();
        const isApproved = statusLower.includes("approv");
        const isRejected = statusLower.includes("reject") || statusLower.includes("declin");
        const disabled = leaveActionId != null || isApproved || isRejected;
        if (id == null) return null;
        return (
          <div className="d-flex gap-1 align-items-center">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
              onClick={() => handleOpenAction(record, "view")}
              disabled={disabled}
            >
              <i className="ti ti-eye fs-14" />
              Review
            </button>
            <button
              type="button"
              className="avatar avatar-xs p-0 btn btn-success"
              onClick={() => handleOpenAction(record, "approve")}
              disabled={disabled}
              title="Approve"
            >
              <i className="ti ti-checks" />
            </button>
            <button
              type="button"
              className="avatar avatar-xs p-0 btn btn-danger"
              onClick={() => handleOpenAction(record, "reject")}
              disabled={disabled}
              title="Reject"
            >
              <i className="ti ti-x" />
            </button>
          </div>
        );
      },
    },
  ];

  const exportHeaders = ["Submitted By", "Leave Type", "Role", "Leave Date", "No of Days", "Applied On", "Status"];
  const exportRows = useMemo(
    () =>
      data.map((row: any) => [
        row.submittedBy ?? "—",
        row.leaveType ?? "—",
        row.role ?? "—",
        row.leaveDate ?? "—",
        row.noofDays ?? "—",
        row.appliedOn ?? "—",
        row.status ?? "—",
      ]),
    [data]
  );

  const downloadCsv = (filename: string) => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [exportHeaders, ...exportRows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTable = () => {
    const htmlRows = exportRows
      .map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=1200,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Leave Approval Requests</title>
      <style>
        body{font-family:Arial,sans-serif;padding:16px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
        th{background:#f5f5f5}
      </style></head><body>
      <h3>Leave Approval Requests</h3>
      <table><thead><tr>${exportHeaders.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${htmlRows}</tbody></table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">
                  {isTeacher ? "Student Leave Requests" : "Leave Approval Requests"}
                </h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={isTeacher ? routes.teacherDashboard : routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">{isTeacher ? "Peoples" : "HRM"}</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      {isTeacher ? "Student Leaves" : "Leave Approval Requests"}
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={() => refetchLeaves()}
                onPrint={printTable}
                onExportPdf={printTable}
                onExportExcel={() => downloadCsv("leave-approval-requests.csv")}
              />
              </div>
            </div>
            {/* Page Header*/}
            {/* Filter Section */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">
                  {isTeacher ? "Pending Student Leave Requests" : "Pending Leave Requests"}
                </h4>
                <div className="d-flex align-items-center flex-wrap">
                  <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
                  </div>
                  <div className="dropdown mb-3 me-2">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                      data-bs-auto-close="outside"
                    >
                      <i className="ti ti-filter me-2" />
                      Filter
                    </Link>
                    <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                      <form >
                        <div className="d-flex align-items-center border-bottom p-3">
                          <h4>Filter</h4>
                        </div>
                        <div className="p-3 border-bottom">
                          <div className="row">
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Leave Type</label>
                               
                                <CommonSelect
                                  className="select"
                                  options={leaveType}
                                />
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Role</label>
                                <CommonSelect
                                  className="select"
                                  options={Role}
                                />
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="mb-0">
                                <label className="form-label">
                                  From - To Date
                                </label>
                                <CommonSelect
                                  className="select"
                                  options={MonthDate}
                                />
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="mb-0">
                                <label className="form-label">Status</label>
                                <CommonSelect
                                  className="select"
                                  options={activeList}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 d-flex align-items-center justify-content-end">
                          <Link to="#" className="btn btn-light me-3">
                            Reset
                          </Link>
                          <Link
                            to="#"
                            className="btn btn-primary"
                            onClick={handleApplyClick}
                          >
                            Apply
                          </Link>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="dropdown mb-3">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                    >
                      <i className="ti ti-sort-ascending-2 me-2" />
                      Sort by A-Z
                    </Link>
                    <ul className="dropdown-menu p-3">
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1 active"
                        >
                          Ascending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Descending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Viewed
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Added
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="card-body p-0 py-3">
                {actionFeedback && (
                  <div
                    className={`alert alert-${actionFeedback.type === "success" ? "success" : "danger"} mx-3 mt-3 mb-0 d-flex justify-content-between align-items-start gap-2`}
                    role="alert"
                  >
                    <span className="small mb-0">{actionFeedback.text}</span>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Dismiss"
                      onClick={() => setActionFeedback(null)}
                    />
                  </div>
                )}
                {leaveError && (
                  <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                    {leaveError}
                  </div>
                )}
                {leaveLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 mb-0">Loading leave applications...</p>
                  </div>
                ) : (
                  <>
                    {/* Approve List */}
                    <Table dataSource={data} columns={columns} Selection={true} />
                    {/* /Approve List */}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Leave Request Modal */}
        {selectedRecord && (
          <>
            <div
              className="modal fade show animate__animated animate__fadeIn animate__faster"
              style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: 1050 }}
            >
              <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "12px" }}>
                  <div className="modal-header bg-light border-bottom-0 pb-0 pt-3 px-4">
                    <h4 className="modal-title d-flex align-items-center gap-2 text-primary fw-bold">
                      <i className="ti ti-file-text fs-22" />
                      Leave Request Details
                    </h4>
                    <button
                      type="button"
                      className="btn-close custom-btn-close border-0 bg-transparent"
                      aria-label="Close"
                      onClick={() => setSelectedRecord(null)}
                    >
                      <i className="ti ti-x fs-18 text-muted" />
                    </button>
                  </div>
                  <form onSubmit={handleModalSubmit}>
                    <div className="modal-body px-4 py-3">
                      {modalFeedback && (
                        <div
                          className={`alert alert-${modalFeedback.type === "success" ? "success" : "danger"} d-flex justify-content-between align-items-start gap-2 mb-3`}
                          role="alert"
                        >
                          <span className="small mb-0">{modalFeedback.text}</span>
                          <button
                            type="button"
                            className="btn-close"
                            aria-label="Dismiss"
                            onClick={() => setModalFeedback(null)}
                          />
                        </div>
                      )}
                      
                      {/* Detailed Grid Info */}
                      <div className="student-leave-info p-3 mb-3 bg-light rounded" style={{ border: "1px solid #eaeaea" }}>
                        <div className="row g-3">
                          <div className="col-sm-6 col-md-4">
                            <span className="text-muted d-block small">Submitted By</span>
                            <h6 className="mb-0 text-dark fw-semibold">{selectedRecord.submittedBy}</h6>
                          </div>
                          <div className="col-sm-6 col-md-4">
                            <span className="text-muted d-block small">Role</span>
                            <h6 className="mb-0 text-dark fw-semibold">{selectedRecord.role}</h6>
                          </div>
                          <div className="col-sm-6 col-md-4">
                            <span className="text-muted d-block small">Leave Type</span>
                            <h6 className="mb-0 text-dark fw-semibold">{selectedRecord.leaveType}</h6>
                          </div>
                          <div className="col-sm-6 col-md-4">
                            <span className="text-muted d-block small">Leave Dates</span>
                            <h6 className="mb-0 text-dark fw-semibold">{selectedRecord.leaveDate}</h6>
                          </div>
                          <div className="col-sm-6 col-md-4">
                            <span className="text-muted d-block small">Number of Days</span>
                            <h6 className="mb-0 text-dark fw-semibold">{selectedRecord.noofDays}</h6>
                          </div>
                          <div className="col-sm-6 col-md-4">
                            <span className="text-muted d-block small">Applied On</span>
                            <h6 className="mb-0 text-dark fw-semibold">{selectedRecord.appliedOn}</h6>
                          </div>
                        </div>
                      </div>

                      {/* Reason Description */}
                      <div className="mb-3 p-3 bg-light rounded" style={{ border: "1px solid #eaeaea" }}>
                        <span className="text-muted d-block small mb-1">Reason / Description</span>
                        <p className="mb-0 text-dark small" style={{ whiteSpace: "pre-wrap" }}>
                          {selectedRecord.description || "No description provided."}
                        </p>
                      </div>

                      {/* Attachment URL (PDF / Image) */}
                      {selectedRecord.document_url && (
                        <div className="mb-3 d-flex align-items-center gap-2">
                          <i className="ti ti-paperclip text-primary fs-18" />
                          <span className="text-muted small">Attachment:</span>
                          <a
                            href={selectedRecord.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-link btn-sm p-0 d-inline-flex align-items-center gap-1 fw-medium text-decoration-none"
                          >
                            View Document / Receipt
                            <i className="ti ti-external-link fs-14" />
                          </a>
                        </div>
                      )}

                      {/* Actions Tab / Choice */}
                      <div className="mb-2">
                        <label className="form-label fw-semibold">Choose Action</label>
                        <div className="d-flex align-items-center gap-3">
                          <button
                            type="button"
                            className={`btn btn-sm d-flex align-items-center gap-1 ${actionType === "view" ? "btn-primary" : "btn-outline-primary"}`}
                            onClick={() => { setActionType("view"); setModalFeedback(null); }}
                          >
                            <i className="ti ti-info-circle fs-16" />
                            View Details Only
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm d-flex align-items-center gap-1 ${actionType === "approve" ? "btn-success" : "btn-outline-success"}`}
                            onClick={() => { setActionType("approve"); setModalFeedback(null); }}
                          >
                            <i className="ti ti-check fs-16" />
                            Approve Leave
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm d-flex align-items-center gap-1 ${actionType === "reject" ? "btn-danger" : "btn-outline-danger"}`}
                            onClick={() => { setActionType("reject"); setModalFeedback(null); }}
                          >
                            <i className="ti ti-x fs-16" />
                            Reject Leave
                          </button>
                        </div>
                      </div>

                      {/* Conditional input forms inside the modal */}
                      {actionType === "approve" && (
                        <div className="mt-3 p-3 border rounded bg-light-success">
                          <h6 className="mb-2 text-success fw-bold">Select Approved Date Range</h6>
                          <div className="row g-2">
                            <div className="col-md-6">
                              <label className="form-label small fw-semibold">Start Date</label>
                              <input
                                type="date"
                                className="form-control"
                                value={approvedStartDate}
                                onChange={(e) => setApprovedStartDate(e.target.value)}
                                min={toYmd(selectedRecord.startDate)}
                                max={toYmd(selectedRecord.endDate)}
                              />
                            </div>
                            <div className="col-md-6">
                              <label className="form-label small fw-semibold">End Date</label>
                              <input
                                type="date"
                                className="form-control"
                                value={approvedEndDate}
                                onChange={(e) => setApprovedEndDate(e.target.value)}
                                min={approvedStartDate || toYmd(selectedRecord.startDate)}
                                max={toYmd(selectedRecord.endDate)}
                              />
                            </div>
                          </div>
                          <div className="form-text text-muted small mt-2">
                            Applied range: {selectedRecord.leaveDate} ({selectedRecord.noofDays} days).
                            {approvedStartDate && approvedEndDate && (
                              <span className="text-success fw-semibold ms-1">
                                Approving {Math.max(1, Math.round((new Date(approvedEndDate).getTime() - new Date(approvedStartDate).getTime()) / (24 * 60 * 60 * 1000)) + 1)} days.
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {actionType === "reject" && (
                        <div className="mt-3 p-3 border rounded bg-light-danger">
                          <div className="mb-0">
                            <label className="form-label fw-semibold text-danger">Rejection Reason</label>
                            <textarea
                              className="form-control"
                              rows={3}
                              placeholder="Please provide a reason for rejecting this leave application..."
                              value={rejectionInput}
                              onChange={(e) => setRejectionInput(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="modal-footer border-top-0 pt-0 px-4 pb-3">
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => setSelectedRecord(null)}
                      >
                        Close
                      </button>
                      {actionType !== "view" && (
                        <button
                          type="submit"
                          className={`btn ${actionType === "approve" ? "btn-success" : "btn-danger"} d-flex align-items-center gap-1`}
                          disabled={leaveActionId != null}
                        >
                          {leaveActionId != null && (
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                          )}
                          Submit {actionType === "approve" ? "Approval" : "Rejection"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
            {/* Modal Backdrop overlay */}
            <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => setSelectedRecord(null)} />
          </>
        )}
        {/* Delete Modal */}
        <div className="modal fade" id="delete-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form >
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
                    <Link to="#" className="btn btn-danger" data-bs-dismiss="modal">
                      Yes, Delete
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Delete Modal */}
      </>
    </div>
  );
};

export default ApproveRequest;





