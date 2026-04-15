import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { apiService, clearTenantBearerToken } from '../services/apiService';
import { setAuthFromSession, setAuthChecked, clearAuth } from '../data/redux/authSlice';

/** Paths where we skip /auth/me (avoids 401 loop and logout spam on login page) */
const SKIP_GET_ME_PATHS = ['/login', '/register', '/forgot-password'];

/**
 * Runs on app load to hydrate auth state from HTTP-only cookie.
 * Calls /auth/me with credentials:include; if valid session exists, sets user in Redux.
 * Skips getMe on login/register (and `/` — root is the main Login route) to prevent
 * 401 → global session handler → full-page redirect blink while on the sign-in screen.
 */
export const AuthBootstrap = () => {
  const dispatch = useDispatch();
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    const skipGetMe =
      pathname === '/' ||
      SKIP_GET_ME_PATHS.some((p) => pathname.startsWith(p) || pathname === p) ||
      pathname.startsWith('/super-admin');

    const bootstrap = async () => {
      if (skipGetMe) {
        if (!cancelled) dispatch(setAuthChecked());
        return;
      }
      try {
        const res = await apiService.getMe();
        if (cancelled) return;
        if (res.status === 'SUCCESS' && res.data) {
          const d = res.data;
          const displayName =
            d.display_name ||
            [d.student_first_name, d.student_last_name].filter(Boolean).join(' ') ||
            [d.staff_first_name, d.staff_last_name].filter(Boolean).join(' ') ||
            [d.first_name, d.last_name].filter(Boolean).join(' ') ||
            d.username ||
            'User';
          const role = d.role_name || d.display_role || 'User';
          dispatch(
            setAuthFromSession({
              user: {
                id: d.id,
                username: d.username,
                displayName,
                role,
                user_role_id: d.role_id,
                staff_id: d.staff_id,
                accountDisabled: d.account_disabled === true,
                school_name: d.school_name,
                school_type: d.school_type,
                school_logo: d.school_logo ?? null,
                institute_number: d.institute_number,
              },
            })
          );
          await apiService.ensureCsrfToken();
        } else {
          dispatch(setAuthChecked());
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = String((err instanceof Error && err.message) || err || '');
          if (msg.includes('401')) {
            clearTenantBearerToken();
            dispatch(clearAuth());
          }
          dispatch(setAuthChecked());
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [dispatch, pathname]);

  return null;
};
