import { Link, useSearchParams } from 'react-router-dom';

import BookingStatusBadge from '../../components/BookingStatusBadge';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import FilterBar from '../../components/FilterBar';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';
import { useCashUnpaid, usePayments } from './hooks/useAdminResources';
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

const CASH_UNPAID_COLUMNS = [
  {
    key: 'scheduledAt',
    header: 'Session',
    className: 'whitespace-nowrap',
    render: (b) => (
      <Link to={`/admin/bookings/${b.id}`} className="text-ink-100 hover:text-accent-300">
        {formatDateTime(b.scheduledAt)}
      </Link>
    ),
  },
  {
    key: 'client',
    header: 'Client',
    render: (b) => (
      <div>
        <p className="text-ink-100">{b.client?.fullName}</p>
        <p className="text-ink-500 text-xs">{b.client?.phone || b.client?.email}</p>
      </div>
    ),
  },
  { key: 'instructor', header: 'Instructor', render: (b) => b.instructor?.fullName || '—' },
  { key: 'status', header: 'Status', render: (b) => <BookingStatusBadge booking={b} /> },
  {
    key: 'due',
    header: 'Due',
    className: 'text-right tabular-nums whitespace-nowrap',
    render: (b) => {
      const due = b.package ? b.package.balance : b.price;
      return due ? formatMoney(due) : '—';
    },
  },
];

function CashUnpaidTab({ result, setPage }) {
  return (
    <>
      <p className="text-ink-400 mb-4 text-sm">
        Completed cash sessions with no cash recorded yet. The instructor records it from the booking.
      </p>
      <DataTable
        caption="Completed sessions with cash unpaid"
        columns={CASH_UNPAID_COLUMNS}
        rows={result.data}
        loading={result.loading}
        error={result.error}
        onRetry={result.refetch}
        emptyMessage="Every completed cash session has its cash recorded."
      />
      <Pagination meta={result.meta} onPageChange={setPage} disabled={result.loading} />
    </>
  );
}

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

const TABS = [
  ['payments', 'Payments'],
  ['cash-unpaid', 'Completed – cash unpaid'],
];

export default function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'cash-unpaid' ? 'cash-unpaid' : 'payments';
  const { filters, page, setFilter, setPage, resetFilters } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = usePayments(filters, page);
  const cashUnpaid = useCashUnpaid(tab === 'cash-unpaid' ? page : 1);
  const cashUnpaidCount = cashUnpaid.meta?.total;

  const selectTab = (next) => setParams(next === 'payments' ? {} : { tab: next }, { replace: true });

  return (
    <>
      <PageHeader title="Payments" description="Totals reflect the filters below." />
      <div role="tablist" aria-label="Payment views" className="border-surface-800 mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'border-accent-500 text-ink-100' : 'text-ink-400 hover:text-ink-100 border-transparent'
            }`}
          >
            {label}
            {key === 'cash-unpaid' && cashUnpaidCount ? (
              <span className="bg-danger-500/15 text-danger-300 rounded-full px-2 text-xs tabular-nums">{cashUnpaidCount}</span>
            ) : null}
          </button>
        ))}
      </div>
      {tab === 'cash-unpaid' ? (
        <CashUnpaidTab result={cashUnpaid} setPage={setPage} />
      ) : (
        <>
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
      )}
    </>
  );
}
