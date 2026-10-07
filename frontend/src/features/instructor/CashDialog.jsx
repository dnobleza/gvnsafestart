import { useState } from 'react';

import { recordCash } from '../../api/instructor';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import { formatDateTime, formatMoney } from '../../utils/format';

const AMOUNT = /^\d+(\.\d{1,2})?$/;

export default function CashDialog({ booking, onClose, onDone }) {
  const due = booking.package ? booking.package.balance : booking.price;
  const [amount, setAmount] = useState(due || '');
  const [fieldError, setFieldError] = useState(null);
  const [issued, setIssued] = useState(null);
  const { run, loading, error } = useAction(recordCash);

  const onSubmit = async (event) => {
    event.preventDefault();
    const value = String(amount).trim();
    if (!AMOUNT.test(value) || Number(value) <= 0) return setFieldError('Enter the amount received, e.g. 1500');
    setFieldError(null);
    const result = await run(booking.id, { amount: value });
    if (result.ok) setIssued({ receiptNumber: result.data.booking.receiptNumber, amount: value });
  };

  if (issued) {
    return (
      <Modal
        open
        title="Cash recorded"
        onClose={onDone}
        footer={
          <Button size="md" onClick={onDone}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-sm" role="status">
          <p className="text-ink-400">
            {formatMoney(issued.amount)} received from <span className="text-ink-100">{booking.client?.fullName}</span>.
          </p>
          <div className="border-accent-600 rounded-xl border p-4 text-center">
            <p className="text-ink-500 text-xs tracking-wide uppercase">Official receipt no.</p>
            <p className="text-accent-300 mt-1 text-2xl font-semibold tracking-wide tabular-nums">{issued.receiptNumber}</p>
          </div>
          <p className="text-ink-500 text-xs">Write this number on the receipt you hand the client. It also appears in their booking.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title="Record cash payment"
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <SubmitButton form="cash" size="md" loading={loading} loadingLabel="Recording…">
            Record cash
          </SubmitButton>
        </>
      }
    >
      <form id="cash" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{error?.message}</FormAlert>
        <p className="text-ink-400 text-sm">
          <span className="text-ink-100 font-medium">{booking.client?.fullName}</span> · {booking.lessonType} ·{' '}
          {formatDateTime(booking.scheduledAt)}
          {booking.package ? (
            <span className="block">
              {booking.package.name} balance: {formatMoney(booking.package.balance)} of {formatMoney(booking.package.price)}
            </span>
          ) : booking.price ? (
            <span className="block">Lesson price: {formatMoney(booking.price)}</span>
          ) : null}
        </p>
        <TextField
          label="Amount received (PHP)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={fieldError || error?.fieldErrors?.amount}
        />
        <p className="text-ink-500 text-xs">An official receipt (OR) number is issued automatically when you record the payment.</p>
      </form>
    </Modal>
  );
}
