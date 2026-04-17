
import { useState } from "react";
import Table from "../../core/common/dataTable/index";
import type { TableData } from "../../core/data/interface";
import PredefinedDateRanges from "../../core/common/datePicker";
import { Link } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { useUserRoles } from "../../core/hooks/useUserRoles";
import { apiService } from "../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../core/utils/exportUtils";

const RolesPermissions = () => {
  const routes = all_routes;
  const { userRoles, loading, error, refetch } = useUserRoles();
  const data = userRoles;
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editRoleName, setEditRoleName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const getRoleId = (role: any) => {
    if (!role) return null;
    const raw = role?.originalData?.id ?? role?.id ?? role?.key ?? null;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isInteger(parsed) ? parsed : null;
  };

  const getRoleName = (role: any) =>
    String(role?.originalData?.role_name || role?.originalData?.roleName || role?.roleName || "").trim();

  const getRoleDescription = (role: any) =>
    String(role?.originalData?.description || "").trim();

  const resetFeedback = () => {
    setSubmitError("");
    setSubmitSuccess("");
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const role_name = newRoleName.trim().replace(/\s+/g, " ");
    if (!role_name) {
      setSubmitError("Role name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiService.createUserRole({
        role_name,
        description: newDescription.trim(),
      });

      if (response?.status !== "SUCCESS") {
        throw new Error(response?.message || "Failed to create role");
      }

      setSubmitSuccess("Role created successfully.");
      setNewRoleName("");
      setNewDescription("");
      await refetch();
      const closeBtn = document.getElementById("add-role-close-btn") as HTMLButtonElement | null;
      closeBtn?.click();
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to create role.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (record: any) => {
    setSelectedRole(record);
    setEditRoleName(getRoleName(record));
    setEditDescription(getRoleDescription(record));
    resetFeedback();
    setTimeout(() => {
      const modalElement = document.getElementById("edit_role");
      if (modalElement) {
        const bootstrap = (window as any).bootstrap;
        if (bootstrap && bootstrap.Modal) {
          const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
          modal.show();
        }
      }
    }, 100);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const id = getRoleId(selectedRole);
    const role_name = editRoleName.trim().replace(/\s+/g, " ");
    if (!id) {
      setSubmitError("Selected role is invalid.");
      return;
    }
    if (!role_name) {
      setSubmitError("Role name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiService.updateUserRole(id, {
        role_name,
        description: editDescription.trim(),
      });

      if (response?.status !== "SUCCESS") {
        throw new Error(response?.message || "Failed to update role");
      }

      setSubmitSuccess("Role updated successfully.");
      await refetch();
      const closeBtn = document.getElementById("edit-role-close-btn") as HTMLButtonElement | null;
      closeBtn?.click();
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to update role.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    const id = getRoleId(selectedRole);
    if (!id) {
      setSubmitError("Selected role is invalid.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiService.deleteUserRole(id);
      if (response?.status !== "SUCCESS") {
        throw new Error(response?.message || "Failed to delete role");
      }
      setSubmitSuccess("Role deleted successfully.");
      await refetch();
      const closeBtn = document.getElementById("delete-role-close-btn") as HTMLButtonElement | null;
      closeBtn?.click();
      setSelectedRole(null);
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to delete role.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportColumns = [
    { title: "Role Name", dataKey: "roleName" },
    { title: "Description", dataKey: "description" },
    { title: "Created On", dataKey: "createdOn" },
  ];

  const exportRows = data.map((role: any) => ({
    roleName: getRoleName(role),
    description: getRoleDescription(role),
    createdOn: String(role?.createdOn || ""),
  }));

  const handleExportExcel = () => {
    if (!exportRows.length) {
      setSubmitError("No role data available for export.");
      return;
    }
    resetFeedback();
    exportToExcel(exportRows, "roles-permissions", "Roles");
  };

  const handleExportPdf = () => {
    if (!exportRows.length) {
      setSubmitError("No role data available for export.");
      return;
    }
    resetFeedback();
    exportToPDF(exportRows, "Roles & Permissions", "roles-permissions", exportColumns);
  };

  const handlePrint = () => {
    if (!exportRows.length) {
      setSubmitError("No role data available for print.");
      return;
    }
    resetFeedback();
    printData("Roles & Permissions", exportColumns, exportRows);
  };
  const columns = [
    {
      title: "Role Name",
      dataIndex: "roleName",
      sorter: (a: TableData, b: TableData) =>
        a.roleName.length - b.roleName.length,
    },

    {
      title: "Created On",
      dataIndex: "createdOn",
      sorter: (a: TableData, b: TableData) =>
        a.createdOn.length - b.createdOn.length,
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (text: any, record: any) => (
        <>
          <div className="d-flex align-items-center">
            <Link
              to="#"
              className="btn btn-outline-light bg-white btn-icon d-flex align-items-center justify-content-center rounded-circle  p-0 me-2"
              onClick={(e) => {
                e.preventDefault();
                handleOpenEdit(record);
              }}
            >
              <i className="ti ti-edit-circle text-primary" />
            </Link>
            <Link
              to={routes.permissions}
              className="btn btn-outline-light bg-white btn-icon d-flex align-items-center justify-content-center rounded-circle  p-0 me-2"
            >
              <i className="ti ti-shield text-skyblue" />
            </Link>
            <Link
              to="#"
              className="btn btn-outline-light bg-white btn-icon d-flex align-items-center justify-content-center rounded-circle p-0 me-3"
              data-bs-toggle="modal"
              data-bs-target="#delete-modal"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedRole(record);
                  resetFeedback();
                  const modalElement = document.getElementById("delete-modal");
                  if (modalElement) {
                    const bootstrap = (window as any).bootstrap;
                    if (bootstrap && bootstrap.Modal) {
                      const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                      modal.show();
                    }
                  }
                }}
            >
              <i className="ti ti-trash-x text-danger" />
            </Link>
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
                <h3 className="page-title mb-1">Roles &amp; Permissions</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">User Management</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Roles &amp; Permissions
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={refetch}
                onPrint={handlePrint}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary d-flex align-items-center"
                    data-bs-toggle="modal"
                    data-bs-target="#add_role"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Add Role
                  </Link>
                </div>
              </div>
            </div>
            {/* /Page Header */}
            {/* Filter Section */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Roles &amp; Permissions List</h4>
                <div className="d-flex align-items-center flex-wrap">
                  <div className="input-icon-start mb-3 me-2 position-relative">
                    <PredefinedDateRanges />
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
                    <p className="mt-2">Loading roles & permissions data...</p>
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

                {/* Role Permission List */}
                {!loading && !error && (
                  <Table columns={columns} dataSource={data} Selection={true} />
                )}
                {/* /Role Permission List */}
              </div>
            </div>
            {/* /Filter Section */}
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Add Role */}
        <div className="modal fade" id="add_role">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Role</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleCreateRole}>
                <div className="modal-body">
                  {submitError && <div className="alert alert-danger py-2">{submitError}</div>}
                  {submitSuccess && <div className="alert alert-success py-2">{submitSuccess}</div>}
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Role Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          maxLength={50}
                          required
                        />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          maxLength={1000}
                          rows={3}
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
                    id="add-role-close-btn"
                  >
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    Add Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Add Role */}
        {/* Edit Role */}
        <div className="modal fade" id="edit_role">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Role</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleUpdateRole}>
                <div className="modal-body">
                  {submitError && <div className="alert alert-danger py-2">{submitError}</div>}
                  {submitSuccess && <div className="alert alert-success py-2">{submitSuccess}</div>}
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="col-form-label">Role Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editRoleName}
                          onChange={(e) => setEditRoleName(e.target.value)}
                          maxLength={50}
                          required
                        />
                      </div>
                      <div className="mb-0">
                        <label className="col-form-label">Description</label>
                        <textarea
                          className="form-control"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={1000}
                          rows={3}
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
                    id="edit-role-close-btn"
                  >
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Edit Role */}
        {/* Delete Modal */}
        <div className="modal fade" id="delete-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleDeleteRole}>
                <div className="modal-body text-center">
                  {submitError && <div className="alert alert-danger py-2 text-start">{submitError}</div>}
                  {submitSuccess && <div className="alert alert-success py-2 text-start">{submitSuccess}</div>}
                  <span className="delete-icon">
                    <i className="ti ti-trash-x" />
                  </span>
                  <h4>Confirm Deletion</h4>
                  <p>
                    You are deleting role <strong>{getRoleName(selectedRole) || "selected role"}</strong>. This action cannot be undone.
                  </p>
                  <div className="d-flex justify-content-center">
                    <Link
                      to="#"
                      className="btn btn-light me-3"
                      data-bs-dismiss="modal"
                      id="delete-role-close-btn"
                    >
                      Cancel
                    </Link>
                    <button type="submit" className="btn btn-danger" disabled={isSubmitting}>
                      Yes, Delete
                    </button>
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

export default RolesPermissions;
