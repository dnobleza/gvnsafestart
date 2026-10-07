import { Link, useSearchParams } from 'react-router-dom';

import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { formatDateTime } from '../../utils/format';
import { useMyBookings } from './hooks/useClientResources';

const TABS = [
  ['upcoming', 'Upcoming'],
  ['past', 'Past'],
  ['cancelled', 'Cancelled'],
];

const EMPTY = {
  upcoming: 'No upcoming bookings.',
  past: 'No past sessions yet.',
  cancelled: 'No cancelled bookings.',
};

const columns = [
  {
    key: 'scheduledAt',
    header: 'When',
    className: 'whitespace-nowrap',
    render: (b) => (
      <Link to={`/client/bookings/${b.id}`} className="text-ink-100 hover:text-accent-300">
        {formatDateTime(b.scheduledAt)}
      </Link>
    ),
  },
  {
    key: 'instructor',
    header: 'Lesson',
    render: (b) => (
      <div>
        <p className="text-ink-100">{b.lessonType}</p>
        <p className="text-ink-500 text-xs">{b.instructor?.fullName || 'Instructor to be assigned'}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (b) => (
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status={b.status} />
        {b.status !== 'CANCELLED' ? <StatusBadge status={b.paymentStatus} /> : null}
      </div>
    ),
  },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    className: 'text-right',
    render: (b) => (
      <Button size="sm" variant={b.canRate || b.canPay ? 'primary' : 'secondary'} to={`/client/bookings/${b.id}`}>
        {b.canRate ? 'Rate' : b.canPay && b.paymentMethod === 'ONLINE' ? 'Pay now' : 'View'}
      </Button>
    ),
  },
];

export default function MyBookingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'upcoming';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, meta, loading, error, refetch } = useMyBookings(tab, page);

  return (
    <>
      <PageHeader
        title="My bookings"
        actions={
          <Button size="sm" to="/client/book">
            Book a lesson
          </Button>
        }
      />
      <div className="border-surface-700 mb-4 flex w-fit rounded-full border p-0.5" role="tablist" aria-label="Bookings">
        {TABS.map(([key, label]) => (
          <Button
            key={key}
            role="tab"
            aria-selected={tab === key}
            size="sm"
            variant={tab === key ? 'primary' : 'ghost'}
            onClick={() => setParams({ tab: key })}
          >
            {label}
          </Button>
        ))}
      </div>
      <DataTable
        caption="My bookings"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage={EMPTY[tab]}
      />
      <Pagination meta={meta} onPageChange={(p) => setParams({ tab, page: String(p) })} disabled={loading} />
    </>
  );
}
