const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const bookingRepository = require('../repositories/booking.repository');
const bookingHistoryRepository = require('../repositories/bookingHistory.repository');
const clientProfileRepository = require('../repositories/clientProfile.repository');
const notificationRepository = require('../repositories/notification.repository');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const bookingAction = require('./bookingAction.service');
const onlinePayment = require('./onlinePayment.service');
const ratingService = require('./rating.service');
const settingsService = require('./settings.service');
const packageService = require('./package.service');
const { forClient, historyEntry } = require('./bookingView');

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const OPEN = ['PENDING', 'CONFIRMED'];
const DASHBOARD_LIST = 5;

const scopeOf = (actor) => ({ clientId: actor.id });

const withActions = (booking, settings, now = Date.now()) => {
  const open = OPEN.includes(booking.status);
  const upcoming = booking.scheduledAt.getTime() > now;
  const changeable = open && booking.scheduledAt.getTime() - now >= settings.clientChangeCutoffHours * HOUR_MS;
  return {
    ...forClient(booking),
    canRate: ratingService.canRate(booking, now),
    ratingState: ratingService.ratingState(booking, now),
    rateUntil: booking.status === 'COMPLETED' ? ratingService.ratingDeadline(booking) : null,
    // Package sessions are paid through their package, not one by one.
    canPay: !booking.clientPackageId && open && upcoming && booking.paymentStatus !== 'PAID',
    canCancel: changeable,
    canReschedule: changeable,
    changeCutoffHours: settings.clientChangeCutoffHours,
  };
};

const mapRows = async (rows) => {
  const settings = await settingsService.get();
  return rows.map((b) => withActions(b, settings));
};

const TABS = {
  upcoming: (now) => ({
    where: { status: { in: OPEN }, scheduledAt: { gte: now } },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
  }),
  past: (now) => ({
    where: {
      OR: [{ status: { in: ['COMPLETED', 'NO_SHOW'] } }, { status: { in: OPEN }, scheduledAt: { lt: now } }],
    },
    orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }],
  }),
  cancelled: () => ({ where: { status: 'CANCELLED' }, orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }] }),
};

const listMine = async (actor, { page, limit, tab }) => {
  const { where, orderBy } = TABS[tab](new Date());
  const { rows, total } = await bookingRepository.listWhere({
    where: { ...where, clientId: actor.id },
    orderBy,
    page,
    limit,
  });
  return { data: await mapRows(rows), meta: { page, limit, total, tab } };
};

const dashboard = async (actor) => {
  const now = new Date();
  const mine = { clientId: actor.id };
  const upcomingWhere = { ...mine, status: { in: OPEN }, scheduledAt: { gte: now } };
  const unpaidWhere = { ...upcomingWhere, paymentStatus: { in: ['UNPAID', 'AWAITING_CASH'] } };
  const toRateWhere = {
    ...mine,
    status: 'COMPLETED',
    instructorId: { not: null },
    rating: { is: null },
    scheduledAt: { gte: new Date(now.getTime() - 14 * DAY_MS) },
  };

  const [upcoming, upcomingCount, unpaid, unpaidCount, toRate, unreadNotifications] = await Promise.all([
    bookingRepository.findManyWhere(upcomingWhere, { orderBy: [{ scheduledAt: 'asc' }], take: DASHBOARD_LIST }),
    bookingRepository.countWhere(upcomingWhere),
    bookingRepository.findManyWhere(unpaidWhere, { orderBy: [{ scheduledAt: 'asc' }], take: DASHBOARD_LIST }),
    bookingRepository.countWhere(unpaidWhere),
    bookingRepository.findManyWhere(toRateWhere, { orderBy: [{ scheduledAt: 'desc' }], take: DASHBOARD_LIST }),
    notificationRepository.countUnread(actor.id),
  ]);

  const [upcomingRows, unpaidRows, toRateRows, packages] = await Promise.all([
    mapRows(upcoming),
    mapRows(unpaid),
    mapRows(toRate),
    packageService.listMine(actor, { page: 1, limit: 20 }),
  ]);
  const openPackages = packages.data.filter((p) => p.status === 'ACTIVE' && (p.sessionsRemaining > 0 || p.canPay));
  return {
    nextSession: upcomingRows[0] || null,
    upcoming: upcomingRows,
    unpaid: unpaidRows,
    toRate: toRateRows.filter((b) => b.canRate),
    packages: openPackages,
    counts: { upcoming: upcomingCount, unpaid: unpaidCount, toRate: toRateRows.filter((b) => b.canRate).length },
    unreadNotifications,
  };
};

