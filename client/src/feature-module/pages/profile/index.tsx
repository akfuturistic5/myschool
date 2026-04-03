import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { all_routes } from "../../router/all_routes";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { setAuthFromSession } from "../../../core/data/redux/authSlice";
import { apiService } from "../../../core/services/apiService";
import { useCurrentUser } from "../../../core/hooks/useCurrentUser";
import {
  validateStrongPassword,
  showPasswordRequirementsAlert,
  showPasswordSuccessAlert,
} from "../../../core/utils/passwordPolicy";
import { extractMessageFromApiError } from "../../../core/utils/apiErrorMessage";
type PasswordField =
  | "oldPassword"
  | "newPassword"
  | "confirmPassword"
  | "currentPassword";

const Profile = () => {
  const route = all_routes;
  const dispatch = useDispatch();
  const { user, loading: meLoading, error: meError, refetch } = useCurrentUser();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    username: "",
    current_address: "",
    permanent_address: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [pwd, setPwd] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdSaving, setPwdSaving] = useState(false);

  const canEdit = useMemo(() => {
    // Basic guard; if account is disabled we still allow viewing
    return !!user && user.account_disabled !== true;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      first_name: (user.first_name || "").toString(),
      last_name: (user.last_name || "").toString(),
      email: (user.email || "").toString(),
      phone: (user.phone || "").toString(),
      username: (user.username || "").toString(),
      current_address: (user.current_address || "").toString(),
      permanent_address: (user.permanent_address || "").toString(),
    }));
  }, [user?.id]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const hydrateReduxFromMe = async () => {
    const res = await apiService.getMe();
    if (res?.status === "SUCCESS" && res.data) {
      const d = res.data;
      const displayName =
        d.display_name ||
        [d.student_first_name, d.student_last_name].filter(Boolean).join(" ") ||
        [d.staff_first_name, d.staff_last_name].filter(Boolean).join(" ") ||
        [d.first_name, d.last_name].filter(Boolean).join(" ") ||
        d.username ||
        "User";
      const role = d.display_role || d.role_name || "User";
      dispatch(
        setAuthFromSession({
          user: {
            id: d.id,
            username: d.username,
            displayName,
            role,
            user_role_id: d.role_id,
            staff_id: d.staff_id,
            accountDisabled: d.account_disabled === true,
            school_name: d.school_name,
            school_type: d.school_type,
            school_logo: d.school_logo ?? null,
            institute_number: d.institute_number,
          },
        })
      );
    }
  };

  const onSave = async () => {
    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        current_address: form.current_address.trim(),
        permanent_address: form.permanent_address.trim(),
      };
      const res = await apiService.updateMe(payload);
      if (res?.status !== "SUCCESS") {
        throw new Error(res?.message || "Failed to save profile");
      }
      setSaveSuccess("Profile saved");
      await hydrateReduxFromMe();
      await refetch();
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    if (!pwd.currentPassword.trim()) {
      await showPasswordRequirementsAlert(
        "Please enter your current password.",
        "Change password"
      );
      return;
    }
    const policyMsg = validateStrongPassword(pwd.newPassword);
    if (policyMsg) {
      await showPasswordRequirementsAlert(policyMsg);
      return;
    }
    if (pwd.newPassword !== pwd.confirmPassword) {
      await showPasswordRequirementsAlert(
        "New password and confirmation do not match.",
        "Change password"
      );
      return;
    }
    if (pwd.currentPassword === pwd.newPassword) {
      await showPasswordRequirementsAlert(
        "New password must be different from your current password.",
        "Change password"
      );
      return;
    }

    setPwdSaving(true);
    try {
      const res = await apiService.changePassword(
        pwd.currentPassword,
        pwd.newPassword,
        pwd.confirmPassword
      );
      if (res?.status !== "SUCCESS") {
        await showPasswordRequirementsAlert(
          res?.message || "Failed to change password.",
          "Cannot change password"
        );
        return;
      }
      setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
      await showPasswordSuccessAlert("Your password was updated successfully.");
      const modalEl = document.getElementById("change_password");
      if (modalEl && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }
    } catch (e: unknown) {
      const msg = extractMessageFromApiError(e);
      await showPasswordRequirementsAlert(msg, "Cannot change password");
    } finally {
      setPwdSaving(false);
    }
  };

  const [passwordVisibility, setPasswordVisibility] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
    currentPassword: false,
  });

  const togglePasswordVisibility = (field: PasswordField) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Profile</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={route.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Settings</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Profile
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
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white btn-icon me-1"
                      onClick={(e) => {
                        e.preventDefault();
                        setSaveSuccess(null);
                        setSaveError(null);
                        refetch();
                      }}
                    >
                      <i className="ti ti-refresh" />
                    </Link>
                  </OverlayTrigger>
                </div>
              </div>
            </div>
            {(meLoading || saving) && (
              <div className="alert alert-info mt-3 mb-0" role="alert">
                {meLoading ? "Loading your profile..." : "Saving your changes..."}
              </div>
            )}
            {meError && (
              <div className="alert alert-warning mt-3 mb-0" role="alert">
                {meError}
              </div>
            )}
            {saveError && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="alert alert-success mt-3 mb-0" role="alert">
                {saveSuccess}
              </div>
            )}
            <div className="d-md-flex d-block mt-3">
              <div className="settings-right-sidebar me-md-3 border-0">
                <div className="card">
                  <div className="card-header">
                    <h5>Personal Information</h5>
                  </div>
                  <div className="card-body ">
                    <div className="settings-profile-upload">
                      <span className="profile-pic">
                        <ImageWithBasePath
                          src="assets/img/profiles/avatar-27.jpg"
                          alt="Profile"
                        />
                      </span>
                      <div className="title-upload">
                        <h5>{user?.display_name || user?.name || "User"}</h5>
                        <p className="mb-0 text-primary">
                          {user?.display_role || user?.role || "User"}
                        </p>
                        <Link to="#" className="me-2">
                          Delete{" "}
                        </Link>
                        <Link to="#" className="text-primary">
                          Update
                        </Link>
                      </div>
                    </div>
                    <div className="profile-uploader profile-uploader-two mb-0">
                      <span className="upload-icon">
                        <i className="ti ti-upload" />
                      </span>
                      <div className="drag-upload-btn bg-transparent me-0 border-0">
                        <p className="upload-btn">
                          <span>Click to Upload</span> or drag and drop
                        </p>
                        <h6>JPG or PNG</h6>
                        <h6>(Max 450 x 450 px)</h6>
                      </div>
                      <input
                        type="file"
                        className="form-control"
                        multiple
                        id="image_sign"
                      />
                      <div id="frames" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-fill ps-0 border-0">
                <form>
                  <div className="d-md-flex">
                    <div className="flex-fill">
                      <div className="card">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <h5>Personal Information</h5>
                          <Link
                            to="#"
                            className="btn btn-primary btn-sm"
                            data-bs-toggle="modal"
                            data-bs-target="#edit_personal_information"
                          >
                            <i className="ti ti-edit me-2" />
                            Edit
                          </Link>
                        </div>
                        <div className="card-body pb-0">
                          <div className="d-block d-xl-flex">
                            <div className="mb-3 flex-fill me-xl-3 me-0">
                              <label className="form-label">First Name</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Enter First Name"
                                value={form.first_name}
                                onChange={(e) => setField("first_name", e.target.value)}
                                disabled={!canEdit || saving}
                              />
                            </div>
                            <div className="mb-3 flex-fill">
                              <label className="form-label">Last Name</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Enter Last Name"
                                value={form.last_name}
                                onChange={(e) => setField("last_name", e.target.value)}
                                disabled={!canEdit || saving}
                              />
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="form-label">Email Address</label>
                            <input
                              type="email"
                              className="form-control"
                              placeholder="Enter Email"
                              value={form.email}
                              onChange={(e) => setField("email", e.target.value)}
                              disabled={!canEdit || saving}
                            />
                          </div>
                          <div className="d-block d-xl-flex">
                            <div className="mb-3 flex-fill me-xl-3 me-0">
                              <label className="form-label">User Name</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Enter User Name"
                                value={form.username}
                                disabled
                              />
                            </div>
                            <div className="mb-3 flex-fill">
                              <label className="form-label">Phone Number</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Enter Phone Number"
                                value={form.phone}
                                onChange={(e) => setField("phone", e.target.value)}
                                disabled={!canEdit || saving}
                              />
                            </div>
                          </div>
                          <div className="d-flex justify-content-end pb-3">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={onSave}
                              disabled={!canEdit || saving || meLoading}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="card">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <h5>Address Information</h5>
                          <Link
                            to="#"
                            className="btn btn-primary btn-sm"
                            data-bs-toggle="modal"
                            data-bs-target="#edit_address_information"
                          >
                            <i className="ti ti-edit me-2" />
                            Edit
                          </Link>
                        </div>
                        <div className="card-body pb-0">
                          <div className="mb-3">
                            <label className="form-label">Current Address</label>
                            <textarea
                              className="form-control"
                              placeholder="Enter Current Address"
                              value={form.current_address}
                              onChange={(e) => setField("current_address", e.target.value)}
                              disabled={!canEdit || saving}
                              rows={3}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label">Permanent Address</label>
                            <textarea
                              className="form-control"
                              placeholder="Enter Permanent Address"
                              value={form.permanent_address}
                              onChange={(e) => setField("permanent_address", e.target.value)}
                              disabled={!canEdit || saving}
                              rows={3}
                            />
                          </div>
                          <div className="d-flex justify-content-end pb-3">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={onSave}
                              disabled={!canEdit || saving || meLoading}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="card">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <h5>Password</h5>
                          <Link
                            to="#"
                            className="btn btn-primary btn-sm"
                            data-bs-toggle="modal"
                            data-bs-target="#change_password"
                          >
                            Change
                          </Link>
                        </div>
                        <div className="card-body pb-0">
                          <div className="mb-3 mb-3">
                            <label className="form-label">
                              Current Password
                            </label>
                            <div className="pass-group d-flex">
                              <input
                                type={
                                  passwordVisibility.currentPassword
                                    ? "text"
                                    : "password"
                                }
                                className="pass-input form-control"
                              />
                              <span
                                className={`ti toggle-passwords ${
                                  passwordVisibility.currentPassword
                                    ? "ti-eye"
                                    : "ti-eye-off"
                                }`}
                                onClick={() =>
                                  togglePasswordVisibility("currentPassword")
                                }
                              ></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        {/* /Page Wrapper */}
        {/* Edit Profile */}
        <div className="modal fade" id="edit_personal_information">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Personal Information</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">First Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter First Name"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Last Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Last Name"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">User Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter User Name"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Email"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Phone Number"
                        />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Bio</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Bio"
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      await onSave();
                    }}
                    data-bs-dismiss="modal"
                    disabled={!canEdit || saving || meLoading}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Edit Profile */}
        {/* Edit Profile */}
        <div className="modal fade" id="edit_address_information">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Address Information</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Address</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Address"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Country</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Country"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">State/Province</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter State/Province"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">City</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter City"
                        />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Postal Code</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Postal Code"
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      await onSave();
                    }}
                    data-bs-dismiss="modal"
                    disabled={!canEdit || saving || meLoading}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Edit Profile */}
        {/* Change Password */}
        <div className="modal fade" id="change_password">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Change Password</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Current Password</label>
                        <div className="pass-group d-flex">
                          <input
                            type={
                              passwordVisibility.oldPassword
                                ? "text"
                                : "password"
                            }
                            className="pass-input form-control"
                            value={pwd.currentPassword}
                            onChange={(e) =>
                              setPwd((p) => ({ ...p, currentPassword: e.target.value }))
                            }
                            disabled={pwdSaving}
                          />
                          <span
                            className={`ti toggle-passwords ${
                              passwordVisibility.oldPassword
                                ? "ti-eye"
                                : "ti-eye-off"
                            }`}
                            onClick={() =>
                              togglePasswordVisibility("oldPassword")
                            }
                          ></span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">New Password</label>
                        <div className="pass-group d-flex">
                          <input
                            type={
                              passwordVisibility.newPassword
                                ? "text"
                                : "password"
                            }
                            className="pass-input form-control"
                            value={pwd.newPassword}
                            onChange={(e) =>
                              setPwd((p) => ({ ...p, newPassword: e.target.value }))
                            }
                            disabled={pwdSaving}
                            minLength={8}
                            maxLength={20}
                            autoComplete="new-password"
                          />
                          <span
                            className={`ti toggle-passwords ${
                              passwordVisibility.newPassword
                                ? "ti-eye"
                                : "ti-eye-off"
                            }`}
                            onClick={() =>
                              togglePasswordVisibility("newPassword")
                            }
                          ></span>
                        </div>
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Confirm Password</label>
                        <div className="pass-group d-flex">
                          <input
                            type={
                              passwordVisibility.confirmPassword
                                ? "text"
                                : "password"
                            }
                            className="pass-input form-control"
                            value={pwd.confirmPassword}
                            onChange={(e) =>
                              setPwd((p) => ({ ...p, confirmPassword: e.target.value }))
                            }
                            disabled={pwdSaving}
                            minLength={8}
                            maxLength={20}
                            autoComplete="new-password"
                          />
                          <span
                            className={`ti toggle-passwords ${
                              passwordVisibility.confirmPassword
                                ? "ti-eye"
                                : "ti-eye-off"
                            }`}
                            onClick={() =>
                              togglePasswordVisibility("confirmPassword")
                            }
                          ></span>
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      await onChangePassword();
                    }}
                    disabled={pwdSaving || meLoading}
                  >
                    {pwdSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Change Password */}
      </>
    </div>
  );
};

export default Profile;
