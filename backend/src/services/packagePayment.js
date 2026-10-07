const clientPackageRepository = require('../repositories/clientPackage.repository');
const bookingRepository = require('../repositories/booking.repository');

// Each session booking mirrors its package's payment state, so instructor
// screens, cash actions and the sweeper keep working per session.
const SESSION_STATUS = {
  UNPAID: 'UNPAID',
  AWAITING_CASH: 'AWAITING_CASH',
  RESERVED: 'AWAITING_CASH',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
};

const money = (n) => Math.round(Number(n) * 100) / 100;

const balanceOf = (pkg) => Math.max(0, money(Number(pkg.price) - Number(pkg.amountPaid)));

// What "Pay online" charges right now: the rest of the reservation fee until
// it is covered, then the remaining balance.
const amountDue = (pkg) => {
  const paid = Number(pkg.amountPaid);
  const reservation = Number(pkg.reservationFee);
  if (paid < reservation) return money(reservation - paid);
  return balanceOf(pkg);
};

const statusFor = (pkg, amountPaid) => {
  if (amountPaid >= Number(pkg.price)) return 'PAID';
  if (amountPaid > 0) return 'RESERVED';
  return pkg.paymentMethod === 'ONLINE' ? 'UNPAID' : 'AWAITING_CASH';
};

const syncSessions = (tx, pkg) =>
  bookingRepository.updateByPackage(
    pkg.id,
    {
      paymentMethod: pkg.paymentMethod,
      paymentStatus: SESSION_STATUS[pkg.paymentStatus],
      paymentDueAt: pkg.paymentStatus === 'UNPAID' ? pkg.paymentDueAt : null,
    },
    tx,
  );

const changePaid = async (tx, packageId, delta, extra = {}) => {
  await clientPackageRepository.lock(tx, packageId);
  const pkg = await clientPackageRepository.findById(packageId, tx);
  const amountPaid = Math.max(0, money(Number(pkg.amountPaid) + delta));
  const updated = await clientPackageRepository.update(
    packageId,
    {
      amountPaid: amountPaid.toFixed(2),
      paymentStatus: statusFor({ ...pkg, ...extra }, amountPaid),
      paymentDueAt: amountPaid > 0 ? null : pkg.paymentDueAt,
      ...extra,
    },
    tx,
  );
  await syncSessions(tx, updated);
  return updated;
};

const applyPayment = (tx, packageId, amount, extra) => changePaid(tx, packageId, Number(amount), extra);

const reversePayment = (tx, packageId, amount) => changePaid(tx, packageId, -Number(amount));

module.exports = { SESSION_STATUS, balanceOf, amountDue, applyPayment, reversePayment, syncSessions };
