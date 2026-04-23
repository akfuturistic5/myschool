import { all_routes } from '../../router/all_routes';
import { Link } from 'react-router-dom';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useCurrentUser } from '../../../core/hooks/useCurrentUser';

const Securitysettings = () => {
  const routes = all_routes;
  const { user, loading, error, refetch } = useCurrentUser();

  const displayEmail = user?.email?.trim() || null;
  const displayPhone = user?.phone?.trim() || null;

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between border-bottom pb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">General Settings</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to="index">Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Settings</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    General Settings
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
                    refetch();
                  }}
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
                <Link to={routes.securitysettings} className="d-block rounded p-2 active">
                  Security Settings
                </Link>
                <Link
                  to={routes.notificationssettings}
                  className="d-block rounded p-2"
                >
                  Notifications
                </Link>
                <Link to={routes.connectedApps} className="d-block rounded p-2">
                  Connected Apps
                </Link>
              </div>
            </div>
            <div className="col-xxl-10 col-xl-9">
              <div className="border-start ps-3 flex-fill">
                <div className="d-flex align-items-center justify-content-between flex-wrap border-bottom mb-3 pt-3">
                  <div className="mb-3">
                    <h5>Security Settings</h5>
                    <p>Manage your account security and contact details</p>
                  </div>
                </div>
                {loading && (
                  <div className="alert alert-info mb-3" role="alert">
                    Loading your security settings...
                  </div>
                )}
                {error && (
                  <div className="alert alert-warning mb-3" role="alert">
                    {error}
                  </div>
                )}
                <div className="d-block">
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Password</h6>
                      <p>Set a unique password to protect the account</p>
                    </div>
                    <div className="mb-3">
                      <Link to={routes.profile} className="btn btn-outline-primary">
                        Change Password
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Two Factor</h6>
                      <p>Receive codes via SMS or email every time you login</p>
                    </div>
                    <div className="mb-3">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="switch-sm"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Google Authentication</h6>
                      <p>Connect to Google</p>
                    </div>
                    <div className="d-flex align-items-center mb-3">
                      <span className="badge badge-soft-secondary me-3">
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        Not connected
                      </span>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="switch-sm2"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Phone Number Verification</h6>
                      <p>The Phone Number associated with the account</p>
                    </div>
                    <div className="d-flex align-items-center flex-wrap">
                      <p className="mb-3 me-3">{displayPhone || '—'}</p>
                      <span className={`badge me-3 mb-3 ${displayPhone ? 'badge-soft-success' : 'badge-soft-secondary'}`}>
                        <i className={`ti ${displayPhone ? 'ti-checks' : 'ti-circle-x'} me-1`} />
                        {displayPhone ? 'Verified' : 'Not set'}
                      </span>
                      <Link to={routes.profile} className="btn btn-light mb-3">
                        <i className="ti ti-edit me-2" />
                        Edit
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Email Address</h6>
                      <p>The email address associated with the account</p>
                    </div>
                    <div className="d-flex align-items-center flex-wrap">
                      <p className="mb-3 me-3">{displayEmail || '—'}</p>
                      <span className={`badge me-3 mb-3 ${displayEmail ? 'badge-soft-success' : 'badge-soft-secondary'}`}>
                        <i className={`ti ${displayEmail ? 'ti-checks' : 'ti-circle-x'} me-1`} />
                        {displayEmail ? 'Verified' : 'Not set'}
                      </span>
                      <Link to={routes.profile} className="btn btn-light mb-3">
                        <i className="ti ti-edit me-2" />
                        Edit
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Device Management</h6>
                      <p>The devices associated with the account</p>
                    </div>
                    <div className="mb-3">
                      <Link to="#" className="btn btn-outline-primary">
                        Manage
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Account Activity</h6>
                      <p>The activities of the account </p>
                    </div>
                    <div className="mb-3">
                      <Link to="#" className="btn btn-outline-primary">
                        View
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Deactivate Account</h6>
                      <p>
                        This will shutdown your account. Your account will be reactive
                        when you sign in again{" "}
                      </p>
                    </div>
                    <div className="mb-3">
                      <Link to="#" className="btn btn-outline-primary">
                        Deactivate
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center rounded flex-wrap bg-white border rounded p-3 pb-0 mb-3">
                    <div className="mb-3">
                      <h6>Delete Account</h6>
                      <p>Your account will be permanently deleted</p>
                    </div>
                    <div className="mb-3">
                      <Link
                        to="#"
                        className="btn btn-outline-danger"
                        data-bs-toggle="modal"
                        data-bs-target="#delete-modal"
                      >
                        Delete
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form>
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>Confirm Deletion</h4>
                <p>
                  You want to delete all the marked items, this cant be undone once
                  you delete.
                </p>
                <div className="d-flex justify-content-center">
                  <Link
                    to="#"
                    className="btn btn-light me-3"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-danger">
                    Yes, Delete
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Securitysettings


