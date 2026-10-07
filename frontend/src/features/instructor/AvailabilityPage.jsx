import { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { addDayOff, removeDayOff, saveAvailability } from '../../api/instructor';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import PageHeader from '../../components/PageHeader';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import { formatDate, toLocalDate } from '../../utils/format';
import { useAvailability } from './hooks/useInstructorResources';

const DAYS = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' },
];

const overlaps = (windows) =>
  windows.some((a, i) =>
    windows.some((b, j) => i !== j && a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime),
  );

function WeeklyHours({ initial, onSaved }) {
  const [windows, setWindows] = useState(initial);
  const [message, setMessage] = useState(null);
  const [localError, setLocalError] = useState(null);
  const { run, loading, error } = useAction(saveAvailability);

  useEffect(() => setWindows(initial), [initial]);

  const update = (index, patch) => setWindows((list) => list.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  const remove = (index) => setWindows((list) => list.filter((_, i) => i !== index));
  const add = (dayOfWeek) => setWindows((list) => [...list, { dayOfWeek, startTime: '08:00', endTime: '17:00' }]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (windows.some((w) => !w.startTime || !w.endTime || w.endTime <= w.startTime)) {
      return setLocalError('Each block needs an end time after its start time.');
    }
    if (overlaps(windows)) return setLocalError('Blocks on the same day must not overlap.');
    setLocalError(null);
    const result = await run(windows);
    if (result.ok) {
      setMessage('Working hours saved.');
      onSaved();
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="border-surface-700 bg-surface-900 rounded-xl border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Weekly working hours</h2>
          <p className="text-ink-500 text-xs">Clients can only book, and you can only reschedule, inside these hours.</p>
        </div>
        <SubmitButton size="md" loading={loading} loadingLabel="Saving…">
          Save hours
        </SubmitButton>
      </div>
      <FormAlert>{localError || error?.message}</FormAlert>
      {message ? (
        <p role="status" className="text-accent-300 mb-3 text-sm">
          {message}
        </p>
      ) : null}
      <ul className="divide-surface-800 divide-y">
        {DAYS.map(({ day, label }) => {
          const rows = windows.map((w, index) => ({ w, index })).filter(({ w }) => w.dayOfWeek === day);
          return (
            <li key={day} className="flex flex-wrap items-start gap-4 py-3">
              <p className="text-ink-100 w-28 pt-2 text-sm font-medium">{label}</p>
              <div className="flex flex-1 flex-col gap-2">
                {rows.length ? null : <p className="text-ink-500 pt-2 text-sm">Not working</p>}
                {rows.map(({ w, index }) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <TextField
                      label={`${label} start`}
                      className="w-36 [&_label]:sr-only"
                      type="time"
                      step={1800}
                      value={w.startTime}
                      onChange={(e) => update(index, { startTime: e.target.value })}
                    />
                    <span className="text-ink-500 pb-3 text-sm">to</span>
                    <TextField
                      label={`${label} end`}
                      className="w-36 [&_label]:sr-only"
                      type="time"
                      step={1800}
                      value={w.endTime}
                      onChange={(e) => update(index, { endTime: e.target.value })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`Remove ${label} block`}>
                      <TrashIcon size={16} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => add(day)} aria-label={`Add hours on ${label}`}>
                <PlusIcon size={14} aria-hidden="true" />
                Add
              </Button>
            </li>
          );
        })}
      </ul>
    </form>
  );
}

function DaysOff({ daysOff, onChanged }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const add = useAction(addDayOff);
  const remove = useAction(removeDayOff);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!date) return setFieldError('Pick a date');
    setFieldError(null);
    const result = await add.run({ date, ...(reason.trim() ? { reason: reason.trim() } : {}) });
    if (result.ok) {
      setDate('');
      setReason('');
      onChanged();
    }
  };

  return (
    <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
      <h2 className="text-sm font-semibold tracking-tight">Days off</h2>
      <p className="text-ink-500 mb-4 text-xs">No bookings or reschedules can land on these dates.</p>
      <form onSubmit={onSubmit} noValidate className="mb-4 flex flex-col gap-3">
        <FormAlert>{add.error?.message}</FormAlert>
        <TextField label="Date" type="date" min={toLocalDate()} value={date} onChange={(e) => setDate(e.target.value)} error={fieldError} />
        <TextField label="Reason (optional)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        <SubmitButton size="md" loading={add.loading} loadingLabel="Adding…">
          Add day off
        </SubmitButton>
      </form>
      {remove.error ? <p className="text-danger-300 mb-2 text-sm">{remove.error.message}</p> : null}
      {daysOff.length ? (
        <ul className="divide-surface-800 divide-y">
          {daysOff.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-ink-100 text-sm">{formatDate(`${d.date}T12:00:00+08:00`)}</p>
                {d.reason ? <p className="text-ink-500 text-xs">{d.reason}</p> : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.loading}
                onClick={async () => (await remove.run(d.id)).ok && onChanged()}
                aria-label={`Remove day off ${d.date}`}
              >
                <TrashIcon size={16} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-500 text-sm">No upcoming days off.</p>
      )}
    </section>
  );
}

export default function AvailabilityPage() {
  const { data, loading, error, refetch } = useAvailability();

  return (
    <>
      <PageHeader title="Availability" description="Set your weekly hours and block out days off." />
      {loading && !data ? (
        <div className="bg-surface-900 h-96 animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <WeeklyHours initial={data.weekly} onSaved={refetch} />
          <DaysOff daysOff={data.daysOff} onChanged={refetch} />
        </div>
      ) : null}
    </>
  );
}
