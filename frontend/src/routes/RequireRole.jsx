import { Outlet } from 'react-router-dom';

import { useAuthStore } from '../store/authStore';
import NotAuthorizedPage from '../pages/NotAuthorizedPage';

// UX only: the API enforces the same role on every /admin endpoint, so hiding
// the pages here is not what keeps the data safe.
export default function RequireRole({ roles }) {
  const role = useAuthStore((state) => state.user?.role);

  if (!roles.includes(role)) return <NotAuthorizedPage />;

  return <Outlet />;
}
