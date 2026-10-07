import { useState } from 'react';

import { cancelBooking, completeBooking, confirmBooking, markNoShow } from '../../api/instructor';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import useAction from '../../hooks/useAction';
import { formatDateTime } from '../../utils/format';
import { ACTION_LABEL, actionsFor } from './bookingRules';
import CashDialog from './CashDialog';
import ReasonDialog from '../../components/ReasonDialog';
import RescheduleDialog from './RescheduleDialog';

const DIRECT = { confirm: confirmBooking, complete: completeBooking };

const runDirect = (kind, id) => DIRECT[kind](id);

const VARIANT = { confirm: 'primary', complete: 'primary', cash: 'secondary', cancel: 'danger', noShow: 'danger' };

export default function BookingActions({ booking, onDone, only }) {
  const [open, setOpen] = useState(null);
  const direct = useAction(runDirect);
  const noShow = useAction(markNoShow);

  const kinds = actionsFor(booking).filter((k) => !only || only.includes(k));
  if (!kinds.length) return null;

  const done = () => {
    setOpen(null);
    onDone?.();
  };

  const click = async (kind) => {
    if (DIRECT[kind]) {
      const result = await direct.run(kind, booking.id);
      if (result.ok) onDone?.();
      return;
    }
    setOpen(kind);
  };

  const who = booking.client?.fullName;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {kinds.map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant={VARIANT[kind] || 'secondary'}
            disabled={direct.loading}
            onClick={() => click(kind)}
            aria-label={`${ACTION_LABEL[kind]} for ${who}`}
          >
            {ACTION_LABEL[kind]}
          </Button>
        ))}
      </div>
      {direct.error ? (
        <p role="alert" className="text-danger-300 mt-1 text-right text-xs">
          {direct.error.message}
        </p>
      ) : null}

      {open === 'reschedule' ? <RescheduleDialog booking={booking} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open === 'cash' ? <CashDialog booking={booking} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open === 'cancel' ? (
        <ReasonDialog
          title="Cancel session?"
          intro={
            <>
              <span className="text-ink-100 font-medium">{who}</span> · {formatDateTime(booking.scheduledAt)}. The client
              is told the reason.
            </>
          }
          submitLabel="Cancel session"
          busyLabel="Cancelling…"
          danger
          request={(reason) => cancelBooking(booking.id, reason)}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      ) : null}
      <ConfirmDialog
        open={open === 'noShow'}
        title="Mark as no-show?"
        confirmLabel="Mark no-show"
        busyLabel="Saving…"
        danger
        loading={noShow.loading}
        error={noShow.error}
        onClose={() => {
          noShow.reset();
          setOpen(null);
        }}
        onConfirm={async () => (await noShow.run(booking.id)).ok && done()}
      >
        {who} did not attend the {formatDateTime(booking.scheduledAt)} session. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
