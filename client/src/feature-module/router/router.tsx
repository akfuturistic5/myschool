import { Route, Routes } from "react-router";
import { authRoutes, publicRoutes } from "./router.link";
import Feature from "../feature";
import AuthFeature from "../authFeature";
import ProtectedRoute from "../../core/components/ProtectedRoute";
import SuperAdminProtectedRoute from "../../core/components/SuperAdminProtectedRoute";
import SuperAdminLayout from "../superAdmin/SuperAdminLayout";
import SuperAdminLogin from "../superAdmin/SuperAdminLogin";
import SuperAdminDashboard from "../superAdmin/SuperAdminDashboard";
import SuperAdminSchoolEdit from "../superAdmin/SuperAdminSchoolEdit";
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
            <Route path="/super-admin/schools/:id" element={<SuperAdminSchoolEdit />} />
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
