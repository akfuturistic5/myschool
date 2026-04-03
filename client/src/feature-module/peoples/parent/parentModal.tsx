import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Select } from "antd";
import { apiService } from "../../../core/services/apiService";
import { useStudents } from "../../../core/hooks/useStudents";

export interface ParentToEditShape {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  Child?: string;
  student_id?: number;
}

interface ParentModalProps {
  parentToEdit?: ParentToEditShape | null;
  refetch?: () => void;
}

const ParentModal = ({ parentToEdit = null, refetch }: ParentModalProps) => {
  const { students = [] } = useStudents();
  const [addFatherName, setAddFatherName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addStudentId, setAddStudentId] = useState<number | null>(null);
  const [editFatherName, setEditFatherName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentOptions = students.map((s: any) => ({
    value: s.id,
    label: `${s.first_name || ""} ${s.last_name || ""}`.trim() || `Student #${s.id}`,
  }));

  useEffect(() => {
    if (parentToEdit) {
      setEditFatherName(parentToEdit.name ?? "");
      setEditPhone(parentToEdit.phone ?? "");
      setEditEmail(parentToEdit.email ?? "");
    }
  }, [parentToEdit]);

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
      if (!addFatherName.trim()) {
        setError("Name is required");
        setSubmitting(false);
        return;
      }
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
      await apiService.createParent({
        student_id: addStudentId,
        father_name: addFatherName.trim(),
        father_phone: addPhone.trim(),
        father_email: addEmail.trim() || null,
      });
      setAddFatherName("");
      setAddPhone("");
      setAddEmail("");
      setAddStudentId(null);
      refetch?.();
      hideModal("add_parent");
    } catch (err: any) {
      setError(err?.message || "Failed to add parent");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentToEdit?.id) return;
    setError(null);
    setSubmitting(true);
    try {
      if (!editFatherName.trim()) {
        setError("Name is required");
        setSubmitting(false);
        return;
      }
      if (!editPhone.trim()) {
        setError("Phone is required");
        setSubmitting(false);
        return;
      }
      await apiService.updateParent(parentToEdit.id, {
        father_name: editFatherName.trim(),
        father_phone: editPhone.trim(),
        father_email: editEmail.trim() || null,
      });
      refetch?.();
      hideModal("edit_parent");
    } catch (err: any) {
      setError(err?.message || "Failed to update parent");
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
      <div className="modal fade" id="add_parent">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Parent</h4>
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
                          <a href="#" className="btn btn-primary mb-3" onClick={(e) => e.preventDefault()}>
                            Remove
                          </a>
                        </div>
                        <p>Upload image size 4MB, Format JPG, PNG, SVG</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Name (Father)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addFatherName}
                        onChange={(e) => setAddFatherName(e.target.value)}
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
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Adding..." : "Add Parent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Parent */}
      {/* Edit Parent */}
      <div className="modal fade" id="edit_parent">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Parent</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form key={parentToEdit?.id ?? "edit-form"} onSubmit={handleEditSubmit}>
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
                          <a href="#" className="btn btn-primary mb-3" onClick={(e) => e.preventDefault()}>
                            Remove
                          </a>
                        </div>
                        <p>Upload image size 4MB, Format JPG, PNG, SVG</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Name (Father)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Name"
                        value={editFatherName}
                        onChange={(e) => setEditFatherName(e.target.value)}
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
                        className="select"
                        getPopupContainer={getModalContainer}
                        style={{ width: "100%" }}
                        placeholder="Student (read-only)"
                        value={parentToEdit?.student_id}
                        options={studentOptions}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
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
      {/* /Edit Parent */}
      
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

export default ParentModal;
