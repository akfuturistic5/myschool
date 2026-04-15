import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { all_routes } from "../../feature-module/router/all_routes";
import { clearAuth } from "../data/redux/authSlice";
import { clearTenantBearerToken } from "../services/apiService";

const INACTIVE_MESSAGE =
  "Your account is disabled by headmaster. Kindly contact school headmaster for browsing application.";

const InactiveAccountScreen = () => {
  const alertShown = useRef(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    if (alertShown.current) return;
    alertShown.current = true;
    const MySwal = withReactContent(Swal);
    MySwal.fire({
      title: "Account Disabled",
      text: INACTIVE_MESSAGE,
      icon: "warning",
      confirmButtonText: "OK",
      confirmButtonColor: "#405189",
      customClass: {
        popup: "rounded-3 shadow-lg",
        title: "h4 mb-2",
      },
      allowOutsideClick: false,
    });
  }, []);

  return (
    <div className="main-wrapper d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="text-center p-4">
        <div className="mb-3">
          <i className="ti ti-user-off fs-1 text-warning" style={{ fontSize: "4rem" }} />
        </div>
        <h5 className="text-dark mb-2">Account Disabled</h5>
        <p className="text-muted mb-3 small">{INACTIVE_MESSAGE}</p>
        <button
          type="button"
          className="btn btn-primary px-4"
          onClick={() => {
            clearTenantBearerToken();
            dispatch(clearAuth());
            navigate(all_routes.login, { replace: true });
          }}
        >
          Go to login page
        </button>
      </div>
    </div>
  );
};

export default InactiveAccountScreen;
