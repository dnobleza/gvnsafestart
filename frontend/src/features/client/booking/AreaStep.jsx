import { useState } from 'react';

import Button from '../../../components/Button';
import SelectField from '../../../components/SelectField';
import TextField from '../../../components/TextField';
import { useServiceAreas } from '../hooks/useClientResources';
import LocationPicker from './LocationPicker';
import { TRAINING_TYPES } from './trainingTypes';

export default function AreaStep({ booking, update, onNext }) {
  const areas = useServiceAreas();
  const [touched, setTouched] = useState(false);
  const address = booking.pickupAddress.trim();
  const addressError = touched && address.length < 5 ? 'Enter the full pickup address' : null;
  const suggested = booking.location?.place?.address || null;
  const ready = booking.serviceArea && booking.trainingType && address.length >= 5 && booking.location;

  return (
    <section className="flex max-w-2xl flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Where and how do you want to train?</h2>
        <p className="text-ink-400 text-sm">Door-to-door: your instructor picks you up. Rates depend on the area and training type.</p>
      </div>

      {areas.error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{areas.error.message}</p>
          <Button variant="secondary" size="sm" onClick={areas.refetch}>
            Retry
          </Button>
        </div>
      ) : (
        <SelectField
          label="Service area"
          value={booking.serviceArea?.id || ''}
          disabled={areas.loading && !areas.data}
          onChange={(e) =>
            update({ serviceArea: (areas.data || []).find((a) => a.id === e.target.value) || null, packageDef: null })
          }
          options={[
            { value: '', label: areas.loading && !areas.data ? 'Loading areas…' : 'Select your area' },
            ...(areas.data || []).map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      )}

      <fieldset>
        <legend className="text-ink-100 text-sm font-medium">Training type</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {TRAINING_TYPES.map((t) => (
            <label
              key={t.value}
              className={
                'flex cursor-pointer items-start gap-2 rounded-xl border p-4 transition-colors ' +
                (booking.trainingType === t.value
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-surface-700 bg-surface-900 hover:border-surface-600')
              }
            >
              <input
                type="radio"
                name="trainingType"
                value={t.value}
                checked={booking.trainingType === t.value}
                onChange={() => update({ trainingType: t.value, packageDef: null })}
                className="accent-accent-500 mt-1"
              />
              <span>
                <span className="text-ink-100 block text-sm font-medium">{t.label}</span>
                <span className="text-ink-400 block text-xs">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        label="Pickup address"
        placeholder="House no., street, barangay, city"
        value={booking.pickupAddress}
        maxLength={300}
        onChange={(e) => update({ pickupAddress: e.target.value })}
        onBlur={() => setTouched(true)}
        error={addressError}
      />

      <LocationPicker
        location={booking.location}
        onChange={(location) =>
          update({
            location,
            // Prefill only an empty field; never overwrite what the client typed.
            ...(location.place?.address && !booking.pickupAddress.trim() ? { pickupAddress: location.place.address } : {}),
          })
        }
      />
      {suggested && suggested !== booking.pickupAddress.trim() ? (
        <div className="text-sm">
          <Button variant="ghost" size="sm" onClick={() => update({ pickupAddress: suggested })}>
            Use as pickup address: {suggested}
          </Button>
        </div>
      ) : null}

      <div>
        <Button
          onClick={() => {
            setTouched(true);
            if (ready) onNext();
          }}
          disabled={!booking.serviceArea || !booking.trainingType || !booking.location}
        >
          Continue
        </Button>
      </div>
    </section>
  );
}
