import { useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';

import { deactivateInstructor, resetInstructorPassword } from '../../api/admin';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SelectField from '../../components/SelectField';
import StatusBadge from '../../components/StatusBadge';
import { formatDate } from '../../utils/format';
import useAction from '../../hooks/useAction';
import { useBranchOptions, useInstructors } from './hooks/useAdminResources';
import useListParams from '../../hooks/useListParams';
import InstructorDetailDialog from './InstructorDetailDialog';
import InstructorFormDialog from './InstructorFormDialog';
import PageHeader from '../../components/PageHeader';
import TemporaryPasswordDialog from './TemporaryPasswordDialog';

const FILTER_KEYS = ['status', 'branchId'];
const STATUS_OPTIONS = [
  { value: '', label: 'Active' },
  { value: 'inactive', label: 'Deactivated' },
  { value: 'all', label: 'All' },
];

const CONFIRM = {
  deactivate: {
    title: 'Deactivate instructor',
    confirmLabel: 'Deactivate',
    busyLabel: 'Deactivating…',
    danger: true,
    body: (i) => `${i.fullName} will be signed out everywhere and will not be able to sign in again.`,
  },
  reset: {
    title: 'Reset password',
    confirmLabel: 'Reset password',
    busyLabel: 'Resetting…',
    danger: false,
    body: (i) =>
      `${i.fullName} will be signed out everywhere. A new temporary password is shown once, and they must change it when they next sign in.`,
  },
};

const runInstructorAction = (kind, id) =>
  kind === 'deactivate' ? deactivateInstructor(id) : resetInstructorPassword(id);

export default function InstructorsPage() {
  const { filters, page, setFilter, setPage } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useInstructors(
    { status: filters.status || 'active', branchId: filters.branchId },
    page,
  );
  const branches = useBranchOptions();
  const action = useAction(runInstructorAction);
  const [form, setForm] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reveal, setReveal] = useState(null);

  const openConfirm = (kind, instructor) => {
    action.reset();
    setConfirm({ kind, instructor });
  };

  const onConfirm = async () => {
    const { kind, instructor } = confirm;
    const result = await action.run(kind, instructor.id);
    if (!result.ok) return;
    setConfirm(null);
    if (kind === 'reset') {
      setReveal({
        title: 'New temporary password',
        name: instructor.fullName,
        email: instructor.email,
        password: result.data.temporaryPassword,
      });
    }
    refetch();
  };

  const onSaved = (result) => {
    const wasCreate = form?.mode === 'create';
    setForm(null);
    if (wasCreate) {
      setReveal({
        title: 'Instructor account created',
        name: result.instructor.fullName,
        email: result.instructor.email,
        password: result.temporaryPassword,
      });
    }
    refetch();
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (i) => (
        <div>
          <p className="text-ink-100">{i.fullName}</p>
          <p className="text-ink-500 text-xs">{i.email}</p>
        </div>
      ),
    },
    { key: 'branch', header: 'Location', render: (i) => i.branch?.name || <span className="text-ink-500">—</span> },
    {
      key: 'status',
      header: 'Status',
      render: (i) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={i.isActive ? 'ACTIVE' : 'INACTIVE'} />
          {i.isActive && i.mustChangePassword ? <span className="text-ink-500 text-xs">Temporary password</span> : null}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Added', render: (i) => formatDate(i.createdAt), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (i) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setViewingId(i.id)} aria-label={`View ${i.fullName}`}>
            View
          </Button>
          {i.isActive ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => openConfirm('reset', i)} aria-label={`Reset password for ${i.fullName}`}>
                Reset password
              </Button>
              <Button size="sm" variant="danger" onClick={() => openConfirm('deactivate', i)} aria-label={`Deactivate ${i.fullName}`}>
                Deactivate
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const copy = confirm ? CONFIRM[confirm.kind] : null;
  const branchFilterOptions = [
    { value: '', label: 'All locations' },
    ...(branches.data || []).map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <>
      <PageHeader
        title="Instructors"
        description="Instructor accounts, their locations and sign-in access."
        actions={
          <Button onClick={() => setForm({ mode: 'create' })}>
            <PlusIcon size={16} aria-hidden="true" />
            Add instructor
          </Button>
        }
      />
      <div className="mb-4 grid max-w-xl gap-4 sm:grid-cols-2">
        <SelectField
          label="Show"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          options={STATUS_OPTIONS}
        />
        <SelectField
          label="Location"
          value={filters.branchId}
          onChange={(e) => setFilter('branchId', e.target.value)}
          options={branchFilterOptions}
        />
      </div>
      <DataTable
        caption="Instructor accounts"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No instructors match these filters."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />

      <InstructorFormDialog
        key={form?.instructor?.id ?? form?.mode ?? 'closed'}
        open={Boolean(form)}
        instructor={form?.instructor}
        onClose={() => setForm(null)}
        onSaved={onSaved}
      />
      <InstructorDetailDialog
        key={viewingId ?? 'none'}
        instructorId={viewingId}
        onClose={() => setViewingId(null)}
        onEdit={(instructor) => {
          setViewingId(null);
          setForm({ mode: 'edit', instructor });
        }}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={copy?.title}
        confirmLabel={copy?.confirmLabel}
        busyLabel={copy?.busyLabel}
        danger={copy?.danger}
        loading={action.loading}
        error={action.error}
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      >
        {confirm ? copy.body(confirm.instructor) : null}
      </ConfirmDialog>
      <TemporaryPasswordDialog reveal={reveal} onClose={() => setReveal(null)} />
    </>
  );
}
