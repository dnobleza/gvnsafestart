const config = require('../config');
const bookingRepository = require('../repositories/booking.repository');
const bookingAction = require('./bookingAction.service');
const { forAdmin, historyEntry } = require('./bookingView');
const { dateRange } = require('../utils/timezone');

const ADMIN_SCOPE = {};

const list = async ({ page, limit, status, from, to, client, instructorId, branchId, actionBy, completedBy, cashUnpaid }) => {
  const { rows, total } = await bookingRepository.list({
    page,
    limit,
    status,
    client,
    instructorId,
    branchId,
    actionBy,
    completedBy,
    cashUnpaid,
    range: dateRange({ from, to }, config.timezone),
  });
  return { data: rows.map(forAdmin), meta: { page, limit, total } };
};

const get = async (id) => {
  const booking = await bookingRepository.findById(id);
  if (!booking) throw bookingAction.notFound();
  return forAdmin(booking);
};

const history = async (id) => {
  const rows = await bookingAction.history(id, ADMIN_SCOPE);
  return rows.map(historyEntry);
};

const act = async (kind, id, actor, meta, extra = {}) =>
  forAdmin(await bookingAction.run({ kind, bookingId: id, actor, scope: ADMIN_SCOPE, meta, ...extra }));

const approve = (id, actor, meta) => act('CONFIRM', id, actor, meta);

const reschedule = (id, { scheduledAt, reason }, actor, meta) =>
  act('RESCHEDULE', id, actor, meta, { scheduledAt, reason });

const cancel = (id, { reason }, actor, meta) => act('CANCEL', id, actor, meta, { reason });

module.exports = { list, get, history, approve, reschedule, cancel };
