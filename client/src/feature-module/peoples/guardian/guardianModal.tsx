import { useState, useEffect } from "react";
import { Select } from "antd";
import { Link } from "react-router-dom";
import { apiService } from "../../../core/services/apiService";
import { useStudents } from "../../../core/hooks/useStudents";

export interface GuardianToEditShape {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  Child?: string;
  student_id?: number;
}

interface GuardianModalProps {
  guardianToEdit?: GuardianToEditShape | null;
  refetch?: () => void;
}

const GuardianModal = ({ guardianToEdit = null, refetch }: GuardianModalProps) => {
  const { students = [] } = useStudents();
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addStudentId, setAddStudentId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStudentId, setEditStudentId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentOptions = students.map((s: any) => ({
    value: s.id,
    label: `${s.first_name || ""} ${s.last_name || ""}`.trim() || `Student #${s.id}`,
  }));

  useEffect(() => {
    if (guardianToEdit) {
      setEditName(guardianToEdit.name ?? "");
      setEditPhone(guardianToEdit.phone ?? "");
      setEditEmail(guardianToEdit.email ?? "");
      setEditStudentId(guardianToEdit.student_id ?? null);
    }
  }, [guardianToEdit]);

  const hideModal = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const Modal = (window as any).bootstrap?.Modal;
      if (Modal) {
        const instance = Modal.getInstance(el);
        if (instance) instance.hide();
      }
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parts = addName.trim().split(/\s+/);
      const first_name = parts[0] || "Guardian";
      const last_name = parts.slice(1).join(" ") || "";
      if (!addPhone.trim()) {
        setError("Phone is required");
        setSubmitting(false);
        return;
      }
      if (!addStudentId) {
        setError("Please select a child/student");
        setSubmitting(false);
        return;
      }
      await apiService.createGuardian({
        student_id: addStudentId,
        first_name,
        last_name,
        phone: addPhone.trim(),
        email: addEmail.trim() || null,
      });
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setAddStudentId(null);
      refetch?.();
      hideModal("add_guardian");
    } catch (err: any) {
      setError(err?.message || "Failed to add guardian");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianToEdit?.id) return;
    setError(null);
    setSubmitting(true);
    try {
      const parts = editName.trim().split(/\s+/);
      const first_name = parts[0] || "Guardian";
      const last_name = parts.slice(1).join(" ") || "";
      if (!editPhone.trim()) {
        setError("Phone is required");
        setSubmitting(false);
        return;
      }
      await apiService.updateGuardian(guardianToEdit.id, {
        student_id: editStudentId ?? guardianToEdit.student_id,
        first_name,
        last_name,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
      });
      refetch?.();
      hideModal("edit_guardian");
    } catch (err: any) {
      setError(err?.message || "Failed to update guardian");
    } finally {
      setSubmitting(false);
    }
  };

  const getModalContainer = () => {
    const modalElement = document.getElementById("modal-tag");
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  const getModalContainer2 = () => {
    const modalElement = document.getElementById("modal-tag2");
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  
  return (
    <>
      {/* Add Parent */}
      <div className="modal fade" id="add_guardian">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Guardian</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              {error && (
                <div className="alert alert-danger mx-3 mt-2 mb-0" role="alert">
                  {error}
                </div>
              )}
              <div id="modal-tag2" className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="d-flex align-items-center upload-pic flex-wrap row-gap-3 mb-3">
                      <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                        <i className="ti ti-photo-plus fs-16" />
                      </div>
                      <div className="profile-upload">
                        <div className="profile-uploader d-flex align-items-center">
                          <div className="drag-upload-btn mb-3">
                            Upload
                            <input
                              type="file"
                              className="form-control image-sign"
                              multiple
                            />
                          </div>
                          <Link
                            to="#"
                            className="btn btn-primary mb-3"
                          >
                            Remove
                          </Link>
                        </div>
                        <p>Upload image size 4MB, Format JPG, PNG, SVG</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addPhone}
                        onChange={(e) => setAddPhone(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                      />
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Child</label>
                      <Select
                        allowClear
                        className="select"
                        getPopupContainer={getModalContainer2}
                        style={{ width: "100%" }}
                        placeholder="Please select a student"
                        value={addStudentId}
                        onChange={(v) => setAddStudentId(v ?? null)}
                        options={studentOptions}
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
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Adding..." : "Add Guardian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Parent */}
      {/* Edit Guardian */}
      <div className="modal fade" id="edit_guardian">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Guardian</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form key={guardianToEdit?.id ?? "edit-form"} onSubmit={handleEditSubmit}>
              {error && (
                <div className="alert alert-danger mx-3 mt-2 mb-0" role="alert">
                  {error}
                </div>
              )}
              <div id="modal-tag" className="modal-body ">
                <div className="row">
                  <div className="col-md-12">
                    <div className="d-flex align-items-center upload-pic flex-wrap row-gap-3 mb-3">
                      <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                        <i className="ti ti-photo-plus fs-16" />
                      </div>
                      <div className="profile-upload">
                        <div className="profile-uploader d-flex align-items-center">
                          <div className="drag-upload-btn mb-3">
                            Upload
                            <input
                              type="file"
                              className="form-control image-sign"
                              multiple
                            />
                          </div>
                          <Link
                            to="#"
                            className="btn btn-primary mb-3"
                          >
                            Remove
                          </Link>
                        </div>
                        <p>Upload image size 4MB, Format JPG, PNG, SVG</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Phone Number"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Enter Email Address"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Child</label>
                      <Select
                        allowClear
                        className="select"
                        getPopupContainer={getModalContainer}
                        style={{ width: "100%" }}
                        placeholder="Please select a student"
                        value={editStudentId}
                        onChange={(v) => setEditStudentId(v ?? null)}
                        options={studentOptions}
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
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Edit Guardian */}
      
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
  );
};

export default GuardianModal;
