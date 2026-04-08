import { useRef, useMemo } from "react";
import type { TableData } from "../../../../core/data/interface";
import Table from "../../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../../core/common/datePicker";
import CommonSelect from "../../../../core/common/commonSelect";
import { activeList, leaveType } from "../../../../core/common/selectoption/selectoption";
import { Link } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { isAdministrativeRole, isHeadmasterRole } from "../../../../core/utils/roleUtils";

const ListLeaves = () => {
  const routes = all_routes;
  const { user: currentUser } = useCurrentUser();
  const canUseAdminList = isHeadmasterRole(currentUser);
  const isOwnLeavesOnly = isAdministrativeRole(currentUser);
  const { leaveApplications, loading: leaveLoading, error: leaveError, refetch: refetchLeaves } = useLeaveApplications({
    limit: 50,
    canUseAdminList,
    studentOnly: isOwnLeavesOnly,
  });

  const data = useMemo(() => {
    if (!Array.isArray(leaveApplications)) return [];
    return leaveApplications.map((row) => ({
      key: row.key ?? String(row.id),
      id: row.id,
      submittedBy: row.name ?? "—",
      leaveType: row.leaveType ?? "—",
      role: row.role ?? "—",
      leaveDate: row.leaveRange ?? row.leaveDate ?? "—",
      noofDays: row.noOfDays ?? "—",
      appliedOn: row.applyOn ?? "—",
      status: row.status ?? "Pending",
    }));
  }, [leaveApplications]);

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (id: number) => (
        <Link to="#" className="link-primary">{id ?? "—"}</Link>
      ),
    },
    {
      title: "Submitted By",
      dataIndex: "submittedBy",
      sorter: (a: TableData, b: TableData) => String(a?.submittedBy ?? "").localeCompare(String(b?.submittedBy ?? "")),
    },
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      sorter: (a: TableData, b: TableData) => String(a?.leaveType ?? "").length - String(b?.leaveType ?? "").length,
    },
    {
      title: "Role",
      dataIndex: "role",
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
    },
    {
      title: "No of Days",
      dataIndex: "noofDays",
    },
    {
      title: "Applied On",
      dataIndex: "appliedOn",
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
      sorter: (a: any, b: any) => String(a?.status ?? "").length - String(b?.status ?? "").length,
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
                <h3 className="page-title mb-1">List of Leaves</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">HRM</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      List of Leaves
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
                <TooltipOption />
              </div>
            </div>
            {/* /Page Header */}
            {/* Filter Section */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Leave List</h4>
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
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Leave Type</label>
                               
                                <CommonSelect
                                  className="select"
                                  options={leaveType}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
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
                    {/* List Leaves List */}
                    <Table columns={columns} dataSource={data} Selection={true} />
                    {/* / List Leaves List */}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Add Leaves */}
        <div className="modal fade" id="add_leaves">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Leave Type</h4>
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
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Leave Type</label>
                        <input type="text" className="form-control" />
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="switch-sm"
                          />
                        </div>
                      </div>
                    </div>
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
                    Add Leave Type
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Leaves */}
        {/* Edit Leaves */}
        <div className="modal fade" id="edit_leaves">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Leave Type</h4>
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
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Leave Type</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Leave Type"
                          defaultValue="Medical Leave"
                        />
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="switch-sm2"
                          />
                        </div>
                      </div>
                    </div>
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
                    Save Changes
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Leaves */}
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

export default ListLeaves;
