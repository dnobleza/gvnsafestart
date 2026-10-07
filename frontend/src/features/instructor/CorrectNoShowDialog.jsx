import { useState } from 'react';

import { correctNoShow } from '../../api/instructor';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import { formatDateTime } from '../../utils/format';

// Two steps: the required reason, then an explicit confirm.
export default function CorrectNoShowDialog({ booking, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [step, setStep] = useState('reason');
  const [fieldError, setFieldError] = useState(null);
  const { run, loading, error } = useAction(correctNoShow);

  const next = (event) => {
    event.preventDefault();
    if (!reason.trim()) return setFieldError('A reason is required');
    setFieldError(null);
    setStep('confirm');
  };

  const confirm = async () => {
    const result = await run(booking.id, reason.trim());
    if (result.ok) onDone(result.data.booking);
  };

  const who = booking.client?.fullName;

  return (
    <Modal
      open
      title="Mark as no-show?"
      onClose={loading ? () => {} : onClose}
      footer={
        step === 'reason' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Keep completed
            </Button>
            <SubmitButton form="correct-no-show" size="md" variant="danger">
              Continue
            </SubmitButton>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep('reason')} disabled={loading}>
              Back
            </Button>
            <SubmitButton type="button" size="md" variant="danger" loading={loading} loadingLabel="Saving…" onClick={confirm}>
              Confirm no-show
            </SubmitButton>
          </>
        )
      }
    >
      {step === 'reason' ? (
        <form id="correct-no-show" onSubmit={next} noValidate className="flex flex-col gap-4">
          <p className="text-ink-400 text-sm">
            <span className="text-ink-100 font-medium">{who}</span> · {formatDateTime(booking.scheduledAt)} was completed
            automatically. Change it to a no-show if the client did not attend.
          </p>
          <TextField
            label="Reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            error={fieldError}
          />
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <FormAlert>{error?.message}</FormAlert>
          <p className="text-ink-400 text-sm">
            This marks the session as a no-show and cannot be undone. If {who} already rated it, the rating is hidden and
            no longer counts. An admin is notified.
          </p>
          <p className="text-ink-100 text-sm">Reason: {reason.trim()}</p>
        </div>
      )}
    </Modal>
  );
}
