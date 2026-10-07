import { useLocation } from 'react-router-dom';

const ROLE_HOME = { ADMIN: '/admin', INSTRUCTOR: '/instructor', CLIENT: '/client' };

export const homeFor = (role) => ROLE_HOME[role] || '/';

export default function useReturnTo(role) {
  const from = useLocation().state?.from;
  return {
    from,
    returnTo: from?.pathname ? `${from.pathname}${from.search || ''}` : role ? homeFor(role) : '/client/book',
  };
}
