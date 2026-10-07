import { useState } from 'react';

import { setRatingHidden } from '../../api/admin';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import SelectField from '../../components/SelectField';
import Stars from '../../components/Stars';
import useAction from '../../hooks/useAction';
import useListParams from '../../hooks/useListParams';
import { formatDate } from '../../utils/format';
import { useBranchOptions, useInstructorOptions, useRatings } from './hooks/useAdminResources';

const FILTER_KEYS = ['instructorId', 'branchId'];

export default function RatingsPage() {
  const { filters, page, setFilter, setPage } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useRatings(filters, page);
  const instructors = useInstructorOptions();
  const branches = useBranchOptions();
  const toggle = useAction(setRatingHidden);
  const [busyId, setBusyId] = useState(null);

  const flip = async (rating) => {
    setBusyId(rating.id);
    const result = await toggle.run(rating.id, !rating.isHidden);
    setBusyId(null);
    if (result.ok) refetch();
  };

  const columns = [
    { key: 'createdAt', header: 'Date', className: 'whitespace-nowrap', render: (r) => formatDate(r.createdAt) },
    {
      key: 'who',
      header: 'Client → Instructor',
      render: (r) => (
        <div>
          <p className="text-ink-100">{r.client?.fullName}</p>
          <p className="text-ink-500 text-xs">
            {r.instructor.fullName}
            {r.instructor.branch ? ` · ${r.instructor.branch.name}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'stars', header: 'Rating', render: (r) => <Stars value={r.stars} /> },
    {
      key: 'comment',
      header: 'Comment',
      render: (r) => (
        <div className="max-w-[24rem]">
          {r.comment ? (
            <p className={r.isHidden ? 'text-ink-500 line-through' : ''}>{r.comment}</p>
          ) : (
            <span className="text-ink-500">No comment</span>
          )}
          {r.isHidden ? <p className="text-ink-500 text-xs">Hidden from the instructor</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (r) =>
        r.comment ? (
          <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => flip(r)}>
            {r.isHidden ? 'Unhide' : 'Hide'}
          </Button>
        ) : null,
    },
  ];

  const averages = meta?.instructors || [];

  return (
    <>
      <PageHeader
        title="Ratings"
        description="Every rating with the client's name. Hiding a comment keeps its stars in the average."
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
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
            ...(branches.data || []).map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      </div>

      {averages.length ? (
        <section className="mb-6">
          <h2 className="text-ink-400 mb-2 text-sm">Average per instructor</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {averages.map((i) => (
              <li key={i.id} className="border-surface-700 bg-surface-900 rounded-xl border p-4">
                <p className="text-ink-100 text-sm font-medium">{i.fullName}</p>
                <p className="text-ink-500 text-xs">{i.branch?.name || 'No branch'}</p>
                <p className="text-accent-300 mt-2 text-xl font-semibold tabular-nums">{i.display}</p>
                <p className="text-ink-500 text-xs">
                  {i.count} rating{i.count === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {toggle.error ? <p className="text-danger-300 mb-3 text-sm">{toggle.error.message}</p> : null}
      <DataTable
        caption="Ratings"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No ratings match these filters."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
