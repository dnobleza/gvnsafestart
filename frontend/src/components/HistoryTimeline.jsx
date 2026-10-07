import Button from './Button';
import StatusBadge from './StatusBadge';
import { ACTION_LABEL, actorLabel, formatDateTime } from '../utils/format';

export default function HistoryTimeline({ entries, loading, error, onRetry }) {
  if (loading && !entries) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface-800 h-14 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex items-center gap-3">
        <p className="text-danger-300 text-sm">{error.message}</p>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }
  if (!entries?.length) return <p className="text-ink-500 text-sm">No history yet.</p>;

  return (
    <ol className="border-surface-700 relative ml-2 border-l">
      {entries.map((h) => (
        <li key={h.id} className="relative pb-5 pl-6 last:pb-0">
          <span className="bg-accent-500 absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ink-100 text-sm font-medium">{ACTION_LABEL[h.action] || h.action}</p>
            {h.toStatus && h.fromStatus !== h.toStatus ? <StatusBadge status={h.toStatus} /> : null}
          </div>
          <p className="text-ink-400 text-xs">
            {actorLabel(h.actor?.fullName, h.actorRole)} ·{' '}
            {formatDateTime(h.createdAt)}
          </p>
          {h.action === 'RESCHEDULED' ? (
            <p className="text-ink-400 mt-1 text-xs">
              {formatDateTime(h.oldScheduledAt)} → <span className="text-ink-100">{formatDateTime(h.newScheduledAt)}</span>
            </p>
          ) : null}
          {h.reason ? <p className="text-ink-400 mt-1 text-xs">Reason: {h.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}
