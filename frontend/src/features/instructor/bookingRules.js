// Mirrors the API's transition rules so only possible actions are offered; the
// API still rejects anything else with INVALID_BOOKING_TRANSITION.
export const actionsFor = (booking, now = Date.now()) => {
  const started = now >= new Date(booking.scheduledAt).getTime();
  const cashDue = booking.paymentStatus === 'AWAITING_CASH';
  switch (booking.status) {
    case 'PENDING':
      return ['confirm', 'reschedule', 'cancel'];
    case 'CONFIRMED':
      return [
        ...(started ? ['complete', 'noShow'] : []),
        ...(cashDue ? ['cash'] : []),
        'reschedule',
        'cancel',
      ];
    case 'COMPLETED':
      return cashDue ? ['cash'] : [];
    default:
      return [];
  }
};

export const ACTION_LABEL = {
  confirm: 'Confirm',
  complete: 'Mark completed',
  noShow: 'Mark no-show',
  cash: 'Record cash',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
};

export const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
