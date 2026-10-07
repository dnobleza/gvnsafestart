import { useEffect, useId, useRef } from 'react';
import { XIcon } from '@phosphor-icons/react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, title, onClose, children, footer }) {
  const titleId = useId();
  const panel = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const first = panel.current?.querySelector(FOCUSABLE);
    (first || panel.current)?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="bg-surface-950/80 absolute inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="border-surface-700 bg-surface-900 relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border p-6 outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-400 hover:text-ink-100 hover:bg-surface-800 -m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
