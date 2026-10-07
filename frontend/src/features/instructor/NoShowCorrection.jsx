import { useState } from 'react';

import Button from '../../components/Button';
import useNow from '../../hooks/useNow';
import { timeLeft } from '../../utils/format';
import CorrectNoShowDialog from './CorrectNoShowDialog';

// "Mark as no-show" with its countdown while the 24-hour window is open, and
// a note once it has closed. Nothing for sessions the instructor completed.
export default function NoShowCorrection({ booking, onDone, compact = false }) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  if (!booking.autoCompleted || booking.status !== 'COMPLETED' || !booking.correctableUntil) return null;

  const left = timeLeft(booking.correctableUntil, now);
  if (!left) {
    return compact ? null : <p className="text-ink-500 text-xs">Correction window closed</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="danger" onClick={() => setOpen(true)} aria-label={`Mark ${booking.client?.fullName} as no-show`}>
        Mark as no-show
      </Button>
      <span className="text-ink-500 text-xs tabular-nums">{left} to correct</span>
      {open ? (
        <CorrectNoShowDialog
          booking={booking}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone?.();
          }}
        />
      ) : null}
    </div>
  );
}
