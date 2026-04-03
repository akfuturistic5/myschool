import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  setDataLayout,
  setDataTheme,
} from "../../data/redux/themeSettingSlice";
import { clearAuth, selectUser } from "../../data/redux/authSlice";
import { setSelectedAcademicYear, selectSelectedAcademicYearId } from "../../data/redux/academicYearSlice";
import ImageWithBasePath from "../imageWithBasePath";
import SchoolLogoImage from "../schoolLogoImage";
import {
  setExpandMenu,
  setMobileSidebar,
  toggleMiniSidebar,
} from "../../data/redux/sidebarSlice";
import { useState, useEffect, useRef } from "react";
import { all_routes } from "../../../feature-module/router/all_routes";
import { getDashboardForRole, getDisplayRoleLabel, isAdministrativeRole, isHeadmasterRole } from "../../utils/roleUtils";
import { getSchoolLogoSrc, isMillatStyleLogoPath } from "../../utils/schoolLogo";
import { useAcademicYears } from "../../hooks/useAcademicYears";
import { useSchoolLogoUpload } from "../../hooks/useSchoolLogoUpload";
const Header = () => {
  const routes = all_routes;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const handleLogout = async () => {
    setUserProfileMenuOpen(false);
    setMobileUserMenuOpen(false);
    try {
      const { apiService } = await import("../../services/apiService");
      await apiService.logout();
    } catch {
      // ignore
    }
    dispatch(clearAuth());
    navigate(routes.login);
  };
  const dataTheme = useSelector((state: any) => state.themeSetting.dataTheme);
  const dataLayout = useSelector((state: any) => state.themeSetting.dataLayout);
  const [notificationVisible, setNotificationVisible] = useState(false);
  /** React-controlled menus: avoids relying on Bootstrap's data-api (fragile with Vite/React + some browsers with display:contents ancestors). */
  const [userProfileMenuOpen, setUserProfileMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const userProfileDropdownRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);
  const selectedAcademicYearId = useSelector(selectSelectedAcademicYearId);

  useEffect(() => {
    if (!userProfileMenuOpen && !mobileUserMenuOpen) return;
    const closeOnOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userProfileMenuOpen && userProfileDropdownRef.current?.contains(t)) return;
      if (mobileUserMenuOpen && mobileUserMenuRef.current?.contains(t)) return;
      setUserProfileMenuOpen(false);
      setMobileUserMenuOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserProfileMenuOpen(false);
        setMobileUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [userProfileMenuOpen, mobileUserMenuOpen]);

  // Fetch academic years from API
  const { academicYears, loading, error } = useAcademicYears();
  const academicYearsList = academicYears ?? [];
  const currentAcademicYear = academicYearsList.find((year: { is_current?: boolean }) => year.is_current === true) || academicYearsList[0];
  const selectedYear = selectedAcademicYearId != null
    ? academicYearsList.find((y: { id: number }) => y.id === selectedAcademicYearId)
    : currentAcademicYear || academicYearsList[0];
  const displayYear = selectedYear || currentAcademicYear;

  // Show Academic Year dropdown only for Admin (Headmaster) and Teacher
  const roleNorm = (user?.role ?? '').trim().toLowerCase();
  const showAcademicYearDropdown =
    isHeadmasterRole(user) || isAdministrativeRole(user) || roleNorm === 'teacher';

  // Bootstrap: when years load and no selection stored, set to current year
  useEffect(() => {
    if (!showAcademicYearDropdown) return;
    if (academicYearsList.length > 0 && selectedAcademicYearId == null && currentAcademicYear?.id) {
      dispatch(setSelectedAcademicYear(currentAcademicYear.id));
    }
  }, [showAcademicYearDropdown, academicYearsList.length, selectedAcademicYearId, currentAcademicYear?.id, dispatch]);

  const dashboardRoute = getDashboardForRole(user);

  const mobileSidebar = useSelector(
    (state: any) => state.sidebarSlice.mobileSidebar
  );

  const toggleMobileSidebar = () => {
    dispatch(setMobileSidebar(!mobileSidebar));
  };

  const onMouseEnter = () => {
    if (dataLayout === "mini_layout") dispatch(setExpandMenu(true));
  };
  const onMouseLeave = () => {
    if (dataLayout === "mini_layout") dispatch(setExpandMenu(false));
  };
  const handleToggleMiniSidebar = () => {
    // Desktop-only: collapse/expand sidebar without changing page-wrapper width.
    // We explicitly do NOT toggle mini_layout here (mini_layout changes content width and uses hover-expand).
    dispatch(setExpandMenu(false));
    if (dataLayout === "mini_layout") dispatch(setDataLayout("default_layout"));
    dispatch(toggleMiniSidebar());
    try {
      const prev = localStorage.getItem("miniSidebar") === "true";
      localStorage.setItem("miniSidebar", String(!prev));
    } catch {
      // ignore
    }
  };

  const handleToggleClick = () => {
    if (dataTheme === "default_data_theme") {
      dispatch(setDataTheme("dark_data_theme"));
      // localStorage.setItem(dataTheme,"dark_data_theme")
    } else {
      dispatch(setDataTheme("default_data_theme"));
      // localStorage.removeItem(dataTheme)
    }
  };
  const location = useLocation();
  const toggleNotification = () => {
    setNotificationVisible(!notificationVisible);
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
        });
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {
          });
        }
        setIsFullscreen(false);
      }
    }
  };

  const schoolLogoSrc = getSchoolLogoSrc(user);
  const isMillatLogo = isMillatStyleLogoPath(schoolLogoSrc);
  const {
    isHeadmaster: canChangeSchoolLogo,
    uploading: logoUploading,
    inputRef: logoFileInputRef,
    openFilePicker: openSchoolLogoPicker,
    onFileChange: onSchoolLogoFileChange,
  } = useSchoolLogoUpload();

  return (
    <>
      {/* Header */}
      <div className="header">
        {/* Logo */}
        <div
          className="header-left active"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {canChangeSchoolLogo && (
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/*"
              className="d-none"
              onChange={onSchoolLogoFileChange}
              aria-hidden
            />
          )}
          {canChangeSchoolLogo ? (
            <>
              <div
                className={`logo ${dataTheme === "default_data_theme" ? "logo-normal" : "dark-logo"} d-flex align-items-center`}
              >
                <button
                  type="button"
                  className="btn p-0 border-0 bg-transparent shadow-none d-flex align-items-center"
                  onClick={openSchoolLogoPicker}
                  disabled={logoUploading}
                  title="Change school logo"
                  aria-label="Change school logo"
                  style={{ cursor: logoUploading ? "wait" : "pointer" }}
                >
                  <SchoolLogoImage
                    src={schoolLogoSrc}
                    alt="School Logo"
                    className={`logo-icon ${isMillatLogo ? "logo-icon--large" : ""}`}
                  />
                </button>
                <Link
                  to={dashboardRoute}
                  className="logo-school-name text-decoration-none text-reset ms-0"
                >
                  {user?.school_name || "PreSkool"}
                </Link>
              </div>
              <div className="logo-small">
                <button
                  type="button"
                  className="btn p-0 border-0 bg-transparent shadow-none w-100 d-flex justify-content-center"
                  onClick={openSchoolLogoPicker}
                  disabled={logoUploading}
                  title="Change school logo"
                  aria-label="Change school logo"
                  style={{ cursor: logoUploading ? "wait" : "pointer" }}
                >
                  <SchoolLogoImage
                    src={schoolLogoSrc}
                    alt="School Logo"
                    className={isMillatLogo ? "logo-icon--large" : undefined}
                  />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to={dashboardRoute}
                className={`logo ${dataTheme === "default_data_theme" ? "logo-normal" : "dark-logo"} d-flex align-items-center`}
              >
                <SchoolLogoImage
                  src={schoolLogoSrc}
                  alt="School Logo"
                  className={`logo-icon ${isMillatLogo ? "logo-icon--large" : ""}`}
                />
                <span className="logo-school-name">{user?.school_name || "PreSkool"}</span>
              </Link>
              <Link to={dashboardRoute} className="logo-small">
                <SchoolLogoImage
                  src={schoolLogoSrc}
                  alt="School Logo"
                  className={isMillatLogo ? "logo-icon--large" : undefined}
                />
              </Link>
            </>
          )}
          <Link
            id="toggle_btn"
            to="#"
            onClick={(e) => {
              e.preventDefault();
              handleToggleMiniSidebar();
            }}
          >
            <i className="ti ti-menu-deep" />
          </Link>
        </div>
        {/* /Logo */}
        <Link
          id="mobile_btn"
          className="mobile_btn"
          to="#sidebar"
          onClick={toggleMobileSidebar}
        >
          <span className="bar-icon">
            <span />
            <span />
            <span />
          </span>
        </Link>
        {user?.school_name && (
          <div className="mobile-show mobile-school-badge">
            <span className="badge bg-primary-subtle text-primary fw-semibold">
              {user.school_name} ({user.institute_number || "----"})
            </span>
          </div>
        )}
        <div className="header-search-center d-none d-lg-flex">
          <div className="nav-item nav-searchinputs w-100">
            <div className="top-nav-search w-100">
              <Link to="#" className="responsive-search">
                <i className="fa fa-search" />
              </Link>
              <form action="#" className="dropdown">
                <div className="searchinputs" id="dropdownMenuClickable">
                  <input type="text" placeholder="Search" aria-label="Search" />
                  <div className="search-addon">
                    <button type="submit" aria-label="Submit search">
                      <i className="ti ti-command" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="header-user">
          <div className="nav user-menu header-toolbar-nav">
            <div className="d-flex align-items-center">
              {showAcademicYearDropdown && (
                <div className="dropdown me-2">
                  <button
                    type="button"
                    className="btn btn-outline-light fw-normal bg-white d-flex align-items-center p-2 dropdown-toggle"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <i className="ti ti-calendar-due me-1" />
                    {loading ? (
                      "Loading..."
                    ) : error ? (
                      "Error loading years"
                    ) : displayYear ? (
                      `Academic Year : ${displayYear.year_name}`
                    ) : (
                      "No academic year"
                    )}
                  </button>
                  <div className="dropdown-menu dropdown-menu-right">
                    {loading ? (
                      <div className="dropdown-item d-flex align-items-center">
                        <i className="ti ti-loader ti-spin me-2"></i>
                        Loading academic years...
                      </div>
                    ) : error ? (
                      <div className="dropdown-item d-flex align-items-center text-danger">
                        <i className="ti ti-alert-circle me-2"></i>
                        Error: {error}
                      </div>
                    ) : academicYearsList.length > 0 ? (
                      academicYearsList.map((year: { id: number; year_name?: string }) => (
                        <Link
                          key={year.id}
                          to="#"
                          className="dropdown-item d-flex align-items-center"
                          onClick={(e) => {
                            e.preventDefault();
                            if (selectedAcademicYearId !== year.id) {
                              dispatch(setSelectedAcademicYear(year.id));
                              window.location.reload();
                            }
                          }}
                        >
                          Academic Year : {year.year_name}
                        </Link>
                      ))
                    ) : (
                      <div className="dropdown-item d-flex align-items-center">
                        No academic years available
                      </div>
                    )}
                  </div>
                </div>
              )}
              {user?.school_name && (
                <div className="pe-2">
                  <span className="badge bg-primary-subtle text-primary fw-semibold">
                    {user.school_name} ({user.institute_number || "----"})
                  </span>
                </div>
              )}
              <div className="pe-1">
                {!location.pathname.includes("layout-dark") && (
                  <Link
                    onClick={handleToggleClick}
                    to="#"
                    id="dark-mode-toggle"
                    className="dark-mode-toggle activate btn btn-outline-light bg-white btn-icon me-1"
                  >
                    <i
                      className={
                        dataTheme === "default_data_theme"
                          ? "ti ti-moon"
                          : "ti ti-brightness-up"
                      }
                    />
                  </Link>
                )}
              </div>
              <div
                className={`pe-1 ${
                  notificationVisible ? "notification-item-show" : ""
                }`}
                id="notification_item"
              >
                <Link
                  onClick={toggleNotification}
                  to="#"
                  className="btn btn-outline-light bg-white btn-icon position-relative me-1"
                  id="notification_popup"
                >
                  <i className="ti ti-bell" />
                  <span className="notification-status-dot" />
                </Link>
                <div className="dropdown-menu dropdown-menu-end notification-dropdown p-4">
                  <div className="d-flex align-items-center justify-content-between border-bottom p-0 pb-3 mb-3">
                    <h4 className="notification-title">Notifications (2)</h4>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="text-primary fs-15 me-3 lh-1">
                        Mark all as read
                      </Link>
                      <div className="dropdown">
                        <button
                          type="button"
                          className="bg-white dropdown-toggle border-0"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <i className="ti ti-calendar-due me-1" />
                          Today
                        </button>
                        <ul className="dropdown-menu mt-2 p-3">
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              This Week
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Last Week
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Last Week
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="noti-content">
                    <div className="d-flex flex-column">
                      <div className="border-bottom mb-3 pb-3">
                        <Link to={routes.activity}>
                          <div className="d-flex">
                            <span className="avatar avatar-lg me-2 flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-27.jpg"
                                alt="Profile"
                              />
                            </span>
                            <div className="flex-grow-1">
                              <p className="mb-1">
                                <span className="text-dark fw-semibold">
                                  Shawn
                                </span>{' '}
                                performance in Math is below the threshold.
                              </p>
                              <span>Just Now</span>
                            </div>
                          </div>
                        </Link>
                      </div>
                      <div className="border-bottom mb-3 pb-3">
                        <Link to={routes.activity} className="pb-0">
                          <div className="d-flex">
                            <span className="avatar avatar-lg me-2 flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-23.jpg"
                                alt="Profile"
                              />
                            </span>
                            <div className="flex-grow-1">
                              <p className="mb-1">
                                <span className="text-dark fw-semibold">
                                  Sylvia
                                </span>{" "}
                                added appointment on 02:00 PM
                              </p>
                              <span>10 mins ago</span>
                              <div className="d-flex justify-content-start align-items-center mt-1">
                                <span className="btn btn-light btn-sm me-2">
                                  Deny
                                </span>
                                <span className="btn btn-primary btn-sm">
                                  Approve
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                      <div className="border-bottom mb-3 pb-3">
                        <Link to={routes.activity}>
                          <div className="d-flex">
                            <span className="avatar avatar-lg me-2 flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-25.jpg"
                                alt="Profile"
                              />
                            </span>
                            <div className="flex-grow-1">
                              <p className="mb-1">
                                New student record{" "}
                                <span className="text-dark fw-semibold">
                                  {" "}
                                  George
                                </span>{" "}
                                is created by{" "}
                                <span className="text-dark fw-semibold">
                                  Teressa
                                </span>
                              </p>
                              <span>2 hrs ago</span>
                            </div>
                          </div>
                        </Link>
                      </div>
                      <div className="border-0 mb-3 pb-0">
                        <Link to={routes.activity}>
                          <div className="d-flex">
                            <span className="avatar avatar-lg me-2 flex-shrink-0">
                              <ImageWithBasePath
                                src="assets/img/profiles/avatar-01.jpg"
                                alt="Profile"
                              />
                            </span>
                            <div className="flex-grow-1">
                              <p className="mb-1">
                                A new teacher record for{" "}
                                <span className="text-dark fw-semibold">
                                  Elisa
                                </span>
                              </p>
                              <span>09:45 AM</span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex p-0">
                    <Link to="#" className="btn btn-light w-100 me-2">
                      Cancel
                    </Link>
                    <Link to={routes.activity} className="btn btn-primary w-100">
                      View All
                    </Link>
                  </div>
                </div>
              </div>
              <div className="pe-1">
                <Link
                  to={routes.chat}
                  className="btn btn-outline-light bg-white btn-icon position-relative me-1"
                >
                  <i className="ti ti-brand-hipchat" />
                  <span className="chat-status-dot" />
                </Link>
              </div>
              <div className="pe-1">
                <Link
                  onClick={toggleFullscreen}
                  to="#"
                  className="btn btn-outline-light bg-white btn-icon me-1"
                  id="btnFullscreen"
                >
                  <i className="ti ti-maximize" />
                </Link>
              </div>
              <div className="dropdown ms-1" ref={userProfileDropdownRef}>
                <button
                  type="button"
                  className="dropdown-toggle d-flex align-items-center p-0 border-0 bg-transparent"
                  aria-expanded={userProfileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open user menu"
                  onClick={() => setUserProfileMenuOpen((o) => !o)}
                >
                  <span className="avatar avatar-md rounded">
                    <ImageWithBasePath
                      src="assets/img/profiles/avatar-27.jpg"
                      alt="Img"
                      className="img-fluid"
                    />
                  </span>
                </button>
                <div
                  className={`dropdown-menu dropdown-menu-end dropdown-menu-profile${userProfileMenuOpen ? " show" : ""}`}
                  role="menu"
                >
                  <div className="d-block">
                    <div className="d-flex align-items-center p-2">
                      <span className="avatar avatar-md me-2 online avatar-rounded">
                        <ImageWithBasePath
                          src="assets/img/profiles/avatar-27.jpg"
                          alt="img"
                        />
                      </span>
                      <div>
                        <h6>{user?.displayName || "User"}</h6>
                        <p className="text-primary mb-0">
                          {getDisplayRoleLabel(user)}
                        </p>
                      </div>
                    </div>
                    <hr className="m-0" />
                    <Link
                      className="dropdown-item d-inline-flex align-items-center p-2"
                      to={routes.profile}
                      role="menuitem"
                      onClick={() => setUserProfileMenuOpen(false)}
                    >
                      <i className="ti ti-user-circle me-2" />
                      My Profile
                    </Link>
                    {isHeadmasterRole(user) && (
                      <Link
                        className="dropdown-item d-inline-flex align-items-center p-2"
                        to={routes.securitysettings}
                        role="menuitem"
                        onClick={() => setUserProfileMenuOpen(false)}
                      >
                        <i className="ti ti-settings me-2" />
                        Settings
                      </Link>
                    )}
                    <hr className="m-0" />
                    <Link
                      className="dropdown-item d-inline-flex align-items-center p-2"
                      to="#"
                      role="menuitem"
                      onClick={(e) => { e.preventDefault(); handleLogout(); }}
                    >
                      <i className="ti ti-login me-2" />
                      Logout
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        <div className="dropdown mobile-user-menu" ref={mobileUserMenuRef}>
          <button
            type="button"
            className="nav-link dropdown-toggle border-0 bg-transparent text-body"
            aria-expanded={mobileUserMenuOpen}
            aria-haspopup="menu"
            aria-label="Open menu"
            onClick={() => setMobileUserMenuOpen((o) => !o)}
          >
            <i className="fa fa-ellipsis-v" />
          </button>
          <div
            className={`dropdown-menu dropdown-menu-end${mobileUserMenuOpen ? " show" : ""}`}
            role="menu"
          >
            <Link
              className="dropdown-item"
              to={routes.profile}
              role="menuitem"
              onClick={() => setMobileUserMenuOpen(false)}
            >
              My Profile
            </Link>
            {isHeadmasterRole(user) && (
              <Link
                className="dropdown-item"
                to={routes.securitysettings}
                role="menuitem"
                onClick={() => setMobileUserMenuOpen(false)}
              >
                Settings
              </Link>
            )}
            <Link
              className="dropdown-item"
              to="#"
              role="menuitem"
              onClick={(e) => { e.preventDefault(); handleLogout(); }}
            >
              Logout
            </Link>
          </div>
        </div>
        {/* /Mobile Menu */}
      </div>
      {/* /Header */}
    </>
  );
};

export default Header;
