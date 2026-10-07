import Button from '../../../components/Button';
import MonthCalendar from '../../../components/MonthCalendar';
import { useInstructorSlots } from '../hooks/useClientResources';

export default function DateTimeStep({ booking, update, minDate, onBack, onNext }) {
  const slots = useInstructorSlots(booking.instructor.id, booking.date, booking.duration);
  const list = slots.data?.slots || [];
  const hours = booking.duration / 60;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Pick the date and start time of session 1</h2>
        <p className="text-ink-400 text-sm">
          Each session is {hours} hours. Only {booking.instructor.fullName}&apos;s open start times are shown
          {booking.packageDef.sessions > 1 ? '; you book the other sessions later from My packages' : ''}.
        </p>
      </div>
      <div className="flex flex-col gap-5 lg:flex-row">
        <MonthCalendar value={booking.date} min={minDate} onChange={(date) => update({ date, slot: null })} />
        <fieldset className="flex-1">
          <legend className="text-ink-100 text-sm font-medium">Open start times</legend>
          <div className="mt-2">
            {slots.loading ? (
              <p className="text-ink-500 text-sm">Checking availability…</p>
            ) : slots.error ? (
              <div role="alert" className="flex items-center gap-3">
                <p className="text-danger-300 text-sm">{slots.error.message}</p>
                <Button variant="secondary" size="sm" onClick={slots.refetch}>
                  Retry
                </Button>
              </div>
            ) : slots.data?.dayOff ? (
              <p className="text-ink-500 text-sm">The instructor is off on this day. Try another date.</p>
            ) : !list.length ? (
              <p className="text-ink-500 text-sm">No {hours}-hour openings on this day. Try another date.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {list.map((s) => (
                  <Button
                    key={s.start}
                    size="sm"
                    variant={booking.slot?.start === s.start ? 'primary' : 'secondary'}
                    aria-pressed={booking.slot?.start === s.start}
                    onClick={() => update({ slot: s })}
                  >
                    {s.time}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </fieldset>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!booking.slot}>
          Continue
        </Button>
      </div>
    </section>
  );
}
