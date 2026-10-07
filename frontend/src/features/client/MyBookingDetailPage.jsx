import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { cancelMyBooking } from '../../api/clientPortal';
import Button from '../../components/Button';
import HistoryTimeline from '../../components/HistoryTimeline';
import PageHeader from '../../components/PageHeader';
import ReasonDialog from '../../components/ReasonDialog';
import Stars from '../../components/Stars';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime, formatMoney, formatTime } from '../../utils/format';
import ClientRescheduleDialog from './ClientRescheduleDialog';
import { useMyBooking } from './hooks/useClientResources';
import usePaymentConfirmation from './hooks/usePaymentConfirmation';
import PayNowButton from './PayNowButton';
import RateInstructorForm from './RateInstructorForm';

// Same wording as the API's errors, shown before the client even tries.
const RATING_NOTE = {
  NOT_YET: 'You can rate after your session is completed.',
  RATED: 'You already rated this session.',
  EXPIRED: 'The rating period has ended.',
};

const PAYMENT_LABEL = { ONLINE: 'Online (PayMongo)', CASH: 'Cash to instructor' };

function Row({ label, children }) {
  return (
    <div className="border-surface-800 grid grid-cols-[8rem_1fr] gap-3 border-b py-3 last:border-0">
      <dt className="text-ink-500 text-sm">{label}</dt>
      <dd className="text-ink-100 text-sm">{children}</dd>
    </div>
  );
}

function PaymentBanner({ state }) {
  if (state === 'waiting') {
    return (
      <p role="status" className="border-surface-700 bg-surface-900 mb-4 rounded-xl border p-4 text-sm">
        Confirming payment… This page updates as soon as PayMongo confirms it.
      </p>
    );
  }
  if (state === 'slow') {
    return (
      <p role="status" className="border-surface-700 bg-surface-900 mb-4 rounded-xl border p-4 text-sm">
        We have not heard back from PayMongo yet. It can take a few minutes; refresh later or check your notifications.
      </p>
    );
  }
  if (state === 'paid') {
    return (
      <p role="status" className="border-accent-600 text-accent-300 mb-4 rounded-xl border p-4 text-sm">
        Payment received. Thank you!
      </p>
    );
  }
  return null;
}

