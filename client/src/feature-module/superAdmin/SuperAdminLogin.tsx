import { FormEvent, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import { setSuperAdminAuth } from '../../core/data/redux/superAdminAuthSlice';

const SuperAdminLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailOrUsername.trim() || !password) {
      setError('Please enter email/username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await superAdminApiService.login(emailOrUsername.trim(), password);
      if (res.status === 'SUCCESS' && res.data?.user) {
        const u = res.data.user;
        dispatch(
          setSuperAdminAuth({
            user: {
              id: u.id,
              username: u.username,
              email: u.email,
              role: u.role || 'super_admin',
            },
          })
        );
        navigate('/super-admin/dashboard', { replace: true });
      } else {
        setError(res.message || 'Super Admin login failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Super Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="super-admin-login-wrap min-vh-100 bg-body text-body d-flex align-items-center py-4">
      <div className="container-fluid w-100">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow-sm border-secondary bg-body">
              <div className="card-body">
                <h4 className="mb-3 text-center text-body">Super Admin Login</h4>
                <p className="text-muted text-center mb-4">
                  Platform-level access for managing all schools.
                </p>
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Email or Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;

