import { useEffect, useState, useMemo, useRef, useCallback, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../data/redux/authSlice";
import { getSidebarDataForRole } from "../../data/json/sidebarDataUtils";
import { filterSidebarBySaasModules } from "../../utils/saasSidebarFilter";
import SchoolLogoImage from "../schoolLogoImage";
import "../../../style/icon/tabler-icons/webfont/tabler-icons.css";
import { setExpandMenu } from "../../data/redux/sidebarSlice";
import { useDispatch } from "react-redux";
import {
  resetAllMode,
  setDataLayout,
} from "../../data/redux/themeSettingSlice";
import usePreviousRoute from "./usePreviousRoute";
import {
  findMenuOpenState,
  hasActiveDescendant,
  itemMatchesPath,
} from "./sidebarMenuUtils";
import { getSchoolLogoSrc, isMillatStyleLogoPath } from "../../utils/schoolLogo";
import { useSchoolLogoUpload } from "../../hooks/useSchoolLogoUpload";
import { getDashboardForRole } from "../../utils/roleUtils";
import { all_routes } from "../../../feature-module/router/all_routes";

import "../../../../node_modules/react-perfect-scrollbar/dist/css/styles.css";
import PerfectScrollbar from "react-perfect-scrollbar";
import "./sidebar-menu.scss";

const Sidebar = () => {
  const Location = useLocation();
  const user = useSelector(selectUser);
  const role = user?.role || "Admin";
  const SidebarData = useMemo(() => {
    const base = getSidebarDataForRole(role);
    return filterSidebarBySaasModules(base, user?.saas_modules ?? undefined);
  }, [role, user?.saas_modules]);

  const schoolLogoSrc = useMemo(() => getSchoolLogoSrc(user), [user?.school_logo, user?.school_name]);
  const isMillatLogo = isMillatStyleLogoPath(schoolLogoSrc);
  const {
    isHeadmaster: canChangeSchoolLogo,
  } = useSchoolLogoUpload();
  const dashboardLink = getDashboardForRole(user);

  const sidebarScrollRef = useRef<PerfectScrollbar | null>(null);
  const [subOpen, setSubopen] = useState("");
  const [subsidebar, setSubsidebar] = useState("");
  const [collapsedMenus, setCollapsedMenus] = useState<Set<string>>(new Set());
  const [collapsedSubMenus, setCollapsedSubMenus] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredSidebarData = useMemo(() => {
    if (!searchQuery.trim()) return SidebarData;

    const query = searchQuery.toLowerCase().trim();
    return SidebarData?.map((section: any) => {
      const isSectionMatch = section.label?.toLowerCase().includes(query);
      
      const filteredSubmenuItems = section.submenuItems?.filter((item: any) => {
        const itemLabelMatch = item.label?.toLowerCase().includes(query);
        
        // Search in level 2 submenu items
        const subItemsMatch = item.submenuItems?.some((sub: any) => {
          const subLabelMatch = sub.label?.toLowerCase().includes(query);
          // Search in level 3 submenu items if they exist
          const deepSubMatch = sub.submenuItems?.some((deep: any) => 
            deep.label?.toLowerCase().includes(query)
          );
          return subLabelMatch || deepSubMatch;
        });

        return itemLabelMatch || subItemsMatch;
      });

      if (isSectionMatch || (filteredSubmenuItems && filteredSubmenuItems.length > 0)) {
        return { 
          ...section, 
          submenuItems: isSectionMatch ? section.submenuItems : filteredSubmenuItems,
        };
      }
      return null;
    }).filter(Boolean);
  }, [SidebarData, searchQuery]);

  const toggleSidebar = (title: string, isExpanded: boolean) => {
    if (isExpanded) {
      setCollapsedMenus((prev) => new Set(prev).add(title));
      if (subOpen === title) {
        setSubopen("");
        localStorage.removeItem("menuOpened");
      }
      return;
    }
    setCollapsedMenus((prev) => {
      const next = new Set(prev);
      next.delete(title);
      return next;
    });
    setSubopen(title);
    localStorage.setItem("menuOpened", title);
  };

  const toggleSubsidebar = (subitem: string, isExpanded: boolean) => {
    if (isExpanded) {
      setCollapsedSubMenus((prev) => new Set(prev).add(subitem));
      if (subsidebar === subitem) {
        setSubsidebar("");
      }
      return;
    }
    setCollapsedSubMenus((prev) => {
      const next = new Set(prev);
      next.delete(subitem);
      return next;
    });
    setSubsidebar(subitem);
  };

  const handleLayoutChange = (layout: string) => {
    dispatch(setDataLayout(layout));
  };

  const handleParentMenuClick = (
    e: MouseEvent,
    title: any,
    isExpanded: boolean
  ) => {
    if (title?.submenu) {
      e.preventDefault();
      toggleSidebar(title.label, isExpanded);
    }
    if (title?.themeSetting) {
      handleLayoutChange(getLayoutClass(title?.label));
    }
  };

  const getLayoutClass = (label: any) => {
    switch (label) {
      case "Default":
        return "default_layout";
      case "Mini":
        return "mini_layout";
      case "Box":
        return "boxed_layout";
      case "Dark":
        return "dark_data_theme";
      case "RTL":
        return "rtl";
      default:
        return "";
    }
  };
  const location = useLocation();
  const dispatch = useDispatch();
  const dataLayout = useSelector((state: any) => state.themeSetting.dataLayout);
  const previousLocation = usePreviousRoute();

  useEffect(() => {
    const layoutPages = [
      "/layout-dark",
      "/layout-rtl",
      "/layout-mini",
      "/layout-box",
      "/layout-default",
    ];

    const isCurrentLayoutPage = layoutPages.some((path) =>
      location.pathname.includes(path)
    );
    const isPreviousLayoutPage =
      previousLocation &&
      layoutPages.some((path) => previousLocation.pathname.includes(path));

    if (isPreviousLayoutPage && !isCurrentLayoutPage) {
      dispatch(resetAllMode());
    }
  }, [location, previousLocation, dispatch]);

  const scrollActiveMenuIntoView = useCallback(() => {
    const run = () => {
      const menu = document.getElementById("sidebar-menu");
      const active =
        (menu?.querySelector("a.active.submenu-two") as HTMLElement | null) ||
        (menu?.querySelector("ul li ul li a.active") as HTMLElement | null) ||
        (menu?.querySelector("a.active") as HTMLElement | null);
      if (!active) return;

      const psContainer =
        (sidebarScrollRef.current as { _container?: HTMLElement } | null)?._container ??
        (document.querySelector("#sidebar .ps") as HTMLElement | null);

      if (psContainer) {
        const containerRect = psContainer.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const relativeTop =
          activeRect.top - containerRect.top + psContainer.scrollTop;
        const target =
          relativeTop - containerRect.height / 2 + activeRect.height / 2;
        psContainer.scrollTo({ top: Math.max(0, target), behavior: "auto" });
        (sidebarScrollRef.current as { _ps?: { update: () => void } } | null)?._ps?.update?.();
      } else {
        active.scrollIntoView({ block: "center", behavior: "auto" });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, []);

  useEffect(() => {
    const { subOpen: openMenu, subsidebar: openSub } = findMenuOpenState(
      SidebarData,
      Location.pathname
    );
    setSubopen(openMenu);
    setSubsidebar(openSub);
    setCollapsedMenus(new Set());
    setCollapsedSubMenus(new Set());
    if (openMenu) {
      localStorage.setItem("menuOpened", openMenu);
    } else {
      localStorage.removeItem("menuOpened");
    }

    const mainWrapper = document.querySelector(".main-wrapper");
    if (mainWrapper) {
      mainWrapper.classList.remove("slide-nav");
    }

    const submenus = document.querySelectorAll(".submenu");
    submenus.forEach((submenu) => {
      const listItems = submenu.querySelectorAll("li");
      submenu.classList.remove("active");
      listItems.forEach((item) => {
        if (item.classList.contains("active")) {
          submenu.classList.add("active");
        }
      });
    });
  }, [Location.pathname, SidebarData]);

  useEffect(() => {
    scrollActiveMenuIntoView();
  }, [Location.pathname, scrollActiveMenuIntoView]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        scrollActiveMenuIntoView();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [scrollActiveMenuIntoView]);

  const onMouseEnter = () => {
    if (dataLayout === "mini_layout") dispatch(setExpandMenu(true));
  };
  const onMouseLeave = () => {
    if (dataLayout === "mini_layout") dispatch(setExpandMenu(false));
  };
  return (
    <>
      <div
        className="sidebar"
        id="sidebar"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <PerfectScrollbar ref={sidebarScrollRef}>
          <div className="sidebar-inner slimscroll">
            <div id="sidebar-menu" className="sidebar-menu">
              <div className="sidebar-search mb-3 px-3 mt-3">
                <div className="input-group input-group-sm bg-light rounded-pill px-2">
                  <span className="input-group-text bg-transparent border-0 text-muted">
                    <i className="ti ti-search fs-14"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-0 ps-0 bg-transparent"
                    placeholder="Search menu..."
                    value={searchQuery}
                    name="sidebar-menu-search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-form-type="other"
                    data-lpignore="true"
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onChange={(e) => {
                      // Ignore autofill/programmatic writes when input is not actively focused by user.
                      if (!isSearchFocused) return;
                      setSearchQuery(e.target.value);
                    }}
                    style={{ fontSize: '13px', color: '#5b6670', boxShadow: 'none' }}
                  />
                  {searchQuery && (
                    <span 
                      className="input-group-text bg-transparent border-0 text-muted cursor-pointer"
                      onClick={() => setSearchQuery("")}
                      style={{ cursor: 'pointer' }}
                    >
                      <i className="ti ti-x fs-12"></i>
                    </span>
                  )}
                </div>
              </div>

              <ul>
                {filteredSidebarData?.map((mainLabel: any, index: number) => (
                  <li key={index}>
                    <h6 className="submenu-hdr">
                      <span>{mainLabel?.label}</span>
                    </h6>
                    <ul>
                      {mainLabel?.submenuItems?.map((title: any) => {
                        const isRouteActive = itemMatchesPath(title, Location.pathname);
                        const hasSubmenu =
                          title?.submenu === true &&
                          Array.isArray(title?.submenuItems) &&
                          title.submenuItems.length > 0;
                        const menuExpanded =
                          !collapsedMenus.has(title?.label) &&
                          (subOpen === title?.label ||
                            (isRouteActive && hasSubmenu) ||
                            Boolean(searchQuery.trim()));
                        const hasActiveChild =
                          hasSubmenu && hasActiveDescendant(title, Location.pathname);
                        const parentLinkClass = [
                          menuExpanded && hasSubmenu ? "subdrop" : "",
                          hasActiveChild ? "parent-has-active" : "",
                          isRouteActive && !hasSubmenu ? "active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <li
                            className={`submenu${menuExpanded ? " submenu-open" : ""}`}
                            key={title.label}
                          >
                            <Link
                              to={title?.submenu ? "#" : title?.link}
                              onClick={(e) =>
                                handleParentMenuClick(e, title, menuExpanded)
                              }
                              className={parentLinkClass}
                            >
                              <i className={title.icon}></i>
                              <span>{title?.label}</span>
                              {title?.version && (
                                <span className="badge badge-primary badge-xs text-white fs-10 ms-auto">
                                  {title?.version}
                                </span>
                              )}
                              <span
                                className={title?.submenu ? "menu-arrow" : ""}
                              />
                            </Link>

                            {/* Submenu Level 1 */}
                            {hasSubmenu && (
                                <ul>
                                  {title.submenuItems.map((item: any) => {
                                    const isSubActive = itemMatchesPath(
                                      item,
                                      Location.pathname
                                    );
                                    const hasNestedSubmenu =
                                      Array.isArray(item?.submenuItems) &&
                                      item.submenuItems.length > 0;
                                    const subExpanded =
                                      !collapsedSubMenus.has(item?.label) &&
                                      (subsidebar === item?.label ||
                                        (isSubActive && hasNestedSubmenu) ||
                                        Boolean(searchQuery.trim()));
                                    const hasActiveNestedChild =
                                      hasNestedSubmenu &&
                                      hasActiveDescendant(item, Location.pathname) &&
                                      !isSubActive;
                                    const subLinkClass = [
                                      subExpanded && hasNestedSubmenu ? "subdrop" : "",
                                      hasActiveNestedChild ? "parent-has-active" : "",
                                      isSubActive && !hasNestedSubmenu ? "active" : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ");

                                    return (
                                      <li
                                        key={item.label}
                                        className={
                                          hasNestedSubmenu
                                            ? `submenu submenu-two${subExpanded ? " submenu-open" : ""}`
                                            : ""
                                        }
                                      >
                                        <Link
                                          to={hasNestedSubmenu ? "#" : item?.link}
                                          className={subLinkClass}
                                          onClick={(e) => {
                                            if (hasNestedSubmenu) {
                                              e.preventDefault();
                                              toggleSubsidebar(item?.label, subExpanded);
                                            }
                                          }}
                                        >
                                          {item?.label}
                                          <span
                                            className={
                                              hasNestedSubmenu ? "menu-arrow" : ""
                                            }
                                          />
                                        </Link>

                                        {/* Submenu Level 2 */}
                                        {hasNestedSubmenu && (
                                            <ul>
                                              {item.submenuItems.map(
                                                (subItem: any) => {
                                                  const isDeepActive = itemMatchesPath(
                                                    subItem,
                                                    Location.pathname
                                                  );

                                                  return (
                                                    <li key={subItem.label}>
                                                      <Link
                                                        to={subItem?.link}
                                                        className={`submenu-two${
                                                          isDeepActive ? " active" : ""
                                                        }`}
                                                      >
                                                        {subItem?.label}
                                                      </Link>
                                                    </li>
                                                  );
                                                }
                                              )}
                                            </ul>
                                          )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PerfectScrollbar>
      </div>
    </>
  );
};

export default Sidebar;

