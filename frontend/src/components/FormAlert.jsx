import { WarningCircleIcon } from '@phosphor-icons/react';

export default function FormAlert({ children }) {
  if (!children) return null;

  return (
    <div
      role="alert"
      className="border-danger-500/60 bg-danger-500/10 text-danger-300 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
    >
      <WarningCircleIcon size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
