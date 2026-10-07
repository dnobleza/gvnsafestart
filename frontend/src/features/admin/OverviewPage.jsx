import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import StatCard from '../../components/StatCard';
import { formatMoney } from '../../utils/format';
import { useOverview } from './hooks/useAdminResources';
import PageHeader from '../../components/PageHeader';

export default function OverviewPage() {
  const { data, loading, error, refetch } = useOverview();
  const busy = loading && !data;

  const cards = [
    { label: "Today's bookings", value: data?.todaysBookings, hint: 'Lessons scheduled today' },
    {
      label: 'Revenue this month',
      value: data ? formatMoney(data.revenueThisMonth.amount, data.revenueThisMonth.currency) : null,
      hint: 'Paid payments only',
    },
    { label: 'Pending requests', value: data?.pendingBookings, hint: 'Bookings awaiting approval' },
    { label: 'Failed payments', value: data?.failedPayments, hint: 'Need follow-up with the client' },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="Today at a glance. Times are Philippine time."
        actions={
          <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
        }
      />
      {error ? (
        <div className="mb-4">
          <FormAlert>{error.message}</FormAlert>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} loading={busy} error={!data && error} />
        ))}
      </div>
    </>
  );
}
