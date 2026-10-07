import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { cancelPackage } from '../../api/clientPortal';
import { toApiError } from '../../api/client';
import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import ReasonDialog from '../../components/ReasonDialog';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime, formatMoney, formatTime } from '../../utils/format';
import { startPackagePayment } from './checkout';
import { useMyPackage } from './hooks/useClientResources';
import usePaymentConfirmation from './hooks/usePaymentConfirmation';
import NextSessionDialog from './NextSessionDialog';
import { TRAINING_TYPES } from './booking/trainingTypes';

const RECENT_MS = 15 * 60000;

function Row({ label, children }) {
  return (
    <div className="border-surface-800 grid grid-cols-[9rem_1fr] gap-3 border-b py-3 last:border-0">
      <dt className="text-ink-500 text-sm">{label}</dt>
      <dd className="text-ink-100 text-sm">{children}</dd>
    </div>
  );
}

const BANNER = {
  waiting: 'Confirming payment… This page updates as soon as PayMongo confirms it.',
  slow: 'We have not heard back from PayMongo yet. It can take a few minutes; refresh later or check your notifications.',
  paid: 'Payment received. Thank you!',
};

export default function PackageDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data: p, loading, error, refetch } = useMyPackage(id);
  const [dialog, setDialog] = useState(null);
  const [payError, setPayError] = useState(null);
  const [paying, setPaying] = useState(false);
  const firstPaid = useRef(null);
  if (p && firstPaid.current === null) firstPaid.current = Number(p.amountPaid);

  // Back from checkout: paid once the amount went up, or an online payment
  // landed in the last few minutes (the webhook may beat the redirect).
  const recentOnline = p?.payments.some(
    (x) => x.method === 'Online' && x.status === 'PAID' && Date.now() - new Date(x.paidAt).getTime() < RECENT_MS,
  );
  const paid = Boolean(p) && (Number(p.amountPaid) > firstPaid.current || recentOnline);
  const paymentState = usePaymentConfirmation({ active: params.get('payment') === 'return' && Boolean(p), paid, refetch });

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      await startPackagePayment(p.id);
    } catch (err) {
      setPayError(toApiError(err).message);
      setPaying(false);
    }
  };

  const done = () => {
    setDialog(null);
    refetch();
  };

  return (
    <>
      <PageHeader
        title={p ? p.name : 'Package'}
        actions={
          <Button variant="ghost" size="sm" to="/client/packages">
            All packages
          </Button>
        }
      />
      {params.get('created') ? (
        <p role="status" className="text-accent-300 mb-4 text-sm">
          Package booked. Your instructor will confirm session 1.
        </p>
      ) : null}
      {params.get('payment') === 'cancelled' ? (
        <p role="status" className="text-ink-400 mb-4 text-sm">
          Payment was not completed. You can try again below.
        </p>
      ) : null}
      {BANNER[paymentState] ? (
        <p
          role="status"
          className={`mb-4 rounded-xl border p-4 text-sm ${paymentState === 'paid' ? 'border-accent-600 text-accent-300' : 'border-surface-700 bg-surface-900'}`}
        >
          {BANNER[paymentState]}
        </p>
      ) : null}

      {loading && !p ? (
        <div className="bg-surface-900 h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.code === 'PACKAGE_NOT_FOUND' ? 'Package not found.' : error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : p ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} />
              <StatusBadge status={p.paymentStatus} />
            </div>
            <div className="mt-4" aria-label="Progress">
              <p className="text-ink-100 text-sm font-medium">
                {p.sessionsUsed} of {p.sessionsTotal} sessions booked · {p.sessionsCompleted} completed
              </p>
              <div className="bg-surface-800 mt-2 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-accent-500 h-full rounded-full"
                  style={{ width: `${(p.sessionsUsed / p.sessionsTotal) * 100}%` }}
                />
              </div>
            </div>
            <dl className="mt-3">
              <Row label="Instructor">
                {p.instructor.fullName}
                {p.instructor.branch ? <span className="text-ink-500"> · {p.instructor.branch.name}</span> : null}
              </Row>
              <Row label="Area">
                {p.serviceArea.name} · {TRAINING_TYPES.find((t) => t.value === p.trainingType)?.label}
              </Row>
              <Row label="Pickup">{p.pickupAddress}</Row>
              <Row label="Price">{formatMoney(p.price)}</Row>
              <Row label="Paid">{formatMoney(p.amountPaid)}</Row>
              <Row label="Balance">
                {formatMoney(p.balance)}
                {Number(p.balance) > 0 ? (
                  <span className="text-ink-500 block text-xs">Pay your instructor in cash and get a receipt number, or pay online.</span>
                ) : null}
              </Row>
              {p.paymentStatus === 'UNPAID' && p.paymentDueAt ? (
                <Row label="Pay by">{formatTime(p.paymentDueAt)} (reservation), or the booking is released</Row>
              ) : null}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {p.canBookNext ? (
                <Button size="sm" onClick={() => setDialog('next')}>
                  Book session {p.sessionsUsed + 1}
                </Button>
              ) : null}
              {p.canPay ? (
                <Button size="sm" variant={p.canBookNext ? 'secondary' : 'primary'} onClick={pay} disabled={paying}>
                  {paying
                    ? 'Opening checkout…'
                    : `Pay ${Number(p.amountPaid) < Number(p.reservationFee) ? 'reservation' : 'balance'} online (${formatMoney(p.amountDue)})`}
                </Button>
              ) : null}
              {p.canCancel ? (
                <Button size="sm" variant="danger" onClick={() => setDialog('cancel')}>
                  Cancel package
                </Button>
              ) : null}
            </div>
            {payError ? (
              <p role="alert" className="text-danger-300 mt-2 text-sm">
                {payError}
              </p>
            ) : null}
          </section>

          <div className="flex flex-col gap-6">
            <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
              <h2 className="mb-3 text-sm font-semibold tracking-tight">Sessions</h2>
              {p.sessions.length ? (
                <ul className="divide-surface-800 divide-y">
                  {p.sessions.map((s) => (
                    <li key={s.id}>
                      <Link to={`/client/bookings/${s.id}`} className="hover:text-accent-300 flex items-center justify-between gap-3 py-3">
                        <span>
                          <span className="text-ink-100 block text-sm">Session {s.sessionNumber}</span>
                          <span className="text-ink-500 block text-xs">{formatDateTime(s.scheduledAt)}</span>
                        </span>
                        <BookingStatusBadge booking={s} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-500 text-sm">No sessions booked.</p>
              )}
            </section>
            <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
              <h2 className="mb-3 text-sm font-semibold tracking-tight">Payments</h2>
              {p.payments.length ? (
                <ul className="divide-surface-800 divide-y">
                  {p.payments.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span>
                        <span className="text-ink-100 block">
                          {formatMoney(x.amount)} · {x.method}
                        </span>
                        <span className="text-ink-500 block text-xs">
                          {formatDateTime(x.paidAt)}
                          {x.receiptNumber ? ` · Receipt ${x.receiptNumber}` : ''}
                        </span>
                      </span>
                      <StatusBadge status={x.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-500 text-sm">No payments yet.</p>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {dialog === 'next' && p ? <NextSessionDialog pkg={p} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog === 'cancel' && p ? (
        <ReasonDialog
          title="Cancel package?"
          intro="All upcoming sessions are cancelled and your instructor is told why. Refunds of amounts already paid are handled by our office."
          submitLabel="Cancel package"
          busyLabel="Cancelling…"
          danger
          request={(reason) => cancelPackage(p.id, reason)}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
    </>
  );
}
