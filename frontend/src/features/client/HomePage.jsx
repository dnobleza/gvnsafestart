import { Link } from 'react-router-dom';

import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime, formatDay, formatMoney, formatTime } from '../../utils/format';
import useBookingRefresh from '../../hooks/useBookingRefresh';
import { showToast } from '../../utils/toast';
import { useDashboard } from './hooks/useClientResources';
import PayNowButton from './PayNowButton';
import RateInstructorForm from './RateInstructorForm';

function NextSession({ booking }) {
  if (!booking) {
    return (
      <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
        <p className="text-ink-400 text-sm">You have no upcoming sessions.</p>
        <div className="mt-3">
          <Button to="/client/book">Book a lesson</Button>
        </div>
      </section>
    );
  }
  const unpaidOnline = booking.paymentMethod === 'ONLINE' && booking.paymentStatus === 'UNPAID';
  return (
    <section className="border-accent-600 bg-surface-900 rounded-xl border p-5">
      <p className="text-ink-500 text-xs tracking-wide uppercase">Next session</p>
      <p className="text-ink-100 mt-1 text-xl font-semibold">{formatDateTime(booking.scheduledAt)}</p>
      <p className="text-ink-400 text-sm">
        {booking.lessonType} · {booking.instructor?.fullName}
        {booking.instructor?.branch ? ` · ${booking.instructor.branch.name}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BookingStatusBadge booking={booking} />
        <StatusBadge status={booking.paymentStatus} />
        {unpaidOnline ? <PayNowButton bookingId={booking.id} /> : null}
        <Button variant="ghost" size="sm" to={`/client/bookings/${booking.id}`}>
          Details
        </Button>
      </div>
      {unpaidOnline && booking.paymentDueAt ? (
        <p className="text-ink-500 mt-2 text-xs">Pay by {formatTime(booking.paymentDueAt)} or the booking is released.</p>
      ) : null}
    </section>
  );
}

function List({ title, rows, empty, action }) {
  return (
    <section className="border-surface-700 bg-surface-900 rounded-xl border">
      <h2 className="border-surface-800 border-b px-5 py-3 text-sm font-semibold tracking-tight">{title}</h2>
      {rows.length ? (
        <ul className="divide-surface-800 divide-y">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <Link to={`/client/bookings/${b.id}`} className="hover:text-accent-300 min-w-0">
                <span className="text-ink-100 block text-sm">
                  {formatDay(b.scheduledAt)} · {formatTime(b.scheduledAt)}
                </span>
                <span className="text-ink-500 block truncate text-xs">
                  {b.lessonType} · {b.instructor?.fullName}
                </span>
              </Link>
              {action ? action(b) : <BookingStatusBadge booking={b} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-500 px-5 py-6 text-sm">{empty}</p>
      )}
    </section>
  );
}

function Packages({ packages }) {
  if (!packages.length) return null;
  return (
    <section className="border-surface-700 bg-surface-900 mb-6 rounded-xl border">
      <h2 className="border-surface-800 border-b px-5 py-3 text-sm font-semibold tracking-tight">My packages</h2>
      <ul className="divide-surface-800 divide-y">
        {packages.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <Link to={`/client/packages/${p.id}`} className="hover:text-accent-300 min-w-0">
              <span className="text-ink-100 block text-sm font-medium">{p.name}</span>
              <span className="text-ink-500 block text-xs">
                {p.sessionsUsed} of {p.sessionsTotal} sessions booked
                {Number(p.balance) > 0 ? ` · balance ${formatMoney(p.balance)}` : ''}
              </span>
            </Link>
            <Button size="sm" variant={p.canBookNext ? 'primary' : 'secondary'} to={`/client/packages/${p.id}`}>
              {p.canBookNext ? 'Book next session' : 'Pay'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RateCards({ bookings, onRated }) {
  if (!bookings.length) return null;
  return (
    <section aria-label="Rate your sessions" className="mb-6 grid gap-4 lg:grid-cols-2">
      {bookings.map((b) => (
        <RateInstructorForm key={b.id} booking={b} heading="Rate your session" onRated={onRated} />
      ))}
    </section>
  );
}

export default function HomePage() {
  const { data, loading, error, refetch } = useDashboard();
  const statLoading = loading && !data;
  useBookingRefresh(refetch);

  const onRated = () => {
    showToast('Thanks for rating your instructor.', { tone: 'success' });
    refetch();
  };

  return (
    <>
      <PageHeader
        title="Home"
        actions={
          <Button size="sm" to="/client/book">
            Book a lesson
          </Button>
        }
      />
      {error ? (
        <div role="alert" className="border-danger-500/40 mb-6 flex items-center justify-between gap-3 rounded-xl border p-4">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : null}
      {data ? <RateCards bookings={data.toRate} onRated={onRated} /> : null}
      {statLoading ? (
        <div className="bg-surface-900 mb-6 h-36 animate-pulse rounded-xl" aria-busy="true" />
      ) : data ? (
        <div className="mb-6">
          <NextSession booking={data.nextSession} />
        </div>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming bookings" value={data?.counts.upcoming} loading={statLoading} error={error} />
        <StatCard label="Unpaid bookings" value={data?.counts.unpaid} loading={statLoading} error={error} />
        <StatCard label="Sessions to rate" value={data?.counts.toRate} loading={statLoading} error={error} />
      </div>
      {data ? <Packages packages={data.packages || []} /> : null}
      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <List title="Upcoming" rows={data.upcoming} empty="Nothing booked yet." />
          <List
            title="Unpaid"
            rows={data.unpaid}
            empty="Everything is paid."
            action={(b) => (b.paymentMethod === 'ONLINE' ? <PayNowButton bookingId={b.id} /> : <StatusBadge status={b.paymentStatus} />)}
          />
        </div>
      ) : null}
    </>
  );
}
