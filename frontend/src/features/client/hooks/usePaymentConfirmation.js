import { useEffect, useState } from 'react';

export const POLL_MS = 3000;
export const GIVE_UP_MS = 120000;

// After the provider redirects back we only know the client *tried* to pay.
// The booking turns PAID when our webhook hears from the provider, so keep
// re-reading it for a while instead of trusting the redirect.
export default function usePaymentConfirmation({ active, paid, refetch }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active || paid) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt >= GIVE_UP_MS) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      refetch();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, paid, refetch]);

  if (!active) return 'idle';
  if (paid) return 'paid';
  return timedOut ? 'slow' : 'waiting';
}
