import { useEffect, useState } from 'react';

import { bookNextSession } from '../../api/clientPortal';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import MonthCalendar from '../../components/MonthCalendar';
import SubmitButton from '../../components/SubmitButton';
import useAction from '../../hooks/useAction';
import { addDaysToDate, toLocalDate } from '../../utils/format';
import { useInstructorSlots } from './hooks/useClientResources';

export default function NextSessionDialog({ pkg, onClose, onDone }) {
  const [date, setDate] = useState(() => addDaysToDate(toLocalDate(), 1));
  const [slot, setSlot] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const slots = useInstructorSlots(pkg.instructor.id, date, pkg.minutesPerSession);
  const { run, loading, error } = useAction(bookNextSession);
  const sessionNumber = pkg.sessionsUsed + 1;

  useEffect(() => setSlot(null), [date]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!slot) return setFieldError('Pick one of the open start times');
    setFieldError(null);
    const result = await run(pkg.id, slot);
    if (result.ok) onDone();
  };

  const list = slots.data?.slots || [];

  return (
    <Modal
      open
      title={`Book session ${sessionNumber} of ${pkg.sessionsTotal}`}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Not now
          </Button>
          <SubmitButton form="next-session" size="md" loading={loading} loadingLabel="Booking…">
            Book session
          </SubmitButton>
        </>
      }
    >
      <form id="next-session" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{error?.message}</FormAlert>
        <p className="text-ink-400 text-sm">
          {pkg.minutesPerSession / 60} hours with {pkg.instructor.fullName}, pickup at {pkg.pickupAddress}.
        </p>
        <MonthCalendar value={date} min={toLocalDate()} onChange={setDate} label="Session date" />
        <fieldset>
          <legend className="text-ink-100 text-sm font-medium">Open start times</legend>
          <div className="mt-2">
            {slots.loading ? (
              <p className="text-ink-500 text-sm">Checking availability…</p>
            ) : slots.error ? (
              <p className="text-danger-300 text-sm">{slots.error.message}</p>
            ) : !list.length ? (
              <p className="text-ink-500 text-sm">No openings on this day.</p>
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
          {fieldError ? <p className="text-danger-300 mt-2 text-sm">{fieldError}</p> : null}
        </fieldset>
      </form>
    </Modal>
  );
}
