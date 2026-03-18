import { all_routes } from "../../../feature-module/router/all_routes";
import { SidebarData } from "./sidebarData";

const routes = all_routes;

/**
 * Role-specific dashboard labels and links for non-admin users
 */
const ROLE_DASHBOARD_MAP: Record<string, { label: string; link: string }> = {
  Admin: { label: "Headmaster Dashboard", link: routes.adminDashboard },
  Teacher: { label: "Teacher Dashboard", link: routes.teacherDashboard },
  Student: { label: "Student Dashboard", link: routes.studentDashboard },
  Parent: { label: "Parent Dashboard", link: routes.parentDashboard },
  Guardian: { label: "Guardian Dashboard", link: routes.guardianDashboard },
};

/**
 * Get sidebar data filtered by user role.
 * Admin sees full sidebar; other roles see only their dashboard + Application.
 */
export function getSidebarDataForRole(role: string | undefined | null): typeof SidebarData {
  const normalizedRole = (role || "Admin").trim();
  const roleKey = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1).toLowerCase();

  if (normalizedRole.toLowerCase() === "admin") {
    return SidebarData;
  }

  const dashboardItem = ROLE_DASHBOARD_MAP[roleKey] || ROLE_DASHBOARD_MAP.Admin;

  // For non-admin: only MAIN section with single Dashboard link + Application
  return [
    {
      label: "MAIN",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Main",
      submenuItems: [
        {
          label: dashboardItem.label,
          icon: "ti ti-layout-dashboard",
          link: dashboardItem.link,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Application",
          icon: "ti ti-layout-list",
          submenu: true,
          showSubRoute: false,
          submenuItems: [
            { label: "Chat", link: routes.chat, showSubRoute: false },
            { label: "Call", link: routes.callHistory, showSubRoute: false },
            { label: "Calendar", link: routes.calendar, showSubRoute: false },
            { label: "Email", link: routes.email, showSubRoute: false },
            { label: "To Do", link: routes.todo, showSubRoute: false },
            { label: "Notes", link: routes.notes, showSubRoute: false },
            { label: "File Manager", link: routes.fileManager, showSubRoute: false },
          ],
        },
      ],
    },
  ];
}
