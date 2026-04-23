import { type FormEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setDataTheme } from '../../core/data/redux/themeSettingSlice';
import {
  clearSuperAdminAuth,
  patchSuperAdminProfile,
  selectSuperAdminUser,
} from '../../core/data/redux/superAdminAuthSlice';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  validateStrongPassword,
  showPasswordRequirementsAlert,
  showPasswordSuccessAlert,
} from '../../core/utils/passwordPolicy';

type Props = {
  open: boolean;
  onClose: () => void;
};

function parseApiErrorMessage(raw: string): string {
  const idx = raw.indexOf('message: ');
  if (idx === -1) return raw;
  const jsonPart = raw.slice(idx + 9).trim();
  try {
    const j = JSON.parse(jsonPart) as { message?: string };
    if (j?.message) return j.message;
  } catch {
    /* ignore */
  }
  return raw;
}

type SaSuccess = {
  status?: string;
  message?: string;
  data?: { id?: number; username?: string; email?: string };
};

const SuperAdminSettingsOffcanvas = ({ open, onClose }: Props) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const saUser = useSelector(selectSuperAdminUser);
  const dataTheme = useSelector((state: { themeSetting: { dataTheme: string } }) => state.themeSetting.dataTheme);

  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const isDark = dataTheme === 'dark_data_theme';

  useEffect(() => {
    if (open && saUser?.username) {
      setUsernameDraft(saUser.username);
      setUsernameCurrentPassword('');
      setUserError(null);
    }
  }, [open, saUser?.username]);

  const syncProfileFromResponse = (res: SaSuccess) => {
    const d = res.data;
    if (d && (d.username != null || d.email != null)) {
      dispatch(
        patchSuperAdminProfile({
          username: d.username,
          email: d.email,
        })
      );
    }
  };

  const setLightMode = () => {
    dispatch(setDataTheme('default_data_theme'));
  };

  const setDarkMode = () => {
    dispatch(setDataTheme('dark_data_theme'));
  };

  const handleLogout = async () => {
    onClose();
    try {
      await superAdminApiService.logout();
    } catch {
      /* best-effort */
    }
    dispatch(clearSuperAdminAuth());
    navigate('/super-admin/login', { replace: true });
  };

  const handleUsernameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUserError(null);
    const next = usernameDraft.trim();
    if (next.length < 2) {
      setUserError('Username must be at least 2 characters');
      return;
    }
    setUserSubmitting(true);
    try {
      const res = (await superAdminApiService.updateProfile(
        next,
        usernameCurrentPassword
      )) as SaSuccess;
      if (res.status === 'SUCCESS') {
        syncProfileFromResponse(res);
        setUsernameCurrentPassword('');
        await showPasswordSuccessAlert(res.message || 'Profile updated.');
        onClose();
      } else {
        setUserError(res.message || 'Could not update username');
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Could not update username';
      setUserError(parseApiErrorMessage(raw));
    } finally {
      setUserSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    const policyMsg = validateStrongPassword(newPassword);
    if (policyMsg) {
      await showPasswordRequirementsAlert(policyMsg);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match');
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = (await superAdminApiService.changePassword(
        currentPassword,
        newPassword,
        confirmPassword
      )) as SaSuccess;
      if (res.status === 'SUCCESS') {
        syncProfileFromResponse(res);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await showPasswordSuccessAlert(res.message || 'Your password has been updated.');
        onClose();
      } else {
        setPwdError(res.message || 'Could not change password');
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Could not change password';
      setPwdError(parseApiErrorMessage(raw));
    } finally {
      setPwdSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="offcanvas-backdrop fade show" onClick={onClose} aria-hidden="true" />
      <div
        className="offcanvas offcanvas-end show super-admin-settings-offcanvas border-start border-secondary"
        tabIndex={-1}
        id="superAdminSettings"
        aria-labelledby="superAdminSettingsLabel"
        role="dialog"
        aria-modal="true"
      >
        <div className="offcanvas-header border-bottom border-secondary">
          <h5 className="offcanvas-title" id="superAdminSettingsLabel">
            Settings
          </h5>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="offcanvas-body d-flex flex-column gap-4">
          <section>
            <h6 className="text-muted text-uppercase small mb-3">Appearance</h6>
            <p className="small text-body-secondary mb-2">Light or dark mode for the Super Admin area.</p>
            <div className="btn-group w-100" role="group" aria-label="Theme">
              <button
                type="button"
                className={`btn btn-outline-primary ${!isDark ? 'active' : ''}`}
                onClick={setLightMode}
              >
                Light
              </button>
              <button
                type="button"
                className={`btn btn-outline-primary ${isDark ? 'active' : ''}`}
                onClick={setDarkMode}
              >
                Dark
              </button>
            </div>
          </section>

          <hr className="border-secondary my-0" />

          <section>
            <h6 className="text-muted text-uppercase small mb-3">Username</h6>
            <form onSubmit={handleUsernameSubmit} className="d-flex flex-column gap-3">
              {userError && (
                <div className="alert alert-danger py-2 small mb-0" role="alert">
                  {userError}
                </div>
              )}
              <div>
                <label className="form-label" htmlFor="sa-username">
                  Username
                </label>
                <input
                  id="sa-username"
                  type="text"
                  className="form-control"
                  autoComplete="username"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  disabled={userSubmitting}
                  required
                  minLength={2}
                  maxLength={150}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="sa-username-pwd">
                  Current password (to confirm)
                </label>
                <input
                  id="sa-username-pwd"
                  type="password"
                  className="form-control"
                  autoComplete="current-password"
                  value={usernameCurrentPassword}
                  onChange={(e) => setUsernameCurrentPassword(e.target.value)}
                  disabled={userSubmitting}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={userSubmitting}>
                {userSubmitting ? 'Saving…' : 'Save username'}
              </button>
            </form>
          </section>

          <hr className="border-secondary my-0" />

          <section>
            <h6 className="text-muted text-uppercase small mb-3">Change password</h6>
            <p className="small text-body-secondary mb-3">
              Your current password is required. The new password applies only if the current one is correct.
            </p>
            <form onSubmit={handlePasswordSubmit} className="d-flex flex-column gap-3">
              {pwdError && (
                <div className="alert alert-danger py-2 small mb-0" role="alert">
                  {pwdError}
                </div>
              )}
              <div>
                <label className="form-label" htmlFor="sa-curr-pwd">
                  Current password
                </label>
                <input
                  id="sa-curr-pwd"
                  type="password"
                  className="form-control"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={pwdSubmitting}
                  required
                />
              </div>
              <div>
                <label className="form-label" htmlFor="sa-new-pwd">
                  New password
                </label>
                <input
                  id="sa-new-pwd"
                  type="password"
                  className="form-control"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={pwdSubmitting}
                  required
                  minLength={8}
                  maxLength={20}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="sa-confirm-pwd">
                  Confirm new password
                </label>
                <input
                  id="sa-confirm-pwd"
                  type="password"
                  className="form-control"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={pwdSubmitting}
                  required
                  minLength={8}
                  maxLength={20}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pwdSubmitting}>
                {pwdSubmitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </section>

          <hr className="border-secondary my-0" />

          <div className="mt-auto">
            <button type="button" className="btn btn-outline-danger w-100" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SuperAdminSettingsOffcanvas;

