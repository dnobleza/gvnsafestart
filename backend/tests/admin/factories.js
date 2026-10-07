const { prisma, createUser, bearer } = require('../helpers');

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

const makeAdmin = (overrides = {}) =>
  createUser({ email: `admin${next()}@test.local`, fullName: 'Admin User', role: 'ADMIN', ...overrides });

const ADDRESS = { street: '1 Test St', barangay: 'Brgy Test', city: 'Quezon City', province: 'Metro Manila' };

const makeBranch = (overrides = {}) =>
  prisma.branch.create({ data: { name: `Branch ${next()}`, ...overrides } });

const makeInstructor = async (overrides = {}) => {
  const { branch, address = ADDRESS, withProfile = true, ...rest } = overrides;
  const user = await createUser({
    email: `instructor${next()}@test.local`,
    fullName: 'Instructor User',
    role: 'INSTRUCTOR',
    ...rest,
  });
  if (!withProfile) return user;
  const assigned = branch || (await makeBranch());
  await prisma.instructorProfile.create({
    data: { userId: user.id, branchId: assigned.id, ...address },
  });
  return user;
};

const makeClient = (overrides = {}) =>
  createUser({ email: `client${next()}@test.local`, fullName: 'Client User', role: 'CLIENT', ...overrides });

const makeBooking = (client, overrides = {}) =>
  prisma.booking.create({
    data: {
      clientId: client.id,
      lessonType: 'Defensive Driving',
      scheduledAt: new Date(Date.now() + 7 * 86400000),
      ...overrides,
    },
  });

const makePayment = (client, overrides = {}) =>
  prisma.payment.create({
    data: { clientId: client.id, amount: '100.00', status: 'PAID', paidAt: new Date(), ...overrides },
  });

const auth = (user) => ({ Authorization: bearer(user) });

// Catalogue as on the website: Metro Manila own-car prices only.
const makeCatalog = async () => {
  const area = await prisma.serviceArea.create({ data: { name: `Metro Manila ${next()}` } });
  const other = await prisma.serviceArea.create({ data: { name: `Cavite ${next()}` } });
  const make = (code, name, sessions, hoursPerSession) =>
    prisma.package.create({ data: { code: `${code}_${next()}`, name, sessions, hoursPerSession } });
  const option1 = await make('OPTION_1', 'Option 1', 1, 5);
  const option2 = await make('OPTION_2', 'Option 2', 3, 5);
  const option3 = await make('OPTION_3', 'Option 3', 1, 12);
  for (const [pkg, price] of [[option1, 2500], [option2, 7000], [option3, 5000]]) {
    await prisma.packageRate.create({
      data: { packageId: pkg.id, serviceAreaId: area.id, trainingType: 'OWN_CAR', price },
    });
  }
  return { area, other, option1, option2, option3 };
};

const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

const makeAvailability = (instructor, { days = ALL_WEEK, startTime = '08:00', endTime = '17:00' } = {}) =>
  prisma.instructorAvailability.createMany({
    data: days.map((dayOfWeek) => ({ instructorId: instructor.id, dayOfWeek, startTime, endTime })),
  });

module.exports = {
  makeAdmin,
  makeInstructor,
  makeBranch,
  ADDRESS,
  makeClient,
  makeBooking,
  makePayment,
  makeAvailability,
  makeCatalog,
  auth,
};
