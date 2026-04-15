import { useState } from 'react';
import { Outlet } from 'react-router';
import SuperAdminSettingsOffcanvas from './SuperAdminSettingsOffcanvas';

const SuperAdminLayout = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="super-admin-shell min-vh-100 d-flex flex-column bg-body text-body">
      <header className="d-flex justify-content-end align-items-center py-2 px-3 border-bottom border-secondary bg-body shadow-sm">
        <button
          type="button"
          className="btn btn-primary btn-lg px-4 fw-semibold text-white shadow-sm"
          onClick={() => setSettingsOpen(true)}
          aria-expanded={settingsOpen}
          aria-controls="superAdminSettings"
        >
          Settings
        </button>
      </header>
      <main className="flex-grow-1 p-4 bg-body-secondary">
        <Outlet />
      </main>

      <SuperAdminSettingsOffcanvas open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default SuperAdminLayout;
