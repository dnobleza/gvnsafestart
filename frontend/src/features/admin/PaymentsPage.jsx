import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import FilterBar from '../../components/FilterBar';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';
import { usePayments } from './hooks/useAdminResources';
import useListParams from '../../hooks/useListParams';
import PageHeader from '../../components/PageHeader';
import VoidRequestsPanel from './VoidRequestsPanel';

const FILTER_KEYS = ['from', 'to', 'client', 'status'];
const STATUSES = ['PAID', 'PENDING', 'FAILED', 'REFUNDED', 'VOIDED'];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
];

const COLUMNS = [
  { key: 'createdAt', header: 'Date', render: (p) => formatDateTime(p.createdAt), className: 'whitespace-nowrap' },
  {
    key: 'client',
    header: 'Client',
    render: (p) => (
      <div>
        <p className="text-ink-100">{p.client?.fullName}</p>
        <p className="text-ink-500 text-xs">{p.client?.email}</p>
      </div>
    ),
  },
  {
    key: 'booking',
    header: 'Booking',
    render: (p) =>
      p.booking ? (
        <div>
          <p>{p.booking.lessonType}</p>
          <p className="text-ink-500 text-xs">{formatDate(p.booking.scheduledAt)}</p>
        </div>
      ) : (
        <span className="text-ink-500">—</span>
      ),
  },
  { key: 'method', header: 'Method', render: (p) => p.method || '—' },
  { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  {
    key: 'amount',
    header: 'Amount',
    className: 'text-right tabular-nums whitespace-nowrap',
    render: (p) => formatMoney(p.amount, p.currency),
  },
];

function Totals({ totals, loading }) {
  const items = [
    { label: 'All payments', value: totals?.overall },
    ...STATUSES.map((s) => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: totals?.byStatus?.[s] })),
  ];

  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Payment totals">
      {items.map(({ label, value }) => (
        <div key={label} className="border-surface-700 bg-surface-900 rounded-xl border px-4 py-3">
          <dt className="text-ink-400 text-xs">{label}</dt>
          <dd className="mt-1">
            {loading && !totals ? (
              <span className="bg-surface-700 block h-6 w-20 animate-pulse rounded-xl" />
            ) : (
              <>
                <span className="text-ink-100 block text-lg font-semibold tabular-nums">
                  {formatMoney(value?.amount ?? 0)}
                </span>
                <span className="text-ink-500 text-xs tabular-nums">{value?.count ?? 0} payments</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function PaymentsPage() {
  const { filters, page, setFilter, setPage, resetFilters } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = usePayments(filters, page);

  return (
    <>
      <PageHeader title="Payments" description="Totals reflect the filters below." />
      <VoidRequestsPanel onReviewed={refetch} />
      <Totals totals={meta?.totals} loading={loading} />
      <FilterBar filters={filters} setFilter={setFilter} onReset={resetFilters} statusOptions={STATUS_OPTIONS} />
      <DataTable
        caption="Payments"
        columns={COLUMNS}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No payments match these filters."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
