import { useNavigate } from 'react-router-dom';

import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import useAction from '../../hooks/useAction';
import useListParams, { PAGE_SIZE } from '../../hooks/useListParams';
import useResource from '../../hooks/useResource';
import { formatDateTime } from '../../utils/format';

const FILTER_KEYS = ['unread'];

export default function NotificationsPage({ api, linkFor }) {
  const { filters, page, setFilter, setPage } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useResource(api.listNotifications, {
    page,
    limit: PAGE_SIZE,
    unread: filters.unread || undefined,
  });
  const markAll = useAction(api.markAllNotificationsRead);
  const navigate = useNavigate();

  const open = async (n) => {
    if (!n.isRead) await api.markNotificationRead(n.id).catch(() => {});
    const to = linkFor(n);
    if (to) navigate(to);
    else refetch();
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description={meta ? `${meta.unread} unread` : 'Booking updates, payments and ratings.'}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilter('unread', filters.unread ? '' : 'true')}
              aria-pressed={Boolean(filters.unread)}
            >
              {filters.unread ? 'Show all' : 'Unread only'}
            </Button>
            <Button
              size="sm"
              disabled={!meta?.unread || markAll.loading}
              onClick={async () => (await markAll.run()).ok && refetch()}
            >
              Mark all read
            </Button>
          </>
        }
      />
      {markAll.error ? <p className="text-danger-300 mb-3 text-sm">{markAll.error.message}</p> : null}
      <div className="border-surface-700 bg-surface-900 rounded-xl border">
        {loading && !data ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-800 h-14 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex items-center justify-between gap-3 p-6">
            <p className="text-danger-300 text-sm">{error.message}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        ) : !data?.length ? (
          <p className="text-ink-500 p-6 text-sm">{filters.unread ? 'No unread notifications.' : 'No notifications yet.'}</p>
        ) : (
          <ul className="divide-surface-800 divide-y">
            {data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="hover:bg-surface-800 flex w-full gap-3 px-5 py-4 text-left transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-accent-500'}`}
                    aria-label={n.isRead ? undefined : 'Unread'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-100 block text-sm font-medium">{n.title}</span>
                    <span className="text-ink-400 block text-sm">{n.message}</span>
                  </span>
                  <span className="text-ink-500 shrink-0 text-xs">{formatDateTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
