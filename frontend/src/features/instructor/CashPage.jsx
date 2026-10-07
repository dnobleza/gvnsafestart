import { useState } from 'react';

import { requestVoid } from '../../api/instructor';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import useListParams from '../../hooks/useListParams';
import { formatDateTime, formatMoney } from '../../utils/format';
import { useCash } from './hooks/useInstructorResources';
import ReasonDialog from '../../components/ReasonDialog';

const FILTER_KEYS = ['from', 'to'];

const VOID_LABEL = { PENDING: 'Void requested', APPROVED: 'Void approved', REJECTED: 'Void rejected' };

export default function CashPage() {
  const { filters, page, setFilter, setPage, resetFilters } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useCash(filters, page);
  const [voiding, setVoiding] = useState(null);

  const columns = [
    { key: 'paidAt', header: 'Recorded', className: 'whitespace-nowrap', render: (p) => formatDateTime(p.paidAt) },
    {
      key: 'client',
      header: 'Client',
      render: (p) => (
        <div>
          <p className="text-ink-100">{p.client?.fullName}</p>
          {p.booking ? <p className="text-ink-500 text-xs">{formatDateTime(p.booking.scheduledAt)}</p> : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'tabular-nums',
      render: (p) => (
        <div>
          <p>{formatMoney(p.amount, p.currency)}</p>
          {p.receiptNumber ? <p className="text-ink-500 text-xs">Receipt {p.receiptNumber}</p> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div>
          <StatusBadge status={p.status} />
          {p.voidRequest ? (
            <p className="text-ink-500 mt-1 text-xs">
              {VOID_LABEL[p.voidRequest.status]}: {p.voidRequest.reason}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (p) =>
        p.status === 'PAID' && p.voidRequest?.status !== 'PENDING' ? (
          <Button size="sm" variant="secondary" onClick={() => setVoiding(p)}>
            Request void
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="My cash" description="Cash you recorded, and the status of any void requests." />
      <FilterBar filters={filters} setFilter={setFilter} onReset={resetFilters} withClient={false} />
      <DataTable
        caption="Cash records"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No cash recorded yet."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
      {voiding ? (
        <ReasonDialog
          title="Request a void"
          intro={`${formatMoney(voiding.amount)} from ${voiding.client?.fullName}. An admin reviews every void request.`}
          submitLabel="Send request"
          busyLabel="Sending…"
          request={(reason) => requestVoid(voiding.id, reason)}
          onClose={() => setVoiding(null)}
          onDone={() => {
            setVoiding(null);
            refetch();
          }}
        />
      ) : null}
    </>
  );
}
