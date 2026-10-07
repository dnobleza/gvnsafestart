import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import { formatAddress } from '../utils/format';
import useMyProfile from '../features/instructor/hooks/useMyProfile';

function Row({ label, children }) {
  return (
    <div className="border-surface-800 grid grid-cols-[8rem_1fr] gap-3 border-b py-3 last:border-0">
      <dt className="text-ink-500 text-sm">{label}</dt>
      <dd className="text-ink-100 text-sm">{children}</dd>
    </div>
  );
}

export default function InstructorProfilePage() {
  const { data, loading, error, refetch } = useMyProfile();
  const profile = data?.profile;

  return (
    <>
      <PageHeader title="My profile" description="Your instructor details. Ask an admin if anything needs to change." />
      <section className="border-surface-700 bg-surface-900 max-w-2xl rounded-xl border p-5">
        {loading && !profile ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-800 h-10 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex items-center gap-3">
            <p className="text-danger-300 text-sm">{error.message}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        ) : profile ? (
          <dl>
            <Row label="Name">{profile.fullName}</Row>
            <Row label="Email">{profile.email}</Row>
            <Row label="Branch">{profile.branch?.name || <span className="text-ink-500">Not assigned yet</span>}</Row>
            <Row label="Address">{formatAddress(profile.address) || <span className="text-ink-500">Not on file</span>}</Row>
          </dl>
        ) : null}
        <div className="border-surface-800 mt-4 border-t pt-4">
          <Button variant="secondary" to="/change-password">
            Change password
          </Button>
        </div>
      </section>
    </>
  );
}
