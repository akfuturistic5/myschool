import { useRef, useState } from "react";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import { activeList, holidays } from "../../../core/common/selectoption/selectoption";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { apiService } from "../../../core/services/apiService";

const Designation = () => {
  const routes = all_routes;
  const { designations, loading, error, refetch } = useDesignations();
  const data = designations;
  const [selectedDesignation, setSelectedDesignation] = useState<any>(null);
  const [editDesignationName, setEditDesignationName] = useState('');
  const [editDesignationStatus, setEditDesignationStatus] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
    const columns = [
      {
        title: "ID",
        dataIndex: "id",
        render: (text: any, record: any) => (
          <>
           <Link to="#" className="link-primary">{text || record.id || 'N/A'}</Link>
          </>
        ),
        sorter: (a: TableData, b: TableData) => String(a.id || '').length - String(b.id || '').length,
      },
  
      {
        title: "Designation",
        dataIndex: "designation",
        sorter: (a: TableData, b: TableData) => a.designation.length - b.designation.length,
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (text: string) => (
            <>
            {text === "Active" ? (
              <span
                className="badge badge-soft-success d-inline-flex align-items-center"
              >
                <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
              </span>
            ):
            (
              <span
                className="badge badge-soft-danger d-inline-flex align-items-center"
              >
                <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
              </span>
            )}
          </>
        ),
        sorter: (a: any, b: any) => a.status.length - b.status.length,
      },
      {
        title: "Action",
        dataIndex: "action",
        render: (text: any, record: any) => (
          <>
            <div className="dropdown">
              <Link
                to="#"
                className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="ti ti-dots-vertical fs-14" />
              </Link>
              <ul className="dropdown-menu dropdown-menu-right p-3">
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const desig = record.originalData || record;
                      const name =
                        desig.designation_name ||
                        desig.designation ||
                        desig.name ||
                        record.designation ||
                        '';
                      let status = true;
                      if (desig && Object.prototype.hasOwnProperty.call(desig, 'is_active')) {
                        status =
                          desig.is_active === true ||
                          desig.is_active === 1 ||
                          desig.is_active === 'true';
                      } else if (record.status) {
                        status = record.status === 'Active';
                      }
                      setEditDesignationName(name);
                      setEditDesignationStatus(status);
                      setSelectedDesignation(record);
                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_designation');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                            modal.show();
                          }
                        }
                      }, 100);
                    }}
                  >
                    <i className="ti ti-edit-circle me-2" />
                    Edit
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#delete-modal"
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </>
        ),
      },
    ];
    const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
    const handleApplyClick = () => {
      if (dropdownMenuRef.current) {
        dropdownMenuRef.current.classList.remove("show");
      }
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
                <h3 className="page-title mb-1">Designation</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">HRM</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Designation
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary d-flex align-items-center"
                    data-bs-toggle="modal"
                    data-bs-target="#add_designation"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Add Designation
                  </Link>
                </div>
              </div>
            </div>
            {/* /Page Header */}
            {/* Students List */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Designation</h4>
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
                <form>
                  <div className="d-flex align-items-center border-bottom p-3">
                    <h4>Filter</h4>
                  </div>
                  <div className="p-3 border-bottom">
                    <div className="row">
                      <div className="col-md-12">
                        <div className="mb-3">
                          <label className="form-label">Holiday Title</label>
                          <CommonSelect
                                  className="select"
                                  options={activeList}
                                />
                        </div>
                      </div>
                      <div className="col-md-12">
                        <div className="mb-0">
                          <label className="form-label">Status</label>
                          <CommonSelect
                                  className="select"
                                  options={holidays}
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
                      Sort by A-Z{" "}
                    </Link>
                    <ul className="dropdown-menu p-3">
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
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
                {/* Loading State */}
                {loading && (
                  <div className="text-center p-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading designations data...</p>
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="text-center p-4">
                    <div className="alert alert-danger" role="alert">
                      <i className="ti ti-alert-circle me-2"></i>
                      {error}
                      <button
                        className="btn btn-sm btn-outline-danger ms-3"
                        onClick={refetch}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* Student List */}
                {!loading && !error && (
                  <Table columns={columns} dataSource={data} Selection={true}/>
                )}
                {/* /Student List */}
              </div>
            </div>
            {/* /Students List */}
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Add Designation */}
        <div className="modal fade" id="add_designation">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Designation</h4>
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
                        <label className="form-label">Designation</label>
                        <input type="text" className="form-control" />
                      </div>
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
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link to="#" className="btn btn-primary" data-bs-dismiss="modal">
                    Add Designation
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Designation */}
        {/* Edit Designation */}
        <div className="modal fade" id="edit_designation">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Designation</h4>
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
                        <label className="form-label">Designation</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Designation"
                          value={editDesignationName}
                          onChange={(e) => setEditDesignationName(e.target.value)}
                        />
                      </div>
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
                          checked={editDesignationStatus}
                          onChange={(e) => setEditDesignationStatus(e.target.checked)}
                        />
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
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      const id = selectedDesignation?.originalData?.id || selectedDesignation?.id;
                      if (!id || isUpdating) return;

                      const name = editDesignationName.trim();
                      if (!name) {
                        alert('Designation name is required');
                        return;
                      }

                      setIsUpdating(true);
                      try {
                        const payload = {
                          designation_name: name,
                          is_active: editDesignationStatus,
                        };
                        const response = await apiService.updateDesignation(id, payload);
                        if (response && response.status === 'SUCCESS') {
                          const modalElement = document.getElementById('edit_designation');
                          if (modalElement) {
                            const bootstrap = (window as any).bootstrap;
                            if (bootstrap && bootstrap.Modal) {
                              const modal = bootstrap.Modal.getInstance(modalElement);
                              if (modal) modal.hide();
                            }
                          }
                          await refetch();
                          setSelectedDesignation(null);
                        } else {
                          alert(response?.message || 'Failed to update designation');
                        }
                      } catch (err: any) {
                        console.error('Error updating designation:', err);
                        alert(err?.message || 'Failed to update designation. Please try again.');
                      } finally {
                        setIsUpdating(false);
                      }
                    }}
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Department */}
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

export default Designation;
