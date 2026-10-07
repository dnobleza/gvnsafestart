const config = require('../config');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const cashVoidRequestRepository = require('../repositories/cashVoidRequest.repository');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const bookingAction = require('./bookingAction.service');
const emailService = require('./email');
const { forInstructor, toMoney } = require('./bookingView');
const packagePayment = require('./packagePayment');
const clientPackageRepository = require('../repositories/clientPackage.repository');
const { dateRange, localParts } = require('../utils/timezone');

const CASH_ALLOWED = ['CONFIRMED', 'COMPLETED'];

// e.g. OR-2026-000042: Manila calendar year of issue, then a counter that
// restarts at 000001 each January.
const issueReceiptNumber = async (tx, now = new Date()) => {
  const year = Number(localParts(now, config.timezone).date.slice(0, 4));
  const n = await paymentRepository.nextReceiptNumber(tx, year);
  return `OR-${year}-${String(n).padStart(6, '0')}`;
};

const toVoid = (v) =>
  v ? { id: v.id, status: v.status, reason: v.reason, createdAt: v.createdAt, reviewedAt: v.reviewedAt } : null;

const toCashRow = (p) => ({
  id: p.id,
  amount: toMoney(p.amount),
  currency: p.currency,
  status: p.status,
  receiptNumber: p.reference,
  paidAt: p.paidAt,
  voidedAt: p.voidedAt,
  createdAt: p.createdAt,
  client: p.client,
  booking: p.booking,
  voidRequest: toVoid(p.voidRequests && p.voidRequests[0]),
});

const record = async (actor, bookingId, { amount: given }, meta) => {
  const { booking, emails } = await prisma.$transaction(async (tx) => {
    // Same per-instructor lock as booking writes, so a double-tap cannot record twice.
    await userRepository.lockUser(tx, actor.id);
    const current = await bookingRepository.findScoped(bookingId, { instructorId: actor.id }, tx);
    if (!current) throw bookingAction.notFound();
    if (!CASH_ALLOWED.includes(current.status)) {
      throw AppError.badRequest('CASH_NOT_ALLOWED', 'Cash can only be recorded for confirmed or completed sessions');
    }
    const pkg = current.clientPackageId ? await clientPackageRepository.findById(current.clientPackageId, tx) : null;
    if (pkg) {
      if (packagePayment.balanceOf(pkg) <= 0) throw AppError.conflict('ALREADY_PAID', 'This package is already paid');
    } else if (current.paymentStatus === 'PAID' || (await paymentRepository.findPaidForBooking(current.id, tx))) {
      throw AppError.conflict('ALREADY_PAID', 'This booking is already paid');
    }
    const fallback = pkg ? packagePayment.balanceOf(pkg) : current.price;
    const amount = given || (fallback ? Number(fallback).toFixed(2) : null);
    if (!amount) throw AppError.badRequest('AMOUNT_REQUIRED', 'Enter the amount received');
    const receiptNumber = await issueReceiptNumber(tx);

    const payment = await paymentRepository.create(
      {
        bookingId: current.id,
        clientPackageId: pkg ? pkg.id : null,
        clientId: current.clientId,
        amount,
        currency: 'PHP',
        status: 'PAID',
        method: 'Cash',
        reference: receiptNumber,
        paidAt: new Date(),
        recordedById: actor.id,
      },
      tx,
    );
    if (pkg) {
      await bookingAction.touch(tx, current, actor);
      await packagePayment.applyPayment(tx, pkg.id, amount);
    } else {
      await bookingAction.touch(tx, current, actor, { paymentMethod: 'CASH', paymentStatus: 'PAID', paymentDueAt: null });
    }
    await bookingAction.addHistory(tx, current, actor, { action: 'CASH_RECORDED' });
    await auditService.record(tx, {
      actor,
      action: 'CASH_RECORDED',
      targetType: 'PAYMENT',
      targetId: payment.id,
      metadata: { bookingId: current.id, clientPackageId: pkg ? pkg.id : null, amount, receiptNumber },
      meta,
    });
    const mails = await notificationService.notify(tx, [
      {
        user: current.instructor,
        type: 'CASH_RECORDED',
        title: 'Cash payment recorded',
        message: `PHP ${amount} cash (receipt ${receiptNumber}) was recorded for ${current.client.fullName}'s lesson on ${notificationService.formatWhen(current.scheduledAt)}.`,
        bookingId: current.id,
      },
    ]);
    return { booking: await bookingRepository.findById(current.id, tx), emails: mails };
  });

  await emailService.sendAll(emails);
  return forInstructor(booking);
};

