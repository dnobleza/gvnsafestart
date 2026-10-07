// Development helper: moves a booking's start time into the past so the
// instructor can press "Mark completed" (which is only allowed after the
// session starts) and the client can then rate it.
// Usage: npm run dev:finish-session -- <bookingId or its first 8 characters>
const config = require('../src/config');
const prisma = require('../src/config/prisma');

const main = async () => {
  if (config.isProduction) throw new Error('Refusing to change bookings in production');
  const [ref] = process.argv.slice(2);
  if (!ref) throw new Error('Usage: npm run dev:finish-session -- <bookingId>');

  const matches = await prisma.booking.findMany({ where: { id: { startsWith: ref } }, take: 2 });
  if (matches.length !== 1) throw new Error(matches.length ? 'More than one booking matches; use more characters' : 'Booking not found');
  const [booking] = matches;
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new Error(`Booking is ${booking.status}; only pending or confirmed sessions can be moved`);
  }

  const scheduledAt = new Date(Date.now() - 2 * 3600000);
  await prisma.booking.update({ where: { id: booking.id }, data: { scheduledAt } });
  process.stdout.write(
    `Booking ${booking.id} now started at ${scheduledAt.toISOString()}.\n` +
      `${booking.status === 'PENDING' ? 'Confirm it, then ' : ''}mark it completed as the instructor; the client can then rate it.\n`,
  );
};

main()
  .catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
