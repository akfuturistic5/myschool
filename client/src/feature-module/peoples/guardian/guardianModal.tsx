import { useState, useEffect } from "react";
import { Select } from "antd";
import { Link } from "react-router-dom";
import { apiService } from "../../../core/services/apiService";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import Swal from "sweetalert2";
import { useCallback, useRef } from "react";

export interface GuardianToEditShape {
  id?: string;
  user_id?: string;
  name?: string;
  phone?: string;
  email?: string;
  Child?: string;
  student_id?: number;
  avatar?: string;
}

interface GuardianModalProps {
  guardianToEdit?: GuardianToEditShape | null;
  refetch?: () => void;
}

const SEARCH_DEBOUNCE_MS = 400;

const GuardianModal = ({ guardianToEdit = null, refetch }: GuardianModalProps) => {
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

  // Uniqueness Check State
  const [phoneInUse, setPhoneInUse] = useState(false);
  const [emailInUse, setEmailInUse] = useState(false);

  // Search & Warning State
  const [childOptions, setChildOptions] = useState<{ value: number; label: string; hasGuardian?: boolean; guardianName?: string }[]>([]);
  const [childSearchLoading, setChildSearchLoading] = useState(false);
  const [existingGuardianNotice, setExistingGuardianNotice] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingAvatar, setExistingAvatar] = useState<string | null>(null);



  useEffect(() => {
    if (guardianToEdit) {
      setEditName(guardianToEdit.name ?? "");
      setEditPhone(guardianToEdit.phone ?? "");
      setEditEmail(guardianToEdit.email ?? "");
      setEditStudentId(guardianToEdit.student_id ?? null);
      setExistingAvatar(guardianToEdit.avatar || null);
      setPreviewUrl(null);
      setSelectedFile(null);
    } else {
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setAddStudentId(null);
      setPreviewUrl(null);
      setSelectedFile(null);
      setExistingAvatar(null);
    }
    setError(null);
    setPhoneInUse(false);
    setEmailInUse(false);
  }, [guardianToEdit]);

  // Real-time uniqueness check (debounced)
  useEffect(() => {
    const mobile = (guardianToEdit ? editPhone : addPhone).trim();
    const email = (guardianToEdit ? editEmail : addEmail).trim();
    const excludeId = guardianToEdit?.user_id;

    if (!mobile && !email) {
      setPhoneInUse(false);
      setEmailInUse(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await apiService.checkUserUnique({ mobile, email, excludeId });
        setPhoneInUse(res.mobileExists);
        setEmailInUse(res.emailExists);
      } catch (err) {
        // ignore
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [addPhone, addEmail, editPhone, editEmail, guardianToEdit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        Swal.fire("Error", "Image size should be less than 4MB", "error");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingAvatar(""); // Empty string means "remove existing"
  };

  const handleChildSearch = useCallback((q: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const t = q.trim();
    if (t.length < 2) {
      setChildOptions([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setChildSearchLoading(true);
      try {
        const res = await apiService.searchStudentsForParent(t);
        const list = res?.data || [];
        setChildOptions(
          list.map((s: any) => ({
            value: s.id,
            label: `${s.name || "Student"} · ${s.admissionNumber || "—"} · ${s.className || "—"}`,
            hasGuardian: s.hasGuardian,
            guardianName: s.guardianName,
          }))
        );
      } catch {
        setChildOptions([]);
      } finally {
        setChildSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleStudentChange = async (studentId: number | null, isEditMode: boolean) => {
    if (isEditMode) {
      setEditStudentId(studentId);
    } else {
      setAddStudentId(studentId);
    }

    const opt = childOptions.find(o => o.value === studentId);
    if (opt?.hasGuardian) {
      setExistingGuardianNotice(`Note: This student already has a guardian linked (${opt.guardianName || 'Existing'}). Saving will replace them.`);
    } else {
      setExistingGuardianNotice(null);
    }
  };

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

      // 1. Duplicate Check
      const dup = await apiService.checkUserUnique({ mobile: addPhone.trim(), email: addEmail.trim() });
      if (dup.mobileExists) {
        setError("Phone number is already in use by another user.");
        setSubmitting(false);
        return;
      }

      // 2. Upload Image if selected
      let avatarUrl = "";
      if (selectedFile) {
        const uploadRes = await apiService.uploadSchoolStorageFile(selectedFile, "guardians");
        if (uploadRes.status === "SUCCESS") {
          avatarUrl = uploadRes.data.url;
        }
      }

      const parts = addName.trim().split(/\s+/);
      const first_name = parts[0] || "Guardian";
      const last_name = parts.slice(1).join(" ") || "";

      await apiService.createGuardian({
        student_id: addStudentId,
        guardian_type: "guardian",
        first_name,
        last_name,
        phone: addPhone.trim(),
        email: addEmail.trim() || null,
        avatar: avatarUrl,
      });
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setAddStudentId(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      refetch?.();
      hideModal("add_guardian");
      Swal.fire("Success", "Guardian added successfully", "success");
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
      if (!editPhone.trim()) {
        setError("Phone is required");
        setSubmitting(false);
        return;
      }

      // 1. Duplicate Check
      const dup = await apiService.checkUserUnique({ 
        mobile: editPhone.trim(), 
        email: editEmail.trim(),
        excludeId: guardianToEdit.user_id
      });
      // Actually, checkUserUnique uses user id.
      // But guardians table doesn't easily expose user id here unless we fetch it.

      // 2. Upload Image if selected
      let avatarUrl = existingAvatar;
      if (selectedFile) {
        const uploadRes = await apiService.uploadSchoolStorageFile(selectedFile, "guardians");
        if (uploadRes.status === "SUCCESS") {
          avatarUrl = uploadRes.data.url;
        }
      } else if (existingAvatar === "") {
        avatarUrl = ""; // Removed
      }

      const parts = editName.trim().split(/\s+/);
      const first_name = parts[0] || "Guardian";
      const last_name = parts.slice(1).join(" ") || "";

      await apiService.updateGuardian(guardianToEdit.id, {
        student_id: editStudentId ?? guardianToEdit.student_id,
        guardian_type: "guardian",
        first_name,
        last_name,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        avatar: avatarUrl,
      });
      refetch?.();
      hideModal("edit_guardian");
      Swal.fire("Success", "Guardian updated successfully", "success");
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
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="img-fluid" />
                        ) : (
                          <i className="ti ti-photo-plus fs-16" />
                        )}
                      </div>
                      <div className="profile-upload">
                        <div className="profile-uploader d-flex align-items-center">
                          <div className="drag-upload-btn mb-3">
                            Upload
                            <input
                              type="file"
                              className="form-control image-sign"
                              onChange={handleFileChange}
                              accept="image/*"
                            />
                          </div>
                          <Link
                            to="#"
                            className="btn btn-primary mb-3"
                            onClick={handleRemoveImage}
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
                        className={`form-control ${(phoneInUse && addPhone) ? 'is-invalid' : ''}`}
                        value={addPhone}
                        onChange={(e) => setAddPhone(e.target.value)}
                        required
                      />
                      {(phoneInUse && addPhone) && <div className="invalid-feedback">This phone number is already in use.</div>}
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className={`form-control ${(emailInUse && addEmail) ? 'is-invalid' : ''}`}
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                      />
                      {(emailInUse && addEmail) && <div className="invalid-feedback">This email address is already in use.</div>}
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Child</label>
                      <Select
                        showSearch
                        allowClear
                        getPopupContainer={getModalContainer2}
                        style={{ width: "100%" }}
                        placeholder="Type 2+ characters to search"
                        filterOption={false}
                        onSearch={handleChildSearch}
                        loading={childSearchLoading}
                        value={addStudentId ?? undefined}
                        onChange={(v) => handleStudentChange(v ?? null, false)}
                        options={childOptions}
                      />
                    </div>
                    {existingGuardianNotice && (
                      <div className="alert alert-info mt-3 mb-0" role="alert">
                        <i className="ti ti-info-circle me-1" />
                        {existingGuardianNotice}
                      </div>
                    )}
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
                <button type="submit" className="btn btn-primary" disabled={submitting || phoneInUse || emailInUse}>
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
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="img-fluid" />
                        ) : existingAvatar ? (
                          <ImageWithBasePath src={existingAvatar} alt="Avatar" className="img-fluid" />
                        ) : (
                          <i className="ti ti-photo-plus fs-16" />
                        )}
                      </div>
                      <div className="profile-upload">
                        <div className="profile-uploader d-flex align-items-center">
                          <div className="drag-upload-btn mb-3">
                            Upload
                            <input
                              type="file"
                              className="form-control image-sign"
                              onChange={handleFileChange}
                              accept="image/*"
                            />
                          </div>
                          <Link
                            to="#"
                            className="btn btn-primary mb-3"
                            onClick={handleRemoveImage}
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
                        className={`form-control ${(phoneInUse && editPhone) ? 'is-invalid' : ''}`}
                        placeholder="Enter Phone Number"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        required
                      />
                      {(phoneInUse && editPhone) && <div className="invalid-feedback">This phone number is already in use.</div>}
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className={`form-control ${(emailInUse && editEmail) ? 'is-invalid' : ''}`}
                        placeholder="Enter Email Address"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                      {(emailInUse && editEmail) && <div className="invalid-feedback">This email address is already in use.</div>}
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Child</label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={guardianToEdit?.Child || ""}
                      />
                      <p className="text-muted small mt-1 mb-0">
                        Student link is managed on the student record.
                      </p>
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
                <button type="submit" className="btn btn-primary" disabled={submitting || phoneInUse || emailInUse}>
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

