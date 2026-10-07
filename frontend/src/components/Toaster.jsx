import { useCallback, useEffect, useState } from 'react';
import { XIcon } from '@phosphor-icons/react';

import { TOAST_MS, onToast } from '../utils/toast';

const TONE = {
  info: 'border-surface-600',
  success: 'border-accent-600',
  error: 'border-danger-500/60',
};

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  useEffect(
    () =>
      onToast((toast) => {
        setToasts((all) => [...all.slice(-2), toast]);
        setTimeout(() => dismiss(toast.id), TOAST_MS);
      }),
    [dismiss],
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`bg-surface-900 text-ink-100 pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${TONE[t.tone] || TONE.info}`}
        >
          <p className="flex-1">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="text-ink-400 hover:text-ink-100 -mr-1 rounded-full p-1"
          >
            <XIcon size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
