import { CreditCardIcon, MoneyIcon } from '@phosphor-icons/react';

import Button from '../../../components/Button';
import { formatMoney } from '../../../utils/format';

export default function PaymentStep({ packageDef, value, onChange, onBack, onNext }) {
  const reservation = formatMoney(packageDef.reservationFee);
  const balance = formatMoney(Number(packageDef.price) - Number(packageDef.reservationFee));
  const options = [
    {
      value: 'ONLINE',
      label: `Pay ${reservation} reservation online`,
      icon: CreditCardIcon,
      note: 'GCash, Maya or card through PayMongo. Pay within the time shown or the booking is released.',
    },
    {
      value: 'CASH',
      label: 'Pay reservation in cash',
      icon: MoneyIcon,
      note: 'Pay your instructor in person and get a receipt number.',
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">How will you pay the reservation?</h2>
        <p className="text-ink-400 text-sm">
          The balance of {balance} is paid in cash to your instructor (you get a receipt number), or online later from My
          packages.
        </p>
      </div>
      <fieldset className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <legend className="sr-only">Payment method</legend>
        {options.map(({ value: option, label, icon: Icon, note }) => (
          <label
            key={option}
            className={
              'flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors ' +
              (value === option ? 'border-accent-500 bg-accent-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600')
            }
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentMethod"
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="accent-accent-500"
              />
              <Icon size={18} aria-hidden="true" className="text-accent-300" />
              <span className="text-ink-100 text-sm font-medium">{label}</span>
            </span>
            <span className="text-ink-400 text-xs">{note}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!value}>
          Review booking
        </Button>
      </div>
    </section>
  );
}
