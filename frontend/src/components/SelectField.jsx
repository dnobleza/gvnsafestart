import { forwardRef, useId } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';

const SelectField = forwardRef(function SelectField({ label, error, options, className = '', ...rest }, ref) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="text-ink-100 block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-2">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={
            'bg-surface-900 text-ink-100 block h-11 w-full appearance-none rounded-full border pr-10 pl-5 text-sm ' +
            'focus:border-accent-500 focus:ring-accent-500/30 outline-none focus:ring-2 ' +
            (error ? 'border-danger-500' : 'border-surface-600')
          }
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <CaretDownIcon
          size={16}
          aria-hidden="true"
          className="text-ink-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-danger-300 mt-2 px-5 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export default SelectField;
