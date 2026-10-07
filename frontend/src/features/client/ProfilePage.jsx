import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NavigationArrowIcon } from '@phosphor-icons/react';

import { updateProfile } from '../../api/clientPortal';
import { reverseGeocode } from '../../api/geo';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import PageHeader from '../../components/PageHeader';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import useGeolocation from '../../hooks/useGeolocation';
import applyApiError from '../auth/applyApiError';
import { useProfile } from './hooks/useClientResources';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+[1-9]\d{7,14}$/.test(v), 'Use the format +639171234567'),
  city: z.string().trim().max(120),
});

const FIELDS = ['fullName', 'phone'];

const toValues = (profile) => ({
  fullName: profile?.fullName ?? '',
  phone: profile?.phone ?? '',
  city: profile?.savedLocation?.city ?? '',
});

export default function ProfilePage() {
  const { data: profile, loading, error, refetch } = useProfile();
  const save = useAction(updateProfile);
  const { locate, locating, unavailable } = useGeolocation();
  const [coords, setCoords] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toValues(profile) });

  useEffect(() => {
    if (!profile) return;
    reset(toValues(profile));
    const s = profile.savedLocation;
    setCoords(s?.latitude != null ? { latitude: s.latitude, longitude: s.longitude } : null);
  }, [profile, reset]);

  const onSubmit = async (values) => {
    setSaved(false);
    setFormError(null);
    const body = { fullName: values.fullName };
    if (values.phone && values.phone !== profile.phone) body.phone = values.phone;
    body.savedLocation =
      values.city || coords ? { ...(values.city ? { city: values.city } : {}), ...(coords || {}) } : null;
    const result = await save.run(body);
    if (!result.ok) {
      if (result.error.code === 'PHONE_ALREADY_REGISTERED') {
        setError('phone', { type: 'server', message: result.error.message });
        return;
      }
      setFormError(applyApiError(result.error, setError, FIELDS));
      return;
    }
    setSaved(true);
    refetch();
  };

  return (
    <>
      <PageHeader title="Profile" description="Your details and the location we use to recommend instructors." />
      {loading && !profile ? (
        <div className="bg-surface-900 h-80 max-w-2xl animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex max-w-2xl flex-col gap-6">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="border-surface-700 bg-surface-900 flex flex-col gap-4 rounded-xl border p-5"
          >
            <FormAlert>{formError}</FormAlert>
            {saved ? (
              <p role="status" className="text-accent-300 text-sm">
                Profile saved.
              </p>
            ) : null}
            <TextField label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
            <TextField label="Email" value={profile?.email || ''} readOnly disabled hint="Contact the office to change your email." />
            <TextField
              label="Mobile number"
              type="tel"
              autoComplete="tel"
              placeholder="+639171234567"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <fieldset className="border-surface-800 flex flex-col gap-3 border-t pt-4">
              <legend className="text-ink-100 text-sm font-medium">Saved location</legend>
              <TextField label="City" placeholder="e.g. Makati" error={errors.city?.message} {...register('city')} />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={locating}
                  onClick={async () => {
                    const found = await locate();
                    if (!found) return;
                    setCoords(found);
                    const place = await reverseGeocode(found.latitude, found.longitude).catch(() => null);
                    if (place?.city) setValue('city', place.city, { shouldDirty: true });
                  }}
                >
                  <NavigationArrowIcon size={14} aria-hidden="true" />
                  {locating ? 'Finding you…' : 'Use my current location'}
                </Button>
                {coords ? (
                  <>
                    <span className="text-ink-400 text-xs tabular-nums">
                      {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setCoords(null)}>
                      Clear
                    </Button>
                  </>
                ) : null}
              </div>
              {unavailable ? <p className="text-ink-500 text-xs">Location is unavailable; the city alone is fine.</p> : null}
            </fieldset>
            <div>
              <SubmitButton size="md" loading={save.loading} loadingLabel="Saving…">
                Save profile
              </SubmitButton>
            </div>
          </form>
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <h2 className="text-sm font-semibold tracking-tight">Password</h2>
            <p className="text-ink-500 mb-3 text-xs">Accounts that sign in with Google, Facebook or a mobile code have no password.</p>
            <Button variant="secondary" size="sm" to="/change-password">
              Change password
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
