import Button from './Button';
import FormAlert from './FormAlert';
import Modal from './Modal';
import SubmitButton from './SubmitButton';

export default function ConfirmDialog({ open, title, children, confirmLabel, busyLabel, danger, loading, error, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <SubmitButton
            type="button"
            size="md"
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            loadingLabel={busyLabel}
            onClick={onConfirm}
          >
            {confirmLabel}
          </SubmitButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormAlert>{error?.message}</FormAlert>
        <div className="text-ink-400 text-sm leading-relaxed">{children}</div>
      </div>
    </Modal>
  );
}
