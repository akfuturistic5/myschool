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
import { isHeadmasterRole } from "../../../../core/utils/roleUtils";

const ApproveRequest = () => {
  const routes = all_routes;
  const [leaveActionId, setLeaveActionId] = useState<number | null>(null);
  const { user: currentUser } = useCurrentUser();
  const canUseAdminList = isHeadmasterRole(currentUser);
  const { leaveApplications, loading: leaveLoading, error: leaveError, refetch: refetchLeaves } = useLeaveApplications({
    limit: 50,
    canUseAdminList,
  });

  const data = useMemo(() => {
    if (!Array.isArray(leaveApplications)) return [];
    const approvedOnly = leaveApplications.filter((row) =>
      String(row?.status ?? "").toLowerCase().includes("approv")
    );
    return approvedOnly.map((row) => ({
      key: row.key ?? String(row.id),
      id: row.id,
      submittedBy: row.name ?? "—",
      leaveType: row.leaveType ?? "—",
      role: row.role ?? "—",
      leaveDate: row.leaveRange ?? row.leaveDate ?? "—",
      noofDays: row.noOfDays ?? "—",
      appliedOn: row.applyOn ?? "—",
      authority: "—",
      status: row.status ?? "Pending",
    }));
  }, [leaveApplications]);

  const handleApprove = async (id: number) => {
    if (leaveActionId != null) return;
    setLeaveActionId(id);
    try {
      const res = await apiService.updateLeaveApplicationStatus(id, "approved");
      if (res?.status === "SUCCESS") refetchLeaves();
    } catch (_) {
      // ignore
    } finally {
      setLeaveActionId(null);
    }
  };

  const handleReject = async (id: number) => {
    if (leaveActionId != null) return;
    setLeaveActionId(id);
    try {
      const res = await apiService.updateLeaveApplicationStatus(id, "rejected");
      if (res?.status === "SUCCESS") refetchLeaves();
    } catch (_) {
      // ignore
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
      title: "Authority",
      dataIndex: "authority",
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
      render: (_: unknown, record: { id?: number; status?: string }) => {
        const id = record?.id;
        const statusLower = (record?.status ?? "").toString().toLowerCase();
        const isApproved = statusLower.includes("approv");
        const isRejected = statusLower.includes("reject") || statusLower.includes("declin");
        const disabled = leaveActionId != null || isApproved || isRejected;
        if (id == null) return null;
        return (
          <div className="d-flex gap-1">
            <button
              type="button"
              className="avatar avatar-xs p-0 btn btn-success"
              onClick={() => handleApprove(Number(id))}
              disabled={disabled}
              title="Approve"
            >
              <i className="ti ti-checks" />
            </button>
            <button
              type="button"
              className="avatar avatar-xs p-0 btn btn-danger"
              onClick={() => handleReject(Number(id))}
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
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Approved Leave Request</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">HRM</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Approved Leave Request
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              </div>
            </div>
            {/* Page Header*/}
            {/* Filter Section */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Approved Leave Request List</h4>
                <div className="d-flex align-items-center flex-wrap">
                  <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
                  </div>
                  <div className="dropdown mb-3 me-2">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown"
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
                      data-bs-toggle="dropdown"
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
        {/* Leave Request */}
        <div className="modal fade" id="leave_request">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Leave Request</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form >
                <div className="modal-body">
                  <div className="student-leave-info">
                    <ul>
                      <li>
                        <span>Submitted By</span>
                        <h6>James Deckar</h6>
                      </li>
                      <li>
                        <span>ID / Roll No</span>
                        <h6>9004</h6>
                      </li>
                      <li>
                        <span>Role</span>
                        <h6>Student</h6>
                      </li>
                      <li>
                        <span>Leave Type</span>
                        <h6>Medical Leave</h6>
                      </li>
                      <li>
                        <span>No of Days</span>
                        <h6>2</h6>
                      </li>
                      <li>
                        <span>Applied On</span>
                        <h6>04 May 2024</h6>
                      </li>
                      <li>
                        <span>Authoity</span>
                        <h6>Jacquelin</h6>
                      </li>
                      <li>
                        <span>Leave</span>
                        <h6>05 May 2024 - 07 may 2024</h6>
                      </li>
                    </ul>
                  </div>
                  <div className="mb-3 leave-reason">
                    <h6 className="mb-1">Reason</h6>
                    <span>Headache &amp; fever</span>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Approval Status</label>
                    <div className="d-flex align-items-center check-radio-group">
                      <label className="custom-radio">
                        <input type="radio" name="radio" checked />
                        <span className="checkmark" />
                        Pending
                      </label>
                      <label className="custom-radio">
                        <input type="radio" name="radio" />
                        <span className="checkmark" />
                        Approved
                      </label>
                      <label className="custom-radio">
                        <input type="radio" name="radio" />
                        <span className="checkmark" />
                        Disapproved
                      </label>
                    </div>
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Note</label>
                    <textarea
                      className="form-control"
                      placeholder="Add Comment"
                      rows={4}
                      defaultValue={""}
                    />
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
                  <Link to="#" className="btn btn-primary" data-bs-dismiss="modal">
                    Submit
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Leave Request */}
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
