import { useEffect, useState } from 'react';

import { rescheduleBooking } from '../../api/instructor';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import { formatDateTime, toLocalDate } from '../../utils/format';
import { useSlots } from './hooks/useInstructorResources';

const submit = (booking, scheduledAt, reason) => rescheduleBooking(booking.id, scheduledAt, reason);

export default function RescheduleDialog({ booking, onClose, onDone }) {
  const [date, setDate] = useState(() => toLocalDate(booking.scheduledAt));
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const slots = useSlots(date, booking.id);
  const { run, loading, error } = useAction(submit);

  useEffect(() => setSlot(null), [date]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!slot) errors.slot = 'Pick one of your open times';
    if (!reason.trim()) errors.reason = 'Tell the client why';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const result = await run(booking, slot, reason.trim());
    if (result.ok) onDone();
  };

  const list = slots.data?.slots || [];

  return (
    <Modal
      open
      title="Reschedule session"
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep as is
          </Button>
          <SubmitButton form="reschedule" size="md" loading={loading} loadingLabel="Saving…">
            Save new time
          </SubmitButton>
        </>
      }
    >
      <form id="reschedule" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{error?.message}</FormAlert>
        <p className="text-ink-400 text-sm">
          <span className="text-ink-100 font-medium">{booking.client?.fullName}</span> · currently{' '}
          {formatDateTime(booking.scheduledAt)} ({booking.durationMinutes} min)
        </p>
        <TextField
          label="Date"
          type="date"
          value={date}
          min={toLocalDate()}
          onChange={(e) => setDate(e.target.value)}
        />
        <fieldset>
          <legend className="text-ink-100 text-sm font-medium">Open times</legend>
          <div className="mt-2 min-h-12">
            {slots.loading ? (
              <p className="text-ink-500 text-sm">Checking your availability…</p>
            ) : slots.error ? (
              <p className="text-danger-300 text-sm">{slots.error.message}</p>
            ) : slots.data?.dayOff ? (
              <p className="text-ink-500 text-sm">You are off on this day.</p>
            ) : !list.length ? (
              <p className="text-ink-500 text-sm">No open times on this day.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {list.map((s) => (
                  <Button
                    key={s.start}
                    size="sm"
                    variant={slot === s.start ? 'primary' : 'secondary'}
                    aria-pressed={slot === s.start}
                    onClick={() => setSlot(s.start)}
                  >
                    {s.time}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {fieldErrors.slot ? <p className="text-danger-300 mt-2 text-sm">{fieldErrors.slot}</p> : null}
        </fieldset>
        <TextField
          label="Reason"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          error={fieldErrors.reason || error?.fieldErrors?.reason}
        />
      </form>
    </Modal>
  );
}
