import { Link } from 'react-router-dom';

import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import StatusBadge from '../../components/StatusBadge';
import useListParams from '../../hooks/useListParams';
import { formatDateTime } from '../../utils/format';
import BookingActions from './BookingActions';
import { STATUS_OPTIONS } from './bookingRules';
import useBookingRefresh from '../../hooks/useBookingRefresh';
import { useMyBookings } from './hooks/useInstructorResources';

const FILTER_KEYS = ['from', 'to', 'status'];

export default function BookingsPage() {
  const { filters, page, setFilter, setPage, resetFilters } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useMyBookings(filters, page);
  useBookingRefresh(refetch);

  const columns = [
    {
      key: 'scheduledAt',
      header: 'Scheduled',
      className: 'whitespace-nowrap',
      render: (b) => (
        <Link to={`/instructor/bookings/${b.id}`} className="hover:text-accent-300 block">
          <span className="text-ink-100 block">{formatDateTime(b.scheduledAt)}</span>
          <span className="text-ink-500 block text-xs">{b.durationMinutes} min</span>
        </Link>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (b) => (
        <div>
          <p className="text-ink-100">{b.client.fullName}</p>
          <p className="text-ink-500 text-xs">
            {b.lessonType}
            {b.package ? ` · session ${b.package.sessionNumber} of ${b.package.sessionsTotal}` : ''}
          </p>
          {b.package ? <p className="text-ink-500 text-xs">Pickup: {b.package.pickupAddress}</p> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <div className="flex flex-wrap gap-1.5">
          <BookingStatusBadge booking={b} />
          {['CONFIRMED', 'COMPLETED'].includes(b.status) ? <StatusBadge status={b.paymentStatus} /> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (b) => <BookingActions booking={b} onDone={refetch} />,
    },
  ];

  return (
    <>
      <PageHeader title="Bookings" description="Confirm, reschedule, complete or cancel your sessions." />
      <FilterBar
        filters={filters}
        setFilter={setFilter}
        onReset={resetFilters}
        statusOptions={STATUS_OPTIONS}
        withClient={false}
      />
      <DataTable
        caption="My bookings"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No bookings match these filters."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
