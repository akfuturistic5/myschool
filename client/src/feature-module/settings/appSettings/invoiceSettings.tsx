
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import { useEffect, useState } from "react";
import { apiService, getApiBaseUrl } from "../../../core/services/apiService";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import Swal from "sweetalert2";

const routes = all_routes;

const InvoiceSettings = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  
  const [logoUrl, setLogoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [terms, setTerms] = useState("");

  const fullUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const cleanPath = path.startsWith("/api/") ? path.slice(4) : path;
    const finalPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
    return `${apiBaseUrl}${finalPath}`;
  };

  useEffect(() => {
    const fetchBase = async () => {
      const base = await getApiBaseUrl();
      setApiBaseUrl(base);
    };
    fetchBase();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiService.getSettings("invoice");
      if (res.data) {
        const s = res.data;
        setLogoUrl(s.invoice_logo || "");
        setSignatureUrl(s.invoice_signature_url || "");
        setSignatureName(s.invoice_signature_name || "");
        setTerms(s.invoice_terms || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const key = type === 'logo' ? "invoice_logo" : "invoice_signature_url";
      const res = await apiService.uploadSettingFile(file, "invoice", key);
      
      if (res.data?.url) {
        if (type === 'logo') setLogoUrl(res.data.url);
        else setSignatureUrl(res.data.url);
        
        await Swal.fire({
          icon: "success",
          title: "File Uploaded",
          text: `${type === 'logo' ? 'Logo' : 'Signature'} uploaded successfully. Click Save to persist changes.`,
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: (error as Error)?.message || "Could not upload file"
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiService.upsertSettings("invoice", {
        invoice_signature_name: signatureName,
        invoice_terms: terms,
        invoice_logo: logoUrl,
        invoice_signature_url: signatureUrl
      });
      
      await Swal.fire({
        icon: "success",
        title: "Settings Saved",
        text: "Invoice settings have been updated successfully",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: (error as Error)?.message || "Could not save settings"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content bg-white">
          <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">App Settings</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Settings</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    App Settings
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
                    onClick={fetchSettings}
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
                  to={routes.invoiceSettings}
                  className="d-block rounded p-2 active"
                >
                  Invoice Settings
                </Link>
                <Link to={routes.customFields} className="d-block rounded p-2">
                  Custom Fields
                </Link>
              </div>
            </div>
            <div className="col-xxl-10 col-xl-9">
              <div className="flex-fill border-start ps-3">
                <form onSubmit={handleSubmit}>
                  <div className="d-flex align-items-center justify-content-between flex-wrap border-bottom pt-3 mb-3">
                    <div className="mb-3">
                      <h5 className="mb-1">Invoice Settings</h5>
                      <p>Collection of settings for Invoice</p>
                    </div>
                    <div className="mb-3">
                      <button className="btn btn-light me-2" type="button" onClick={fetchSettings}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                  {loading && (
                    <div className="d-flex justify-content-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  )}
                  {!loading && (
                    <div className="d-md-flex d-block">
                      <div className="row flex-fill">
                        <div className="col-xl-10">
                          <div className="settings-middle-info invoice-setting-wrap">
                            {/* Invoice Logo */}
                            <div className="row align-items-center mb-4">
                              <div className="col-xxl-7 col-lg-6">
                                <div className="invoice-info-title">
                                  <h6>Invoice Logo</h6>
                                  <p>Upload school logo to display in Invoice</p>
                                </div>
                              </div>
                              <div className="col-xxl-5 col-lg-6">
                                <div className="card mb-0">
                                  <div className="card-body">
                                    <div className="d-flex align-items-center mb-3">
                                      <span className="avatar avatar-xl border rounded d-flex align-items-center justify-content-center p-2 me-2 bg-light">
                                        {logoUrl ? (
                                          <img src={fullUrl(logoUrl)} alt="Logo" className="img-fluid" style={{ maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : (
                                          <i className="ti ti-photo fs-30 text-gray-4" />
                                        )}
                                      </span>
                                      <div>
                                        <h5>Logo</h5>
                                        <p className="fs-12">Recommended: 450x450px</p>
                                      </div>
                                    </div>
                                    <div className="profile-uploader profile-uploader-two mb-0">
                                      <div className="drag-upload-btn bg-transparent me-0 border-0">
                                        <p className="fs-12 mb-2">
                                          <span className="text-primary font-medium">Click to Upload</span>
                                        </p>
                                      </div>
                                      <input
                                        type="file"
                                        className="form-control"
                                        onChange={(e) => handleFileUpload(e, 'logo')}
                                        accept="image/*"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Signature Upload */}
                            <div className="row align-items-center mb-4">
                              <div className="col-xxl-7 col-lg-6">
                                <div className="invoice-info-title">
                                  <h6>Signature Image</h6>
                                  <p>Upload authorized signature for invoices</p>
                                </div>
                              </div>
                              <div className="col-xxl-5 col-lg-6">
                                <div className="card mb-0">
                                  <div className="card-body">
                                    <div className="d-flex align-items-center mb-3">
                                      <span className="avatar avatar-xl border rounded d-flex align-items-center justify-content-center p-2 me-2 bg-light">
                                        {signatureUrl ? (
                                          <img src={fullUrl(signatureUrl)} alt="Signature" className="img-fluid" style={{ maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : (
                                          <i className="ti ti-signature fs-30 text-gray-4" />
                                        )}
                                      </span>
                                      <div>
                                        <h5>Signature</h5>
                                        <p className="fs-12">Authorized Signature</p>
                                      </div>
                                    </div>
                                    <div className="profile-uploader profile-uploader-two mb-0">
                                      <div className="drag-upload-btn bg-transparent me-0 border-0">
                                        <p className="fs-12 mb-2">
                                          <span className="text-primary font-medium">Click to Upload</span>
                                        </p>
                                      </div>
                                      <input
                                        type="file"
                                        className="form-control"
                                        onChange={(e) => handleFileUpload(e, 'signature')}
                                        accept="image/*"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Signature Name */}
                            <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                              <div className="row align-items-center flex-fill">
                                <div className="col-xxl-7 col-lg-6">
                                  <div className="mb-3">
                                    <h6>Signature Name</h6>
                                    <p>Designation or Name to display below signature</p>
                                  </div>
                                </div>
                                <div className="col-xxl-5 col-lg-6">
                                  <div className="mb-3">
                                    <input 
                                      type="text" 
                                      className="form-control" 
                                      value={signatureName}
                                      onChange={(e) => setSignatureName(e.target.value)}
                                      placeholder="e.g. Authorized Signatory"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Terms & Conditions */}
                            <div className="d-flex align-items-center justify-content-between flex-wrap border mb-3 p-3 pb-0 rounded">
                              <div className="row align-items-center flex-fill">
                                <div className="col-xxl-7 col-lg-6">
                                  <div className="mb-3">
                                    <h6>Terms & Conditions</h6>
                                    <p>Global terms displayed on all invoices</p>
                                  </div>
                                </div>
                                <div className="col-xxl-5 col-lg-6">
                                  <div className="mb-3">
                                    <textarea
                                      rows={4}
                                      className="form-control"
                                      value={terms}
                                      onChange={(e) => setTerms(e.target.value)}
                                      placeholder="Enter terms and conditions..."
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSettings;
