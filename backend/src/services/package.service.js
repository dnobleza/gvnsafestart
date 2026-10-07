const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const packageRepository = require('../repositories/package.repository');
const clientPackageRepository = require('../repositories/clientPackage.repository');
const auditService = require('./audit.service');
const bookingAction = require('./bookingAction.service');
const onlinePayment = require('./onlinePayment.service');
const settingsService = require('./settings.service');
const emailService = require('./email');
const packagePayment = require('./packagePayment');
const { toMoney, branchOf } = require('./bookingView');

const HOUR_MS = 3600000;
const OPEN = ['PENDING', 'CONFIRMED'];
const TRAINING_LABEL = { OWN_CAR: 'own car', CAR_RENTAL: 'car rental' };

const notFound = () => AppError.notFound('PACKAGE_NOT_FOUND', 'Package not found');

const usedSessions = (pkg) => pkg.bookings.filter((b) => b.status !== 'CANCELLED').length;

const toView = (pkg, settings) => {
  const used = usedSessions(pkg);
  const remaining = Math.max(0, pkg.sessionsTotal - used);
  const active = pkg.status === 'ACTIVE';
  const due = packagePayment.amountDue(pkg);
  const nextOpen = pkg.bookings
    .filter((b) => OPEN.includes(b.status))
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  return {
    id: pkg.id,
    name: pkg.packageName,
    serviceArea: pkg.serviceArea,
    trainingType: pkg.trainingType,
    pickupAddress: pkg.pickupAddress,
    instructor: { id: pkg.instructor.id, fullName: pkg.instructor.fullName, branch: branchOf(pkg.instructor) },
    price: toMoney(pkg.price),
    reservationFee: toMoney(pkg.reservationFee),
    amountPaid: toMoney(pkg.amountPaid),
    balance: toMoney(packagePayment.balanceOf(pkg)),
    amountDue: toMoney(due),
    paymentMethod: pkg.paymentMethod,
    paymentStatus: pkg.paymentStatus,
    paymentDueAt: pkg.paymentDueAt,
    status: pkg.status,
    sessionsTotal: pkg.sessionsTotal,
    minutesPerSession: pkg.minutesPerSession,
    sessionsUsed: used,
    sessionsRemaining: remaining,
    sessionsCompleted: pkg.bookings.filter((b) => b.status === 'COMPLETED').length,
    sessions: pkg.bookings.map((b) => ({
      id: b.id,
      sessionNumber: b.sessionNumber,
      status: b.status,
      scheduledAt: b.scheduledAt,
      durationMinutes: b.durationMinutes,
    })),
    payments: pkg.payments
      .filter((p) => p.status !== 'PENDING')
      .map((p) => ({
        id: p.id,
        amount: toMoney(p.amount),
        method: p.method,
        status: p.status,
        receiptNumber: p.method === 'Cash' ? p.reference : null,
        paidAt: p.paidAt,
      })),
    canBookNext: active && remaining > 0 && pkg.paymentStatus !== 'UNPAID',
    canPay: active && due > 0,
    canCancel:
      active &&
      (!nextOpen || nextOpen.scheduledAt.getTime() - Date.now() >= settings.clientChangeCutoffHours * HOUR_MS),
    createdAt: pkg.createdAt,
  };
};

const view = async (pkg) => toView(pkg, await settingsService.get());

const requireOwned = async (actor, id, client) => {
  const pkg = await clientPackageRepository.findScoped(id, actor.id, client);
  if (!pkg) throw notFound();
  return pkg;
};

const purchase = async (actor, input, meta) => {
  const { packageId, serviceAreaId, trainingType, instructorId, scheduledAt, pickupAddress, paymentMethod } = input;
  const settings = await settingsService.get();
  const online = paymentMethod === 'ONLINE';

  const { pkg, emails } = await prisma.$transaction(async (tx) => {
    const definition = await packageRepository.findPackage(packageId, tx);
    if (!definition || !definition.isActive) throw notFound();
    const area = await packageRepository.findArea(serviceAreaId, tx);
    if (!area || !area.isActive) throw AppError.notFound('SERVICE_AREA_NOT_FOUND', 'Service area not found');
    const rate = await packageRepository.findRate({ packageId, serviceAreaId, trainingType }, tx);
    if (!rate) {
      throw AppError.badRequest(
        'RATE_NOT_SET',
        `${definition.name} is not yet available for ${area.name} (${TRAINING_LABEL[trainingType]}). Please contact us.`,
      );
    }

    const price = Number(rate.price);
    const created = await clientPackageRepository.create(
      {
        clientId: actor.id,
        packageId,
        serviceAreaId,
        trainingType,
        instructorId,
        packageName: definition.name,
        price: price.toFixed(2),
        sessionsTotal: definition.sessions,
        minutesPerSession: definition.hoursPerSession * 60,
        pickupAddress,
        paymentMethod,
        reservationFee: Math.min(Number(settings.reservationFee), price).toFixed(2),
        paymentStatus: online ? 'UNPAID' : 'AWAITING_CASH',
        paymentDueAt: online ? new Date(Date.now() + settings.onlinePaymentExpiryMinutes * 60000) : null,
      },
      tx,
    );

    const { emails: mails } = await bookingAction.createInTx(tx, {
      actor: { ...actor, meta },
      instructorId,
      scheduledAt,
      durationMinutes: created.minutesPerSession,
      lessonType: definition.name,
      area: area.name,
      notes: `Pickup: ${pickupAddress}`,
      paymentMethod,
      settings,
      packageFields: { clientPackageId: created.id, sessionNumber: 1, price: null, paymentDueAt: created.paymentDueAt },
    });

    await auditService.record(tx, {
      actor,
      action: 'PACKAGE_PURCHASED',
      targetType: 'CLIENT_PACKAGE',
      targetId: created.id,
      metadata: { packageId, serviceAreaId, trainingType, instructorId, price: price.toFixed(2), paymentMethod },
      meta,
    });
    return { pkg: await clientPackageRepository.findById(created.id, tx), emails: mails };
  });

  await emailService.sendAll(emails);
  let checkoutUrl = null;
  if (online) {
    // The booking already exists; if the provider is down the client retries
    // with "Pay reservation" before the deadline.
    const checkout = await onlinePayment.startPackageCheckout(actor, pkg.id, meta).catch(() => null);
    checkoutUrl = checkout ? checkout.checkoutUrl : null;
  }
  return { package: await view(await clientPackageRepository.findById(pkg.id)), checkoutUrl };
};

