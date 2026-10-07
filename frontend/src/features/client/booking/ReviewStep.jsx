import { useNavigate } from 'react-router-dom';

import { purchasePackage } from '../../../api/clientPortal';
import Button from '../../../components/Button';
import FormAlert from '../../../components/FormAlert';
import SubmitButton from '../../../components/SubmitButton';
import useAction from '../../../hooks/useAction';
import { formatDateTime, formatMoney } from '../../../utils/format';
import { goToCheckout } from '../checkout';
import { TRAINING_TYPES } from './trainingTypes';

const SLOT_GONE = ['SLOT_TAKEN', 'OUTSIDE_AVAILABILITY', 'INSTRUCTOR_DAY_OFF'];

function Row({ label, children }) {
  return (
    <div className="border-surface-800 grid grid-cols-[9rem_1fr] gap-3 border-b py-3 last:border-0">
      <dt className="text-ink-500 text-sm">{label}</dt>
      <dd className="text-ink-100 text-sm">{children}</dd>
    </div>
  );
}

export default function ReviewStep({ booking, onBack, onSlotLost }) {
  const navigate = useNavigate();
  const { run, loading, error } = useAction(purchasePackage);
  const online = booking.paymentMethod === 'ONLINE';
  const p = booking.packageDef;

  const confirm = async () => {
    const result = await run({
      packageId: p.id,
      serviceAreaId: booking.serviceArea.id,
      trainingType: booking.trainingType,
      instructorId: booking.instructor.id,
      scheduledAt: booking.slot.start,
      pickupAddress: booking.pickupAddress.trim(),
      paymentMethod: booking.paymentMethod,
    });
    if (!result.ok) {
      if (SLOT_GONE.includes(result.error.code)) onSlotLost(result.error.message);
      return;
    }
    const { package: created, checkoutUrl } = result.data;
    if (online && checkoutUrl) {
      goToCheckout(checkoutUrl);
      return;
    }
    navigate(`/client/packages/${created.id}?created=1`);
  };

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold tracking-tight">Review and confirm</h2>
      <FormAlert>{error && !SLOT_GONE.includes(error.code) ? error.message : null}</FormAlert>
      <dl className="border-surface-700 bg-surface-900 max-w-xl rounded-xl border px-5">
        <Row label="Package">
          {p.name} · {p.sessions} × {p.hoursPerSession} h
        </Row>
        <Row label="Area">
          {booking.serviceArea.name} · {TRAINING_TYPES.find((t) => t.value === booking.trainingType)?.label}
        </Row>
        <Row label="Pickup">{booking.pickupAddress}</Row>
        <Row label="Instructor">
          {booking.instructor.fullName}
          {booking.instructor.branch ? <span className="text-ink-500"> · {booking.instructor.branch.name}</span> : null}
        </Row>
        <Row label="Session 1">{formatDateTime(booking.slot.start)}</Row>
        <Row label="Price">{formatMoney(p.price)}</Row>
        <Row label="Reservation">
          {formatMoney(p.reservationFee)} · {online ? 'online now' : 'cash to your instructor'}
        </Row>
        <Row label="Balance">{formatMoney(Number(p.price) - Number(p.reservationFee))}</Row>
      </dl>
      <p className="text-ink-400 max-w-xl text-sm">
        {online
          ? 'You will be taken to PayMongo to pay the reservation. It counts as paid only once PayMongo confirms it.'
          : 'Pay your instructor in person and get a receipt number. Your instructor confirms the booking next.'}
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <SubmitButton type="button" size="md" loading={loading} loadingLabel="Booking…" onClick={confirm}>
          {online ? 'Confirm and pay reservation' : 'Confirm booking'}
        </SubmitButton>
      </div>
    </section>
  );
}
