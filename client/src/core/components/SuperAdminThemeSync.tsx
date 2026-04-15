import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * Super Admin routes are outside <Feature />, so document theme attributes are not applied there.
 * Keeps data-theme / data-bs-theme in sync with Redux (same keys as main app theme slice).
 */
export function SuperAdminThemeSync() {
  const location = useLocation();
  const dataTheme = useSelector((state: { themeSetting?: { dataTheme?: string } }) => state.themeSetting?.dataTheme);

  useEffect(() => {
    if (!location.pathname.startsWith('/super-admin')) return;

    const themeMap: Record<string, string> = {
      default_data_theme: 'light',
      dark_data_theme: 'dark',
    };
    const mode = themeMap[dataTheme || ''] ?? 'light';
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-bs-theme', mode);
  }, [location.pathname, dataTheme]);

  return null;
}
