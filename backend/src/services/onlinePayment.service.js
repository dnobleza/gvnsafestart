const config = require('../config');
const logger = require('../config/logger');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const paymentEventRepository = require('../repositories/paymentEvent.repository');
const clientPackageRepository = require('../repositories/clientPackage.repository');
const packagePayment = require('./packagePayment');
const auditService = require('./audit.service');
const bookingAction = require('./bookingAction.service');
const notificationService = require('./notification.service');
const settingsService = require('./settings.service');
const emailService = require('./email');
const providers = require('./payments');
const signature = require('./payments/signature');

const PAID_EVENT = 'checkout_session.payment.paid';

const PAYABLE_STATUSES = ['PENDING', 'CONFIRMED'];

const { SYSTEM_ACTOR } = bookingAction;

// Opens (or reuses) a provider checkout. Nothing here marks the booking paid:
// only the signed webhook does. A cash booking stays CASH / AWAITING_CASH
// until that webhook arrives, so abandoning checkout leaves it payable in cash.
const startCheckout = async (actor, bookingId, meta) => {
  const provider = providers.active();
  const booking = await bookingRepository.findScoped(bookingId, { clientId: actor.id });
  if (!booking) throw bookingAction.notFound();
  // A package session is paid through its package (reservation, then balance).
  if (booking.clientPackageId) return startPackageCheckout(actor, booking.clientPackageId, meta);
  if (!PAYABLE_STATUSES.includes(booking.status)) {
    throw AppError.badRequest('PAYMENT_NOT_ALLOWED', 'This booking can no longer be paid');
  }
  if (booking.paymentStatus === 'PAID') throw AppError.conflict('ALREADY_PAID', 'This booking is already paid');
  if (booking.scheduledAt.getTime() <= Date.now()) {
    throw AppError.badRequest('PAYMENT_NOT_ALLOWED', 'Online payment closes when the session starts');
  }

  const now = new Date();
  const open = await paymentRepository.findOpenCheckout(booking.id, provider.NAME, now);
  if (open) return { checkoutUrl: open.checkoutUrl, expiresAt: open.expiresAt };

  const settings = await settingsService.get();
  const amount = booking.price ? Number(booking.price).toFixed(2) : bookingAction.priceFor(settings.pricePerHour, booking.durationMinutes);
  const expiresAt =
    booking.paymentStatus === 'UNPAID' && booking.paymentDueAt
      ? booking.paymentDueAt
      : new Date(now.getTime() + settings.onlinePaymentExpiryMinutes * 60000);
  const returnUrl = `${config.appBaseUrl}/client/bookings/${booking.id}`;

  const checkout = await provider.createCheckout({
    bookingId: booking.id,
    amount,
    description: `${booking.lessonType} lesson (${booking.durationMinutes} min)`,
    successUrl: `${returnUrl}?payment=return`,
    cancelUrl: `${returnUrl}?payment=cancelled`,
  });

  await prisma.$transaction(async (tx) => {
    const payment = await paymentRepository.create(
      {
        bookingId: booking.id,
        clientId: booking.clientId,
        amount,
        currency: 'PHP',
        status: 'PENDING',
        method: 'Online',
        provider: provider.NAME,
        providerReference: checkout.reference,
        checkoutUrl: checkout.checkoutUrl,
        expiresAt,
      },
      tx,
    );
    await auditService.record(tx, {
      actor,
      action: 'CHECKOUT_STARTED',
      targetType: 'PAYMENT',
      targetId: payment.id,
      metadata: { bookingId: booking.id, provider: provider.NAME, amount },
      meta,
    });
  });

  return { checkoutUrl: checkout.checkoutUrl, expiresAt };
};