// The latest reschedule or cancellation, shown next to the status with its reason.
const statusNote = (history) => {
  const last = [...history].reverse().find((h) => h.action === 'RESCHEDULED' || h.action === 'CANCELLED');
  if (!last) return null;
  return {
    action: last.action,
    reason: last.reason,
    at: last.createdAt,
    actorRole: last.changedByRole,
    actorName: last.changedBy ? last.changedBy.fullName : null,
    oldScheduledAt: last.oldScheduledAt,
    newScheduledAt: last.newScheduledAt,
  };
};

const getMine = async (actor, id) => {
  const booking = await bookingRepository.findScoped(id, scopeOf(actor));
  if (!booking) throw bookingAction.notFound();
  const [history, settings] = await Promise.all([
    bookingHistoryRepository.listForBooking(id),
    settingsService.get(),
  ]);
  return { ...withActions(booking, settings), statusNote: statusNote(history), history: history.map(historyEntry) };
};

const createBooking = async (actor, input, meta) => {
  const created = await bookingAction.create({ actor, meta, ...input });
  let checkout = null;
  if (input.paymentMethod === 'ONLINE') {
    // The booking already exists; if the provider is down the client can
    // retry from "Pay now" before the payment deadline.
    checkout = await onlinePayment.startCheckout(actor, created.id, meta).catch(() => null);
  }
  const booking = (await mapRows([created]))[0];
  return { booking, checkoutUrl: checkout ? checkout.checkoutUrl : null };
};

const act = async (kind, actor, id, meta, extra) =>
  (await mapRows([await bookingAction.run({ kind, bookingId: id, actor, scope: scopeOf(actor), meta, ...extra })]))[0];

const cancel = (actor, id, { reason }, meta) => act('CANCEL', actor, id, meta, { reason });

const reschedule = (actor, id, { scheduledAt, reason }, meta) => act('RESCHEDULE', actor, id, meta, { scheduledAt, reason });

const pay = (actor, id, meta) => onlinePayment.startCheckout(actor, id, meta);

const rate = (actor, id, input, meta) => ratingService.rate(actor, id, input, meta);

const toProfile = (user, profile) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  savedLocation:
    profile && profile.savedLatitude !== null && profile.savedLatitude !== undefined
      ? {
          city: profile.savedCity,
          latitude: Number(profile.savedLatitude),
          longitude: Number(profile.savedLongitude),
        }
      : profile && profile.savedCity
        ? { city: profile.savedCity, latitude: null, longitude: null }
        : null,
});

const getProfile = async (actor) => {
  const [user, profile] = await Promise.all([
    userRepository.findById(actor.id),
    clientProfileRepository.findByUser(actor.id),
  ]);
  return toProfile(user, profile);
};

const updateProfile = async (actor, { fullName, phone, savedLocation }, meta) => {
  await prisma.$transaction(async (tx) => {
    const userData = {};
    if (fullName !== undefined) userData.fullName = fullName;
    if (phone !== undefined && phone !== actor.phone) {
      const taken = await tx.user.findUnique({ where: { phone } });
      if (taken && taken.id !== actor.id) {
        throw AppError.conflict('PHONE_ALREADY_REGISTERED', 'That phone number is already in use');
      }
      userData.phone = phone;
    }
    if (Object.keys(userData).length) await userRepository.update(actor.id, userData, tx);
    if (savedLocation !== undefined) {
      await clientProfileRepository.upsert(
        actor.id,
        savedLocation
          ? {
              savedCity: savedLocation.city || null,
              savedLatitude: savedLocation.latitude ?? null,
              savedLongitude: savedLocation.longitude ?? null,
            }
          : { savedCity: null, savedLatitude: null, savedLongitude: null },
        tx,
      );
    }
    await auditService.record(tx, {
      actor,
      action: 'CLIENT_PROFILE_UPDATED',
      targetType: 'USER',
      targetId: actor.id,
      metadata: {
        fields: [
          ...Object.keys(userData),
          ...(savedLocation !== undefined ? ['savedLocation'] : []),
        ],
      },
      meta,
    });
  });
  return getProfile(actor);
};

module.exports = {
  dashboard,
  listMine,
  getMine,
  createBooking,
  cancel,
  reschedule,
  pay,
  rate,
  getProfile,
  updateProfile,
};
