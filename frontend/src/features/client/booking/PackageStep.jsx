import Button from '../../../components/Button';
import { formatMoney } from '../../../utils/format';
import { usePackages } from '../hooks/useClientResources';

const POPULAR = 'OPTION_2';

const sessionsText = (p) =>
  p.sessions === 1 ? `1 session of ${p.hoursPerSession} hours` : `${p.sessions} sessions of ${p.hoursPerSession} hours`;

export default function PackageStep({ booking, update, onBack, onNext }) {
  const packages = usePackages(booking.serviceArea.id, booking.trainingType);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Choose a package</h2>
        <p className="text-ink-400 text-sm">Prices for {booking.serviceArea.name}. Hours are actual driving time.</p>
      </div>
      {packages.loading && !packages.data ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-800 h-32 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : packages.error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{packages.error.message}</p>
          <Button variant="secondary" size="sm" onClick={packages.refetch}>
            Retry
          </Button>
        </div>
      ) : !packages.data?.length ? (
        <p className="text-ink-500 text-sm">No packages are on sale right now.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {packages.data.map((p) => {
            const available = p.price !== null;
            const selected = booking.packageDef?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!available}
                  aria-pressed={selected}
                  onClick={() => update({ packageDef: p, slot: null })}
                  className={
                    'flex h-full w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
                    (selected ? 'border-accent-500 bg-accent-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600')
                  }
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-ink-100 text-base font-semibold">{p.name}</span>
                    {p.code === POPULAR ? (
                      <span className="border-accent-500/50 text-accent-300 rounded-full border px-2 py-0.5 text-[11px]">
                        Most popular
                      </span>
                    ) : null}
                  </span>
                  <span className="text-ink-400 text-sm">
                    {sessionsText(p)} · {p.totalHours} hours total
                  </span>
                  {p.description ? <span className="text-ink-500 text-xs">{p.description}</span> : null}
                  <span className="text-ink-100 mt-auto text-lg font-semibold tabular-nums">
                    {available ? formatMoney(p.price) : 'Not yet available online in this area'}
                  </span>
                  {available ? (
                    <span className="text-ink-500 text-xs">Reserve with {formatMoney(p.reservationFee)}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!booking.packageDef}>
          Continue
        </Button>
      </div>
    </section>
  );
}
