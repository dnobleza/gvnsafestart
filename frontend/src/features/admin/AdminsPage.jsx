import { useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';

import { deactivateAdmin, resetAdminPassword } from '../../api/admin';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SelectField from '../../components/SelectField';
import StatusBadge from '../../components/StatusBadge';
import { useAuthStore } from '../../store/authStore';
import CreateAdminDialog from './CreateAdminDialog';
import { formatDate } from '../../utils/format';
import useAction from '../../hooks/useAction';
import { useAdmins } from './hooks/useAdminResources';
import useListParams from '../../hooks/useListParams';
import PageHeader from '../../components/PageHeader';
import TemporaryPasswordDialog from './TemporaryPasswordDialog';

const FILTER_KEYS = ['status'];
const STATUS_OPTIONS = [
  { value: '', label: 'Active' },
  { value: 'inactive', label: 'Deactivated' },
  { value: 'all', label: 'All' },
];

const CONFIRM = {
  deactivate: {
    title: 'Deactivate account',
    confirmLabel: 'Deactivate',
    busyLabel: 'Deactivating…',
    danger: true,
    body: (s) => `${s.fullName} will be signed out everywhere and will not be able to sign in again.`,
  },
  reset: {
    title: 'Reset password',
    confirmLabel: 'Reset password',
    busyLabel: 'Resetting…',
    danger: false,
    body: (s) =>
      `${s.fullName} will be signed out everywhere. A new temporary password is shown once, and they must change it when they next sign in.`,
  },
};

const runAdminAction = (kind, id) => (kind === 'deactivate' ? deactivateAdmin(id) : resetAdminPassword(id));

export default function AdminsPage() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { filters, page, setFilter, setPage } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useAdmins({ status: filters.status || 'active' }, page);
  const action = useAction(runAdminAction);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [reveal, setReveal] = useState(null);

  const openConfirm = (kind, account) => {
    action.reset();
    setConfirm({ kind, account });
  };

  const onConfirm = async () => {
    const { kind, account } = confirm;
    const result = await action.run(kind, account.id);
    if (!result.ok) return;
    setConfirm(null);
    if (kind === 'reset') {
      setReveal({
        title: 'New temporary password',
        name: account.fullName,
        email: account.email,
        password: result.data.temporaryPassword,
      });
    }
    refetch();
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (s) => (
        <div>
          <p className="text-ink-100">
            {s.fullName}
            {s.id === currentUserId ? <span className="text-ink-500 ml-2 text-xs">(you)</span> : null}
          </p>
          <p className="text-ink-500 text-xs">{s.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={s.isActive ? 'ACTIVE' : 'INACTIVE'} />
          {s.isActive && s.mustChangePassword ? (
            <span className="text-ink-500 text-xs">Temporary password</span>
          ) : null}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Added', render: (s) => formatDate(s.createdAt), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (s) =>
        s.isActive && s.id !== currentUserId ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => openConfirm('reset', s)} aria-label={`Reset password for ${s.fullName}`}>
              Reset password
            </Button>
            <Button size="sm" variant="danger" onClick={() => openConfirm('deactivate', s)} aria-label={`Deactivate ${s.fullName}`}>
              Deactivate
            </Button>
          </div>
        ) : null,
    },
  ];

  const copy = confirm ? CONFIRM[confirm.kind] : null;

  return (
    <>
      <PageHeader
        title="Admins"
        description="Accounts with full access to this dashboard."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon size={16} aria-hidden="true" />
            Add admin
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
        caption="Admin accounts"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No admin accounts match this filter."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />

      <CreateAdminDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={({ admin, temporaryPassword }) => {
          setCreating(false);
          setReveal({
            title: 'Admin account created',
            name: admin.fullName,
            email: admin.email,
            password: temporaryPassword,
          });
          refetch();
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
        {confirm ? copy.body(confirm.account) : null}
      </ConfirmDialog>
      <TemporaryPasswordDialog reveal={reveal} onClose={() => setReveal(null)} />
    </>
  );
}
