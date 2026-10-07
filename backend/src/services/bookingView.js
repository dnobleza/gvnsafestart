// How long an instructor may turn a system-completed session into a no-show.
const CORRECTION_WINDOW_MS = 24 * 3600000;

const toMoney = (value) => (value === null || value === undefined ? null : Number(value).toFixed(2));

const branchOf = (user) => {
  const branch = user && user.instructorProfile && user.instructorProfile.branch;
  return branch ? { id: branch.id, name: branch.name } : null;
};

const receiptNumber = (booking) => {
  const cash = (booking.payments || []).find((p) => p.status === 'PAID' && p.method === 'Cash');
  return cash ? cash.reference : null;
};

const lastAction = (booking) => {
  const latest = booking.history && booking.history[0];
  if (!latest) return null;
  return {
    action: latest.action,
    actorName: latest.changedBy ? latest.changedBy.fullName : null,
    actorRole: latest.changedByRole,
    at: latest.createdAt,
    reason: latest.reason,
  };
};

const packageSummary = (booking) => {
  const pkg = booking.clientPackage;
  if (!pkg) return null;
  return {
    id: pkg.id,
    name: pkg.packageName,
    sessionNumber: booking.sessionNumber,
    sessionsTotal: pkg.sessionsTotal,
    trainingType: pkg.trainingType,
    serviceArea: pkg.serviceArea,
    pickupAddress: pkg.pickupAddress,
    paymentMethod: pkg.paymentMethod,
    paymentStatus: pkg.paymentStatus,
    status: pkg.status,
    price: toMoney(pkg.price),
    amountPaid: toMoney(pkg.amountPaid),
    balance: toMoney(Math.max(0, Number(pkg.price) - Number(pkg.amountPaid))),
  };
};

const correctableUntil = (booking) =>
  booking.status === 'COMPLETED' && booking.autoCompleted && booking.autoCompletedAt
    ? new Date(booking.autoCompletedAt.getTime() + CORRECTION_WINDOW_MS)
    : null;

const isCashUnpaid = (booking) =>
  booking.status === 'COMPLETED' && booking.paymentMethod === 'CASH' && booking.paymentStatus !== 'PAID';

const base = (booking) => ({
  id: booking.id,
  lessonType: booking.lessonType,
  area: booking.area,
  scheduledAt: booking.scheduledAt,
  durationMinutes: booking.durationMinutes,
  endsAt: new Date(booking.scheduledAt.getTime() + booking.durationMinutes * 60000),
  status: booking.status,
  notes: booking.notes,
  cancelReason: booking.cancelReason,
  createdAt: booking.createdAt,
  paymentMethod: booking.paymentMethod,
  paymentStatus: booking.paymentStatus,
  price: toMoney(booking.price),
  paymentDueAt: booking.paymentDueAt,
  receiptNumber: receiptNumber(booking),
  payments: (booking.payments || []).map((p) => ({
    id: p.id,
    amount: toMoney(p.amount),
    currency: p.currency,
    status: p.status,
    method: p.method,
    provider: p.provider || null,
    paidAt: p.paidAt,
  })),
  instructor: booking.instructor
    ? { id: booking.instructor.id, fullName: booking.instructor.fullName, branch: branchOf(booking.instructor) }
    : null,
  lastAction: lastAction(booking),
  rated: Boolean(booking.rating),
  package: packageSummary(booking),
  autoCompleted: Boolean(booking.autoCompleted),
  autoCompletedAt: booking.autoCompletedAt || null,
  cashUnpaid: isCashUnpaid(booking),
});

const forAdmin = (booking) => ({
  ...base(booking),
  client: {
    id: booking.client.id,
    fullName: booking.client.fullName,
    email: booking.client.email,
    phone: booking.client.phone,
  },
});

const forInstructor = (booking) => {
  const until = correctableUntil(booking);
  return {
    ...base(booking),
    client: { id: booking.client.id, fullName: booking.client.fullName, phone: booking.client.phone },
    correctableUntil: until,
    canCorrectNoShow: Boolean(until && until.getTime() > Date.now()),
  };
};

const forClient = (booking) => ({
  ...base(booking),
  rating: booking.rating ? { stars: booking.rating.stars } : null,
});

const historyEntry = (row) => ({
  id: row.id,
  action: row.action,
  fromStatus: row.fromStatus,
  toStatus: row.toStatus,
  oldScheduledAt: row.oldScheduledAt,
  newScheduledAt: row.newScheduledAt,
  reason: row.reason,
  actor: row.changedBy ? { id: row.changedBy.id, fullName: row.changedBy.fullName } : null,
  actorRole: row.changedByRole,
  createdAt: row.createdAt,
});

module.exports = {
  CORRECTION_WINDOW_MS,
  correctableUntil,
  isCashUnpaid,
  toMoney,
  branchOf,
  forAdmin,
  forInstructor,
  forClient,
  historyEntry,
};
