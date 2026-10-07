import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SelectField from '../../components/SelectField';
import { formatAddress, formatDateTime } from '../../utils/format';
import { useAuditLogs } from './hooks/useAdminResources';
import useListParams from '../../hooks/useListParams';
import PageHeader from '../../components/PageHeader';

const FILTER_KEYS = ['action'];

const ACTION_LABELS = {
  INSTRUCTOR_CREATED: 'Instructor created',
  INSTRUCTOR_UPDATED: 'Instructor updated',
  INSTRUCTOR_DEACTIVATED: 'Instructor deactivated',
  INSTRUCTOR_PASSWORD_RESET: 'Instructor password reset',
  ADMIN_CREATED: 'Admin created',
  ADMIN_DEACTIVATED: 'Admin deactivated',
  ADMIN_PASSWORD_RESET: 'Admin password reset',
  BRANCH_CREATED: 'Branch created',
  BRANCH_UPDATED: 'Branch updated',
  PASSWORD_CHANGED: 'Password changed',
  BOOKING_APPROVED: 'Booking approved',
  BOOKING_RESCHEDULED: 'Booking rescheduled',
  BOOKING_CANCELLED: 'Booking cancelled',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
];

const FIELD_LABELS = { fullName: 'name', branch: 'location', isActive: 'active' };

// Metadata values are plain values, {id, name} references, addresses, or
// {from, to} pairs under `changes`; each is flattened to one readable string.
const show = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'object') return String(value);
  if ('name' in value) return value.name;
  if ('street' in value) return formatAddress(value);
  return JSON.stringify(value);
};

const describe = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return '—';
  const { changes, ...rest } = metadata;
  const parts = Object.entries(rest).map(([k, v]) => `${FIELD_LABELS[k] || k}: ${show(v)}`);
  for (const [field, change] of Object.entries(changes || {})) {
    parts.push(`${FIELD_LABELS[field] || field}: ${show(change?.from)} → ${show(change?.to)}`);
  }
  return parts.length ? parts.join(' · ') : '—';
};

const COLUMNS = [
  { key: 'createdAt', header: 'When', render: (l) => formatDateTime(l.createdAt), className: 'whitespace-nowrap' },
  {
    key: 'actor',
    header: 'Who',
    render: (l) => (
      <div>
        <p className="text-ink-100">{l.actor?.fullName || l.actorEmail}</p>
        {l.actor ? <p className="text-ink-500 text-xs">{l.actorEmail}</p> : null}
      </div>
    ),
  },
  { key: 'action', header: 'What', render: (l) => ACTION_LABELS[l.action] || l.action },
  {
    key: 'target',
    header: 'Target',
    render: (l) => (
      <span className="text-ink-400 font-mono text-xs">
        {l.targetType} {l.targetId?.slice(0, 8)}
      </span>
    ),
  },
  {
    key: 'metadata',
    header: 'Details',
    render: (l) => <span className="text-ink-400 block max-w-[24rem] text-xs break-words">{describe(l.metadata)}</span>,
  },
];

export default function AuditLogPage() {
  const { filters, page, setFilter, setPage } = useListParams(FILTER_KEYS);
  const { data, meta, loading, error, refetch } = useAuditLogs(filters, page);

  return (
    <>
      <PageHeader title="Audit log" description="Every admin action, newest first." />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Action"
          value={filters.action}
          onChange={(e) => setFilter('action', e.target.value)}
          options={ACTION_OPTIONS}
        />
      </div>
      <DataTable
        caption="Audit log"
        columns={COLUMNS}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No admin actions recorded yet."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
