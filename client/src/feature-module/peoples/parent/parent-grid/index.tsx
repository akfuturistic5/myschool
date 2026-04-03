import  { useRef, useState } from "react";
import { useSelector } from "react-redux";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import ParentModal from "../parentModal";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";
import PredefinedDateRanges from "../../../../core/common/datePicker";
import { Link } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import {
  names,
  parent,
} from "../../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../../core/common/commonSelect";
import { Modal } from "react-bootstrap";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useParents } from "../../../../core/hooks/useParents";

const ParentGrid = () => {
  const [show, setShow] = useState(false);
  const [selectedParent, setSelectedParent] = useState<any>(null);
  const [parentToEdit, setParentToEdit] = useState<any>(null);
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const role = user?.role || "Admin";
  const isParentRole = (role || "").toLowerCase() === "parent";
  const canManageParents = ["admin", "headmaster", "administrative", "administrator"].includes((role || "").toLowerCase());
  const { parents, loading, error, refetch } = useParents({ forCurrentUser: isParentRole, academicYearId: isParentRole ? null : academicYearId });
  const dashboardRoute = getDashboardForRole(role);

  // useParents already returns transformed parent objects in the exact
  // shape expected by this grid and the View Details modal.
  // Re-mapping here would lose data (because raw API fields are no longer present),
  // so we just pass the hook data through.
  const data = parents ?? [];

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  const handleClose = () => {
    setShow(false);
    setSelectedParent(null);
  };

  const handleViewParent = (parent) => {
    setSelectedParent(parent);
    setShow(true);
  };
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content content-two">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <Link
                to={dashboardRoute}
                className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
              >
                <i className="ti ti-arrow-left me-1" />
                Back
              </Link>
              <h3 className="page-title mb-1">Parents</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={dashboardRoute}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Peoples</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Parents
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption />

              {canManageParents && (
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary d-flex align-items-center"
                    data-bs-toggle="modal"
                    data-bs-target="#add_parent"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Add Parent
                  </Link>
                </div>
              )}
            </div>
          </div>
          {/* /Page Header */}
          <div className="bg-white p-3 border rounded-1 d-flex align-items-center justify-content-between flex-wrap mb-4 pb-0">
            <h4 className="mb-3">Parents Grid</h4>
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
                    <div className="p-3 pb-0 border-bottom">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Parent</label>
                            <CommonSelect
                              className="select"
                              options={parent}
                              defaultValue={parent[0]}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Child</label>
                            <CommonSelect
                              className="select"
                              options={names}
                              defaultValue={names[0]}
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
                  to={routes.parentList}
                  className=" btn btn-icon btn-sm me-1 bg-light primary-hover"
                >
                  <i className="ti ti-list-tree" />
                </Link>
                <Link
                  to={routes.parentGrid}
                  className=" active btn btn-icon btn-sm  primary-hover"
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
          <div className="row">
            {/* Loading State */}
            {loading && (
              <div className="col-12 text-center p-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading parents data...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="col-12 text-center p-4">
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

            {/* Parents Grid */}
            {!loading && !error && data.map((parent, _index) => (
              <div key={parent.id} className="col-xl-4 col-md-6 d-flex">
                <div className="card flex-fill">
                  <div className="card-header d-flex align-items-center justify-content-between">
                    <Link
                      to="#"
                      className="link-primary"
                      onClick={() => handleViewParent(parent)}
                    >
                      {parent.id}
                    </Link>
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
                              onClick={() => handleViewParent(parent)}
                            >
                              <i className="ti ti-menu me-2" />
                              View Parent
                            </Link>
                          </li>
                        {canManageParents && (
                            <>
                              <li>
                                <Link
                                  className="dropdown-item rounded-1"
                                  to="#"
                                  data-bs-toggle="modal"
                                  data-bs-target="#edit_parent"
                                  onClick={() => setParentToEdit(parent)}
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
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="bg-light-300 rounded-2 p-3 mb-3">
                      <div className="d-flex align-items-center">
                        <Link
                          to="#"
                          onClick={() => handleViewParent(parent)}
                          className="avatar avatar-lg flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src={parent.ParentImage}
                            className="img-fluid rounded-circle"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2">
                         <h6 className="text-dark text-truncate mb-0">
                            <Link to="#" onClick={() => handleViewParent(parent)}>{parent.name}</Link>
                          </h6>
                          <p>{parent.Addedon}</p>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between gx-2">
                      <div>
                        <p className="mb-0">Email</p>
                        <p className="text-dark">{parent.email}</p>
                      </div>
                      <div>
                        <p className="mb-0">Phone</p>
                        <p className="text-dark">{parent.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <div className="d-flex align-items-center">
                        <Link
                          to={routes.studentDetail}
                          state={parent.student_id != null ? { studentId: parent.student_id } : undefined}
                          className="avatar avatar-md flex-shrink-0 p-0 me-2"
                        >
                          <ImageWithBasePath
                            src={parent.ChildImage}
                            alt="img"
                            className="img-fluid rounded-circle"
                          />
                        </Link>
                        <p className="text-dark">{parent.Child}</p>
                      </div>
                    </div>
                    <Link
                      to="#"
                      className="btn btn-light btn-sm"
                      onClick={() => handleViewParent(parent)}
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* /Parents Grid */}
            <div className="col-md-12">
              <div className="load-more text-center">
                <Link to="#" className="btn btn-primary">
                  <i className="ti ti-loader-3" />
                  Load More
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
      <ParentModal parentToEdit={parentToEdit} refetch={refetch} />

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
          {selectedParent && (
            <div className="parent-wrap">
              <div className="row align-items-center">
                <div className="col-lg-6">
                  <div className="d-flex align-items-center mb-3">
                    <span className="avatar avatar-xl me-2">
                      <ImageWithBasePath
                        src={selectedParent.ParentImage}
                        alt="img"
                      />
                    </span>
                    <div className="parent-name">
                      <h5 className="mb-1">{selectedParent.name}</h5>
                      <p>{selectedParent.Addedon}</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <ul className="d-flex align-items-center">
                    <li className="mb-3 me-5">
                      <p className="mb-1">Email</p>
                      <h6 className="fw-normal">{selectedParent.email}</h6>
                    </li>
                    <li className="mb-3">
                      <p className="mb-1">Phone</p>
                      <h6 className="fw-normal">{selectedParent.phone}</h6>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          <h5 className="mb-3">Children Details</h5>
          {selectedParent && (
            <div className="border rounded p-4 pb-1 mb-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap pb-1 mb-3 border-bottom">
                <span className="link-primary mb-2">{selectedParent.student_admission_number}</span>
                <span className="badge badge-soft-success badge-md mb-2">
                  <i className="ti ti-circle-filled me-2" />
                  Active
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between flex-wrap">
                <div className="d-flex align-items-center mb-3">
                  <Link
                    to={routes.studentDetail}
                    state={selectedParent.student_id != null ? { studentId: selectedParent.student_id } : undefined}
                    className="avatar"
                  >
                    <ImageWithBasePath
                      src={selectedParent.ChildImage}
                      className="img-fluid rounded-circle"
                      alt="img"
                    />
                  </Link>
                  <div className="ms-2">
                    <p className="mb-0">
                      <Link
                        to={routes.studentDetail}
                        state={selectedParent.student_id != null ? { studentId: selectedParent.student_id } : undefined}
                      >
                        {selectedParent.Child}
                      </Link>
                    </p>
                    <span>{selectedParent.class}</span>
                  </div>
                </div>
                <ul className="d-flex align-items-center flex-wrap">
                  <li className="mb-3 me-4">
                    <p className="mb-1">Roll No</p>
                    <h6 className="fw-normal">{selectedParent.student_roll_number}</h6>
                  </li>
                  <li className="mb-3 me-4">
                    <p className="mb-1">Father's Occupation</p>
                    <h6 className="fw-normal">{selectedParent.father_occupation || 'N/A'}</h6>
                  </li>
                  <li className="mb-3">
                    <p className="mb-1">Mother's Name</p>
                    <h6 className="fw-normal">{selectedParent.mother_name || 'N/A'}</h6>
                  </li>
                </ul>
                <div className="d-flex align-items-center">
                  <Link to="#" className="btn btn-light mb-3 me-3">
                    Add Fees
                  </Link>
                  <Link
                    to={routes.studentDetail}
                    state={selectedParent.student_id != null ? { studentId: selectedParent.student_id } : undefined}
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

export default ParentGrid;
