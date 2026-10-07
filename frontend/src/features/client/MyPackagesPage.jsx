import { Link } from 'react-router-dom';

import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import useListParams from '../../hooks/useListParams';
import { formatDate, formatMoney } from '../../utils/format';
import { useMyPackages } from './hooks/useClientResources';

const NO_FILTERS = [];

const columns = [
  {
    key: 'name',
    header: 'Package',
    render: (p) => (
      <Link to={`/client/packages/${p.id}`} className="hover:text-accent-300 block">
        <span className="text-ink-100 block font-medium">{p.name}</span>
        <span className="text-ink-500 block text-xs">
          {p.serviceArea.name} · bought {formatDate(p.createdAt)}
        </span>
      </Link>
    ),
  },
  {
    key: 'sessions',
    header: 'Sessions',
    className: 'whitespace-nowrap tabular-nums',
    render: (p) => `${p.sessionsUsed} of ${p.sessionsTotal} booked`,
  },
  {
    key: 'payment',
    header: 'Payment',
    render: (p) => (
      <div>
        <StatusBadge status={p.paymentStatus} />
        {Number(p.balance) > 0 ? <p className="text-ink-500 mt-1 text-xs">Balance {formatMoney(p.balance)}</p> : null}
      </div>
    ),
  },
  { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    className: 'text-right',
    render: (p) => (
      <Button size="sm" variant={p.canBookNext || p.canPay ? 'primary' : 'secondary'} to={`/client/packages/${p.id}`}>
        {p.canBookNext ? 'Book next session' : p.canPay ? 'Pay' : 'View'}
      </Button>
    ),
  },
];

export default function MyPackagesPage() {
  const { page, setPage } = useListParams(NO_FILTERS);
  const { data, meta, loading, error, refetch } = useMyPackages(page);

  return (
    <>
      <PageHeader
        title="My packages"
        actions={
          <Button size="sm" to="/client/book">
            Buy a package
          </Button>
        }
      />
      <DataTable
        caption="My packages"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="You have not bought a package yet."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
