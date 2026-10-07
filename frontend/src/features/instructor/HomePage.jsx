import { Link } from 'react-router-dom';

import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import StatusBadge from '../../components/StatusBadge';
import useBookingRefresh from '../../hooks/useBookingRefresh';
import { formatDateTime, formatDay, formatMoney, formatTime } from '../../utils/format';
import BookingActions from './BookingActions';
import NoShowCorrection from './NoShowCorrection';
import { useDashboard } from './hooks/useInstructorResources';

const QUICK = ['confirm', 'complete', 'noShow', 'cash'];

function Panel({ title, children, action }) {
  return (
    <section className="border-surface-700 bg-surface-900 rounded-xl border">
      <div className="border-surface-800 flex items-center justify-between gap-3 border-b px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="flex flex-col gap-2 p-5" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bg-surface-800 h-12 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

function SessionRow({ booking, onDone }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <p className="text-ink-100 w-20 shrink-0 text-sm font-medium tabular-nums">{formatTime(booking.scheduledAt)}</p>
        <div className="min-w-0">
          <Link to={`/instructor/bookings/${booking.id}`} className="text-ink-100 hover:text-accent-300 text-sm font-medium">
            {booking.client.fullName}
          </Link>
          <p className="text-ink-500 text-xs">
            {booking.lessonType}
            {booking.package ? ` · session ${booking.package.sessionNumber}/${booking.package.sessionsTotal}` : ''} ·{' '}
            {booking.durationMinutes / 60} h
            {booking.package ? ` · ${booking.package.pickupAddress}` : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BookingStatusBadge booking={booking} />
        {booking.status !== 'PENDING' ? <StatusBadge status={booking.paymentStatus} /> : null}
        <BookingActions booking={booking} onDone={onDone} only={QUICK} />
      </div>
    </li>
  );
}

function FollowUpRow({ booking, children }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <Link to={`/instructor/bookings/${booking.id}`} className="text-ink-100 hover:text-accent-300 text-sm font-medium">
          {booking.client.fullName}
        </Link>
        <p className="text-ink-500 text-xs">
          {formatDateTime(booking.scheduledAt)} · {booking.lessonType}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </li>
  );
}

function FollowUpPanel({ title, rows, loading, error, empty, render }) {
  return (
    <Panel title={title}>
      {loading ? (
        <Skeleton rows={2} />
      ) : error ? (
        <p className="text-danger-300 px-5 py-6 text-sm">Could not load this list.</p>
      ) : !rows?.length ? (
        <p className="text-ink-500 px-5 py-6 text-sm">{empty}</p>
      ) : (
        <ul className="divide-surface-800 divide-y">{rows.map(render)}</ul>
      )}
    </Panel>
  );
}

export default function HomePage() {
  const { data, loading, error, refetch } = useDashboard();
  const counts = data?.counts;
  const statLoading = loading && !data;
  useBookingRefresh(refetch);

  return (
    <>
      <PageHeader title="Today" description="Your sessions, what needs doing, and the week ahead." />

      {error ? (
        <div role="alert" className="border-danger-500/40 mb-6 flex items-center justify-between gap-3 rounded-xl border p-4">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting confirmation" value={counts?.awaitingConfirmation} loading={statLoading} error={error} />
        <StatCard label="Cash to collect today" value={counts?.cashToCollectToday} loading={statLoading} error={error} />
        <StatCard label="Sessions needing completion" value={counts?.needsCompletion} loading={statLoading} error={error} />
        <StatCard
          label="My average rating"
          value={data?.rating?.display}
          hint={data ? `${data.rating.count} rating${data.rating.count === 1 ? '' : 's'}` : null}
          loading={statLoading}
          error={error}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <FollowUpPanel
          title="Recently auto-completed"
          rows={data?.recentlyAutoCompleted}
          loading={statLoading}
          error={error}
          empty="No sessions were completed automatically in the last 24 hours."
          render={(b) => (
            <FollowUpRow key={b.id} booking={b}>
              <BookingStatusBadge booking={b} />
              <NoShowCorrection booking={b} onDone={refetch} compact />
            </FollowUpRow>
          )}
        />
        <FollowUpPanel
          title="Cash not recorded"
          rows={data?.cashNotRecorded}
          loading={statLoading}
          error={error}
          empty="All completed cash sessions are recorded."
          render={(b) => (
            <FollowUpRow key={b.id} booking={b}>
              <StatusBadge status={b.paymentStatus} />
              <BookingActions booking={b} onDone={refetch} only={['cash']} />
            </FollowUpRow>
          )}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Today's sessions">
          {statLoading ? (
            <Skeleton />
          ) : !data?.today.length ? (
            <p className="text-ink-500 px-5 py-6 text-sm">{error ? 'Could not load sessions.' : 'No sessions today.'}</p>
          ) : (
            <ul className="divide-surface-800 divide-y">
              {data.today.map((b) => (
                <SessionRow key={b.id} booking={b} onDone={refetch} />
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="My cash today">
            <div className="px-5 py-4">
              {statLoading ? (
                <div className="bg-surface-800 h-8 w-32 animate-pulse rounded-xl" />
              ) : data ? (
                <>
                  <p className="text-ink-100 text-2xl font-semibold tabular-nums">{formatMoney(data.cashToday.amount)}</p>
                  <p className="text-ink-500 text-xs">
                    {data.cashToday.count} payment{data.cashToday.count === 1 ? '' : 's'} recorded
                  </p>
                </>
              ) : (
                <p className="text-ink-500 text-sm">—</p>
              )}
            </div>
          </Panel>

          <Panel
            title="Next 7 days"
            action={
              <Button variant="ghost" size="sm" to="/instructor/schedule">
                Schedule
              </Button>
            }
          >
            {statLoading ? (
              <Skeleton rows={2} />
            ) : !data?.upcoming.length ? (
              <p className="text-ink-500 px-5 py-6 text-sm">{error ? '—' : 'Nothing booked in the next 7 days.'}</p>
            ) : (
              <ul className="divide-surface-800 divide-y">
                {data.upcoming.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`/instructor/bookings/${b.id}`}
                      className="hover:bg-surface-800 flex items-center justify-between gap-3 px-5 py-3 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="text-ink-100 block truncate text-sm">{b.client.fullName}</span>
                        <span className="text-ink-500 block text-xs">
                          {formatDay(b.scheduledAt)} · {formatTime(b.scheduledAt)}
                        </span>
                      </span>
                      <BookingStatusBadge booking={b} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
