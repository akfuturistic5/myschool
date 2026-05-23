import { Route, Routes } from "react-router";
import { authRoutes, publicRoutes } from "./router.link";
import Feature from "../feature";
import AuthFeature from "../authFeature";
import ProtectedRoute from "../../core/components/ProtectedRoute";
import SuperAdminProtectedRoute from "../../core/components/SuperAdminProtectedRoute";
import SuperAdminLayout from "../superAdmin/SuperAdminLayout";
import SuperAdminLogin from "../superAdmin/SuperAdminLogin";
import SuperAdminDashboard from "../superAdmin/SuperAdminDashboard";
import SuperAdminSchoolList from "../superAdmin/SuperAdminSchoolList";
import SuperAdminSchoolPermissions from "../superAdmin/SuperAdminSchoolPermissions";
import SuperAdminSchoolsRedirect from "../superAdmin/SuperAdminSchoolsRedirect";
import SuperAdminSchoolView from "../superAdmin/SuperAdminSchoolView";
import SuperAdminSchoolEdit from "../superAdmin/SuperAdminSchoolEdit";
import SuperAdminSchoolModules from "../superAdmin/SuperAdminSchoolModules";
import SuperAdminPlans from "../superAdmin/SuperAdminPlans";
import SuperAdminEnquiries from "../superAdmin/SuperAdminEnquiries";
import SuperAdminHelpCenter from "../superAdmin/SuperAdminHelpCenter";
import SuperAdminSupportTickets from "../superAdmin/SuperAdminSupportTickets";
import SuperAdminSupportTicketDetail from "../superAdmin/SuperAdminSupportTicketDetail";
import Login from "../auth/login/login";

const ALLRoutes: React.FC = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* Super Admin routes - completely separate from tenant dashboards */}
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route element={<SuperAdminProtectedRoute />}>
          <Route element={<SuperAdminLayout />}>
            <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/super-admin/plans" element={<SuperAdminPlans />} />
            <Route path="/super-admin/enquiries" element={<SuperAdminEnquiries />} />
            <Route path="/super-admin/help" element={<SuperAdminHelpCenter />} />
            <Route path="/super-admin/support/tickets" element={<SuperAdminSupportTickets />} />
            <Route path="/super-admin/support/tickets/:id" element={<SuperAdminSupportTicketDetail />} />
            <Route path="/super-admin/schools/list" element={<SuperAdminSchoolList />} />
            <Route path="/super-admin/schools/permissions" element={<SuperAdminSchoolPermissions />} />
            <Route path="/super-admin/schools/:id/modules" element={<SuperAdminSchoolModules />} />
            <Route path="/super-admin/schools/:id/edit" element={<SuperAdminSchoolEdit />} />
            <Route path="/super-admin/schools/:id" element={<SuperAdminSchoolView />} />
            <Route path="/super-admin/schools" element={<SuperAdminSchoolsRedirect />} />
          </Route>
        </Route>
        <Route element={<AuthFeature />}>
          {authRoutes.map((route, idx) => (
            <Route path={route.path} element={route.element} key={idx} />
          ))}
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<Feature />}>
            {publicRoutes.map((route, idx) => (
              <Route path={route.path} element={route.element} key={idx} />
            ))}
          </Route>
        </Route>
      </Routes>
    </>
  );
};

export default ALLRoutes;

