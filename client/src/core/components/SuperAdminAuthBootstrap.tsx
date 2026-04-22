import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { superAdminApiService } from '../services/superAdminApiService';
import {
  setSuperAdminAuthFromSession,
  clearSuperAdminAuth,
} from '../data/redux/superAdminAuthSlice';

/**
 * Hydrates Super Admin auth state from HTTP-only cookie when on /super-admin routes.
 * Calls /super-admin/api/me and sets Redux on success.
 * On failure or when leaving /super-admin, clears client state so UI never shows
 * "authenticated" without a valid session (avoids dashboard API calls with no cookie).
 */
export const SuperAdminAuthBootstrap = () => {
  const dispatch = useDispatch();
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    const isSuperAdminPath = pathname.startsWith('/super-admin');

    const bootstrap = async () => {
      if (!isSuperAdminPath) {
        if (!cancelled) dispatch(clearSuperAdminAuth());
        return;
      }
      try {
        const res = await superAdminApiService.getProfile();
        if (cancelled) return;
        if (res.status === 'SUCCESS' && res.data) {
          const d = res.data;
          await superAdminApiService.ensureCsrfToken();
          if (cancelled) return;
          dispatch(
            setSuperAdminAuthFromSession({
              user: {
                id: d.id,
                username: d.username,
                email: d.email,
                role: d.role || 'super_admin',
              },
            })
          );
        } else {
          dispatch(clearSuperAdminAuth());
        }
      } catch {
        if (!cancelled) dispatch(clearSuperAdminAuth());
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [dispatch, pathname]);

  return null;
};


