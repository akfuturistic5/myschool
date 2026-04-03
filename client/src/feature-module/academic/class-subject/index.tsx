import  { useRef, useState } from "react";
import Table from "../../../core/common/dataTable/index";

import {
  count,
 
  language,
  typetheory,
} from "../../../core/common/selectoption/selectoption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";
import { useSubjects } from "../../../core/hooks/useSubjects";
import { apiService } from "../../../core/services/apiService";

const ClassSubject = () => {
  const routes = all_routes;
  const { subjects, loading, error, refetch } = useSubjects();
  
  // State for edit modal
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectStatus, setEditSubjectStatus] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Transform API data to match table structure
  const data = (subjects ?? []).map((subject: any, index: number) => ({
    key: subject.id?.toString() || (index + 1).toString(),
    id: subject.id?.toString() || subject.subject_code || `SU${String(index + 1).padStart(6, '0')}`,
    name: subject.subject_name || 'N/A',
    code: subject.subject_code || 'N/A',
    type: (subject.practical_hours && subject.practical_hours > 0) ? 'Practical' : 'Theory',
    status: subject.is_active ? 'Active' : 'Inactive',
    // Store original data for edit modal
    originalData: subject
  }));
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
      render: (text: any, record: any) => (
        <>
          <Link to="#" className="link-primary">
            {text || record.id || 'N/A'}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => {
        const idA = String(a.id || '').length;
        const idB = String(b.id || '').length;
        return idA - idB;
      },
    },

    {
      title: "Name",
      dataIndex: "name",
      sorter: (a: TableData, b: TableData) => a.name.length - b.name.length,
    },
    {
      title: "Code",
      dataIndex: "code",
      sorter: (a: TableData, b: TableData) => a.code.length - b.code.length,
    },
    {
      title: "Type",
      dataIndex: "type",
      sorter: (a: TableData, b: TableData) => a.type.length - b.type.length,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : (
            <span className="badge badge-soft-danger d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          )}
        </>
      ),
      sorter: (a: TableData, b: TableData) => a.status.length - b.status.length,
    },

    {
      title: "Action",
      dataIndex: "action",
      render: (text: any, record: any) => (
        <>
          <div className="d-flex align-items-center">
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
                      // Populate edit form state from selected record
                      const subject = record.originalData || record;
                      const name = subject.subject_name || record.name || '';
                      let status = true;
                      if (subject && Object.prototype.hasOwnProperty.call(subject, 'is_active')) {
                        status =
                          subject.is_active === true ||
                          subject.is_active === 1 ||
                          subject.is_active === 'true';
                      } else if (record.status) {
                        status = record.status === 'Active';
                      }

                      setEditSubjectName(name);
                      setEditSubjectStatus(status);
                      setSelectedSubject(record);
                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_subject');
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
          </div>
        </>
      ),
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
                <h3 className="page-title mb-1">Subjects</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Academic </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Subjects
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary"
                    data-bs-toggle="modal"
                    data-bs-target="#add_subject"
                  >
                    <i className="ti ti-square-rounded-plus-filled me-2" />
                    Add Subject
                  </Link>
                </div>
              </div>
            </div>
            {/* /Page Header */}
            {/* Guardians List */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Class Subject</h4>
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
                    <div className="dropdown-menu drop-width"  ref={dropdownMenuRef}>
                      <form>
                        <div className="d-flex align-items-center border-bottom p-3">
                          <h4>Filter</h4>
                        </div>
                        <div className="p-3 border-bottom pb-0">
                          <div className="row">
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Name</label>
                                <CommonSelect
                                  className="select"
                                  options={language}
                                  defaultValue={language[0]}
                                  
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Code</label>
                                <CommonSelect
                                  className="select"
                                  options={count}
                                  defaultValue={count[0]}
                                   
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
                {/* Loading State */}
                {loading && (
                  <div className="text-center p-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading subjects data...</p>
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

                {/* Subjects List */}
                {!loading && !error && (
                  <Table columns={columns} dataSource={data} Selection={true} />
                )}
                
                {/* /Subjects List */}
              </div>
            </div>
            {/* /Guardians List */}
          </div>
        </div>
        {/* /Page Wrapper */}
      </>
      <div>
        {/* Add Subject */}
        <div className="modal fade" id="add_subject">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Subject</h4>
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
                        <label className="form-label">Name</label>
                        <input type="text" className="form-control" />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Code</label>
                        <CommonSelect
                          className="select"
                          options={count}
                          defaultValue={count[0]}
                           
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Type</label>
                        <CommonSelect
                          className="select"
                          options={typetheory}
                          defaultValue={typetheory[0]}
                          
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
                  <Link to="#" data-bs-dismiss="modal" className="btn btn-primary">
                    Add Subject
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Add Subject */}
        {/* Edit Subject */}
        <div className="modal fade" id="edit_subject">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Subject</h4>
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
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Name"
                          value={editSubjectName}
                          onChange={(e) => setEditSubjectName(e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Code</label>
                        <CommonSelect
                          className="select"
                          options={count}
                          defaultValue={selectedSubject?.originalData?.subject_code || selectedSubject?.code ? count.find((c: any) => c.value === (selectedSubject?.originalData?.subject_code || selectedSubject?.code) || c.label === (selectedSubject?.originalData?.subject_code || selectedSubject?.code)) || count[0] : count[0]}
                          key={`code-${selectedSubject?.id || 'new'}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Type</label>
                        <CommonSelect
                          className="select"
                          options={typetheory}
                          defaultValue={selectedSubject?.type === 'Practical' ? typetheory.find((t: any) => t.label === 'Practical') || typetheory[0] : typetheory.find((t: any) => t.label === 'Theory') || typetheory[0]}
                          key={`type-${selectedSubject?.id || 'new'}`}
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
                            checked={editSubjectStatus}
                            onChange={(e) => setEditSubjectStatus(e.target.checked)}
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
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      const id = selectedSubject?.originalData?.id || selectedSubject?.id;
                      if (!id || isUpdating) return;

                      const name = editSubjectName.trim();
                      if (!name) {
                        alert('Subject name is required');
                        return;
                      }

                      setIsUpdating(true);
                      try {
                        const payload = {
                          subject_name: name,
                          is_active: editSubjectStatus,
                        };
                        const response = await apiService.updateSubject(id, payload);
                        if (response && response.status === 'SUCCESS') {
                          const modalElement = document.getElementById('edit_subject');
                          if (modalElement) {
                            const bootstrap = (window as any).bootstrap;
                            if (bootstrap && bootstrap.Modal) {
                              const modal = bootstrap.Modal.getInstance(modalElement);
                              if (modal) modal.hide();
                            }
                          }
                          await refetch();
                          setSelectedSubject(null);
                        } else {
                          alert(response?.message || 'Failed to update subject');
                        }
                      } catch (err: any) {
                        console.error('Error updating subject:', err);
                        alert(err?.message || 'Failed to update subject. Please try again.');
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
        {/* /Edit Subject */}
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
      </div>
    </div>
  );
};

export default ClassSubject;
