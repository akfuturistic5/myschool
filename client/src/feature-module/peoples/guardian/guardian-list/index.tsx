import  { useRef, useState } from "react";
import { useSelector } from "react-redux";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import PredefinedDateRanges from "../../../../core/common/datePicker";
import { Link } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import {
    allClass,
  names,
  parent,
  status,
} from "../../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../../core/common/commonSelect";
import { Modal } from "react-bootstrap";
import GuardianModal from "../guardianModal";
import type { TableData } from "../../../../core/data/interface";
import Table from "../../../../core/common/dataTable/index";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useGuardians } from "../../../../core/hooks/useGuardians";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";

const GuardianList = () => {
  const [show, setShow] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<any>(null);
  const [guardianToEdit, setGuardianToEdit] = useState<any>(null);
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const isGuardian = (user?.role || "").toLowerCase() === "guardian";
  const { guardians, loading, error, refetch } = useGuardians({ academicYearId: isGuardian ? null : academicYearId });

  // useGuardians already returns guardian records transformed into the
  // exact shape expected by this table and the View Details modal.
  // Re-transforming here against raw API field names causes the "N/A"
  // issue, so we simply use the hook result as-is.
  const data = guardians ?? [];

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  const handleClose = () => {
    setShow(false);
    setSelectedGuardian(null);
  };

  const handleViewGuardian = (guardian) => {
    setSelectedGuardian(guardian);
    setShow(true);
  };
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: string, record: any) => (
        <Link to="#" onClick={() => handleViewGuardian(record)} className="link-primary">
          {text}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => (Number(a.id) || 0) - (Number(b.id) || 0),
    },
    {
      title: "Guardian Name",
      dataIndex: "name",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link
            to="#"
            className="avatar avatar-md"
            onClick={() => handleViewGuardian(record)}
          >
            <ImageWithBasePath
              src={record.GuardianImage}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to="#" onClick={() => handleViewGuardian(record)}>
                {text}
              </Link>
            </p>
            <span className="fs-12">{record.Addedon}</span>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => a.name.length - b.name.length,
    },
    {
      title: "Child",
      dataIndex: "Child",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link
            to={record.student_id != null ? `${routes.studentDetail}/${record.student_id}` : routes.guardiansList}
            state={record.student_id != null ? { studentId: record.student_id } : undefined}
            className="avatar avatar-md"
          >
            <ImageWithBasePath
              src={record.ChildImage}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link
                to={record.student_id != null ? `${routes.studentDetail}/${record.student_id}` : routes.guardiansList}
                state={record.student_id != null ? { studentId: record.student_id } : undefined}
              >
                {text}
              </Link>
            </p>
            <span className="fs-12">{record.class}</span>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => a.Child.length - b.Child.length,
    },
    {
      title: "Phone",
      dataIndex: "phone",
      sorter: (a: TableData, b: TableData) => a.phone.length - b.phone.length,
    },
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a: TableData, b: TableData) => a.email.length - b.email.length,
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_text: string, record: any) => (
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
                    onClick={() => handleViewGuardian(record)}
                  >
                    <i className="ti ti-menu me-2" />
                    View Guardian
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#edit_guardian"
                    onClick={() => setGuardianToEdit(record)}
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
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content content-two">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <Link
                to={isGuardian ? routes.guardianDashboard : routes.guardiansGrid}
                className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
              >
                <i className="ti ti-arrow-left me-1" />
                Back
              </Link>
              <h3 className="page-title mb-1">Guardian</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={isGuardian ? routes.guardianDashboard : routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Peoples</li>
                  <li className="breadcrumb-item active" aria-current="page">
                  Guardian  
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption />

              {!isGuardian && (
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary d-flex align-items-center"
                    data-bs-toggle="modal"
                    data-bs-target="#add_guardian"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Add Guardian
                  </Link>
                </div>
              )}
            </div>
          </div>
          {/* /Page Header */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Guardian List</h4>
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
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                  >
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 pb-0 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Guardian</label>
                              <CommonSelect
                                className="select"
                                options={parent}
                                defaultValue={parent[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Child</label>
                              <CommonSelect
                                className="select"
                                options={names}
                                defaultValue={names[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Class</label>
                            <CommonSelect
                              className="select"
                              options={allClass}
                              defaultValue={allClass[0]}
                            />
                          </div>
                        </div>
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Status</label>
                            <CommonSelect
                              className="select"
                              options={status}
                              defaultValue={status[0]}
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
                <div className="d-flex align-items-center bg-white border rounded-2 p-1 mb-3 me-2">
                  <Link
                    to={routes.guardiansList}
                    className="active btn btn-icon btn-sm me-1 primary-hover"
                  >
                    <i className="ti ti-list-tree" />
                  </Link>
                  <Link
                    to={routes.guardiansGrid}
                    className="btn btn-icon btn-sm bg-light primary-hover"
                  >
                    <i className="ti ti-grid-dots" />
                  </Link>
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
                      <Link to="#" className="dropdown-item rounded-1 active">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Descending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Viewed
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
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
                  <p className="mt-2">Loading guardians data...</p>
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

              {/* Guardians List */}
              {!loading && !error && (
                <Table dataSource={data} columns={columns} Selection={true} />
              )}
              
              {/* /Guardians List */}
            </div>
          </div>

        </div>
      </div>
      {/* /Page Wrapper */}
      <GuardianModal guardianToEdit={guardianToEdit} refetch={refetch} />

      <Modal show={show} onHide={handleClose} centered size="lg">
        <div className="modal-header">
          <h4 className="modal-title">View Details</h4>
          <button
            type="button"
            className="btn-close custom-btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
            onClick={handleClose}
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body mb-0">
          {selectedGuardian && (
            <div className="parent-wrap">
              <div className="row align-items-center">
                <div className="col-lg-6">
                  <div className="d-flex align-items-center mb-3">
                    <span className="avatar avatar-xl me-2">
                      <ImageWithBasePath
                        src={selectedGuardian.GuardianImage}
                        alt="img"
                      />
                    </span>
                    <div className="parent-name">
                      <h5 className="mb-1">{selectedGuardian.name}</h5>
                      <p>{selectedGuardian.Addedon}</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <ul className="d-flex align-items-center">
                    <li className="mb-3 me-5">
                      <p className="mb-1">Email</p>
                      <h6 className="fw-normal">{selectedGuardian.email}</h6>
                    </li>
                    <li className="mb-3">
                      <p className="mb-1">Phone</p>
                      <h6 className="fw-normal">{selectedGuardian.phone}</h6>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          <h5 className="mb-3">Children Details</h5>
          {selectedGuardian && (
            <div className="border rounded p-4 pb-1 mb-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap pb-1 mb-3 border-bottom">
                <span className="link-primary mb-2">{selectedGuardian.student_admission_number}</span>
                <span className="badge badge-soft-success badge-md mb-2">
                  <i className="ti ti-circle-filled me-2" />
                  Active
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between flex-wrap">
                <div className="d-flex align-items-center mb-3">
                  <Link
                    to={routes.studentDetail}
                    state={selectedGuardian.student_id != null ? { studentId: selectedGuardian.student_id } : undefined}
                    className="avatar"
                  >
                    <ImageWithBasePath
                      src={selectedGuardian.ChildImage}
                      className="img-fluid rounded-circle"
                      alt="img"
                    />
                  </Link>
                  <div className="ms-2">
                    <p className="mb-0">
                      <Link
                        to={selectedGuardian.student_id != null ? `${routes.studentDetail}/${selectedGuardian.student_id}` : routes.guardiansList}
                        state={selectedGuardian.student_id != null ? { studentId: selectedGuardian.student_id } : undefined}
                      >
                        {selectedGuardian.Child}
                      </Link>
                    </p>
                    <span>{selectedGuardian.class}</span>
                  </div>
                </div>
                <ul className="d-flex align-items-center flex-wrap">
                  <li className="mb-3 me-4">
                    <p className="mb-1">Roll No</p>
                    <h6 className="fw-normal">{selectedGuardian.student_roll_number}</h6>
                  </li>
                  <li className="mb-3 me-4">
                    <p className="mb-1">Guardian Type</p>
                    <h6 className="fw-normal">{selectedGuardian.guardian_type || 'N/A'}</h6>
                  </li>
                  <li className="mb-3">
                    <p className="mb-1">Relation</p>
                    <h6 className="fw-normal">{selectedGuardian.relation || 'N/A'}</h6>
                  </li>
                </ul>
                <div className="d-flex align-items-center">
                  <Link to="#" className="btn btn-light mb-3 me-3">
                    Add Fees
                  </Link>
                  <Link
                    to={selectedGuardian.student_id != null ? `${routes.studentDetail}/${selectedGuardian.student_id}` : routes.guardiansList}
                    state={selectedGuardian.student_id != null ? { studentId: selectedGuardian.student_id } : undefined}
                    className="btn btn-primary mb-3"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default GuardianList;
