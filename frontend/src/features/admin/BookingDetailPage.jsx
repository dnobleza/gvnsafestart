import { useParams } from 'react-router-dom';

import Button from '../../components/Button';
import HistoryTimeline from '../../components/HistoryTimeline';
import PageHeader from '../../components/PageHeader';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import StatusBadge from '../../components/StatusBadge';
import { describeAction, formatDateTime, formatMoney } from '../../utils/format';
import { useBooking, useBookingHistory } from './hooks/useAdminResources';

function Row({ label, children }) {
  return (
    <div className="border-surface-800 grid grid-cols-[8rem_1fr] gap-3 border-b py-3 last:border-0">
      <dt className="text-ink-500 text-sm">{label}</dt>
      <dd className="text-ink-100 text-sm">{children}</dd>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const booking = useBooking(id);
  const history = useBookingHistory(id);
  const b = booking.data;

  return (
    <>
      <PageHeader
        title="Booking"
        description={b ? `${b.client.fullName} · ${formatDateTime(b.scheduledAt)}` : null}
        actions={
          <Button variant="ghost" size="sm" to="/admin/bookings">
            All bookings
          </Button>
        }
      />
      {booking.loading && !b ? (
        <div className="bg-surface-900 h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : booking.error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">
            {booking.error.code === 'BOOKING_NOT_FOUND' ? 'This booking was not found.' : booking.error.message}
          </p>
          <Button variant="secondary" size="sm" onClick={booking.refetch}>
            Retry
          </Button>
        </div>
      ) : b ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <BookingStatusBadge booking={b} />
              <StatusBadge status={b.paymentStatus} />
            </div>
            {b.lastAction ? <p className="text-ink-500 mb-3 text-xs">{describeAction(b.lastAction)}</p> : null}
            <dl>
              <Row label="Client">
                {b.client.fullName}
                <span className="text-ink-500 block text-xs">{b.client.email || b.client.phone}</span>
              </Row>
              <Row label="Instructor">
                {b.instructor ? (
                  <>
                    {b.instructor.fullName}
                    {b.instructor.branch ? <span className="text-ink-500"> · {b.instructor.branch.name}</span> : null}
                  </>
                ) : (
                  <span className="text-ink-500">Not assigned</span>
                )}
              </Row>
              <Row label="When">
                {formatDateTime(b.scheduledAt)} · {b.durationMinutes} min
              </Row>
              <Row label="Lesson">{b.lessonType}</Row>
              {b.cancelReason ? <Row label="Cancel reason">{b.cancelReason}</Row> : null}
              <Row label="Payments">
                {b.payments.length
                  ? b.payments.map((p) => (
                      <span key={p.id} className="block">
                        {formatMoney(p.amount, p.currency)} · {p.method || 'Payment'} · {p.status.toLowerCase()}
                      </span>
                    ))
                  : 'None'}
              </Row>
            </dl>
          </section>
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-tight">History</h2>
            <HistoryTimeline entries={history.data} loading={history.loading} error={history.error} onRetry={history.refetch} />
          </section>
        </div>
      ) : null}
    </>
  );
}
