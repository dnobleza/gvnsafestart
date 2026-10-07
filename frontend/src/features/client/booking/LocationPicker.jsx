import { NavigationArrowIcon } from '@phosphor-icons/react';

import { updateProfile } from '../../../api/clientPortal';
import { reverseGeocode } from '../../../api/geo';
import Button from '../../../components/Button';
import SelectField from '../../../components/SelectField';
import useGeolocation from '../../../hooks/useGeolocation';
import { nearestBranch } from '../../../utils/geo';
import { useLocations } from '../hooks/useClientResources';

const remember = (location) =>
  updateProfile({
    savedLocation: { city: location.city, latitude: location.latitude, longitude: location.longitude },
  }).catch(() => {});

// Where to search from for instructor recommendations: the browser location or
// a branch. Denied or unavailable location quietly falls back to the list.
export default function LocationPicker({ location, onChange }) {
  const branches = useLocations();
  const { locate, locating, unavailable } = useGeolocation();

  const useCurrent = async () => {
    const coords = await locate();
    if (!coords) return;
    const place = await reverseGeocode(coords.latitude, coords.longitude).catch(() => null);
    const near = nearestBranch(coords, branches.data || []);
    const next = {
      ...coords,
      place,
      label: place ? place.label : 'your current location',
      city: (place && place.city) || (near && near.name) || null,
      branchId: null,
    };
    onChange(next);
    if (next.city) remember(next);
  };

  const pickBranch = (id) => {
    const branch = (branches.data || []).find((b) => b.id === id);
    if (!branch) return;
    const next = {
      latitude: branch.latitude,
      longitude: branch.longitude,
      label: branch.name,
      city: branch.name,
      place: null,
      branchId: branch.id,
    };
    onChange(next);
    remember(next);
  };

  const near = location && !location.branchId ? nearestBranch(location, branches.data || []) : null;

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-ink-100 text-sm font-medium">Find instructors near</legend>

      <div>
        <Button variant="secondary" onClick={useCurrent} disabled={locating}>
          <NavigationArrowIcon size={16} aria-hidden="true" />
          {locating ? 'Finding you…' : 'Use my current location'}
        </Button>
        {unavailable ? (
          <p className="text-ink-500 mt-2 text-sm">We could not get your location, so pick the nearest branch instead.</p>
        ) : null}
      </div>

      <div className="max-w-sm">
        {branches.error ? (
          <div role="alert" className="flex items-center gap-3">
            <p className="text-danger-300 text-sm">{branches.error.message}</p>
            <Button variant="secondary" size="sm" onClick={branches.refetch}>
              Retry
            </Button>
          </div>
        ) : (
          <SelectField
            label="Or choose a branch / city"
            value={location?.branchId || ''}
            disabled={branches.loading && !branches.data}
            onChange={(e) => pickBranch(e.target.value)}
            options={[
              { value: '', label: branches.loading && !branches.data ? 'Loading branches…' : 'Select a branch' },
              ...(branches.data || []).map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        )}
      </div>

      {location ? (
        <div className="text-sm" role="status">
          <p className="text-ink-400">
            Searching near <span className="text-ink-100 font-medium">{location.label}</span>
          </p>
          {!location.branchId ? (
            <p className="text-ink-500 text-xs tabular-nums">
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              {near ? ` · nearest branch ${near.name} (${near.km.toFixed(1)} km)` : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
