import { Navigate } from 'react-router-dom';
import { all_routes } from '../router/all_routes';

/** Legacy `/super-admin/schools` → canonical list route */
const SuperAdminSchoolsRedirect = () => <Navigate to={all_routes.superAdminSchoolList} replace />;

export default SuperAdminSchoolsRedirect;
