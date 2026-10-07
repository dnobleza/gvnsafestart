import { Link } from 'react-router-dom';

import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import useListParams from '../../hooks/useListParams';
import { formatDateTime } from '../../utils/format';
import { useClients } from './hooks/useInstructorResources';

const NO_FILTERS = [];

const columns = [
  {
    key: 'fullName',
    header: 'Client',
    render: (c) => (
      <Link to={`/instructor/clients/${c.id}`} className="text-ink-100 hover:text-accent-300 font-medium">
        {c.fullName}
      </Link>
    ),
  },
  { key: 'phone', header: 'Phone', render: (c) => c.phone || <span className="text-ink-500">—</span> },
  { key: 'sessions', header: 'Sessions', className: 'tabular-nums', render: (c) => c.sessions },
  { key: 'last', header: 'Latest session', className: 'whitespace-nowrap', render: (c) => formatDateTime(c.lastSessionAt) },
];

export default function ClientsPage() {
  const { page, setPage } = useListParams(NO_FILTERS);
  const { data, meta, loading, error, refetch } = useClients(page);

  return (
    <>
      <PageHeader title="Clients" description="Everyone you have had a session with." />
      <DataTable
        caption="My clients"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyMessage="No clients yet. They appear here once a session is booked with you."
      />
      <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
    </>
  );
}
