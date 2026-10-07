import { useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';

import { updateBranch } from '../../api/admin';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SelectField from '../../components/SelectField';
import StatusBadge from '../../components/StatusBadge';
import BranchFormDialog from './BranchFormDialog';
import { formatDate } from '../../utils/format';
import useAction from '../../hooks/useAction';
import { useBranches } from './hooks/useAdminResources';
import useListParams from '../../hooks/useListParams';
import PageHeader from '../../components/PageHeader';

const FILTER_KEYS = ['status'];
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const setActive = ({ id, isActive }) => updateBranch(id, { isActive });

export default function BranchesPage() {
  const { filters, page, setFilter, setPage } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useBranches({ status: filters.status || 'all' }, page);
  const toggle = useAction(setActive);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const onConfirm = async () => {
    const result = await toggle.run({ id: confirm.id, isActive: !confirm.isActive });
    if (!result.ok) return;
    setConfirm(null);
    refetch();
  };

  const columns = [
    {
      key: 'name',
      header: 'Branch',
      render: (b) => (
        <div>
          <p className="text-ink-100">{b.name}</p>
          {b.latitude == null ? <p className="text-ink-500 text-xs">No map position yet</p> : null}
        </div>
      ),
    },
    { key: 'instructorCount', header: 'Instructors', className: 'tabular-nums', render: (b) => b.instructorCount },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'createdAt', header: 'Added', render: (b) => formatDate(b.createdAt), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setForm({ branch: b })} aria-label={`Edit ${b.name}`}>
            Edit
          </Button>
          <Button
            size="sm"
            variant={b.isActive ? 'danger' : 'secondary'}
            onClick={() => {
              toggle.reset();
              setConfirm(b);
            }}
            aria-label={`${b.isActive ? 'Deactivate' : 'Activate'} ${b.name}`}
          >
            {b.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Branches"
        description="Locations instructors can be assigned to."
        actions={
          <Button onClick={() => setForm({ branch: null })}>
            <PlusIcon size={16} aria-hidden="true" />
            Add branch
          </Button>
        }
      />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Show"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          options={STATUS_OPTIONS}
        />
      </div>
      <DataTable
        caption="Branches"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No branches yet. Add one so instructors can be assigned."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />

      <BranchFormDialog
        key={form?.branch?.id ?? 'new'}
        open={Boolean(form)}
        branch={form?.branch}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          refetch();
        }}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.isActive ? 'Deactivate branch' : 'Activate branch'}
        confirmLabel={confirm?.isActive ? 'Deactivate' : 'Activate'}
        busyLabel="Saving…"
        danger={confirm?.isActive}
        loading={toggle.loading}
        error={toggle.error}
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      >
        {confirm?.isActive
          ? `${confirm.name} will no longer be offered when assigning instructors. Instructors already there keep it.`
          : confirm
            ? `${confirm.name} will be available again when assigning instructors.`
            : null}
      </ConfirmDialog>
    </>
  );
}
