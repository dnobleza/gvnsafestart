import { useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import SelectField from '../../components/SelectField';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import useBookingRefresh from '../../hooks/useBookingRefresh';
import useListParams from '../../hooks/useListParams';
import { describeAction, formatDateTime } from '../../utils/format';
import BookingActionDialog from './BookingActionDialog';
import { useBookings, useBranchOptions, useInstructorOptions } from './hooks/useAdminResources';

const FILTER_KEYS = ['from', 'to', 'client', 'status', 'instructorId', 'branchId', 'actionBy', 'completedBy'];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const ACTION_BY_OPTIONS = [
  { value: '', label: 'Anyone' },
  { value: 'INSTRUCTOR', label: 'Instructor' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'CLIENT', label: 'Client' },
];

const COMPLETED_BY_OPTIONS = [
  { value: '', label: 'Anyone' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'INSTRUCTOR', label: 'Instructor' },
  { value: 'ADMIN', label: 'Admin' },
];

// Mirrors the API's transition rules so only possible actions are offered; the
// API still rejects anything else with INVALID_BOOKING_TRANSITION.
const ACTIONS = {
  PENDING: ['approve', 'reschedule', 'cancel'],
  CONFIRMED: ['reschedule', 'cancel'],
};

const ACTION_LABEL = { approve: 'Confirm', reschedule: 'Reschedule', cancel: 'Cancel' };

export default function BookingsPage() {
  const { filters, page, setFilter, setPage, resetFilters } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useBookings(filters, page);
  useBookingRefresh(refetch);
  const instructors = useInstructorOptions();
  const branches = useBranchOptions();
  const [action, setAction] = useState(null);

  const columns = [
    {
      key: 'scheduledAt',
      header: 'Scheduled',
      className: 'whitespace-nowrap',
      render: (b) => (
        <Link to={`/admin/bookings/${b.id}`} className="hover:text-accent-300 block">
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
          <p className="text-ink-100">{b.client?.fullName}</p>
          <p className="text-ink-500 text-xs">{b.client?.email || b.client?.phone}</p>
        </div>
      ),
    },
    {
      key: 'lesson',
      header: 'Lesson',
      render: (b) => (
        <div>
          <p>{b.lessonType}</p>
          <p className="text-ink-500 text-xs">
            {b.instructor ? `${b.instructor.fullName}${b.instructor.branch ? ` · ${b.instructor.branch.name}` : ''}` : 'No instructor'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <div>
          <BookingStatusBadge booking={b} />
          {b.lastAction ? <p className="text-ink-500 mt-1 max-w-[18rem] text-xs">{describeAction(b.lastAction)}</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-2">
          {(ACTIONS[b.status] || []).map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant={kind === 'approve' ? 'primary' : kind === 'cancel' ? 'danger' : 'secondary'}
              onClick={() => setAction({ kind, booking: b })}
              aria-label={`${ACTION_LABEL[kind]} booking for ${b.client?.fullName}`}
            >
              {ACTION_LABEL[kind]}
            </Button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Bookings" description="Every booking, who touched it last, and when." />
      <FilterBar filters={filters} setFilter={setFilter} onReset={resetFilters} statusOptions={STATUS_OPTIONS} />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Instructor"
          value={filters.instructorId}
          onChange={(e) => setFilter('instructorId', e.target.value)}
          options={[
            { value: '', label: 'All instructors' },
            ...(instructors.data || []).map((i) => ({ value: i.id, label: i.fullName })),
          ]}
        />
        <SelectField
          label="Location"
          value={filters.branchId}
          onChange={(e) => setFilter('branchId', e.target.value)}
          options={[
            { value: '', label: 'All locations' },
            ...(branches.data || []).map((br) => ({ value: br.id, label: br.name })),
          ]}
        />
        <SelectField
          label="Last action by"
          value={filters.actionBy}
          onChange={(e) => setFilter('actionBy', e.target.value)}
          options={ACTION_BY_OPTIONS}
        />
        <SelectField
          label="Completed by"
          value={filters.completedBy}
          onChange={(e) => setFilter('completedBy', e.target.value)}
          options={COMPLETED_BY_OPTIONS}
        />
      </div>
      <DataTable
        caption="Bookings"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No bookings match these filters."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
      <BookingActionDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          refetch();
        }}
      />
    </>
  );
}
