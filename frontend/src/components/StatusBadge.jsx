const TONES = {
  accent: 'border-accent-500/50 bg-accent-500/10 text-accent-300',
  neutral: 'border-surface-600 bg-surface-800 text-ink-100',
  danger: 'border-danger-500/60 bg-danger-500/10 text-danger-300',
  muted: 'border-surface-700 bg-transparent text-ink-500',
};

const STATUS_TONE = {
  PAID: 'accent',
  APPROVED: 'accent',
  CONFIRMED: 'accent',
  ACTIVE: 'accent',
  COMPLETED: 'neutral',
  PENDING: 'neutral',
  FAILED: 'danger',
  NO_SHOW: 'danger',
  AWAITING_CASH: 'neutral',
  RESERVED: 'neutral',
  UNPAID: 'danger',
  CANCELLED: 'muted',
  REFUNDED: 'muted',
  INACTIVE: 'muted',
  VOIDED: 'muted',
  REJECTED: 'muted',
};

const toLabel = (status) => status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');

const LABEL_OVERRIDES = { NO_SHOW: 'No-show', AWAITING_CASH: 'Cash due', UNPAID: 'Unpaid' };

export default function StatusBadge({ status }) {
  const tone = TONES[STATUS_TONE[status] || 'neutral'];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {LABEL_OVERRIDES[status] || toLabel(status)}
    </span>
  );
}
