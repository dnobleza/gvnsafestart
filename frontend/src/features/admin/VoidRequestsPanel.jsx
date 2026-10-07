import { useState } from 'react';

import { reviewVoidRequest } from '../../api/admin';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import useAction from '../../hooks/useAction';
import { formatDateTime, formatMoney } from '../../utils/format';
import { useVoidRequests } from './hooks/useAdminResources';

const PENDING_ONLY = { status: 'PENDING' };

export default function VoidRequestsPanel({ onReviewed }) {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useVoidRequests(PENDING_ONLY, page);
  const review = useAction(reviewVoidRequest);
  const [busyId, setBusyId] = useState(null);

  const decide = async (id, decision) => {
    setBusyId(id);
    const result = await review.run(id, decision);
    setBusyId(null);
    if (result.ok) {
      refetch();
      onReviewed?.();
    }
  };

  const columns = [
    { key: 'createdAt', header: 'Requested', className: 'whitespace-nowrap', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'who',
      header: 'Instructor · Client',
      render: (r) => (
        <div>
          <p className="text-ink-100">{r.requestedBy?.fullName}</p>
          <p className="text-ink-500 text-xs">{r.payment.client?.fullName}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', className: 'tabular-nums', render: (r) => formatMoney(r.payment.amount, r.payment.currency) },
    { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-[20rem]">{r.reason}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" disabled={busyId === r.id} onClick={() => decide(r.id, 'APPROVE')}>
            Approve void
          </Button>
          <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => decide(r.id, 'REJECT')}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold tracking-tight">Cash void requests</h2>
      <p className="text-ink-400 mb-3 text-sm">Approving marks the cash payment as voided.</p>
      {review.error ? <p className="text-danger-300 mb-3 text-sm">{review.error.message}</p> : null}
      <DataTable
        caption="Pending void requests"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No void requests waiting."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </section>
  );
}
