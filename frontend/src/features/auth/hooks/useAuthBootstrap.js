import { useEffect } from 'react';

import { refresh } from '../../../api/auth';
import { useAuthStore } from '../../../store/authStore';

let bootstrap = null;

// Runs once per page load. StrictMode mounts effects twice, and sending the same
// refresh cookie twice reads as token replay to the API, which revokes every
// session for the user.
export default function useAuthBootstrap() {
  useEffect(() => {
    if (useAuthStore.getState().status !== 'checking') return;
    if (!bootstrap) {
      bootstrap = refresh()
        .then((session) => useAuthStore.getState().setSession(session))
        .catch(() => useAuthStore.getState().clearSession());
    }
  }, []);
}

export function resetAuthBootstrap() {
  bootstrap = null;
}
