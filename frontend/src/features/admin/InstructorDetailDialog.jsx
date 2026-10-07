import Button from '../../components/Button';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { formatAddress, formatDate } from '../../utils/format';
import { useInstructor } from './hooks/useAdminResources';

function Row({ label, children }) {
  return (
    <div className="border-surface-800 grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[8rem_1fr]">
      <dt className="text-ink-500 text-sm">{label}</dt>
      <dd className="text-ink-100 text-sm">{children}</dd>
    </div>
  );
}

export default function InstructorDetailDialog({ instructorId, onClose, onEdit }) {
  const { data, loading, error, refetch } = useInstructor(instructorId);
  const instructor = data?.instructor;

  return (
    <Modal
      open={Boolean(instructorId)}
      title={instructor?.fullName || 'Instructor'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onEdit(instructor)} disabled={!instructor}>
            Edit
          </Button>
        </>
      }
    >
      {loading && !instructor ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-700 h-5 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : instructor ? (
        <dl>
          <Row label="Email">{instructor.email}</Row>
          <Row label="Location">{instructor.branch?.name || <span className="text-ink-500">Not assigned</span>}</Row>
          <Row label="Address">{formatAddress(instructor.address) || <span className="text-ink-500">Not on file</span>}</Row>
          <Row label="Status">
            <StatusBadge status={instructor.isActive ? 'ACTIVE' : 'INACTIVE'} />
          </Row>
          <Row label="Added">{formatDate(instructor.createdAt)}</Row>
        </dl>
      ) : null}
    </Modal>
  );
}