const findOpenPackageCheckout = (clientPackageId, provider, now) =>
  prisma.payment.findFirst({
    where: { clientPackageId, provider, status: 'PENDING', expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });

// Reservation fee first, then the remaining balance. As with single bookings,
// only the signed webhook moves money on the package.
const startPackageCheckout = async (actor, packageId, meta) => {
  const provider = providers.active();
  const pkg = await clientPackageRepository.findScoped(packageId, actor.id);
  if (!pkg) throw AppError.notFound('PACKAGE_NOT_FOUND', 'Package not found');
  if (pkg.status !== 'ACTIVE') throw AppError.badRequest('PAYMENT_NOT_ALLOWED', 'This package can no longer be paid');
  const amount = packagePayment.amountDue(pkg);
  if (amount <= 0) throw AppError.conflict('ALREADY_PAID', 'This package is already paid');

  const now = new Date();
  const open = await findOpenPackageCheckout(pkg.id, provider.NAME, now);
  if (open && Number(open.amount) === amount) return { checkoutUrl: open.checkoutUrl, expiresAt: open.expiresAt, amount };

  const settings = await settingsService.get();
  const expiresAt =
    pkg.paymentStatus === 'UNPAID' && pkg.paymentDueAt
      ? pkg.paymentDueAt
      : new Date(now.getTime() + settings.onlinePaymentExpiryMinutes * 60000);
  const firstSession = pkg.bookings[0];
  const returnUrl = firstSession
    ? `${config.appBaseUrl}/client/bookings/${firstSession.id}`
    : `${config.appBaseUrl}/client/packages/${pkg.id}`;
  const isReservation = Number(pkg.amountPaid) < Number(pkg.reservationFee);

  const checkout = await provider.createCheckout({
    bookingId: pkg.id,
    amount: amount.toFixed(2),
    description: `${pkg.packageName} ${isReservation ? 'reservation fee' : 'balance'}`,
    successUrl: `${config.appBaseUrl}/client/packages/${pkg.id}?payment=return`,
    cancelUrl: `${config.appBaseUrl}/client/packages/${pkg.id}?payment=cancelled`,
  });

  await prisma.$transaction(async (tx) => {
    const payment = await paymentRepository.create(
      {
        bookingId: firstSession ? firstSession.id : null,
        clientPackageId: pkg.id,
        clientId: pkg.clientId,
        amount: amount.toFixed(2),
        currency: 'PHP',
        status: 'PENDING',
        method: 'Online',
        provider: provider.NAME,
        providerReference: checkout.reference,
        checkoutUrl: checkout.checkoutUrl,
        expiresAt,
      },
      tx,
    );
    await auditService.record(tx, {
      actor,
      action: 'CHECKOUT_STARTED',
      targetType: 'PAYMENT',
      targetId: payment.id,
      metadata: { clientPackageId: pkg.id, provider: provider.NAME, amount: amount.toFixed(2), returnUrl },
      meta,
    });
  });

  return { checkoutUrl: checkout.checkoutUrl, expiresAt, amount };
};

const invalidSignature = () => new AppError('INVALID_SIGNATURE', 401, 'Webhook signature is invalid');

const parseEvent = (rawBody) => {
  try {
    const body = JSON.parse(rawBody);
    if (!body || !body.data || !body.data.id || !body.data.attributes) throw new Error('shape');
    return body.data;
  } catch {
    throw AppError.badRequest('INVALID_WEBHOOK', 'Webhook body is not a valid event');
  }
};

const handleWebhook = async ({ rawBody, signatureHeader }) => {
  const provider = providers.active();
  if (!rawBody) throw AppError.badRequest('INVALID_WEBHOOK', 'Webhook body is missing');
  const event = parseEvent(rawBody);
  const ok = signature.verify({
    secret: provider.webhookSecret(),
    header: signatureHeader,
    rawBody,
    livemode: Boolean(event.attributes.livemode),
  });
  if (!ok) throw invalidSignature();

  const type = event.attributes.type;
  const { result, emails } = await prisma.$transaction(async (tx) => {
    const fresh = await paymentEventRepository.record({ provider: provider.NAME, eventId: event.id, type }, tx);
    if (!fresh) return { result: { status: 'duplicate' }, emails: [] };
    if (type !== PAID_EVENT) return { result: { status: 'ignored' }, emails: [] };

    const reference = event.attributes.data && event.attributes.data.id;
    const payment = reference ? await paymentRepository.findByProviderReference(reference, tx) : null;
    if (!payment) {
      logger.warn(`Paid webhook ${event.id} references unknown checkout ${reference}`);
      return { result: { status: 'unknown_checkout' }, emails: [] };
    }
    if (payment.status === 'PAID') return { result: { status: 'already_paid' }, emails: [] };

    await paymentRepository.markPaid(payment.id, tx);
    const booking = await bookingRepository.findById(payment.bookingId, tx);
    let lateForCancelled = booking.status === 'CANCELLED';
    if (payment.clientPackageId) {
      const pkg = await packagePayment.applyPayment(tx, payment.clientPackageId, payment.amount);
      lateForCancelled = pkg.status === 'CANCELLED';
    } else {
      await bookingRepository.update(
        booking.id,
        { paymentMethod: 'ONLINE', paymentStatus: 'PAID', paymentDueAt: null },
        tx,
      );
    }
    await bookingAction.addHistory(tx, booking, SYSTEM_ACTOR, {
      action: 'PAYMENT_RECEIVED',
      reason: lateForCancelled ? 'Paid after the booking was cancelled; refund needed' : null,
    });
    await auditService.record(tx, {
      actor: SYSTEM_ACTOR,
      action: 'ONLINE_PAYMENT_RECEIVED',
      targetType: 'PAYMENT',
      targetId: payment.id,
      metadata: { bookingId: booking.id, eventId: event.id, provider: provider.NAME, amount: payment.amount.toString() },
    });

    const when = notificationService.formatWhen(booking.scheduledAt);
    const mails = await notificationService.notify(tx, [
      {
        user: booking.client,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment received',
        message: `We received your online payment for the ${booking.lessonType} lesson on ${when}.`,
        bookingId: booking.id,
      },
      ...(booking.instructor
        ? [
            {
              user: booking.instructor,
              type: 'PAYMENT_RECEIVED',
              title: 'Booking paid online',
              message: `${booking.client.fullName} paid online for the ${booking.lessonType} lesson on ${when}. No cash to collect.`,
              bookingId: booking.id,
            },
          ]
        : []),
    ]);
    return { result: { status: 'paid', bookingId: booking.id }, emails: mails };
  });

  await emailService.sendAll(emails);
  return result;
};

module.exports = { startCheckout, startPackageCheckout, handleWebhook, PAID_EVENT };
