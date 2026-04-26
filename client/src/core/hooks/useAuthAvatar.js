import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../data/redux/authSlice';
import { apiService } from '../services/apiService';

const DEFAULT_AVATAR_SRC = '/assets/img/profiles/avatar-27.jpg';

/**
 * Role-agnostic current user avatar resolver.
 * Always uses authenticated user's avatar when available.
 */
export const useAuthAvatar = () => {
  const user = useSelector(selectUser);
  const [avatarSrc, setAvatarSrc] = useState(DEFAULT_AVATAR_SRC);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = String(user?.avatar || '').trim();
      if (!raw) {
        if (!cancelled) setAvatarSrc(DEFAULT_AVATAR_SRC);
        return;
      }
      try {
        const resolved = await apiService.resolveAvatarUrl(raw);
        if (!cancelled) {
          setAvatarSrc(resolved || DEFAULT_AVATAR_SRC);
        }
      } catch {
        if (!cancelled) setAvatarSrc(DEFAULT_AVATAR_SRC);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.avatar]);

  return {
    avatarSrc,
    hasAvatar: !!String(user?.avatar || '').trim(),
    defaultAvatarSrc: DEFAULT_AVATAR_SRC,
  };
};

