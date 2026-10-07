import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import StatCard from '../../components/StatCard';
import Stars from '../../components/Stars';
import useListParams from '../../hooks/useListParams';
import { formatDate } from '../../utils/format';
import { useRatings } from './hooks/useInstructorResources';

const NO_FILTERS = [];

function Breakdown({ summary }) {
  return (
    <div className="border-surface-700 bg-surface-900 rounded-xl border p-5">
      <p className="text-ink-400 mb-3 text-sm">Star breakdown</p>
      <ul className="flex flex-col gap-2">
        {summary.breakdown.map(({ stars, count }) => {
          const pct = summary.count ? Math.round((count / summary.count) * 100) : 0;
          return (
            <li key={stars} className="flex items-center gap-3 text-xs">
              <span className="text-ink-400 w-6 tabular-nums">{stars}★</span>
              <span className="bg-surface-800 h-2 flex-1 overflow-hidden rounded-full">
                <span className="bg-accent-500 block h-full rounded-full" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-ink-400 w-8 text-right tabular-nums">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const columns = [
  { key: 'stars', header: 'Rating', render: (r) => <Stars value={r.stars} /> },
  { key: 'comment', header: 'Comment', render: (r) => r.comment || <span className="text-ink-500">No comment</span> },
  { key: 'sessionDate', header: 'Session', className: 'whitespace-nowrap', render: (r) => formatDate(r.sessionDate) },
];

export default function RatingsPage() {
  const { page, setPage } = useListParams(NO_FILTERS);
  const { data, meta, loading, error, refetch } = useRatings(page);
  const summary = meta?.summary;

  return (
    <>
      <PageHeader title="Ratings" description="What clients said after their sessions. Ratings are anonymous." />
      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
        <StatCard
          label="Average"
          value={summary ? (summary.average === null ? '—' : summary.average.toFixed(1)) : null}
          hint={summary?.isNew ? 'Shown to clients as "New" until you have 3 ratings' : null}
          loading={loading && !summary}
          error={error}
        />
        <StatCard label="Ratings" value={summary?.count} loading={loading && !summary} error={error} />
        {summary ? <Breakdown summary={summary} /> : <div className="bg-surface-900 rounded-xl" />}
      </div>
      <DataTable
        caption="Ratings"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No ratings yet."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
