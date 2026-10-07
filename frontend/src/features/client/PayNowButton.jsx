import { useState } from 'react';

import Button from '../../components/Button';
import { toApiError } from '../../api/client';
import { startPayment } from './checkout';

export default function PayNowButton({ bookingId, size = 'sm', label = 'Pay now' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await startPayment(bookingId);
    } catch (err) {
      setError(toApiError(err).message);
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size={size} onClick={pay} disabled={busy}>
        {busy ? 'Opening checkout…' : label}
      </Button>
      {error ? (
        <span role="alert" className="text-danger-300 text-xs">
          {error}
        </span>
      ) : null}
    </span>
  );
}
