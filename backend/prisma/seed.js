const bcrypt = require('bcrypt');
const config = require('../src/config');
const prisma = require('../src/config/prisma');
const { dayBounds } = require('../src/utils/timezone');
const { registerSchema } = require('../src/validators/auth.validator');

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

const LESSON_TYPES = ['Defensive Driving', 'Basic Driving', 'Highway Practice', 'Parking Skills', 'Night Driving'];
const AREAS = ['Makati', 'Quezon City', 'Taguig', 'Pasig', 'Mandaluyong', null];
const METHODS = ['GCash', 'Maya', 'Card', 'Bank Transfer', 'Cash'];
const FIRST = ['Ana', 'Ben', 'Carla', 'Dino', 'Elena', 'Franco', 'Gina', 'Hugo', 'Isla', 'Jun'];
const LAST = ['Reyes', 'Santos', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos', 'Aquino'];

const out = (line) => process.stdout.write(`${line}\n`);

const makeRandom = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const seedAdmin = async () => {
  const { email, password } = config.seedAdmin;
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  }
  registerSchema.body.shape.password.parse(password);

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  return prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      fullName: 'Portal Admin',
      mustChangePassword: false,
    },
  });
};

const BRANCHES = [
  { name: 'Quezon City', isActive: true, latitude: 14.676, longitude: 121.0437 },
  { name: 'Makati', isActive: true, latitude: 14.5547, longitude: 121.0244 },
  { name: 'Pasig', isActive: true, latitude: 14.5764, longitude: 121.0851 },
  { name: 'Taguig', isActive: true, latitude: 14.5176, longitude: 121.0509 },
  { name: 'Cavite (closed)', isActive: false, latitude: 14.4791, longitude: 120.897 },
];

const INSTRUCTORS = [
  {
    email: 'instructor1@example.test',
    fullName: 'Rico Villanueva',
    branch: 'Quezon City',
    address: { street: '12 Maginhawa St', barangay: 'Teachers Village East', city: 'Quezon City', province: 'Metro Manila' },
  },
  {
    email: 'instructor2@example.test',
    fullName: 'Marites Domingo',
    branch: 'Makati',
    address: { street: '88 Pasong Tamo Ext', barangay: 'San Antonio', city: 'Makati', province: 'Metro Manila' },
  },
  {
    email: 'instructor3@example.test',
    fullName: 'Joel Manalo',
    branch: 'Taguig',
    address: { street: '5 Upper McKinley Rd', barangay: 'Fort Bonifacio', city: 'Taguig', province: 'Metro Manila' },
  },
];

const seedBranchesAndInstructors = async () => {
  const branchIds = {};
  for (const { name, isActive, latitude, longitude } of BRANCHES) {
    const existing = await prisma.branch.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    let branch = existing || (await prisma.branch.create({ data: { name, isActive, latitude, longitude } }));
    if (branch.latitude === null) {
      branch = await prisma.branch.update({ where: { id: branch.id }, data: { latitude, longitude } });
    }
    branchIds[name] = branch.id;
  }

  const passwordHash = await bcrypt.hash(config.seedAdmin.password, config.bcryptRounds);
  let created = 0;
  for (const { email, fullName, branch, address } of INSTRUCTORS) {
    if (await prisma.user.findUnique({ where: { email } })) continue;
    await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: 'INSTRUCTOR',
        instructorProfile: { create: { branchId: branchIds[branch], ...address } },
      },
    });
    created += 1;
  }
  return { branches: Object.keys(branchIds).length, instructors: created };
};

const WORK_DAYS = [1, 2, 3, 4, 5, 6];
// Long enough for the 12-hour Option 3 session.
const WORK_START = '06:00';
const WORK_END = '20:00';

