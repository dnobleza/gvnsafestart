import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { logout } from '../../../api/auth';
import { useAuthStore } from '../../../store/authStore';

// For pages behind RequireAuth. The session is cleared when the calling page
// unmounts, not in signOut: the store update renders before the router's
// navigation commits, so the guard would see an anonymous user still on the
// protected route and bounce to /login instead of home.
export default function useSignOut() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [signingOut, setSigningOut] = useState(false);
  const signedOut = useRef(false);

  useEffect(
    () => () => {
      if (signedOut.current) clearSession();
    },
    [clearSession],
  );

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // The local session is dropped either way; a failed revoke only leaves a
      // refresh token that expires on its own.
    }
    signedOut.current = true;
    navigate('/', { replace: true });
  }, [navigate]);

  return { signOut, signingOut };
}
