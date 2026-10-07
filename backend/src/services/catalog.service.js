const AppError = require('../utils/AppError');
const branchRepository = require('../repositories/branch.repository');
const instructorRepository = require('../repositories/instructor.repository');
const packageRepository = require('../repositories/package.repository');
const settingsService = require('./settings.service');
const availabilityService = require('./availability.service');
const ratingService = require('./rating.service');
const { haversineKm } = require('../utils/geo');
const { addDays } = require('../utils/timezone');

const LOOKAHEAD_DAYS = 14;
const MAX_RECOMMENDED = 20;

const coordsOf = (branch) =>
  branch && branch.latitude !== null && branch.longitude !== null
    ? { lat: Number(branch.latitude), lng: Number(branch.longitude) }
    : null;

const branchOf = (instructor) => {
  const branch = instructor.instructorProfile && instructor.instructorProfile.branch;
  return branch ? { id: branch.id, name: branch.name } : null;
};

const toCard = (instructor, rating) => ({
  id: instructor.id,
  fullName: instructor.fullName,
  branch: branchOf(instructor),
  rating,
});

const locations = async () =>
  (await branchRepository.listActiveLocated()).map((b) => ({
    id: b.id,
    name: b.name,
    latitude: Number(b.latitude),
    longitude: Number(b.longitude),
  }));

const listInstructors = async ({ locationId, search, page, limit }) => {
  const all = await instructorRepository.listBookable({ branchId: locationId, search });
  const slice = all.slice((page - 1) * limit, page * limit);
  const ratings = await ratingService.summariesFor(slice.map((i) => i.id));
  return { data: slice.map((i) => toCard(i, ratings.get(i.id))), meta: { page, limit, total: all.length } };
};

const requireBookable = async (id) => {
  const instructor = await instructorRepository.findBookable(id);
  if (!instructor) throw AppError.notFound('INSTRUCTOR_NOT_FOUND', 'Instructor not found');
  return instructor;
};

const slots = async (id, { date, duration }) => {
  await requireBookable(id);
  return availabilityService.listSlots({ instructorId: id, date, durationMinutes: duration });
};

const nextSlotFrom = async (instructorId, date, durationMinutes) => {
  for (let i = 0; i < LOOKAHEAD_DAYS; i += 1) {
    const day = addDays(date, i);
    const { slots: open } = await availabilityService.listSlots({ instructorId, date: day, durationMinutes });
    if (open.length) return { ...open[0], date: day };
  }
  return null;
};

// Rounded so instructors at the same (or practically the same) branch tie on
// distance and are then ordered by availability and rating, as specified.
const distanceKey = (km) => (km === null ? Infinity : Math.round(km * 10));

const ratingKey = (rating) => (rating.isNew ? -1 : rating.average);

const recommended = async ({ lat, lng, date, duration }) => {
  const instructors = await instructorRepository.listBookable();
  const ratings = await ratingService.summariesFor(instructors.map((i) => i.id));
  const origin = { lat, lng };

  const ranked = await Promise.all(
    instructors.map(async (instructor) => {
      const where = coordsOf(instructor.instructorProfile && instructor.instructorProfile.branch);
      const km = where ? haversineKm(origin, where) : null;
      const next = await nextSlotFrom(instructor.id, date, duration);
      const card = {
        ...toCard(instructor, ratings.get(instructor.id)),
        distanceKm: km === null ? null : Math.round(km * 10) / 10,
        availableOnDate: Boolean(next && next.date === date),
        nextAvailableSlot: next,
      };
      return { card, km };
    }),
  );

  ranked.sort(
    (a, b) =>
      distanceKey(a.km) - distanceKey(b.km) ||
      Number(b.card.availableOnDate) - Number(a.card.availableOnDate) ||
      ratingKey(b.card.rating) - ratingKey(a.card.rating) ||
      a.card.fullName.localeCompare(b.card.fullName),
  );

  return ranked.slice(0, MAX_RECOMMENDED).map((r) => r.card);
};

const serviceAreas = async () =>
  (await packageRepository.listAreas()).map((a) => ({ id: a.id, name: a.name }));

// Every active package, priced for the chosen area and training type. A
// package with no rate there is listed with price null so the client sees it
// exists but cannot book it online yet.
const packages = async ({ serviceAreaId, trainingType }) => {
  const [list, rates, settings] = await Promise.all([
    packageRepository.listPackages(),
    serviceAreaId && trainingType ? packageRepository.listRates({ serviceAreaId, trainingType }) : [],
    settingsService.get(),
  ]);
  const priceOf = new Map(rates.map((r) => [r.packageId, Number(r.price)]));
  return list.map((p) => {
    const price = priceOf.has(p.id) ? priceOf.get(p.id) : null;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      sessions: p.sessions,
      hoursPerSession: p.hoursPerSession,
      totalHours: p.sessions * p.hoursPerSession,
      price: price === null ? null : price.toFixed(2),
      reservationFee: price === null ? null : Math.min(Number(settings.reservationFee), price).toFixed(2),
    };
  });
};

const getInstructor = async (id) => {
  const instructor = await requireBookable(id);
  const ratings = await ratingService.summariesFor([id]);
  return toCard(instructor, ratings.get(id));
};

module.exports = {
  locations,
  serviceAreas,
  packages,
  listInstructors,
  getInstructor,
  slots,
  recommended,
  requireBookable,
};
