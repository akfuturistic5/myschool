
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";

const routes = all_routes;

const PaymentModes = () => {
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<any>(null);
  const [modeName, setModeName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchPaymentModes = async () => {
    setLoading(true);
    try {
      // Fetch all for admin management
      const res = await apiService.getPaymentModes(false);
      if (res?.status === "SUCCESS") {
        setPaymentModes(res.data);
      }
    } catch (error) {
      console.error("Error fetching payment modes:", error);
      Swal.fire("Error", "Failed to fetch payment modes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentModes();
  }, []);

  const handleAddMode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiService.createPaymentMode({ name: modeName, is_active: isActive });
      if (res?.status === "SUCCESS") {
        Swal.fire("Success", "Payment mode added successfully", "success");
        fetchPaymentModes();
        setModeName("");
        setIsActive(true);
      } else {
        Swal.fire("Error", res?.message || "Failed to add payment mode", "error");
      }
    } catch (error) {
      Swal.fire("Error", "An error occurred", "error");
    }
  };

  const handleUpdateMode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiService.updatePaymentMode(selectedMode.id, { name: modeName, is_active: isActive });
      if (res?.status === "SUCCESS") {
        Swal.fire("Success", "Payment mode updated successfully", "success");
        fetchPaymentModes();
      } else {
        Swal.fire("Error", res?.message || "Failed to update payment mode", "error");
      }
    } catch (error) {
      Swal.fire("Error", "An error occurred", "error");
    }
  };

  const handleDeleteMode = async () => {
    try {
      const res = await apiService.deletePaymentMode(selectedMode.id);
      if (res?.status === "SUCCESS") {
        Swal.fire("Success", "Payment mode deleted successfully", "success");
        fetchPaymentModes();
      } else {
        Swal.fire("Error", res?.message || "Failed to delete payment mode", "error");
      }
    } catch (error) {
      Swal.fire("Error", "An error occurred", "error");
    }
  };

  const openEditModal = (mode: any) => {
    setSelectedMode(mode);
    setModeName(mode.name);
    setIsActive(mode.is_active);
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content bg-white">
          <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Financial Settings</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Settings</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Financial Settings
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <div className="pe-1 mb-2">
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip id="tooltip-top">Refresh</Tooltip>}
                >
                  <button
                    onClick={fetchPaymentModes}
                    className="btn btn-outline-light bg-white btn-icon me-1"
                  >
                    <i className="ti ti-refresh" />
                  </button>
                </OverlayTrigger>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xxl-2 col-xl-3">
              <div className="pt-3 d-flex flex-column list-group mb-4">
                <Link
                  to={routes.paymentGateways}
                  className="d-block rounded p-2"
                >
                  Payment Gateway
                </Link>
                <Link
                  to={routes.taxRates}
                  className="d-block rounded p-2"
                >
                  Tax Rates
                </Link>
                <Link
                  to={routes.paymentModes}
                  className="d-block rounded active p-2"
                >
                  Payment Modes
                </Link>
              </div>
            </div>
            <div className="col-xxl-10 col-xl-9">
              <div className="border-start ps-3">
                <div className="d-flex align-items-center justify-content-between flex-wrap border-bottom pt-3 mb-3">
                  <div className="mb-3">
                    <h5 className="mb-1">Payment Modes</h5>
                    <p>Manage payment methods available for fee collection</p>
                  </div>
                  <div className="mb-3">
                    <button
                      className="btn btn-primary"
                      data-bs-toggle="modal"
                      data-bs-target="#add_payment_mode"
                      onClick={() => {
                        setModeName("");
                        setIsActive(true);
                      }}
                    >
                      <i className="ti ti-plus me-1" /> Add Payment Mode
                    </button>
                  </div>
                </div>

                <div className="row">
                  {loading ? (
                    <div className="col-12 text-center p-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : paymentModes.length === 0 ? (
                    <div className="col-12 text-center p-5 text-muted">
                      No payment modes found.
                    </div>
                  ) : (
                    paymentModes.map((mode) => (
                      <div className="col-xxl-4 col-lg-6" key={mode.id}>
                        <div className="mb-3 card shadow-sm">
                          <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                              <h6 className="mb-0">{mode.name}</h6>
                              <span className={`badge ${mode.is_active ? 'bg-success' : 'bg-danger'} mt-1`}>
                                {mode.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="d-flex">
                              <button
                                className="btn btn-soft-primary btn-icon btn-sm me-2"
                                data-bs-toggle="modal"
                                data-bs-target="#edit_payment_mode"
                                onClick={() => openEditModal(mode)}
                              >
                                <i className="ti ti-edit" />
                              </button>
                              <button
                                className="btn btn-soft-danger btn-icon btn-sm"
                                data-bs-toggle="modal"
                                data-bs-target="#delete-modal"
                                onClick={() => setSelectedMode(mode)}
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Payment Mode Modal */}
      <div className="modal fade" id="add_payment_mode">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Payment Mode</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleAddMode}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. UPI, Bank Transfer, Cash"
                        value={modeName}
                        onChange={(e) => setModeName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Enable or disable this payment mode</p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="status_add"
                          className="check"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <label htmlFor="status_add" className="checktoggle"> </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" data-bs-dismiss="modal">
                  Add Mode
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Payment Mode Modal */}
      <div className="modal fade" id="edit_payment_mode">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Payment Mode</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleUpdateMode}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Name"
                        value={modeName}
                        onChange={(e) => setModeName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                      <div className="status-title">
                        <h5>Status</h5>
                        <p>Enable or disable this payment mode</p>
                      </div>
                      <div className="status-toggle modal-status">
                        <input
                          type="checkbox"
                          id="status_edit"
                          className="check"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <label htmlFor="status_edit" className="checktoggle"> </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" data-bs-dismiss="modal">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="delete-icon">
                <i className="ti ti-trash-x" />
              </span>
              <h4>Confirm Deletion</h4>
              <p>
                Are you sure you want to delete the payment mode "<strong>{selectedMode?.name}</strong>"?
                This action cannot be undone.
              </p>
              <div className="d-flex justify-content-center">
                <button className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-bs-dismiss="modal"
                  onClick={handleDeleteMode}
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModes;
