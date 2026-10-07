import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import { addDaysToDate, formatDay, formatTime, toLocalDate } from '../../utils/format';
import { useSchedule } from './hooks/useInstructorResources';

const STATUS_STYLE = {
  PENDING: 'border-l-ink-400 bg-surface-800',
  CONFIRMED: 'border-l-accent-500 bg-accent-500/10',
  COMPLETED: 'border-l-surface-600 bg-surface-800',
  NO_SHOW: 'border-l-danger-500 bg-danger-500/10',
  CANCELLED: 'border-l-surface-700 bg-transparent text-ink-500 line-through',
};

const LEGEND = [
  ['PENDING', 'Pending'],
  ['CONFIRMED', 'Confirmed'],
  ['COMPLETED', 'Completed'],
  ['NO_SHOW', 'No-show'],
  ['CANCELLED', 'Cancelled'],
];

const weekday = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const mondayOf = (iso) => addDaysToDate(iso, -((weekday(iso) + 6) % 7));

function Session({ booking }) {
  return (
    <Link
      to={`/instructor/bookings/${booking.id}`}
      className={`hover:border-l-accent-300 block rounded-xl border-l-4 px-3 py-2 text-xs transition-colors ${STATUS_STYLE[booking.status]}`}
    >
      <span className="block font-medium tabular-nums">
        {formatTime(booking.scheduledAt)} – {formatTime(booking.endsAt)}
      </span>
      <span className="block truncate">{booking.client.fullName}</span>
      <span className="text-ink-500 block truncate">{booking.lessonType}</span>
    </Link>
  );
}

export default function SchedulePage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'day' ? 'day' : 'week';
  const anchor = params.get('date') || toLocalDate();
  const from = view === 'week' ? mondayOf(anchor) : anchor;
  const days = view === 'week' ? 7 : 1;
  const to = addDaysToDate(from, days - 1);
  const { data, loading, error, refetch } = useSchedule(from, to);

  const set = (changes) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => next.set(k, v));
      return next;
    });

  const columns = useMemo(() => {
    const byDay = Object.fromEntries(Array.from({ length: days }, (_, i) => [addDaysToDate(from, i), []]));
    for (const b of data || []) byDay[toLocalDate(b.scheduledAt)]?.push(b);
    return Object.entries(byDay);
  }, [data, from, days]);

  const today = toLocalDate();

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${formatDay(`${from}T12:00:00+08:00`)}${days > 1 ? ` – ${formatDay(`${to}T12:00:00+08:00`)}` : ''}`}
        actions={
          <>
            <div className="border-surface-700 flex rounded-full border p-0.5" role="group" aria-label="View">
              {['day', 'week'].map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={view === v ? 'primary' : 'ghost'}
                  aria-pressed={view === v}
                  onClick={() => set({ view: v })}
                >
                  {v === 'day' ? 'Day' : 'Week'}
                </Button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => set({ date: addDaysToDate(from, -days) })} aria-label="Previous">
              <CaretLeftIcon size={14} aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => set({ date: today })}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => set({ date: addDaysToDate(from, days) })} aria-label="Next">
              <CaretRightIcon size={14} aria-hidden="true" />
            </Button>
          </>
        }
      />

      <ul className="mb-4 flex flex-wrap gap-3 text-xs" aria-label="Status colours">
        {LEGEND.map(([status, label]) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full border-l-4 ${STATUS_STYLE[status]}`} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>

      {error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className={`grid gap-3 ${view === 'week' ? 'min-w-[56rem] grid-cols-7' : 'grid-cols-1'}`}
            aria-busy={loading}
          >
            {columns.map(([day, sessions]) => (
              <section
                key={day}
                className={`bg-surface-900 min-h-48 rounded-xl border p-3 ${day === today ? 'border-accent-600' : 'border-surface-700'}`}
              >
                <h2 className="text-ink-400 mb-2 text-xs font-medium">{formatDay(`${day}T12:00:00+08:00`)}</h2>
                {loading && !data ? (
                  <div className="bg-surface-800 h-12 animate-pulse rounded-xl" />
                ) : sessions.length ? (
                  <div className="flex flex-col gap-2">
                    {sessions.map((b) => (
                      <Session key={b.id} booking={b} />
                    ))}
                  </div>
                ) : (
                  <p className="text-ink-500 text-xs">No sessions</p>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
