const TONES = {
  accent: 'border-accent-500/50 bg-accent-500/10 text-accent-300',
  neutral: 'border-surface-600 bg-surface-800 text-ink-100',
  danger: 'border-danger-500/60 bg-danger-500/10 text-danger-300',
  muted: 'border-surface-700 bg-transparent text-ink-500',
  gray: 'border-surface-600 bg-surface-700/60 text-ink-400',
  pending: 'border-status-pending-500/50 bg-status-pending-500/10 text-status-pending-300',
  confirmed: 'border-status-confirmed-500/50 bg-status-confirmed-500/10 text-status-confirmed-300',
  completed: 'border-status-completed-500/50 bg-status-completed-500/10 text-status-completed-300',
};

const STATUS_TONE = {
  PAID: 'accent',
  APPROVED: 'accent',
  ACTIVE: 'accent',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  NO_SHOW: 'gray',
  CANCELLED: 'danger',
  FAILED: 'danger',
  AWAITING_CASH: 'neutral',
  RESERVED: 'neutral',
  UNPAID: 'danger',
  REFUNDED: 'muted',
  INACTIVE: 'muted',
  VOIDED: 'muted',
  REJECTED: 'muted',
};

const toLabel = (status) => status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');

const LABEL_OVERRIDES = { NO_SHOW: 'No-show', AWAITING_CASH: 'Cash due', UNPAID: 'Unpaid' };

export default function StatusBadge({ status, tag, tagTitle }) {
  const tone = TONES[STATUS_TONE[status] || 'neutral'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
      title={tagTitle}
    >
      {LABEL_OVERRIDES[status] || toLabel(status)}
      {tag ? (
        <span className="rounded-full bg-current/15 px-1.5 text-[10px] leading-4 font-semibold tracking-wide uppercase">
          {tag}
          {tagTitle ? <span className="sr-only">: {tagTitle}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
