export default function StatCard({ label, value, hint, loading, error }) {
  return (
    <div className="border-surface-700 bg-surface-900 rounded-xl border p-5">
      <p className="text-ink-400 text-sm">{label}</p>
      {loading ? (
        <div className="bg-surface-700 mt-3 h-8 w-24 animate-pulse rounded-xl" aria-hidden="true" />
      ) : error ? (
        <p className="text-danger-300 mt-3 text-sm">Could not load</p>
      ) : (
        <p className="text-ink-100 mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      )}
      {hint ? <p className="text-ink-500 mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
