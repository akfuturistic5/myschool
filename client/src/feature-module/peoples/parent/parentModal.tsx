import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Select } from "antd";
import Swal from "sweetalert2";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { apiService } from "../../../core/services/apiService";
import { checkUserUnique } from "../../../core/utils/checkUserUnique";

export interface ParentToEditShape {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  Child?: string;
  student_id?: number;
  /** Father parent `users.id` for uniqueness exclude on edit */
  father_user_id?: number | null;
}

interface ParentModalProps {
  parentToEdit?: ParentToEditShape | null;
  refetch?: () => void;
}

type ChildOption = { value: number; label: string };

const SEARCH_DEBOUNCE_MS = 400;
const UNIQUENESS_DEBOUNCE_MS = 400;
const PROFILE_MAX = 4 * 1024 * 1024;

const ParentModal = ({ parentToEdit = null, refetch }: ParentModalProps) => {
  const [addFatherName, setAddFatherName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addStudentId, setAddStudentId] = useState<number | null>(null);
  const [childOptions, setChildOptions] = useState<ChildOption[]>([]);
  const [childSearchLoading, setChildSearchLoading] = useState(false);

  const [profileRelPath, setProfileRelPath] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [profileFileName, setProfileFileName] = useState("");
  const [profileUploadStatus, setProfileUploadStatus] = useState<"idle" | "uploading" | "ok" | "err">("idle");
  const profileInputRef = useRef<HTMLInputElement>(null);

  const [editFatherName, setEditFatherName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addMobileError, setAddMobileError] = useState<string | null>(null);
  const [addEmailError, setAddEmailError] = useState<string | null>(null);
  const [addMobileChecking, setAddMobileChecking] = useState(false);
  const [addEmailChecking, setAddEmailChecking] = useState(false);
  const [uniqueCheckNotice, setUniqueCheckNotice] = useState<string | null>(null);

  const [editMobileError, setEditMobileError] = useState<string | null>(null);
  const [editEmailError, setEditEmailError] = useState<string | null>(null);
  const [editMobileChecking, setEditMobileChecking] = useState(false);
  const [editEmailChecking, setEditEmailChecking] = useState(false);
  const [editUniqueNotice, setEditUniqueNotice] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addMobileUniqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addEmailUniqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editMobileUniqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editEmailUniqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (parentToEdit) {
      setEditFatherName(parentToEdit.name ?? "");
      setEditPhone(parentToEdit.phone ?? "");
      setEditEmail(parentToEdit.email ?? "");
      setEditMobileError(null);
      setEditEmailError(null);
      setEditUniqueNotice(null);
    }
  }, [parentToEdit]);

  const runAddMobileUniqueness = useCallback(async (phoneVal?: string) => {
    const m = (phoneVal ?? addPhone).trim();
    if (m.length < 4) {
      setAddMobileError(null);
      return;
    }
    setUniqueCheckNotice(null);
    setAddMobileChecking(true);
    try {
      const r = await checkUserUnique({ mobile: m, excludeId: null });
      setAddMobileError(r.mobileExists ? "Mobile already registered" : null);
    } catch {
      setUniqueCheckNotice("Could not verify mobile. Try again on blur.");
    } finally {
      setAddMobileChecking(false);
    }
  }, [addPhone]);

  const runAddEmailUniqueness = useCallback(async (emailVal?: string) => {
    const e = (emailVal ?? addEmail).trim();
    if (!e) {
      setAddEmailError(null);
      return;
    }
    setUniqueCheckNotice(null);
    setAddEmailChecking(true);
    try {
      const r = await checkUserUnique({ email: e, excludeId: null });
      setAddEmailError(r.emailExists ? "Email already registered" : null);
    } catch {
      setUniqueCheckNotice("Could not verify email. Try again on blur.");
    } finally {
      setAddEmailChecking(false);
    }
  }, [addEmail]);

  const runEditMobileUniqueness = useCallback(
    async (phoneVal?: string) => {
      const m = (phoneVal ?? editPhone).trim();
      if (m.length < 4) {
        setEditMobileError(null);
        return;
      }
      setEditUniqueNotice(null);
      setEditMobileChecking(true);
      try {
        const ex =
          parentToEdit?.father_user_id != null && Number(parentToEdit.father_user_id) > 0
            ? Number(parentToEdit.father_user_id)
            : null;
        const r = await checkUserUnique({ mobile: m, excludeId: ex ?? undefined });
        setEditMobileError(r.mobileExists ? "Mobile already registered" : null);
      } catch {
        setEditUniqueNotice("Could not verify mobile. Try again on blur.");
      } finally {
        setEditMobileChecking(false);
      }
    },
    [editPhone, parentToEdit?.father_user_id]
  );

  const runEditEmailUniqueness = useCallback(
    async (emailVal?: string) => {
      const e = (emailVal ?? editEmail).trim();
      if (!e) {
        setEditEmailError(null);
        return;
      }
      setEditUniqueNotice(null);
      setEditEmailChecking(true);
      try {
        const ex =
          parentToEdit?.father_user_id != null && Number(parentToEdit.father_user_id) > 0
            ? Number(parentToEdit.father_user_id)
            : null;
        const r = await checkUserUnique({ email: e, excludeId: ex ?? undefined });
        setEditEmailError(r.emailExists ? "Email already registered" : null);
      } catch {
        setEditUniqueNotice("Could not verify email. Try again on blur.");
      } finally {
        setEditEmailChecking(false);
      }
    },
    [editEmail, parentToEdit?.father_user_id]
  );

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
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data;
        const list = Array.isArray(arr) ? arr : [];
        setChildOptions(
          list.map((s: { id: number; name?: string; admissionNumber?: string; className?: string }) => ({
            value: s.id,
            label: `${s.name || "Student"} · ${s.admissionNumber || "—"} · ${s.className || "—"}`,
          }))
        );
      } catch {
        setChildOptions([]);
      } finally {
        setChildSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const hideModal = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const Modal = (window as unknown as { bootstrap?: { Modal: { getInstance: (e: HTMLElement) => { hide: () => void } | null } } }).bootstrap?.Modal;
      if (Modal) {
        const instance = Modal.getInstance(el);
        if (instance) instance.hide();
      }
    }
  };

  const resetAddForm = () => {
    setAddFatherName("");
    setAddPhone("");
    setAddEmail("");
    setAddStudentId(null);
    setChildOptions([]);
    setProfileRelPath(null);
    setProfilePreview(null);
    setProfileFileName("");
    setProfileUploadStatus("idle");
    setAddMobileError(null);
    setAddEmailError(null);
    setUniqueCheckNotice(null);
    if (addMobileUniqTimerRef.current) clearTimeout(addMobileUniqTimerRef.current);
    if (addEmailUniqTimerRef.current) clearTimeout(addEmailUniqTimerRef.current);
  };

  const handleProfileFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okMime = ["image/jpeg", "image/png", "image/svg+xml"].includes(file.type);
    if (!okMime || !/\.(jpe?g|png|svg)$/i.test(file.name)) {
      setProfileUploadStatus("err");
      void Swal.fire({ icon: "error", title: "Only JPG, PNG, SVG allowed" });
      return;
    }
    if (file.size > PROFILE_MAX) {
      setProfileUploadStatus("err");
      void Swal.fire({ icon: "error", title: "Max file size is 4MB" });
      return;
    }
    setProfileUploadStatus("uploading");
    try {
      const res = await apiService.uploadParentProfileImage(file);
      const d = (res as { data?: { relativePath?: string; url?: string } })?.data ?? res;
      const rel = (d as { relativePath?: string })?.relativePath;
      const url = (d as { url?: string })?.url;
      if (!rel) throw new Error("No path returned");
      setProfileRelPath(rel);
      setProfileFileName(file.name);
      if (url) {
        const abs = await apiService.getSchoolStorageFileAbsoluteUrl(url);
        setProfilePreview(abs);
      } else {
        setProfilePreview(URL.createObjectURL(file));
      }
      setProfileUploadStatus("ok");
    } catch (err: unknown) {
      setProfileUploadStatus("err");
      const msg = err instanceof Error ? err.message : "Upload failed";
      void Swal.fire({ icon: "error", title: "Upload failed", text: msg });
    }
  };

  const clearProfile = () => {
    setProfileRelPath(null);
    setProfilePreview(null);
    setProfileFileName("");
    setProfileUploadStatus("idle");
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
      if (addMobileError || addEmailError) {
        setSubmitting(false);
        return;
      }
      setUniqueCheckNotice(null);
      setAddMobileChecking(true);
      setAddEmailChecking(true);
      try {
        const final = await checkUserUnique({
          mobile: addPhone.trim(),
          email: addEmail.trim() || undefined,
          excludeId: null,
        });
        if (final.mobileExists) {
          setAddMobileError("Mobile already registered");
          setSubmitting(false);
          return;
        }
        if (addEmail.trim() && final.emailExists) {
          setAddEmailError("Email already registered");
          setSubmitting(false);
          return;
        }
      } catch {
        setUniqueCheckNotice("Could not confirm uniqueness. Please try again.");
        setSubmitting(false);
        return;
      } finally {
        setAddMobileChecking(false);
        setAddEmailChecking(false);
      }

      const res = await apiService.createParentWithChild({
        name: addFatherName.trim(),
        phone: addPhone.trim(),
        email: addEmail.trim() || null,
        student_id: addStudentId ?? null,
        profile_image_path: profileRelPath,
      });
      const payload = (res as { data?: { studentName?: string; reused?: boolean } })?.data ?? res;
      const studentName = (payload as { studentName?: string })?.studentName;
      const linked = addStudentId != null;
      let detail = "Parent account saved.";
      if (linked && studentName) {
        detail = `Linked to student: ${studentName}`;
      } else if (linked) {
        const label = childOptions.find((o) => o.value === addStudentId)?.label ?? "";
        detail = label ? `Linked to: ${label}` : "Guardian link created.";
      }
      await Swal.fire({
        icon: "success",
        title: "Parent created successfully",
        text: detail,
      });
      resetAddForm();
      refetch?.();
      hideModal("add_parent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add parent");
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
      if (editMobileError || editEmailError) {
        setSubmitting(false);
        return;
      }
      const excl =
        parentToEdit?.father_user_id != null && Number(parentToEdit.father_user_id) > 0
          ? Number(parentToEdit.father_user_id)
          : null;
      setEditUniqueNotice(null);
      setEditMobileChecking(true);
      setEditEmailChecking(true);
      try {
        const final = await checkUserUnique({
          mobile: editPhone.trim(),
          email: editEmail.trim() || undefined,
          excludeId: excl ?? undefined,
        });
        if (final.mobileExists) {
          setEditMobileError("Mobile already registered");
          setSubmitting(false);
          return;
        }
        if (editEmail.trim() && final.emailExists) {
          setEditEmailError("Email already registered");
          setSubmitting(false);
          return;
        }
      } catch {
        setEditUniqueNotice("Could not confirm uniqueness. Please try again.");
        setSubmitting(false);
        return;
      } finally {
        setEditMobileChecking(false);
        setEditEmailChecking(false);
      }

      await apiService.updateParent(parentToEdit.id, {
        father_name: editFatherName.trim(),
        father_phone: editPhone.trim(),
        father_email: editEmail.trim() || null,
      });
      await Swal.fire({ icon: "success", title: "Parent updated successfully" });
      refetch?.();
      hideModal("edit_parent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update parent");
    } finally {
      setSubmitting(false);
    }
  };

  const getModalContainer2 = () => {
    const modalElement = document.getElementById("modal-tag2");
    return modalElement ? modalElement : document.body;
  };

  const addSubmitDisabled =
    submitting || addMobileChecking || addEmailChecking || !!addMobileError || !!addEmailError;
  const editSubmitDisabled =
    submitting || editMobileChecking || editEmailChecking || !!editMobileError || !!editEmailError;

  return (
    <>
      {/* Add Parent */}
      <div className="modal fade" id="add_parent">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Parent</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              {error && (
                <div className="alert alert-danger mx-3 mt-2 mb-0" role="alert">
                  {error}
                </div>
              )}
              {uniqueCheckNotice && (
                <div className="alert alert-warning mx-3 mt-2 mb-0" role="alert">
                  {uniqueCheckNotice}
                </div>
              )}
              <div id="modal-tag2" className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="d-flex align-items-start upload-pic flex-wrap row-gap-3 mb-3">
                      <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames overflow-hidden">
                        {profilePreview ? (
                          <img src={profilePreview} alt="Profile" className="img-fluid rounded w-100 h-100 object-fit-cover" />
                        ) : (
                          <i className="ti ti-photo-plus fs-16" />
                        )}
                      </div>
                      <div className="profile-upload">
                        <div className="profile-uploader d-flex align-items-center flex-wrap gap-2 mb-2">
                          <input ref={profileInputRef} type="file" accept="image/jpeg,image/png,image/svg+xml,.jpg,.jpeg,.png,.svg" className="d-none" onChange={handleProfileFile} />
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => profileInputRef.current?.click()}>
                            <i className="ti ti-upload me-1" />
                            Upload photo
                          </button>
                          {profileRelPath && (
                            <button type="button" className="btn btn-sm btn-light" onClick={clearProfile}>
                              Remove
                            </button>
                          )}
                        </div>
                        {profileFileName && <p className="small text-muted mb-1">Uploaded: {profileFileName}</p>}
                        <p className="small mb-1">
                          {profileUploadStatus === "uploading" && <span className="text-primary">Uploading…</span>}
                          {profileUploadStatus === "ok" && (
                            <span className="text-success">
                              <i className="ti ti-check me-1" />
                              Uploaded
                            </span>
                          )}
                          {profileUploadStatus === "err" && (
                            <span className="text-danger">
                              <i className="ti ti-x me-1" />
                              Failed
                            </span>
                          )}
                        </p>
                        <p className="text-muted small mb-0">Max 4MB. JPG, PNG, or SVG.</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addFatherName}
                        onChange={(e) => setAddFatherName(e.target.value)}
                        required
                        placeholder="Full name"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label d-flex align-items-center gap-2">
                        Mobile
                        {addMobileChecking && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                      </label>
                      <input
                        type="text"
                        className={`form-control ${addMobileError ? "is-invalid" : ""}`}
                        value={addPhone}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddPhone(v);
                          setAddMobileError(null);
                          setUniqueCheckNotice(null);
                          if (addMobileUniqTimerRef.current) clearTimeout(addMobileUniqTimerRef.current);
                          addMobileUniqTimerRef.current = setTimeout(() => void runAddMobileUniqueness(v), UNIQUENESS_DEBOUNCE_MS);
                        }}
                        onBlur={(e) => {
                          if (addMobileUniqTimerRef.current) clearTimeout(addMobileUniqTimerRef.current);
                          void runAddMobileUniqueness(e.target.value);
                        }}
                        required
                        placeholder="Required — used for login / uniqueness"
                        autoComplete="tel"
                      />
                      {addMobileError && <div className="invalid-feedback d-block">{addMobileError}</div>}
                    </div>
                    <div className="mb-3">
                      <label className="form-label d-flex align-items-center gap-2">
                        Email (optional)
                        {addEmailChecking && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                      </label>
                      <input
                        type="email"
                        className={`form-control ${addEmailError ? "is-invalid" : ""}`}
                        value={addEmail}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddEmail(v);
                          setAddEmailError(null);
                          setUniqueCheckNotice(null);
                          if (addEmailUniqTimerRef.current) clearTimeout(addEmailUniqTimerRef.current);
                          addEmailUniqTimerRef.current = setTimeout(() => void runAddEmailUniqueness(v), UNIQUENESS_DEBOUNCE_MS);
                        }}
                        onBlur={(e) => {
                          if (addEmailUniqTimerRef.current) clearTimeout(addEmailUniqTimerRef.current);
                          void runAddEmailUniqueness(e.target.value);
                        }}
                        placeholder="Optional"
                        autoComplete="email"
                      />
                      {addEmailError && <div className="invalid-feedback d-block">{addEmailError}</div>}
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Select child</label>
                      <Select
                        showSearch
                        allowClear
                        className="w-100"
                        placeholder="Type at least 2 characters to search"
                        filterOption={false}
                        onSearch={handleChildSearch}
                        loading={childSearchLoading}
                        notFoundContent={childSearchLoading ? "Searching…" : "No students"}
                        getPopupContainer={getModalContainer2}
                        options={childOptions}
                        value={addStudentId ?? undefined}
                        onChange={(v) => setAddStudentId(v ?? null)}
                        optionLabelProp="label"
                      />
                      <p className="text-muted small mt-1 mb-0">Optional — links this parent as father guardian to the student.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addSubmitDisabled}>
                  {submitting ? "Saving…" : "Add Parent"}
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
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form key={parentToEdit?.id ?? "edit-form"} onSubmit={handleEditSubmit}>
              {error && (
                <div className="alert alert-danger mx-3 mt-2 mb-0" role="alert">
                  {error}
                </div>
              )}
              {editUniqueNotice && (
                <div className="alert alert-warning mx-3 mt-2 mb-0" role="alert">
                  {editUniqueNotice}
                </div>
              )}
              <div id="modal-tag" className="modal-body ">
                <div className="row">
                  <div className="col-md-12">
                    <div className="d-flex align-items-center upload-pic flex-wrap row-gap-3 mb-3">
                      <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                        <ImageWithBasePath src="assets/img/parents/parent-13.jpg" className="img-fluid rounded" alt="" />
                      </div>
                      <div className="profile-upload">
                        <p className="text-muted small mb-0">Photo update from parent grid edit can be added later.</p>
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
                      <label className="form-label d-flex align-items-center gap-2">
                        Phone Number
                        {editMobileChecking && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                      </label>
                      <input
                        type="text"
                        className={`form-control ${editMobileError ? "is-invalid" : ""}`}
                        placeholder="Enter Phone Number"
                        value={editPhone}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditPhone(v);
                          setEditMobileError(null);
                          setEditUniqueNotice(null);
                          if (editMobileUniqTimerRef.current) clearTimeout(editMobileUniqTimerRef.current);
                          editMobileUniqTimerRef.current = setTimeout(() => void runEditMobileUniqueness(v), UNIQUENESS_DEBOUNCE_MS);
                        }}
                        onBlur={(e) => {
                          if (editMobileUniqTimerRef.current) clearTimeout(editMobileUniqTimerRef.current);
                          void runEditMobileUniqueness(e.target.value);
                        }}
                        required
                        autoComplete="tel"
                      />
                      {editMobileError && <div className="invalid-feedback d-block">{editMobileError}</div>}
                    </div>
                    <div className="mb-3">
                      <label className="form-label d-flex align-items-center gap-2">
                        Email Address
                        {editEmailChecking && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                      </label>
                      <input
                        type="email"
                        className={`form-control ${editEmailError ? "is-invalid" : ""}`}
                        placeholder="Enter Email Address"
                        value={editEmail}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditEmail(v);
                          setEditEmailError(null);
                          setEditUniqueNotice(null);
                          if (editEmailUniqTimerRef.current) clearTimeout(editEmailUniqTimerRef.current);
                          editEmailUniqTimerRef.current = setTimeout(() => void runEditEmailUniqueness(v), UNIQUENESS_DEBOUNCE_MS);
                        }}
                        onBlur={(e) => {
                          if (editEmailUniqTimerRef.current) clearTimeout(editEmailUniqTimerRef.current);
                          void runEditEmailUniqueness(e.target.value);
                        }}
                        autoComplete="email"
                      />
                      {editEmailError && <div className="invalid-feedback d-block">{editEmailError}</div>}
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Child (student)</label>
                      <input type="text" className="form-control" readOnly value={parentToEdit?.Child || ""} />
                      <p className="text-muted small mt-1 mb-0">Student link is managed on the student record.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitDisabled}>
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
            <form>
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>Confirm Deletion</h4>
                <p>You want to delete all the marked items, this cant be undone once you delete.</p>
                <div className="d-flex justify-content-center">
                  <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">
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
