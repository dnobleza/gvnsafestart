import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as adminApi from '../src/api/admin';
import * as authApi from '../src/api/auth';
import { resetAuthBootstrap } from '../src/features/auth/hooks/useAuthBootstrap';
import AppRoutes from '../src/routes';
import { useAuthStore } from '../src/store/authStore';

vi.mock('../src/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock('../src/api/admin', () => ({
  getOverview: vi.fn(),
  listPayments: vi.fn(),
  listBookings: vi.fn(),
  approveBooking: vi.fn(),
  getBooking: vi.fn(),
  getBookingHistory: vi.fn(),
  rescheduleBooking: vi.fn(),
  cancelBooking: vi.fn(),
  listInstructors: vi.fn(),
  getInstructor: vi.fn(),
  createInstructor: vi.fn(),
  updateInstructor: vi.fn(),
  deactivateInstructor: vi.fn(),
  resetInstructorPassword: vi.fn(),
  listAdmins: vi.fn(),
  createAdmin: vi.fn(),
  deactivateAdmin: vi.fn(),
  resetAdminPassword: vi.fn(),
  listBranches: vi.fn(),
  listBranchOptions: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
  listAuditLogs: vi.fn(),
  listRatings: vi.fn(),
  setRatingHidden: vi.fn(),
  listVoidRequests: vi.fn(),
  reviewVoidRequest: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listAdminPackages: vi.fn(),
  createPackage: vi.fn(),
  updatePackage: vi.fn(),
  getPackageRates: vi.fn(),
  savePackageRates: vi.fn(),
  listAdminServiceAreas: vi.fn(),
  updateServiceArea: vi.fn(),
  getPaymentProvider: vi.fn(),
  testPaymentProvider: vi.fn(),
}));

vi.mock('../src/api/clientPortal', () => ({
  getDashboard: vi.fn(),
  createBooking: vi.fn(),
  listMyBookings: vi.fn(),
  getMyBooking: vi.fn(),
  cancelMyBooking: vi.fn(),
  rescheduleMyBooking: vi.fn(),
  payBooking: vi.fn(),
  rateBooking: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  purchasePackage: vi.fn(),
  listMyPackages: vi.fn(),
  getMyPackage: vi.fn(),
  bookNextSession: vi.fn(),
  payPackage: vi.fn(),
  cancelPackage: vi.fn(),
}));

vi.mock('../src/api/public', () => ({
  listLocations: vi.fn(),
  listInstructors: vi.fn(),
  getRecommended: vi.fn(),
  getInstructorSlots: vi.fn(),
  listServiceAreas: vi.fn(),
  listPackages: vi.fn(),
  getTopInstructors: vi.fn(),
  getPublicInstructor: vi.fn(),
}));

const admin = { id: 'a1', email: 'admin@test.local', fullName: 'Ada Admin', role: 'ADMIN', mustChangePassword: false };

const page = (data, extra = {}) => ({ data, meta: { page: 1, limit: 20, total: data.length, ...extra } });

const PAST = '2026-10-06T02:15:00.000Z';

const booking = (overrides = {}) => ({
  id: 'b1',
  lessonType: 'Basic Driving',
  area: null,
  scheduledAt: '2031-01-15T02:00:00.000Z',
  endsAt: '2031-01-15T03:00:00.000Z',
  durationMinutes: 60,
  status: 'CONFIRMED',
  notes: null,
  cancelReason: null,
  createdAt: PAST,
  paymentStatus: 'CASH_DUE',
  payments: [],
  instructor: { id: 'i1', fullName: 'Juan Dela Cruz', branch: { id: 'br1', name: 'Makati' } },
  lastAction: { action: 'CONFIRMED', actorName: 'Juan Dela Cruz', actorRole: 'INSTRUCTOR', at: PAST, reason: null },
  rated: false,
  client: { id: 'c1', fullName: 'Cleo Client', email: 'cleo@test.local', phone: null },
  ...overrides,
});

