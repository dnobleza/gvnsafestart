import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { getSettings, updateSettings } from '../../api/admin';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import PageHeader from '../../components/PageHeader';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import useResource from '../../hooks/useResource';
import applyApiError from '../auth/applyApiError';
import PaymentProviderCard from './PaymentProviderCard';

const whole = (min, max) =>
  z.coerce.number({ message: 'Enter a number' }).int('Use a whole number').min(min, `At least ${min}`).max(max, `At most ${max}`);

const schema = z.object({
  clientChangeCutoffHours: whole(0, 168),
  onlinePaymentExpiryMinutes: whole(5, 1440),
  cashAutoCancelHours: whole(0, 168),
  pricePerHour: z.coerce.number({ message: 'Enter a number' }).positive('Must be more than 0').max(100000),
  reservationFee: z.coerce.number({ message: 'Enter a number' }).min(0, 'Cannot be negative').max(100000),
});

const FIELDS = Object.keys(schema.shape);

const COPY = {
  clientChangeCutoffHours: {
    label: 'Client change cutoff (hours)',
    hint: 'Clients can cancel or reschedule until this many hours before the session.',
  },
  onlinePaymentExpiryMinutes: {
    label: 'Online payment window (minutes)',
    hint: 'Unpaid online bookings are cancelled after this long.',
  },
  cashAutoCancelHours: {
    label: 'Cash auto-cancel (hours)',
    hint: 'Cash bookings the instructor has not confirmed are cancelled this many hours before the session.',
  },
  pricePerHour: { label: 'Hourly lesson price (PHP)', hint: 'Only for legacy hourly bookings; packages use the rate grid.' },
  reservationFee: { label: 'Reservation fee (PHP)', hint: 'Paid when a package is booked; the rest is the balance.' },
};

export default function SettingsPage() {
  const { data, loading, error, refetch } = useResource(getSettings);
  const save = useAction(updateSettings);
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  const onSubmit = async (values) => {
    setSaved(false);
    setFormError(null);
    const changed = Object.fromEntries(Object.entries(values).filter(([k]) => dirtyFields[k]));
    if (!Object.keys(changed).length) return;
    const result = await save.run(changed);
    if (!result.ok) {
      setFormError(applyApiError(result.error, setError, FIELDS));
      return;
    }
    reset(result.data);
    setSaved(true);
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Booking and payment rules for every client."
        actions={
          <Button variant="secondary" size="sm" to="/admin/settings/auto-complete">
            Auto-complete
          </Button>
        }
      />
      <div className="mb-6">
        <PaymentProviderCard />
      </div>
      {loading && !data ? (
        <div className="bg-surface-900 h-80 max-w-2xl animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="border-surface-700 bg-surface-900 flex max-w-2xl flex-col gap-5 rounded-xl border p-5"
        >
          <FormAlert>{formError}</FormAlert>
          {saved ? (
            <p role="status" className="text-accent-300 text-sm">
              Settings saved.
            </p>
          ) : null}
          {FIELDS.map((key) => (
            <TextField
              key={key}
              label={COPY[key].label}
              hint={COPY[key].hint}
              inputMode="decimal"
              error={errors[key]?.message}
              {...register(key)}
            />
          ))}
          <div>
            <SubmitButton size="md" loading={save.loading} loadingLabel="Saving…">
              Save settings
            </SubmitButton>
          </div>
        </form>
      )}
    </>
  );
}
