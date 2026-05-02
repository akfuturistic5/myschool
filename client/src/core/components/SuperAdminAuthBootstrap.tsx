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
 * Calls /super-admin/api/auth/session (always 200) and sets Redux when authenticated.
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
        const res = await superAdminApiService.getSession();
        if (cancelled) return;
        const payload = res.data as {
          authenticated?: boolean;
          user?: { id: number; username: string; email: string; role?: string };
        };
        if (
          res.status === 'SUCCESS' &&
          payload?.authenticated === true &&
          payload.user
        ) {
          const u = payload.user;
          await superAdminApiService.ensureCsrfToken();
          if (cancelled) return;
          dispatch(
            setSuperAdminAuthFromSession({
              user: {
                id: u.id,
                username: u.username,
                email: u.email,
                role: u.role || 'super_admin',
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


