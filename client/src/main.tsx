import { createRoot } from 'react-dom/client'
import { base_path } from "./environment";
import "../node_modules/bootstrap/dist/css/bootstrap.min.css";
// Single Bootstrap JS entry: registers Dropdown/Modal data-api once on `document`.
// Do not `import { X } from "bootstrap"` in app code — a second copy registers duplicate listeners and every dropdown toggles twice (open then instant close).
import "../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js";
import "../src/style/css/feather.css";
import "../src/index.scss";
import store from "./core/data/redux/store";
import { Provider } from "react-redux";
import { clearAuth } from "./core/data/redux/authSlice";
import { clearSuperAdminAuth } from "./core/data/redux/superAdminAuthSlice";
import { AuthBootstrap } from "./core/components/AuthBootstrap";
import { SuperAdminAuthBootstrap } from "./core/components/SuperAdminAuthBootstrap";
import { SuperAdminThemeSync } from "./core/components/SuperAdminThemeSync";
import "../src/style/icon/boxicons/boxicons/css/boxicons.min.css";
import "../src/style/icon/weather/weathericons.css";
import "../src/style/icon/typicons/typicons.css";
import "../src/style/icon/fontawesome/css/fontawesome.min.css";
import "../src/style/icon/fontawesome/css/all.min.css";
import "../src/style/icon/ionic/ionicons.css";
import "../src/style/icon/tabler-icons/webfont/tabler-icons.css";
import ALLRoutes from "./feature-module/router/router";
import { BrowserRouter } from 'react-router';
import React from 'react';
import ErrorBoundary from './core/components/ErrorBoundary';
import { clearCachedCsrfToken } from './core/utils/csrfClientStore.js';
import { clearTenantBearerToken } from './core/services/apiService.js';

// Fix Bootstrap 5 modal accessibility: use inert to avoid
// "Blocked aria-hidden on an element because its descendant retained focus" warning
document.addEventListener('show.bs.modal', (e: Event) => {
  const el = e.target as HTMLElement & { inert?: boolean };
  if (el && 'inert' in el) el.inert = false;
});
document.addEventListener('hide.bs.modal', (e: Event) => {
  const el = e.target as HTMLElement & { inert?: boolean };
  if (el && 'inert' in el) el.inert = true;
});

// Handle session expiry (401) - clear auth and redirect to login
window.addEventListener('auth:sessionExpired', () => {
  clearCachedCsrfToken();
  clearTenantBearerToken();
  store.dispatch(clearAuth());
  store.dispatch(clearSuperAdminAuth());
  window.location.href = `${base_path}login`;
});

// Super Admin API returned 401 — clear client state so protected routes redirect cleanly
window.addEventListener('super-admin:sessionInvalid', () => {
  clearCachedCsrfToken();
  store.dispatch(clearSuperAdminAuth());
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <BrowserRouter basename={base_path}>
          <SuperAdminThemeSync />
          <AuthBootstrap />
          <SuperAdminAuthBootstrap />
          <ALLRoutes />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
)
