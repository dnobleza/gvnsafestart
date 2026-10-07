import { useState } from 'react';

import Button from './Button';
import FormAlert from './FormAlert';
import Modal from './Modal';
import SubmitButton from './SubmitButton';
import TextField from './TextField';
import useAction from '../hooks/useAction';

// A confirm step that also collects the required reason (cancel, void request).
export default function ReasonDialog({ title, intro, label = 'Reason', submitLabel, busyLabel, danger, request, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const { run, loading, error } = useAction(request);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) return setFieldError('A reason is required');
    setFieldError(null);
    const result = await run(reason.trim());
    if (result.ok) onDone();
  };

  return (
    <Modal
      open
      title={title}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep as is
          </Button>
          <SubmitButton
            form="reason-dialog"
            size="md"
            loading={loading}
            loadingLabel={busyLabel}
            variant={danger ? 'danger' : 'primary'}
          >
            {submitLabel}
          </SubmitButton>
        </>
      }
    >
      <form id="reason-dialog" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{error?.message}</FormAlert>
        {intro ? <div className="text-ink-400 text-sm">{intro}</div> : null}
        <TextField
          label={label}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          error={fieldError || error?.fieldErrors?.reason}
        />
      </form>
    </Modal>
  );
}