export default function MyBookingDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data: b, loading, error, refetch } = useMyBooking(id);
  const [dialog, setDialog] = useState(null);
  const [thanks, setThanks] = useState(false);
  const returned = params.get('payment') === 'return';
  const paymentState = usePaymentConfirmation({ active: returned && Boolean(b), paid: b?.paymentStatus === 'PAID', refetch });

  const done = () => {
    setDialog(null);
    refetch();
  };

  return (
    <>
      <PageHeader
        title="Booking"
        actions={
          <Button variant="ghost" size="sm" to="/client/bookings">
            All bookings
          </Button>
        }
      />
      {params.get('created') ? (
        <p role="status" className="text-accent-300 mb-4 text-sm">
          Booking requested. Your instructor will confirm it.
        </p>
      ) : null}
      {params.get('payment') === 'cancelled' ? (
        <p role="status" className="text-ink-400 mb-4 text-sm">
          Payment was not completed. You can try again with Pay now.
        </p>
      ) : null}
      <PaymentBanner state={paymentState} />

      {loading && !b ? (
        <div className="bg-surface-900 h-48 animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">
            {error.code === 'BOOKING_NOT_FOUND' ? 'This booking was not found.' : error.message}
          </p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : b ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-6">
            <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={b.status} />
                <StatusBadge status={b.paymentStatus} />
              </div>
              <p className="text-ink-100 mt-4 text-lg font-semibold">{formatDateTime(b.scheduledAt)}</p>
              <dl className="mt-2">
                <Row label="Lesson">
                  {b.lessonType} · {b.durationMinutes} min
                </Row>
                <Row label="Instructor">
                  {b.instructor?.fullName || 'To be assigned'}
                  {b.instructor?.branch ? <span className="text-ink-500"> · {b.instructor.branch.name}</span> : null}
                </Row>
                {b.package ? (
                  <Row label="Package">
                    <Link to={`/client/packages/${b.package.id}`} className="text-accent-300 hover:text-accent-200">
                      {b.package.name}
                    </Link>
                    {' '}· session {b.package.sessionNumber} of {b.package.sessionsTotal}
                    <span className="text-ink-500 block text-xs">Pickup: {b.package.pickupAddress}</span>
                  </Row>
                ) : null}
                <Row label="Payment">
                  {b.package ? (
                    <>
                      Balance {formatMoney(b.package.balance)} of {formatMoney(b.package.price)}
                      {Number(b.package.balance) > 0 ? (
                        <Link to={`/client/packages/${b.package.id}`} className="text-accent-300 hover:text-accent-200 block text-xs">
                          Pay from the package page
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    PAYMENT_LABEL[b.paymentMethod]
                  )}
                  {b.price ? <span className="text-ink-500"> · {formatMoney(b.price)}</span> : null}
                  {b.paymentStatus === 'UNPAID' && b.paymentDueAt ? (
                    <span className="text-ink-500 block text-xs">Pay by {formatTime(b.paymentDueAt)} or the booking is released.</span>
                  ) : null}
                  {b.paymentStatus === 'AWAITING_CASH' ? (
                    <span className="text-ink-500 block text-xs">Pay your instructor in person and get a receipt number.</span>
                  ) : null}
                </Row>
                {b.receiptNumber ? <Row label="Receipt no.">{b.receiptNumber}</Row> : null}
                {b.statusNote?.reason ? (
                  <Row label={b.statusNote.action === 'RESCHEDULED' ? 'Reschedule reason' : 'Cancel reason'}>
                    {b.statusNote.reason}
                  </Row>
                ) : null}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {b.canPay ? (
                  <PayNowButton bookingId={b.id} label={b.paymentMethod === 'CASH' ? 'Pay online instead' : 'Pay now'} />
                ) : null}
                {b.canReschedule && b.instructor ? (
                  <Button size="sm" variant="secondary" onClick={() => setDialog('reschedule')}>
                    Reschedule
                  </Button>
                ) : null}
                {b.canCancel ? (
                  <Button size="sm" variant="danger" onClick={() => setDialog('cancel')}>
                    Cancel booking
                  </Button>
                ) : null}
              </div>
              {['PENDING', 'CONFIRMED'].includes(b.status) && !b.canCancel ? (
                <p className="text-ink-500 mt-3 text-xs">
                  Changes close {b.changeCutoffHours} hours before the session. Contact the office if you need help.
                </p>
              ) : null}
            </section>

            {b.ratingState === 'OPEN' ? (
              <RateInstructorForm
                booking={b}
                onRated={() => {
                  setThanks(true);
                  refetch();
                }}
              />
            ) : RATING_NOTE[b.ratingState] ? (
              <section className="border-surface-700 bg-surface-900 rounded-xl border p-5" aria-label="Rate your instructor">
                <h2 className="text-sm font-semibold tracking-tight">Rate your instructor</h2>
                {thanks ? (
                  <p role="status" className="text-accent-300 mt-1 text-sm">
                    Thanks for rating your instructor.
                  </p>
                ) : null}
                <p className="text-ink-400 mt-1 flex flex-wrap items-center gap-2 text-sm">
                  {RATING_NOTE[b.ratingState]}
                  {b.ratingState === 'RATED' && b.rating ? <Stars value={b.rating.stars} /> : null}
                </p>
              </section>
            ) : null}
          </div>

          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-tight">History</h2>
            <HistoryTimeline entries={b.history} />
          </section>
        </div>
      ) : null}

      {dialog === 'reschedule' && b ? (
        <ClientRescheduleDialog booking={b} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
      {dialog === 'cancel' && b ? (
        <ReasonDialog
          title="Cancel booking?"
          intro={`${b.lessonType} on ${formatDateTime(b.scheduledAt)}. Your instructor is told the reason.`}
          submitLabel="Cancel booking"
          busyLabel="Cancelling…"
          danger
          request={(reason) => cancelMyBooking(b.id, reason)}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
    </>
  );
}
