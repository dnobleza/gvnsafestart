import { useState } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

import Button from './Button';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const pad = (n) => String(n).padStart(2, '0');

const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Pick a calendar date (YYYY-MM-DD). Dates are plain calendar days, so all
// arithmetic is done in UTC to avoid the viewer's zone shifting them.
export default function MonthCalendar({ value, onChange, min, label = 'Date' }) {
  const start = value || min;
  const [view, setView] = useState(() => {
    const [y, m] = start.split('-').map(Number);
    return { y, m: m - 1 };
  });

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const [minY, minM] = min.split('-').map(Number);
  const atMin = view.y === minY && view.m === minM - 1;

  const shift = (delta) =>
    setView(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  return (
    <div className="border-surface-700 bg-surface-900 max-w-sm rounded-xl border p-4" role="group" aria-label={label}>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => shift(-1)} disabled={atMin} aria-label="Previous month">
          <CaretLeftIcon size={14} aria-hidden="true" />
        </Button>
        <p className="text-sm font-medium" aria-live="polite">
          {monthLabel.format(first)}
        </p>
        <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Next month">
          <CaretRightIcon size={14} aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-ink-500 py-1 text-[11px]">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const date = iso(view.y, view.m, day);
          const selected = date === value;
          const disabled = date < min;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => onChange(date)}
              aria-pressed={selected}
              aria-label={date}
              className={
                'h-9 rounded-full text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30 ' +
                (selected ? 'bg-accent-500 text-surface-950 font-semibold' : 'text-ink-100 hover:bg-surface-800')
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