const renderApp = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const signIn = (user) => useAuthStore.setState({ user, accessToken: 't', status: 'authenticated' });

beforeEach(() => {
  vi.resetAllMocks();
  authApi.refresh.mockRejectedValue(new Error('no session'));
  resetAuthBootstrap();
  adminApi.listInstructors.mockResolvedValue(page([{ id: 'i1', fullName: 'Juan Dela Cruz' }]));
  adminApi.listBranchOptions.mockResolvedValue([{ id: 'br1', name: 'Makati' }]);
});

describe('admin booking accountability', () => {
  it('shows who acted last under the status, and filters by action-by', async () => {
    signIn(admin);
    adminApi.listBookings.mockResolvedValue(page([booking()]));
    const user = userEvent.setup();
    renderApp('/admin/bookings');

    expect(await screen.findByText('Confirmed by Juan Dela Cruz (Instructor) · Oct 6, 2026, 10:15 AM')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Last action by'), 'INSTRUCTOR');
    await waitFor(() =>
      expect(adminApi.listBookings).toHaveBeenLastCalledWith(expect.objectContaining({ actionBy: 'INSTRUCTOR', page: 1 })),
    );
  });

  it('shows the full timeline on the booking detail', async () => {
    signIn(admin);
    adminApi.getBooking.mockResolvedValue({ booking: booking() });
    adminApi.getBookingHistory.mockResolvedValue({
      history: [
        { id: 'h1', action: 'CREATED', fromStatus: null, toStatus: 'PENDING', reason: null, actor: { id: 'c1', fullName: 'Cleo Client' }, actorRole: 'CLIENT', createdAt: PAST },
        {
          id: 'h2',
          action: 'RESCHEDULED',
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          oldScheduledAt: '2031-01-14T02:00:00.000Z',
          newScheduledAt: '2031-01-15T02:00:00.000Z',
          reason: 'Branch closed',
          actor: { id: 'a1', fullName: 'Ada Admin' },
          actorRole: 'ADMIN',
          createdAt: PAST,
        },
      ],
    });
    renderApp('/admin/bookings/b1');

    expect(await screen.findByText('Rescheduled')).toBeInTheDocument();
    expect(screen.getByText(/Ada Admin \(Admin\)/)).toBeInTheDocument();
    expect(screen.getByText('Reason: Branch closed')).toBeInTheDocument();
    expect(screen.getByText(/Jan 14, 2031/)).toBeInTheDocument();
  });

  it('lists ratings with client names and hides a comment', async () => {
    signIn(admin);
    adminApi.listRatings.mockResolvedValue({
      data: [
        {
          id: 'r1',
          stars: 2,
          comment: 'Late and rude',
          isHidden: false,
          createdAt: PAST,
          client: { id: 'c1', fullName: 'Cleo Client' },
          instructor: { id: 'i1', fullName: 'Juan Dela Cruz', branch: { id: 'br1', name: 'Makati' } },
          booking: { id: 'b1' },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, instructors: [{ id: 'i1', fullName: 'Juan Dela Cruz', branch: null, display: 'New', count: 1 }] },
    });
    adminApi.setRatingHidden.mockResolvedValue({ rating: { id: 'r1', isHidden: true } });
    const user = userEvent.setup();
    renderApp('/admin/ratings');

    expect(await screen.findByText('Late and rude')).toBeInTheDocument();
    expect(screen.getByText('Cleo Client')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(adminApi.setRatingHidden).toHaveBeenCalledWith('r1', true);
    await waitFor(() => expect(adminApi.listRatings).toHaveBeenCalledTimes(2));
  });
});

describe('admin settings', () => {
  it('saves only the changed settings', async () => {
    signIn(admin);
    adminApi.getSettings.mockResolvedValue({
      clientChangeCutoffHours: 24,
      onlinePaymentExpiryMinutes: 30,
      cashAutoCancelHours: 12,
      pricePerHour: 800,
    });
    adminApi.updateSettings.mockResolvedValue({
      clientChangeCutoffHours: 12,
      onlinePaymentExpiryMinutes: 30,
      cashAutoCancelHours: 12,
      pricePerHour: 800,
    });
    const user = userEvent.setup();
    renderApp('/admin/settings');

    const cutoff = await screen.findByLabelText('Client change cutoff (hours)');
    await waitFor(() => expect(cutoff).toHaveValue('24'));
    await user.clear(cutoff);
    await user.type(cutoff, '12');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(adminApi.updateSettings).toHaveBeenCalledWith({ clientChangeCutoffHours: 12 }));
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
  });
});

describe('admin packages and rates', () => {
  const grid = {
    trainingType: 'OWN_CAR',
    areas: [
      { id: 'mm', name: 'Metro Manila', isActive: true, sortOrder: 1 },
      { id: 'cv', name: 'Cavite', isActive: true, sortOrder: 2 },
    ],
    packages: [
      { id: 'p1', code: 'OPTION_1', name: 'Option 1', sessions: 1, hoursPerSession: 5, isActive: true, sortOrder: 1 },
    ],
    rates: [{ packageId: 'p1', serviceAreaId: 'mm', price: '2500.00' }],
  };

  it('saves only the changed cells, with empty meaning "not offered"', async () => {
    signIn(admin);
    adminApi.getPackageRates.mockResolvedValue(grid);
    adminApi.savePackageRates.mockResolvedValue(grid);
    const user = userEvent.setup();
    renderApp('/admin/packages');

    const mm = await screen.findByLabelText('Option 1 price in Metro Manila');
    expect(mm).toHaveValue('2500');
    await user.clear(mm);
    await user.type(screen.getByLabelText('Option 1 price in Cavite'), '2800');
    await user.click(screen.getByRole('button', { name: 'Save rates' }));

    await waitFor(() =>
      expect(adminApi.savePackageRates).toHaveBeenCalledWith({
        trainingType: 'OWN_CAR',
        rates: expect.arrayContaining([
          { packageId: 'p1', serviceAreaId: 'mm', price: null },
          { packageId: 'p1', serviceAreaId: 'cv', price: 2800 },
        ]),
      }),
    );

    await user.click(screen.getByRole('tab', { name: 'Car Rental' }));
    await waitFor(() => expect(adminApi.getPackageRates).toHaveBeenLastCalledWith({ trainingType: 'CAR_RENTAL' }));
  });
});

describe('PayMongo connection card', () => {
  it('shows status, the webhook URL to register, and the test result', async () => {
    signIn(admin);
    adminApi.getSettings.mockResolvedValue({
      clientChangeCutoffHours: 24,
      onlinePaymentExpiryMinutes: 30,
      cashAutoCancelHours: 12,
      pricePerHour: 800,
      reservationFee: 1000,
    });
    adminApi.getPaymentProvider.mockResolvedValue({
      provider: 'paymongo',
      mode: 'test',
      secretKeySet: true,
      webhookSecretSet: false,
      webhookUrl: 'https://abc.trycloudflare.com/api/v1/payments/webhooks/paymongo',
      webhookEvent: 'checkout_session.payment.paid',
      webhookUrlIsLocal: false,
      returnUrl: 'http://localhost:5173',
    });
    adminApi.testPaymentProvider.mockResolvedValue({
      result: { ok: false, keyValid: false, message: 'PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET must both be set.' },
    });
    const user = userEvent.setup();
    renderApp('/admin/settings');

    expect(await screen.findByText('Provider: PayMongo test mode')).toBeInTheDocument();
    expect(screen.getByText(/Webhook signing secret missing/)).toBeInTheDocument();
    expect(screen.getByText('https://abc.trycloudflare.com/api/v1/payments/webhooks/paymongo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText('PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET must both be set.')).toBeInTheDocument();
  });
});
