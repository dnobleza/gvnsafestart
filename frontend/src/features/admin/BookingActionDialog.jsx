import { useEffect, useState } from 'react';

import { approveBooking, cancelBooking, rescheduleBooking } from '../../api/admin';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import { formatDateTime, toLocalInputValue } from '../../utils/format';
import useAction from '../../hooks/useAction';

const COPY = {
  approve: { title: 'Confirm booking', submit: 'Confirm', busy: 'Confirming…' },
  reschedule: { title: 'Reschedule booking', submit: 'Save new time', busy: 'Saving…' },
  cancel: { title: 'Cancel booking', submit: 'Cancel booking', busy: 'Cancelling…' },
};

const REQUESTS = {
  approve: (booking) => approveBooking(booking.id),
  reschedule: (booking, { scheduledAt, reason }) =>
    rescheduleBooking(booking.id, new Date(scheduledAt).toISOString(), reason.trim()),
  cancel: (booking, { reason }) => cancelBooking(booking.id, reason.trim()),
};

const runRequest = (kind, booking, values) => REQUESTS[kind](booking, values);

export default function BookingActionDialog({ action, onClose, onDone }) {
  const { run, loading, error, reset } = useAction(runRequest);
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [reasonError, setReasonError] = useState(null);

  const booking = action?.booking;
  const kind = action?.kind;

  useEffect(() => {
    if (!booking) return;
    setScheduledAt(toLocalInputValue(booking.scheduledAt));
    setReason('');
    setFieldError(null);
    setReasonError(null);
    reset();
  }, [booking, kind, reset]);

  if (!action) return null;
  const copy = COPY[kind];

  const onSubmit = async (event) => {
    event.preventDefault();
    if (kind === 'reschedule') {
      if (!scheduledAt) return setFieldError('Choose a date and time');
      if (new Date(scheduledAt) <= new Date()) return setFieldError('Choose a time in the future');
    }
    if (kind !== 'approve' && !reason.trim()) return setReasonError('A reason is required');
    setReasonError(null);
    setFieldError(null);
    const result = await run(kind, booking, { scheduledAt, reason });
    if (result.ok) onDone();
  };

  return (
    <Modal
      open
      title={copy.title}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep as is
          </Button>
          <SubmitButton
            form="booking-action"
            size="md"
            loading={loading}
            loadingLabel={copy.busy}
            variant={kind === 'cancel' ? 'danger' : 'primary'}
          >
            {copy.submit}
          </SubmitButton>
        </>
      }
    >
      <form id="booking-action" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{error?.fieldErrors?.scheduledAt ? null : error?.message}</FormAlert>
        <div className="text-ink-400 text-sm">
          <p className="text-ink-100 font-medium">{booking.client?.fullName}</p>
          <p>
            {booking.lessonType} · {formatDateTime(booking.scheduledAt)}
          </p>
        </div>
        {kind === 'reschedule' ? (
          <TextField
            label="New date and time"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            error={fieldError || error?.fieldErrors?.scheduledAt}
          />
        ) : null}
        {kind !== 'approve' ? (
          <TextField
            label="Reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            error={reasonError || error?.fieldErrors?.reason}
          />
        ) : null}
      </form>
    </Modal>
  );
}
