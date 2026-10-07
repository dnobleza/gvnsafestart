import { useEffect, useState } from 'react';

import { getPackageRates, savePackageRates, updatePackage, updateServiceArea } from '../../api/admin';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import PageHeader from '../../components/PageHeader';
import SubmitButton from '../../components/SubmitButton';
import useAction from '../../hooks/useAction';
import useResource from '../../hooks/useResource';

const TYPES = [
  { value: 'OWN_CAR', label: 'Own Car' },
  { value: 'CAR_RENTAL', label: 'Car Rental' },
];

const key = (packageId, serviceAreaId) => `${packageId}:${serviceAreaId}`;

const toCells = (grid) =>
  Object.fromEntries((grid?.rates || []).map((r) => [key(r.packageId, r.serviceAreaId), String(Number(r.price))]));

export default function PackagesPage() {
  const [trainingType, setTrainingType] = useState('OWN_CAR');
  const { data: grid, loading, error, refetch } = useResource(getPackageRates, { trainingType });
  const save = useAction(savePackageRates);
  const toggle = useAction((kind, id, isActive) =>
    kind === 'package' ? updatePackage(id, { isActive }) : updateServiceArea(id, { isActive }),
  );
  const [cells, setCells] = useState({});
  const [invalid, setInvalid] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setCells(toCells(grid)), [grid]);

  const original = toCells(grid);
  const dirty = Object.keys({ ...original, ...cells }).filter((k) => (original[k] || '') !== (cells[k] || ''));

  const onSave = async (event) => {
    event.preventDefault();
    setSaved(false);
    const rates = [];
    for (const k of dirty) {
      const [packageId, serviceAreaId] = k.split(':');
      const text = (cells[k] || '').trim();
      if (text && !(Number(text) > 0)) return setInvalid('Prices must be numbers above 0, or empty for "not offered".');
      rates.push({ packageId, serviceAreaId, price: text ? Number(text) : null });
    }
    setInvalid(null);
    if (!rates.length) return;
    const result = await save.run({ trainingType, rates });
    if (result.ok) {
      setSaved(true);
      refetch();
    }
  };

  const flip = async (kind, id, isActive) => {
    if ((await toggle.run(kind, id, isActive)).ok) refetch();
  };

  return (
    <>
      <PageHeader
        title="Packages & rates"
        description="Prices per service area and training type. Leave a cell empty if that package is not offered there."
      />
      <div className="border-surface-700 mb-4 flex w-fit rounded-full border p-0.5" role="tablist" aria-label="Training type">
        {TYPES.map((t) => (
          <Button
            key={t.value}
            role="tab"
            aria-selected={trainingType === t.value}
            size="sm"
            variant={trainingType === t.value ? 'primary' : 'ghost'}
            onClick={() => {
              setSaved(false);
              setTrainingType(t.value);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {loading && !grid ? (
        <div className="bg-surface-900 h-96 animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : grid ? (
        <form onSubmit={onSave} noValidate className="flex flex-col gap-4">
          <FormAlert>{invalid || save.error?.message || toggle.error?.message}</FormAlert>
          {saved ? (
            <p role="status" className="text-accent-300 text-sm">
              Rates saved.
            </p>
          ) : null}
          <div className="border-surface-700 overflow-x-auto rounded-xl border">
            <table className="min-w-[720px] w-full text-sm">
              <caption className="sr-only">{TYPES.find((t) => t.value === trainingType).label} rates</caption>
              <thead className="bg-surface-900 text-ink-400 text-left text-xs">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Service area
                  </th>
                  {grid.packages.map((p) => (
                    <th key={p.id} scope="col" className="px-3 py-3 font-medium">
                      <span className="text-ink-100 block">{p.name}</span>
                      <span className="block">
                        {p.sessions} × {p.hoursPerSession} h
                      </span>
                      <label className="mt-1 flex items-center gap-1 font-normal">
                        <input
                          type="checkbox"
                          checked={p.isActive}
                          onChange={() => flip('package', p.id, !p.isActive)}
                          className="accent-accent-500"
                        />
                        On sale
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-surface-800 divide-y">
                {grid.areas.map((a) => (
                  <tr key={a.id} className={a.isActive ? '' : 'opacity-60'}>
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <span className="text-ink-100 block">{a.name}</span>
                      <label className="text-ink-500 flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={a.isActive}
                          onChange={() => flip('area', a.id, !a.isActive)}
                          className="accent-accent-500"
                        />
                        Serving this area
                      </label>
                    </th>
                    {grid.packages.map((p) => {
                      const k = key(p.id, a.id);
                      return (
                        <td key={p.id} className="px-3 py-2">
                          <input
                            aria-label={`${p.name} price in ${a.name}`}
                            inputMode="decimal"
                            placeholder="—"
                            value={cells[k] || ''}
                            onChange={(e) => setCells((c) => ({ ...c, [k]: e.target.value }))}
                            className="bg-surface-900 text-ink-100 border-surface-600 focus:border-accent-500 h-9 w-28 rounded-full border px-3 text-sm tabular-nums outline-none"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton size="md" loading={save.loading} loadingLabel="Saving…" disabled={!dirty.length}>
              Save rates
            </SubmitButton>
            {dirty.length ? <span className="text-ink-400 text-xs">{dirty.length} unsaved change(s)</span> : null}
          </div>
        </form>
      ) : null}
    </>
  );
}
