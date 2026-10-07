import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CircleNotchIcon } from '@phosphor-icons/react';

import { useAuthStore } from '../store/authStore';

export const CHANGE_PASSWORD_PATH = '/change-password';

export default function RequireAuth() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword);

  if (status === 'checking') {
    return (
      <main className="text-ink-400 flex min-h-[100dvh] items-center justify-center gap-3" role="status">
        <CircleNotchIcon size={20} className="animate-spin" aria-hidden="true" />
        Checking your session…
      </main>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