const bookNextSession = async (actor, id, { scheduledAt }, meta) => {
  const settings = await settingsService.get();
  const { pkg, emails } = await prisma.$transaction(async (tx) => {
    await clientPackageRepository.lock(tx, id);
    const current = await requireOwned(actor, id, tx);
    if (current.status !== 'ACTIVE') throw AppError.badRequest('PACKAGE_NOT_ACTIVE', 'This package is no longer active');
    if (current.paymentStatus === 'UNPAID') {
      throw AppError.badRequest('PAYMENT_REQUIRED', 'Pay the reservation fee before booking more sessions');
    }
    const used = usedSessions(current);
    if (used >= current.sessionsTotal) throw AppError.badRequest('NO_SESSIONS_LEFT', 'All sessions in this package are booked');

    const { emails: mails } = await bookingAction.createInTx(tx, {
      actor: { ...actor, meta },
      instructorId: current.instructorId,
      scheduledAt,
      durationMinutes: current.minutesPerSession,
      lessonType: current.packageName,
      area: current.serviceArea.name,
      notes: `Pickup: ${current.pickupAddress}`,
      paymentMethod: current.paymentMethod,
      settings,
      packageFields: {
        clientPackageId: current.id,
        sessionNumber: used + 1,
        price: null,
        paymentStatus: packagePayment.SESSION_STATUS[current.paymentStatus],
        paymentDueAt: null,
      },
    });
    return { pkg: await clientPackageRepository.findById(current.id, tx), emails: mails };
  });
  await emailService.sendAll(emails);
  return view(pkg);
};

// Cancels every open session through the normal booking engine (history,
// notifications), then closes the package. Refunds are handled manually.
const closePackage = async (actor, pkg, reason, meta) => {
  const open = pkg.bookings.filter((b) => OPEN.includes(b.status));
  for (const session of open) {
    await bookingAction.run({ kind: 'CANCEL', bookingId: session.id, actor, scope: {}, reason, meta });
  }
  await prisma.$transaction(async (tx) => {
    await clientPackageRepository.update(pkg.id, { status: 'CANCELLED', paymentDueAt: null }, tx);
    await auditService.record(tx, {
      actor,
      action: 'PACKAGE_CANCELLED',
      targetType: 'CLIENT_PACKAGE',
      targetId: pkg.id,
      metadata: { reason, amountPaid: Number(pkg.amountPaid).toFixed(2), cancelledSessions: open.length },
      meta,
    });
  });
};

const cancel = async (actor, id, { reason }, meta) => {
  const pkg = await requireOwned(actor, id);
  const settings = await settingsService.get();
  if (pkg.status !== 'ACTIVE') throw AppError.badRequest('PACKAGE_NOT_ACTIVE', 'This package is no longer active');
  if (!toView(pkg, settings).canCancel) {
    throw AppError.badRequest(
      'CHANGE_WINDOW_CLOSED',
      `Packages can only be cancelled up to ${settings.clientChangeCutoffHours} hours before the next session`,
    );
  }
  await closePackage(actor, pkg, reason, meta);
  return view(await clientPackageRepository.findById(id));
};

const expireUnpaid = async (now = new Date()) => {
  const expired = await clientPackageRepository.findManyWhere({
    status: 'ACTIVE',
    paymentMethod: 'ONLINE',
    paymentStatus: 'UNPAID',
    paymentDueAt: { lt: now },
  });
  for (const pkg of expired) {
    await closePackage(bookingAction.SYSTEM_ACTOR, pkg, 'Reservation fee was not paid in time');
  }
  return expired.length;
};

const listMine = async (actor, { page, limit }) => {
  const settings = await settingsService.get();
  const { rows, total } = await clientPackageRepository.listForClient({ clientId: actor.id, page, limit });
  return { data: rows.map((p) => toView(p, settings)), meta: { page, limit, total } };
};

const getMine = async (actor, id) => view(await requireOwned(actor, id));

const pay = (actor, id, meta) => onlinePayment.startPackageCheckout(actor, id, meta);

module.exports = { purchase, bookNextSession, cancel, expireUnpaid, listMine, getMine, pay, toView };