const listMine = async (instructorId, { page, limit, from, to }) => {
  const { rows, total } = await paymentRepository.listRecordedBy({
    recordedById: instructorId,
    page,
    limit,
    range: dateRange({ from, to }, config.timezone),
  });
  return { data: rows.map(toCashRow), meta: { page, limit, total } };
};

const requestVoid = async (actor, paymentId, { reason }, meta) => {
  const created = await prisma.$transaction(async (tx) => {
    const payment = await paymentRepository.findRecordedBy(paymentId, actor.id, tx);
    if (!payment) throw AppError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');
    if (payment.status !== 'PAID') throw AppError.badRequest('VOID_NOT_ALLOWED', 'Only paid cash records can be voided');
    if (await cashVoidRequestRepository.findPending(paymentId, tx)) {
      throw AppError.conflict('VOID_ALREADY_REQUESTED', 'A void request is already pending for this payment');
    }
    const row = await cashVoidRequestRepository.create({ paymentId, requestedById: actor.id, reason }, tx);
    await auditService.record(tx, {
      actor,
      action: 'CASH_VOID_REQUESTED',
      targetType: 'PAYMENT',
      targetId: paymentId,
      metadata: { voidRequestId: row.id, reason },
      meta,
    });
    return row;
  });
  return toVoid(created);
};

const listVoidRequests = async ({ page, limit, status }) => {
  const { rows, total } = await cashVoidRequestRepository.list({ page, limit, status });
  return {
    data: rows.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      requestedBy: r.requestedBy,
      reviewedBy: r.reviewedBy,
      payment: { ...r.payment, amount: toMoney(r.payment.amount) },
    })),
    meta: { page, limit, total },
  };
};

const reviewVoid = async (actor, id, { decision }, meta) => {
  const approve = decision === 'APPROVE';
  await prisma.$transaction(async (tx) => {
    const request = await cashVoidRequestRepository.findById(id, tx);
    if (!request) throw AppError.notFound('VOID_REQUEST_NOT_FOUND', 'Void request not found');
    const count = await cashVoidRequestRepository.updateIfPending(
      id,
      { status: approve ? 'APPROVED' : 'REJECTED', reviewedById: actor.id, reviewedAt: new Date() },
      tx,
    );
    if (!count) throw AppError.badRequest('VOID_ALREADY_REVIEWED', 'This void request has already been reviewed');
    if (approve) {
      await paymentRepository.markVoided(request.paymentId, tx);
      if (request.payment.clientPackageId) {
        await packagePayment.reversePayment(tx, request.payment.clientPackageId, request.payment.amount);
      } else if (request.payment.bookingId) {
        await bookingRepository.update(request.payment.bookingId, { paymentStatus: 'AWAITING_CASH' }, tx);
      }
    }
    await auditService.record(tx, {
      actor,
      action: approve ? 'CASH_VOID_APPROVED' : 'CASH_VOID_REJECTED',
      targetType: 'PAYMENT',
      targetId: request.paymentId,
      metadata: { voidRequestId: id },
      meta,
    });
  });
  return { id, status: approve ? 'APPROVED' : 'REJECTED' };
};

module.exports = { issueReceiptNumber, record, listMine, requestVoid, listVoidRequests, reviewVoid };
