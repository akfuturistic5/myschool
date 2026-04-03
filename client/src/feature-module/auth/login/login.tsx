import { useEffect, useState } from "react";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { Link, useNavigate } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import { useDispatch, useSelector } from "react-redux";
import { setAuth, selectUser } from "../../../core/data/redux/authSlice";
import { apiService } from "../../../core/services/apiService";
import { getDashboardForRole } from "../../../core/utils/roleUtils";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const Login = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [instituteNumber, setInstituteNumber] = useState("1111");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setPasswordVisible((prevState) => !prevState);
  };
  const isAuthenticated = useSelector((state: any) => state.auth?.isAuthenticated);
  const user = useSelector(selectUser);

  const MySwal = withReactContent(Swal);

  useEffect(() => {
    localStorage.setItem("menuOpened", "Dashboard");
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role || "Admin";
      const dashboard = getDashboardForRole(role);
      navigate(dashboard);
    } else if (isAuthenticated) {
      navigate(routes.adminDashboard);
    }
  }, [isAuthenticated, user, navigate, routes.adminDashboard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!instituteNumber.trim() || !username.trim() || !password) {
      setError("Please enter institute number, username and password");
      return;
    }
    setLoading(true);
    try {
      const res = await apiService.login(instituteNumber.trim(), username.trim(), password);
      if (res.status === "SUCCESS" && res.data) {
        dispatch(
          setAuth({
            user: res.data.user,
            token: res.data.accessToken ?? undefined,
          })
        );
        const role = res.data.user?.role || "Admin";
        const dashboard = getDashboardForRole(role);
        navigate(dashboard);
      } else {
        setError(res.message || "Login failed");
      }
    } catch (err: any) {
      const msg = err?.message || "Login failed. Please try again.";

      // Handle disabled school (403) with a SweetAlert-style popup
      if (msg.includes("status: 403") && msg.includes("This school is currently disabled")) {
        setError("");
        MySwal.fire({
          icon: "warning",
          title: "School Disabled",
          text: "This school is currently disabled. Please contact the platform administrator.",
          confirmButtonText: "Go to Login",
          confirmButtonColor: "#3085d6",
        }).then(() => {
          navigate(routes.login);
        });
      } else {
        setError(msg.includes("401") ? "Invalid username or password" : msg);
      }
    } finally {
      setLoading(false);
    }
  };
  const date = () => {
    return new Date().getFullYear();
  };

  return (
    <div className="container-fuild">
      <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100">
        <div className="row">
          <div className="col-lg-6">
            <div className="login-background d-lg-flex align-items-center justify-content-center d-lg-block d-none flex-wrap vh-100 overflowy-auto">
              <div>
                <ImageWithBasePath
                  src="assets/img/authentication/authentication-02.jpg"
                  alt=""
                />
              </div>
              <div className="authen-overlay-item  w-100 p-4">
                <h4 className="text-white mb-3">What's New on Preskool !!!</h4>
                <div className="d-flex align-items-center flex-row mb-3 justify-content-between p-3 br-5 gap-3 card">
                  <div>
                    <h6>Summer Vacation Holiday Homework</h6>
                    <p className="mb-0 text-truncate">
                      The school will remain closed from April 20th to June...
                    </p>
                  </div>
                  <Link to="#">
                    <i className="ti ti-chevrons-right" />
                  </Link>
                </div>
                <div className="d-flex align-items-center flex-row mb-3 justify-content-between p-3 br-5 gap-3 card">
                  <div>
                    <h6>New Academic Session Admission Start(2024-25)</h6>
                    <p className="mb-0 text-truncate">
                      An academic term is a portion of an academic year, the
                      time ....
                    </p>
                  </div>
                  <Link to="#">
                    <i className="ti ti-chevrons-right" />
                  </Link>
                </div>
                <div className="d-flex align-items-center flex-row mb-3 justify-content-between p-3 br-5 gap-3 card">
                  <div>
                    <h6>Date sheet Final Exam Nursery to Sr.Kg</h6>
                    <p className="mb-0 text-truncate">
                      Dear Parents, As the final examination for the session
                      2024-25 is ...
                    </p>
                  </div>
                  <Link to="#">
                    <i className="ti ti-chevrons-right" />
                  </Link>
                </div>
                <div className="d-flex align-items-center flex-row mb-3 justify-content-between p-3 br-5 gap-3 card">
                  <div>
                    <h6>Annual Day Function</h6>
                    <p className="mb-0 text-truncate">
                      Annual functions provide a platform for students to
                      showcase their...
                    </p>
                  </div>
                  <Link to="#">
                    <i className="ti ti-chevrons-right" />
                  </Link>
                </div>
                <div className="d-flex align-items-center flex-row mb-0 justify-content-between p-3 br-5 gap-3 card">
                  <div>
                    <h6>Summer Vacation Holiday Homework</h6>
                    <p className="mb-0 text-truncate">
                      The school will remain closed from April 20th to June 15th
                      for summer...
                    </p>
                  </div>
                  <Link to="#">
                    <i className="ti ti-chevrons-right" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-6 col-md-12 col-sm-12">
            <div className="row justify-content-center align-items-center vh-100 overflow-auto flex-wrap ">
              <div className="col-md-8 mx-auto p-4">
                <form onSubmit={handleSubmit}>
                  <div>
                    <div className=" mx-auto mb-5 text-center">
                      <ImageWithBasePath
                        src="assets/img/authentication/authentication-logo.svg"
                        className="img-fluid"
                        alt="Logo"
                      />
                    </div>
                    <div className="card">
                      <div className="card-body pb-3">
                        <div className=" mb-4">
                          <h2 className="mb-2">Welcome</h2>
                          <p className="mb-0">
                            Please enter your details to sign in
                          </p>
                        </div>
                        <div className="mt-4">
                          <div className="d-flex align-items-center justify-content-center flex-wrap">
                            <div className="text-center me-2 flex-fill">
                              <Link
                                to="#"
                                className="bg-primary br-10 p-2 btn btn-primary  d-flex align-items-center justify-content-center"
                              >
                                <ImageWithBasePath
                                  className="img-fluid m-1"
                                  src="assets/img/icons/facebook-logo.svg"
                                  alt="Facebook"
                                />
                              </Link>
                            </div>
                            <div className="text-center me-2 flex-fill">
                              <Link
                                to="#"
                                className=" br-10 p-2 btn btn-outline-light  d-flex align-items-center justify-content-center"
                              >
                                <ImageWithBasePath
                                  className="img-fluid  m-1"
                                  src="assets/img/icons/google-logo.svg"
                                  alt="Facebook"
                                />
                              </Link>
                            </div>
                            <div className="text-center flex-fill">
                              <Link
                                to="#"
                                className="bg-dark br-10 p-2 btn btn-dark d-flex align-items-center justify-content-center"
                              >
                                <ImageWithBasePath
                                  className="img-fluid  m-1"
                                  src="assets/img/icons/apple-logo.svg"
                                  alt="Apple"
                                />
                              </Link>
                            </div>
                          </div>
                        </div>
                        <div className="login-or">
                          <span className="span-or">Or</span>
                        </div>
                        {error && (
                          <div className="alert alert-danger mb-3" role="alert">
                            {error}
                          </div>
                        )}
                        <div className="mb-3 ">
                          <label className="form-label">Institute Number</label>
                          <div className="input-icon mb-3 position-relative">
                            <span className="input-icon-addon">
                              <i className="ti ti-building-school" />
                            </span>
                            <input
                              type="text"
                              value={instituteNumber}
                              onChange={(e) => setInstituteNumber(e.target.value)}
                              className="form-control"
                              placeholder="Enter institute number (e.g. 1111)"
                              disabled={loading}
                            />
                          </div>
                          <label className="form-label">Username or Phone</label>
                          <div className="input-icon mb-3 position-relative">
                            <span className="input-icon-addon">
                              <i className="ti ti-user" />
                            </span>
                            <input
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="form-control"
                              placeholder="Enter username or phone"
                              disabled={loading}
                            />
                          </div>
                          <label className="form-label">Password (Phone Number)</label>
                          <div className="pass-group">
                            <input
                              type={isPasswordVisible ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pass-input form-control"
                              placeholder="Enter phone number as password"
                              disabled={loading}
                            />
                            <span
                              className={`ti toggle-password ${
                                isPasswordVisible ? "ti-eye" : "ti-eye-off"
                              }`}
                              onClick={togglePasswordVisibility}
                            />
                          </div>
                        </div>
                        <div className="form-wrap form-wrap-checkbox">
                          <div className="d-flex align-items-center">
                            <div className="form-check form-check-md mb-0">
                              <input
                                className="form-check-input mt-0"
                                type="checkbox"
                              />
                            </div>
                            <p className="ms-1 mb-0 ">Remember Me</p>
                          </div>
                          <div className="text-end ">
                            <Link to={routes.forgotPassword}className="link-danger">
                              Forgot Password?
                            </Link>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 pt-0">
                        <div className="mb-3">
                          <button
                            type="submit"
                            className="btn btn-primary w-100"
                            disabled={loading}
                          >
                            {loading ? "Signing In..." : "Sign In"}
                          </button>
                        </div>
                        <div className="text-center">
                          <h6 className="fw-normal text-dark mb-0">
                            Don’t have an account?{" "}
                            <Link to={routes.register} className="hover-a ">
                              {" "}
                              Create Account
                            </Link>
                          </h6>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 text-center">
                      <p className="mb-0 ">Copyright © {date()} - Preskool</p>
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

export default Login;
