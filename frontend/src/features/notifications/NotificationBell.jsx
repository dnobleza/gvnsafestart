import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@phosphor-icons/react';

import Button from '../../components/Button';
import { formatDateTime } from '../../utils/format';
import useNotificationFeed from './hooks/useNotificationFeed';

export default function NotificationBell({ api, linkFor, allPath }) {
  const { data, unread, loading, error, refetch } = useNotificationFeed(api.listNotifications);
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      try {
        await api.markNotificationRead(n.id);
      } finally {
        refetch();
      }
    }
    const to = linkFor(n);
    if (to) navigate(to);
  };

  const markAll = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    refetch();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="text-ink-100 hover:bg-surface-800 hover:text-accent-300 relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
      >
        <BellIcon size={20} aria-hidden="true" />
        {unread ? (
          <span className="bg-accent-500 text-surface-950 absolute -top-0.5 -right-0.5 min-w-5 rounded-full px-1 text-center text-[11px] leading-5 font-semibold tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="border-surface-700 bg-surface-900 absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border shadow-xl">
          <div className="border-surface-800 flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-medium">Notifications</p>
            <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread}>
              Mark all read
            </Button>
          </div>
          {loading && !data ? (
            <p className="text-ink-500 px-4 py-6 text-sm">Loading…</p>
          ) : error ? (
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <p className="text-danger-300 text-sm">Could not load notifications</p>
              <Button variant="secondary" size="sm" onClick={refetch}>
                Retry
              </Button>
            </div>
          ) : !data?.length ? (
            <p className="text-ink-500 px-4 py-6 text-sm">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="hover:bg-surface-800 flex w-full gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-accent-500'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="text-ink-100 block text-sm font-medium">{n.title}</span>
                      <span className="text-ink-400 line-clamp-2 block text-xs">{n.message}</span>
                      <span className="text-ink-500 mt-1 block text-[11px]">{formatDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-surface-800 border-t px-4 py-2 text-center">
            <Button variant="ghost" size="sm" to={allPath} onClick={() => setOpen(false)}>
              View all
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
