import { forwardRef, useId } from 'react';

const TextField = forwardRef(function TextField({ label, error, hint, className = '', ...rest }, ref) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="text-ink-100 block text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={
          'bg-surface-900 text-ink-100 placeholder:text-ink-500 mt-2 block h-11 w-full rounded-full border px-5 text-sm ' +
          'transition-colors outline-none focus:border-accent-500 focus:ring-accent-500/30 focus:ring-2 ' +
          (error ? 'border-danger-500' : 'border-surface-600')
        }
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-danger-300 mt-2 px-5 text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-ink-500 mt-2 px-5 text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default TextField;
