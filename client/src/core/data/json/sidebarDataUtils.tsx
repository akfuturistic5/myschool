import { all_routes } from "../../../feature-module/router/all_routes";
import { SidebarData } from "./sidebarData";
import { isAdministrativeRole, isHeadmasterRole } from "../../utils/roleUtils";

const routes = all_routes;

/**
 * Role-specific dashboard labels and links for non-admin users
 */
const ROLE_DASHBOARD_MAP: Record<string, { label: string; link: string }> = {
  Admin: { label: "Headmaster Dashboard", link: routes.adminDashboard },
  Administrative: { label: "Administrative Dashboard", link: routes.administrativeDashboard },
  Teacher: { label: "Teacher Dashboard", link: routes.teacherDashboard },
  Student: { label: "Student Dashboard", link: routes.studentDashboard },
  Parent: { label: "Parent Dashboard", link: routes.parentDashboard },
  Guardian: { label: "Guardian Dashboard", link: routes.guardianDashboard },
};

const ADMINISTRATIVE_VISIBLE_SECTIONS = new Set([
  "MAIN",
  "Peoples",
  "Academic",
  "MANAGEMENT",
  "HRM",
  "Finance & Accounts",
  "Announcements",
  "Reports",
  "Pages",
  "Help",
]);

function buildTeacherSidebar() {
  return [
    {
      label: "MAIN",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Main",
      submenuItems: [
        {
          label: "Teacher Dashboard",
          icon: "ti ti-layout-dashboard",
          link: routes.teacherDashboard,
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
    {
      label: "Peoples",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Peoples",
      submenuItems: [
        {
          label: "Students",
          icon: "ti ti-school",
          submenu: true,
          showSubRoute: false,
          submenuItems: [
            { label: "All Students", link: routes.studentGrid },
            { label: "Students List", link: routes.studentList },
            { label: "Students Details", link: routes.studentList },
            { label: "Bonafide", link: routes.bonafideGenerator },
          ],
        },
        {
          label: "Parents",
          icon: "ti ti-user-bolt",
          submenu: true,
          showSubRoute: false,
          submenuItems: [
            { label: "All Parents", link: routes.parentGrid },
            { label: "Parents List", link: routes.parentList },
          ],
        },
      ],
    },
    {
      label: "Academic",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Academic",
      submenuItems: [
        {
          label: "Classes",
          icon: "ti ti-school-bell",
          submenu: true,
          showSubRoute: false,
          submenuItems: [
            { label: "Schedule", link: routes.teachersRoutine },
          ],
        },
      ],
    },
    {
      label: "Announcements",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Announcements",
      submenuItems: [
        {
          label: "Events",
          link: routes.events,
          icon: "ti ti-speakerphone",
          showSubRoute: false,
          submenu: false,
        },
        {
          label: "Notice Board",
          link: routes.noticeBoard,
          icon: "ti ti-note",
          showSubRoute: false,
          submenu: false,
        },
      ],
    },
    {
      label: "Reports",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Reports",
      submenuItems: [
        {
          label: "Attendance Report",
          link: routes.attendanceReport,
          icon: "ti ti-chart-bar",
          showSubRoute: false,
          submenu: false,
        },
        {
          label: "Student Attendance",
          link: routes.studentAttendanceType,
          icon: "ti ti-report-analytics",
          showSubRoute: false,
          submenu: false,
        },
        {
          label: "Grade Report",
          link: routes.gradeReport,
          icon: "ti ti-school",
          showSubRoute: false,
          submenu: false,
        },
        {
          label: "Student Report",
          link: routes.studentReport,
          icon: "ti ti-file-description",
          showSubRoute: false,
          submenu: false,
        },
      ],
    },
    {
      label: "Pages",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Pages",
      submenuItems: [
        {
          label: "Profile",
          icon: "ti ti-user-circle",
          link: routes.profile,
          submenu: false,
          showSubRoute: false,
        },
      ],
    },
  ];
}

function buildStudentSidebar() {
  return [
    {
      label: "MAIN",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Main",
      submenuItems: [
        {
          label: "Student Dashboard",
          icon: "ti ti-layout-dashboard",
          link: routes.studentDashboard,
          submenu: false,
          showSubRoute: false,
        },
      ],
    },
    {
      label: "Academic",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Academic",
      submenuItems: [
        {
          label: "My Profile",
          icon: "ti ti-user-circle",
          link: routes.studentDetail,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Time Table",
          icon: "ti ti-table",
          link: routes.studentTimeTable,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Leave & Attendance",
          icon: "ti ti-calendar-share",
          link: routes.studentLeaves,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Fees",
          icon: "ti ti-report-money",
          link: routes.studentFees,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Exam & Results",
          icon: "ti ti-bookmark-edit",
          link: routes.studentResult,
          submenu: false,
          showSubRoute: false,
        },
      ],
    },
    {
      label: "Announcements",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Announcements",
      submenuItems: [
        {
          label: "Notice Board",
          link: routes.noticeBoard,
          icon: "ti ti-note",
          showSubRoute: false,
          submenu: false,
        },
        {
          label: "Events",
          link: routes.events,
          icon: "ti ti-speakerphone",
          showSubRoute: false,
          submenu: false,
        },
      ],
    },
    {
      label: "Pages",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Pages",
      submenuItems: [
        {
          label: "Profile",
          icon: "ti ti-user",
          link: routes.profile,
          submenu: false,
          showSubRoute: false,
        },
      ],
    },
  ];
}

function buildParentSidebar() {
  return [
    {
      label: "MAIN",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Main",
      submenuItems: [
        {
          label: "Parent Dashboard",
          icon: "ti ti-layout-dashboard",
          link: routes.parentDashboard,
          submenu: false,
          showSubRoute: false,
        },
      ],
    },
    {
      label: "Academic",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Academic",
      submenuItems: [
        {
          label: "Child Profile",
          icon: "ti ti-user-circle",
          link: routes.studentDetail,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Time Table",
          icon: "ti ti-table",
          link: routes.studentTimeTable,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Leave & Attendance",
          icon: "ti ti-calendar-share",
          link: routes.studentLeaves,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Fees",
          icon: "ti ti-report-money",
          link: routes.studentFees,
          submenu: false,
          showSubRoute: false,
        },
        {
          label: "Exam & Results",
          icon: "ti ti-bookmark-edit",
          link: routes.studentResult,
          submenu: false,
          showSubRoute: false,
        },
      ],
    },
    {
      label: "Announcements",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Announcements",
      submenuItems: [
        {
          label: "Notice Board",
          link: routes.noticeBoard,
          icon: "ti ti-note",
          showSubRoute: false,
          submenu: false,
        },
        {
          label: "Events",
          link: routes.events,
          icon: "ti ti-speakerphone",
          showSubRoute: false,
          submenu: false,
        },
      ],
    },
    {
      label: "Pages",
      submenuOpen: true,
      showSubRoute: false,
      submenuHdr: "Pages",
      submenuItems: [
        {
          label: "Profile",
          icon: "ti ti-user",
          link: routes.profile,
          submenu: false,
          showSubRoute: false,
        },
      ],
    },
  ];
}

function buildAdministrativeSidebar() {
  return SidebarData
    .filter((section) => ADMINISTRATIVE_VISIBLE_SECTIONS.has(section.label))
    .map((section) => {
      const nextSection = {
        ...section,
        submenuItems: [...(section.submenuItems || [])],
      };

      if (section.label === "MAIN") {
        nextSection.submenuItems = nextSection.submenuItems.map((item) => {
          if (item.label !== "Dashboard") return item;
          return {
            ...item,
            label: "Administrative Dashboard",
            link: routes.administrativeDashboard,
          };
        });
      }

      if (section.label === "HRM") {
        nextSection.submenuItems = nextSection.submenuItems.map((item) => {
          if (item.label !== "Leaves" || !item.submenuItems) return item;
          return {
            ...item,
            submenuItems: item.submenuItems.filter((sub) => sub.label !== "Approve Request"),
          };
        });
      }

      if (section.label === "Pages") {
        nextSection.submenuItems = nextSection.submenuItems.filter((item) => item.label === "Profile");
      }

      return nextSection;
    });
}

/**
 * Get sidebar data filtered by user role.
 * Admin sees full sidebar; other roles see only their dashboard + Application.
 */
export function getSidebarDataForRole(role: string | undefined | null): typeof SidebarData {
  const normalizedRole = (role || "Admin").trim();
  const roleKey = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1).toLowerCase();

  if (isHeadmasterRole(role)) {
    return SidebarData;
  }

  if (isAdministrativeRole(role)) {
    return buildAdministrativeSidebar();
  }

  if (roleKey === "Teacher") {
    return buildTeacherSidebar();
  }

  if (roleKey === "Student") {
    return buildStudentSidebar();
  }

  if (roleKey === "Parent") {
    return buildParentSidebar();
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
