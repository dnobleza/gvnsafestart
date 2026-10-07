const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');
const tokenService = require('../src/services/token.service');

const TABLES = [
  'audit_logs',
  'receipt_counters',
  'client_packages',
  'package_rates',
  'packages',
  'service_areas',
  'payment_events',
  'app_settings',
  'notifications',
  'ratings',
  'booking_history',
  'cash_void_requests',
  'client_notes',
  'instructor_days_off',
  'instructor_availability',
  'payments',
  'bookings',
  'request_status_history',
  'invoice_items',
  'invoices',
  'service_requests',
  'services',
  'refresh_tokens',
  'auth_identities',
  'phone_otps',
  'client_profiles',
  'instructor_profiles',
  'branches',
  'registrations',
  'users',
];

const resetDb = async () => {
  require('../src/services/settings.service').clearCache();
  require('../src/services/topInstructors.service').clearCache();
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
};

const createUser = async (overrides = {}) => {
  const { password = 'Passw0rd!', ...rest } = overrides;
  return prisma.user.create({
    data: {
      email: 'user@test.local',
      fullName: 'Test User',
      role: 'CLIENT',
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      ...rest,
    },
  });
};

const createAdmin = () =>
  createUser({ email: 'admin@test.local', fullName: 'Admin', role: 'ADMIN' });

const bearer = (user) => `Bearer ${tokenService.issueAccessToken(user)}`;

const refreshCookie = (res) => {
  const raw = res.headers['set-cookie'] || [];
  const found = raw.find((c) => c.startsWith('refresh_token='));
  return found ? found.split(';')[0] : null;
};

module.exports = { prisma, resetDb, createUser, createAdmin, bearer, refreshCookie };
