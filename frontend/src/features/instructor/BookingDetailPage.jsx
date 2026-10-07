import { useParams } from 'react-router-dom';

import Button from '../../components/Button';
import HistoryTimeline from '../../components/HistoryTimeline';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime, formatMoney } from '../../utils/format';
import BookingActions from './BookingActions';
import { useBookingHistory, useMyBooking } from './hooks/useInstructorResources';

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
  const booking = useMyBooking(id);
  const history = useBookingHistory(id);
  const b = booking.data;

  const refresh = () => {
    booking.refetch();
    history.refetch();
  };

  return (
    <>
      <PageHeader
        title="Booking"
        description={b ? `${b.client.fullName} · ${formatDateTime(b.scheduledAt)}` : null}
        actions={
          <Button variant="ghost" size="sm" to="/instructor/bookings">
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
          {booking.error.code !== 'BOOKING_NOT_FOUND' ? (
            <Button variant="secondary" size="sm" onClick={booking.refetch}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : b ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <StatusBadge status={b.status} />
                <StatusBadge status={b.paymentStatus} />
              </div>
              <BookingActions booking={b} onDone={refresh} />
            </div>
            <dl>
              <Row label="Client">
                {b.client.fullName}
                {b.client.phone ? <span className="text-ink-500"> · {b.client.phone}</span> : null}
              </Row>
              <Row label="When">
                {formatDateTime(b.scheduledAt)} · {b.durationMinutes} min
              </Row>
              <Row label="Lesson">{b.lessonType}</Row>
              {b.package ? (
                <>
                  <Row label="Package">
                    Session {b.package.sessionNumber} of {b.package.sessionsTotal} ·{' '}
                    {b.package.trainingType === 'CAR_RENTAL' ? 'Car rental (bring the training car)' : "Client's own car"}
                  </Row>
                  <Row label="Pickup">
                    {b.package.pickupAddress}
                    <span className="text-ink-500 block text-xs">{b.package.serviceArea?.name}</span>
                  </Row>
                  <Row label="Package balance">
                    {formatMoney(b.package.balance)} of {formatMoney(b.package.price)}
                  </Row>
                </>
              ) : null}
              {b.area ? <Row label="Area">{b.area}</Row> : null}
              {b.notes ? <Row label="Client notes">{b.notes}</Row> : null}
              {b.cancelReason ? <Row label="Cancel reason">{b.cancelReason}</Row> : null}
              <Row label="Payment">
                {b.payments.length
                  ? b.payments.map((p) => (
                      <span key={p.id} className="block">
                        {formatMoney(p.amount, p.currency)} · {p.method || 'Payment'} · {p.status.toLowerCase()}
                      </span>
                    ))
                  : 'Not paid yet'}
                {b.receiptNumber ? <span className="text-ink-500 block text-xs">Receipt {b.receiptNumber}</span> : null}
              </Row>
            </dl>
          </section>
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-tight">History</h2>
            <HistoryTimeline
              entries={history.data}
              loading={history.loading}
              error={history.error}
              onRetry={history.refetch}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
