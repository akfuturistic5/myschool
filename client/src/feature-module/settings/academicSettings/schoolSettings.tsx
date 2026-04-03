import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { apiService } from "../../../core/services/apiService";
import { useDispatch } from "react-redux";
import { patchAuthUser } from "../../../core/data/redux/authSlice";
import { useCurrentUser } from "../../../core/hooks/useCurrentUser";
import { alertLogoUploadError, alertLogoUploadSuccess } from "../../../core/utils/schoolLogoUploadAlerts";
import { isHeadmasterRole } from "../../../core/utils/roleUtils";
import SchoolLogoImage from "../../../core/common/schoolLogoImage";

const SchoolSettings = () => {
  const route = all_routes;
  const dispatch = useDispatch();
  const { user } = useCurrentUser();
  const isAdmin = useMemo(() => isHeadmasterRole(user), [user]);
  const [schoolName, setSchoolName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiService.getSchoolProfile();
      const data = res?.data || {};
      setSchoolName(data.school_name || "");
      setLogoUrl(data.logo_url || "");
    } catch (e) {
      setError((e as Error)?.message || "Failed to load school profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      setSaving(true);
      setMessage("");
      setError("");
      await apiService.updateSchoolProfile({ school_name: schoolName });
      setMessage("School profile updated successfully.");
    } catch (e) {
      setError((e as Error)?.message || "Failed to update school profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setMessage("");
      setError("");
      const res = await apiService.uploadSchoolLogo(file);
      const updated = res?.data || {};
      setLogoUrl(updated.logo_url || "");
      const fromUpload = updated.logo_url || "";
      try {
        const me = await apiService.getMe();
        if (me?.status === "SUCCESS" && me.data && me.data.school_logo !== undefined) {
          dispatch(patchAuthUser({ school_logo: me.data.school_logo ?? null }));
        } else if (fromUpload) {
          dispatch(patchAuthUser({ school_logo: fromUpload }));
        }
      } catch {
        if (fromUpload) {
          dispatch(patchAuthUser({ school_logo: fromUpload }));
        }
      }
      await alertLogoUploadSuccess();
    } catch (err) {
      setError((err as Error)?.message || "Failed to upload school logo");
      await alertLogoUploadError(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content bg-white">
          <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Academic Settings</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to="index">Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Settings</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Academic Settings
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
                  >
                    <i className="ti ti-refresh" />
                  </Link>
                </OverlayTrigger>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xxl-2 col-xl-3">
              <div className="pt-3 d-flex flex-column list-group mb-4">
                <Link
                  to={route.schoolSettings}
                  className="d-block rounded active p-2"
                >
                  School Settings
                </Link>
                <Link to={route.religion} className="d-block rounded p-2">
                  Religion
                </Link>
              </div>
            </div>
            <div className="col-xxl-10 col-xl-9">
              <div className="border-start ps-3">
                <form onSubmit={handleSave}>
                  <div className="d-flex align-items-center justify-content-between flex-wrap border-bottom pt-3 mb-3">
                    <div className="mb-3">
                      <h5 className="mb-1">School Settings</h5>
                      <p>School Settings Configuration</p>
                    </div>
                    <div className="mb-3">
                      <button className="btn btn-light me-2" type="button">
                        Cancel
                      </button>
                      <button className="btn btn-primary" type="submit" disabled={!isAdmin || saving || loading}>
                        Save
                      </button>
                    </div>
                  </div>
                  {loading && <div className="alert alert-info">Loading school profile...</div>}
                  {!!message && <div className="alert alert-success">{message}</div>}
                  {!!error && <div className="alert alert-danger">{error}</div>}
                  {!isAdmin && <div className="alert alert-warning">Only Admin can edit school settings.</div>}
                  <div className="d-md-flex">
                    <div className="row flex-fill">
                      <div className="col-xl-10">
                        <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                          <div className="row align-items-center flex-fill">
                            <div className="col-xxl-8 col-lg-6">
                              <div className="mb-3">
                                <h6>School Name</h6>
                                <p>Shows name of your school</p>
                              </div>
                            </div>
                            <div className="col-xxl-4 col-lg-6">
                              <div className="mb-3">
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Enter School Name"
                                  value={schoolName}
                                  onChange={(e) => setSchoolName(e.target.value)}
                                  disabled={!isAdmin || loading || saving}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                          <div className="row align-items-center flex-fill">
                            <div className="col-xxl-8 col-lg-6">
                              <div className="mb-3">
                                <h6>School Logo</h6>
                                <p>Used in generated documents like Bonafide Certificate</p>
                                {logoUrl ? (
                                  <SchoolLogoImage
                                    src={logoUrl}
                                    alt="School Logo"
                                    style={{ maxHeight: 80, objectFit: "contain", marginTop: 8 }}
                                  />
                                ) : (
                                  <p className="mb-0 text-muted">No logo uploaded</p>
                                )}
                              </div>
                            </div>
                            <div className="col-xxl-4 col-lg-6">
                              <div className="mb-3">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="form-control"
                                  onChange={handleLogoChange}
                                  disabled={!isAdmin || uploading || loading}
                                />
                                {uploading && <small className="text-muted">Uploading...</small>}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                          <div className="row align-items-center flex-fill">
                            <div className="col-xxl-8 col-lg-6">
                              <div className="mb-3">
                                <h6>Phone Number</h6>
                                <p>Shows phone number of your school</p>
                              </div>
                            </div>
                            <div className="col-xxl-4 col-lg-6">
                              <div className="mb-3">
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Enter Phone Number"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                          <div className="row align-items-center flex-fill">
                            <div className="col-xxl-8 col-lg-6">
                              <div className="mb-3">
                                <h6>Email</h6>
                                <p>Shows email of your school</p>
                              </div>
                            </div>
                            <div className="col-xxl-4 col-lg-6">
                              <div className="mb-3">
                                <input
                                  type="email"
                                  className="form-control"
                                  placeholder="Enter Email"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                          <div className="row align-items-center flex-fill">
                            <div className="col-xxl-8 col-lg-6">
                              <div className="mb-3">
                                <h6>Fax</h6>
                                <p>Shows fax of your school</p>
                              </div>
                            </div>
                            <div className="col-xxl-4 col-lg-6">
                              <div className="mb-3">
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Enter Fax"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                          <div className="row align-items-center flex-fill">
                            <div className="col-xxl-8 col-lg-6">
                              <div className="mb-3">
                                <h6>Address</h6>
                                <p>Shows address of your school</p>
                              </div>
                            </div>
                            <div className="col-xxl-4 col-lg-6">
                              <div className="mb-3">
                                <textarea
                                  rows={4}
                                  className="form-control"
                                  placeholder="Add Comment"
                                  defaultValue={""}
                                />
                              </div>
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
      </div>
    </div>
  );
};

export default SchoolSettings;
