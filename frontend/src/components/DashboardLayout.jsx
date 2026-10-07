import { NavLink, Outlet } from 'react-router-dom';
import { SignOutIcon } from '@phosphor-icons/react';

import BrandMark from './BrandMark';
import Button from './Button';
import useSignOut from '../features/auth/hooks/useSignOut';
import { useAuthStore } from '../store/authStore';

const linkClass = ({ isActive }) =>
  'flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ' +
  (isActive ? 'bg-accent-500/15 text-accent-300' : 'text-ink-400 hover:bg-surface-800 hover:text-ink-100');

export default function DashboardLayout({ nav, navLabel, headerExtras }) {
  const user = useAuthStore((state) => state.user);
  const { signOut, signingOut } = useSignOut();

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-surface-800 bg-surface-950 lg:sticky lg:top-0 lg:h-[100dvh] lg:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <BrandMark height={40} />
          <div className="lg:hidden">
            <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
              <SignOutIcon size={16} aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
        <nav aria-label={navLabel} className="border-surface-800 border-b lg:border-0">
          <ul className="flex gap-1 overflow-x-auto px-4 pb-3 lg:flex-col lg:px-3">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={linkClass}>
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0">
        <header
          className={
            'border-surface-800 items-center justify-end gap-4 border-b px-4 py-2 sm:px-6 lg:flex lg:px-8 lg:py-4 ' +
            (headerExtras ? 'flex' : 'hidden')
          }
        >
          {headerExtras}
          <div className="hidden text-right lg:block">
            <p className="text-ink-100 text-sm font-medium">{user?.fullName}</p>
            <p className="text-ink-500 text-xs">{user?.email || user?.phone}</p>
          </div>
          <div className="hidden lg:block">
            <Button variant="secondary" size="sm" onClick={signOut} disabled={signingOut}>
              <SignOutIcon size={16} aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