// Gives each demo instructor Mon-Sat 08:00-17:00 hours and hands any booking
// that has no instructor yet to one of them, so the instructor dashboard has
// data to show. Safe to re-run: it only fills gaps.
const seedInstructorWorkspace = async () => {
  const instructors = await prisma.user.findMany({
    where: { email: { in: INSTRUCTORS.map((i) => i.email) } },
    orderBy: { email: 'asc' },
  });
  if (!instructors.length) return { availability: 0, assigned: 0 };

  let availability = 0;
  for (const instructor of instructors) {
    // Earlier seeds used 08:00-17:00, too short for a 12-hour session.
    const { count: widened } = await prisma.instructorAvailability.updateMany({
      where: { instructorId: instructor.id, startTime: '08:00', endTime: '17:00' },
      data: { startTime: WORK_START, endTime: WORK_END },
    });
    if (widened || (await prisma.instructorAvailability.count({ where: { instructorId: instructor.id } }))) continue;
    await prisma.instructorAvailability.createMany({
      data: WORK_DAYS.map((dayOfWeek) => ({ instructorId: instructor.id, dayOfWeek, startTime: WORK_START, endTime: WORK_END })),
    });
    availability += 1;
  }

  const unassigned = await prisma.booking.findMany({ where: { instructorId: null }, orderBy: { scheduledAt: 'asc' } });
  for (const [i, booking] of unassigned.entries()) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { instructorId: instructors[i % instructors.length].id },
    });
  }
  return { availability, assigned: unassigned.length };
};

const seedSamples = async () => {
  if ((await prisma.booking.count()) > 0) {
    out('Bookings already exist, skipping sample data');
    return { clients: 0, bookings: 0, payments: 0 };
  }

  const random = makeRandom(20260101);
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = (list) => list[Math.floor(random() * list.length)];

  const clients = [];
  for (let i = 0; i < 10; i += 1) {
    const email = `client${i + 1}@example.test`;
    clients.push(
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, fullName: `${FIRST[i]} ${LAST[i]}`, role: 'CLIENT', phone: `+63917000${String(i).padStart(4, '0')}` },
      }),
    );
  }

  const now = Date.now();
  const today = dayBounds(new Date(now), config.timezone).start.getTime();

  const bookings = [];
  for (let i = 0; i < 40; i += 1) {
    let scheduledAt;
    if (i < 6) {
      scheduledAt = new Date(today + between(8, 18) * HOUR_MS);
    } else {
      scheduledAt = new Date(today + between(-60, 21) * DAY_MS + between(8, 18) * HOUR_MS);
    }

    const past = scheduledAt.getTime() < now;
    const status = past
      ? pick(['COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED'])
      : pick(['PENDING', 'PENDING', 'CONFIRMED', 'CONFIRMED', 'CANCELLED']);

    bookings.push(
      await prisma.booking.create({
        data: {
          clientId: pick(clients).id,
          lessonType: pick(LESSON_TYPES),
          area: pick(AREAS),
          scheduledAt,
          durationMinutes: pick([60, 90, 120]),
          status,
          cancelReason: status === 'CANCELLED' ? 'Client requested cancellation' : null,
          createdAt: new Date(Math.min(now, scheduledAt.getTime()) - between(1, 14) * DAY_MS),
        },
      }),
    );
  }

  const paymentRows = [];
  for (let i = 0; i < 40; i += 1) {
    const createdAt =
      i < 5
        ? new Date(now - between(0, 6) * HOUR_MS)
        : new Date(now - between(0, 60) * DAY_MS - between(0, 23) * HOUR_MS);
    const status = pick(['PAID', 'PAID', 'PAID', 'PENDING', 'FAILED', 'REFUNDED']);
    const booking = i % 3 === 0 ? null : pick(bookings);

    paymentRows.push({
      bookingId: booking ? booking.id : null,
      clientId: booking ? booking.clientId : pick(clients).id,
      amount: (between(5, 60) * 50).toFixed(2),
      currency: 'PHP',
      status,
      method: pick(METHODS),
      reference: `SEED-${String(i + 1).padStart(4, '0')}`,
      paidAt: status === 'PAID' || status === 'REFUNDED' ? createdAt : null,
      createdAt,
    });
  }
  await prisma.payment.createMany({ data: paymentRows });

  return { clients: clients.length, bookings: bookings.length, payments: paymentRows.length };
};

const main = async () => {
  if (config.isProduction) throw new Error('Refusing to seed when NODE_ENV=production');

  const admin = await seedAdmin();
  out(`Admin ready: ${admin.email}`);

  const people = await seedBranchesAndInstructors();
  out(`Branches present=${people.branches}, instructors created=${people.instructors}`);

  const created = await seedSamples();
  out(`Created clients=${created.clients} bookings=${created.bookings} payments=${created.payments}`);

  const workspace = await seedInstructorWorkspace();
  out(`Instructor hours set=${workspace.availability}, bookings assigned=${workspace.assigned}`);
};

main()
  .catch((err) => {
    process.stderr.write(`Seed failed: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
