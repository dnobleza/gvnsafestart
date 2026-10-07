import { useEffect, useState } from 'react';

import { rescheduleMyBooking } from '../../api/clientPortal';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import MonthCalendar from '../../components/MonthCalendar';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import { formatDateTime, toLocalDate } from '../../utils/format';
import { useInstructorSlots } from './hooks/useClientResources';

export default function ClientRescheduleDialog({ booking, onClose, onDone }) {
  const [date, setDate] = useState(() => toLocalDate(booking.scheduledAt));
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const slots = useInstructorSlots(booking.instructor?.id, date, booking.durationMinutes);
  const { run, loading, error } = useAction(rescheduleMyBooking);

  useEffect(() => setSlot(null), [date]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!slot) errors.slot = 'Pick one of the open times';
    if (!reason.trim()) errors.reason = 'Tell your instructor why';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const result = await run(booking.id, slot, reason.trim());
    if (result.ok) onDone();
  };

  const list = slots.data?.slots || [];

  return (
    <Modal
      open
      title="Reschedule booking"
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep as is
          </Button>
          <SubmitButton form="client-reschedule" size="md" loading={loading} loadingLabel="Saving…">
            Save new time
          </SubmitButton>
        </>
      }
    >
      <form id="client-reschedule" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{error?.message}</FormAlert>
        <p className="text-ink-400 text-sm">Currently {formatDateTime(booking.scheduledAt)}</p>
        <MonthCalendar value={date} min={toLocalDate()} onChange={setDate} label="New date" />
        <fieldset>
          <legend className="text-ink-100 text-sm font-medium">Open times</legend>
          <div className="mt-2">
            {slots.loading ? (
              <p className="text-ink-500 text-sm">Checking availability…</p>
            ) : slots.error ? (
              <p className="text-danger-300 text-sm">{slots.error.message}</p>
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
