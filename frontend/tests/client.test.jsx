import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../src/api/auth';
import * as clientApi from '../src/api/clientPortal';
import * as geoApi from '../src/api/geo';
import * as publicApi from '../src/api/public';
import * as checkout from '../src/features/client/checkout';
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

vi.mock('../src/api/geo', () => ({ reverseGeocode: vi.fn() }));

vi.mock('../src/features/client/checkout', () => ({
  goToCheckout: vi.fn(),
  startPayment: vi.fn(),
  startPackagePayment: vi.fn(),
}));

const client = { id: 'c1', email: 'cleo@test.local', fullName: 'Cleo Client', role: 'CLIENT', mustChangePassword: false };

const page = (data, extra = {}) => ({ data, meta: { page: 1, limit: 20, total: data.length, ...extra } });

const PAST = '2026-10-06T02:15:00.000Z';
const SLOT = { start: '2031-01-15T01:00:00.000Z', time: '09:00' };

const booking = (overrides = {}) => ({
  id: 'b1',
  lessonType: 'Basic Driving',
  scheduledAt: '2031-01-15T02:00:00.000Z',
  durationMinutes: 60,
  status: 'CONFIRMED',
  paymentMethod: 'CASH',
  paymentStatus: 'AWAITING_CASH',
  price: '800.00',
  paymentDueAt: null,
  receiptNumber: null,
  instructor: { id: 'i1', fullName: 'Juan Dela Cruz', branch: { id: 'br1', name: 'Makati' } },
  canPay: true,
  canCancel: true,
  canReschedule: true,
  canRate: false,
  changeCutoffHours: 24,
  rating: null,
  statusNote: null,
  history: [],
  ...overrides,
});

const instructorCard = (overrides = {}) => ({
  id: 'i1',
  fullName: 'Juan Dela Cruz',
  branch: { id: 'br1', name: 'Makati' },
  rating: { isNew: false, display: '4.6', count: 12, average: 4.6 },
  distanceKm: 1.2,
  availableOnDate: true,
  nextAvailableSlot: { ...SLOT, date: '2031-01-15' },
  ...overrides,
});

const renderApp = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const denyGeolocation = () =>
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (_ok, fail) => fail({ code: 1, message: 'denied' }) },
  });

const allowGeolocation = () =>
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 14.556, longitude: 121.023 } }) },
  });

beforeEach(() => {
  vi.resetAllMocks();
  authApi.refresh.mockRejectedValue(new Error('no session'));
  resetAuthBootstrap();
  useAuthStore.setState({ user: client, accessToken: 't', status: 'authenticated' });
  clientApi.listNotifications.mockResolvedValue(page([], { unread: 0 }));
  clientApi.getProfile.mockResolvedValue({ id: 'c1', fullName: 'Cleo Client', email: 'cleo@test.local', phone: null, savedLocation: null });
  clientApi.updateProfile.mockResolvedValue({});
  publicApi.listLocations.mockResolvedValue([
    { id: 'br1', name: 'Makati', latitude: 14.5547, longitude: 121.0244 },
    { id: 'br2', name: 'Quezon City', latitude: 14.676, longitude: 121.0437 },
  ]);
});

afterEach(() => vi.useRealTimers());

describe('book now', () => {
  it('sends a signed-out visitor to log in, then back into the booking flow', async () => {
    useAuthStore.setState({ user: null, accessToken: null, status: 'checking' });
    authApi.login.mockResolvedValue({ user: client, accessToken: 't' });
    const user = userEvent.setup();
    renderApp('/book');

    await user.type(await screen.findByLabelText('Email'), 'cleo@test.local');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Book a lesson' })).toBeInTheDocument();
  });
});

describe('booking wizard', () => {
  const AREA = { id: 'mm', name: 'Metro Manila' };
  const PACKAGES = [
    { id: 'p1', code: 'OPTION_1', name: 'Option 1', sessions: 1, hoursPerSession: 5, totalHours: 5, price: '2500.00', reservationFee: '1000.00', description: null },
    { id: 'p2', code: 'OPTION_2', name: 'Option 2', sessions: 3, hoursPerSession: 5, totalHours: 15, price: '7000.00', reservationFee: '1000.00', description: null },
    { id: 'p3', code: 'OPTION_3', name: 'Option 3', sessions: 1, hoursPerSession: 12, totalHours: 12, price: null, reservationFee: null, description: null },
  ];

  const fillArea = async (user) => {
    await user.selectOptions(await screen.findByLabelText('Service area'), 'mm');
    await user.type(screen.getByLabelText('Pickup address'), '12 Mabini St, Makati');
    await user.selectOptions(screen.getByLabelText('Or choose a branch / city'), 'br1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
  };

  beforeEach(() => {
    publicApi.listServiceAreas.mockResolvedValue([AREA]);
    publicApi.listPackages.mockResolvedValue(PACKAGES);
    publicApi.getRecommended.mockResolvedValue([
      instructorCard(),
      instructorCard({ id: 'i2', fullName: 'Rita Reyes', rating: { isNew: true, display: 'New', count: 1 }, distanceKm: 12.4 }),
    ]);
    publicApi.getInstructorSlots.mockResolvedValue({ date: '2031-01-15', dayOff: false, slots: [SLOT] });
  });

  it('falls back to the branch list quietly when location is denied, and buys a package with cash', async () => {
    denyGeolocation();
    clientApi.purchasePackage.mockResolvedValue({ package: { id: 'pk1' }, checkoutUrl: null });
    clientApi.getMyPackage.mockResolvedValue({
      id: 'pk1',
      name: 'Option 2',
      status: 'ACTIVE',
      paymentStatus: 'AWAITING_CASH',
      sessionsTotal: 3,
      sessionsUsed: 1,
      sessionsCompleted: 0,
      sessionsRemaining: 2,
      minutesPerSession: 300,
      instructor: { id: 'i1', fullName: 'Juan Dela Cruz', branch: null },
      serviceArea: AREA,
      trainingType: 'OWN_CAR',
      pickupAddress: '12 Mabini St, Makati',
      price: '7000.00',
      reservationFee: '1000.00',
      amountPaid: '0.00',
      balance: '7000.00',
      amountDue: '1000.00',
      sessions: [],
      payments: [],
      canBookNext: true,
      canPay: true,
      canCancel: true,
    });
    const user = userEvent.setup();
    renderApp('/client/book');

    await user.click(await screen.findByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText(/pick the nearest branch instead/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await fillArea(user);
    expect(clientApi.updateProfile).toHaveBeenCalledWith({
      savedLocation: { city: 'Makati', latitude: 14.5547, longitude: 121.0244 },
    });

    expect(await screen.findByText('₱7,000.00')).toBeInTheDocument();
    expect(publicApi.listPackages).toHaveBeenCalledWith({ serviceAreaId: 'mm', trainingType: 'OWN_CAR' });
    expect(screen.getByText('Most popular')).toBeInTheDocument();
    expect(screen.getByText('Option 3').closest('button')).toBeDisabled();
    await user.click(screen.getByText('Option 2').closest('button'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const juan = (await screen.findByText('Juan Dela Cruz')).closest('button');
    expect(within(juan).getByText('★ 4.6 (12)')).toBeInTheDocument();
    expect(within(juan).getByText(/1.2 km away/)).toBeInTheDocument();
    expect(within(screen.getByText('Rita Reyes').closest('button')).getByText('New')).toBeInTheDocument();
    expect(publicApi.getRecommended).toHaveBeenCalledWith(expect.objectContaining({ lat: 14.5547, lng: 121.0244, duration: 300 }));
    await user.click(juan);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/Each session is 5 hours/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    expect(publicApi.getInstructorSlots).toHaveBeenLastCalledWith('i1', expect.objectContaining({ duration: 300 }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByLabelText(/Pay reservation in cash/));
    expect(screen.getByText('Pay your instructor in person and get a receipt number.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review booking' }));

    expect(await screen.findByText('₱6,000.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(clientApi.purchasePackage).toHaveBeenCalledWith({
      packageId: 'p2',
      serviceAreaId: 'mm',
      trainingType: 'OWN_CAR',
      instructorId: 'i1',
      scheduledAt: SLOT.start,
      pickupAddress: '12 Mabini St, Makati',
      paymentMethod: 'CASH',
    });
    expect(await screen.findByText('Package booked. Your instructor will confirm session 1.')).toBeInTheDocument();
    expect(checkout.goToCheckout).not.toHaveBeenCalled();
  });

  it('uses the browser location, browses instructors, and pays the reservation online', async () => {
    allowGeolocation();
    geoApi.reverseGeocode.mockResolvedValue({
      label: 'Poblacion, Makati',
      barangay: 'Poblacion',
      city: 'Makati',
      province: 'Metro Manila',
      address: '12 Mabini St, Poblacion, Makati',
    });
    publicApi.listInstructors.mockResolvedValue(page([instructorCard({ id: 'i3', fullName: 'Rico Villanueva' })]));
    clientApi.purchasePackage.mockResolvedValue({ package: { id: 'pk2' }, checkoutUrl: 'https://checkout.paymongo.test/cs_1' });
    const user = userEvent.setup();
    renderApp('/client/book');

    await user.selectOptions(await screen.findByLabelText('Service area'), 'mm');
    await user.click(screen.getByLabelText(/Car Rental Training/));
    await user.type(screen.getByLabelText('Pickup address'), '5 Rizal Ave, Pasig');
    await user.click(screen.getByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('Poblacion, Makati')).toBeInTheDocument();
    expect(screen.getByText(/14.55600, 121.02300 · nearest branch Makati/)).toBeInTheDocument();
    expect(screen.getByLabelText('Pickup address')).toHaveValue('5 Rizal Ave, Pasig');
    await user.click(screen.getByRole('button', { name: /Use as pickup address/ }));
    expect(screen.getByLabelText('Pickup address')).toHaveValue('12 Mabini St, Poblacion, Makati');
    expect(clientApi.updateProfile).toHaveBeenCalledWith({ savedLocation: { city: 'Makati', latitude: 14.556, longitude: 121.023 } });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(publicApi.listPackages).toHaveBeenCalledWith({ serviceAreaId: 'mm', trainingType: 'CAR_RENTAL' }));

    await user.click((await screen.findByText('Option 1')).closest('button'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('tab', { name: 'Choose instructor' }));
    await user.click(await screen.findByText('Rico Villanueva'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByLabelText(/reservation online/));
    await user.click(screen.getByRole('button', { name: 'Review booking' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm and pay reservation' }));

    await waitFor(() => expect(checkout.goToCheckout).toHaveBeenCalledWith('https://checkout.paymongo.test/cs_1'));
    expect(clientApi.purchasePackage).toHaveBeenCalledWith(
      expect.objectContaining({ instructorId: 'i3', paymentMethod: 'ONLINE', trainingType: 'CAR_RENTAL', packageId: 'p1' }),
    );
  });

  it('sends the client back to pick a time when the slot was taken meanwhile', async () => {
    clientApi.getProfile.mockResolvedValue({
      id: 'c1',
      fullName: 'Cleo',
      savedLocation: { city: 'Makati', latitude: 14.5547, longitude: 121.0244 },
    });
    clientApi.purchasePackage.mockRejectedValue(
      Object.assign(new Error('x'), { response: { status: 409, data: { error: { code: 'SLOT_TAKEN', message: 'That time overlaps another session' } } } }),
    );
    const user = userEvent.setup();
    renderApp('/client/book');

    expect(await screen.findByText('Makati')).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText('Service area'), 'mm');
    await user.type(screen.getByLabelText('Pickup address'), '12 Mabini St, Makati');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click((await screen.findByText('Option 1')).closest('button'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByText('Juan Dela Cruz'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByLabelText(/Pay reservation in cash/));
    await user.click(screen.getByRole('button', { name: 'Review booking' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText('That time overlaps another session. Please pick another time.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pick the date and start time of session 1' })).toBeInTheDocument();
  });
});

describe('my packages', () => {
  const pkg = (overrides = {}) => ({
    id: 'pk1',
    name: 'Option 2',
    status: 'ACTIVE',
    paymentStatus: 'RESERVED',
    sessionsTotal: 3,
    sessionsUsed: 1,
    sessionsCompleted: 1,
    sessionsRemaining: 2,
    minutesPerSession: 300,
    instructor: { id: 'i1', fullName: 'Juan Dela Cruz', branch: { id: 'br1', name: 'Makati' } },
    serviceArea: { id: 'mm', name: 'Metro Manila' },
    trainingType: 'OWN_CAR',
    pickupAddress: '12 Mabini St, Makati',
    price: '7000.00',
    reservationFee: '1000.00',
    amountPaid: '1000.00',
    balance: '6000.00',
    amountDue: '6000.00',
    sessions: [{ id: 'b1', sessionNumber: 1, status: 'COMPLETED', scheduledAt: PAST, durationMinutes: 300 }],
    payments: [{ id: 'pay1', amount: '1000.00', method: 'Online', status: 'PAID', receiptNumber: null, paidAt: PAST }],
    canBookNext: true,
    canPay: true,
    canCancel: true,
    ...overrides,
  });

  it('books the next session from the package page', async () => {
    clientApi.getMyPackage.mockResolvedValue(pkg());
    clientApi.bookNextSession.mockResolvedValue(pkg({ sessionsUsed: 2 }));
    publicApi.getInstructorSlots.mockResolvedValue({ date: '2031-01-15', dayOff: false, slots: [SLOT] });
    const user = userEvent.setup();
    renderApp('/client/packages/pk1');

    expect(await screen.findByText('1 of 3 sessions booked · 1 completed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Book session 2' }));
    const dialog = screen.getByRole('dialog', { name: 'Book session 2 of 3' });
    await user.click(await within(dialog).findByRole('button', { name: '09:00' }));
    await user.click(within(dialog).getByRole('button', { name: 'Book session' }));

    await waitFor(() => expect(clientApi.bookNextSession).toHaveBeenCalledWith('pk1', SLOT.start));
    expect(publicApi.getInstructorSlots).toHaveBeenCalledWith('i1', expect.objectContaining({ duration: 300 }));
  });

  it('pays the balance online', async () => {
    clientApi.getMyPackage.mockResolvedValue(pkg());
    const user = userEvent.setup();
    renderApp('/client/packages/pk1');

    await user.click(await screen.findByRole('button', { name: 'Pay balance online (₱6,000.00)' }));
    expect(checkout.startPackagePayment).toHaveBeenCalledWith('pk1');
  });

  it('after checkout polls until the payment shows up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const before = pkg({ paymentStatus: 'UNPAID', amountPaid: '0.00', payments: [] });
    clientApi.getMyPackage
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValue(pkg({ payments: [{ id: 'pay1', amount: '1000.00', method: 'Online', status: 'PAID', receiptNumber: null, paidAt: new Date().toISOString() }] }));
    renderApp('/client/packages/pk1?payment=return');

    expect(await screen.findByText(/Confirming payment/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(await screen.findByText('Payment received. Thank you!')).toBeInTheDocument();
  });
});

describe('client home', () => {
  it('shows the next session with Pay now for unpaid online, and the summary cards', async () => {
    const next = booking({ paymentMethod: 'ONLINE', paymentStatus: 'UNPAID', paymentDueAt: '2031-01-14T02:30:00.000Z' });
    clientApi.getDashboard.mockResolvedValue({
      nextSession: next,
      upcoming: [next],
      unpaid: [next],
      toRate: [],
      counts: { upcoming: 3, unpaid: 1, toRate: 0 },
      unreadNotifications: 2,
    });
    const user = userEvent.setup();
    renderApp('/client');

    expect(await screen.findByText('Next session')).toBeInTheDocument();
    expect(screen.getByText('Upcoming bookings').parentElement).toHaveTextContent('3');
    expect(screen.getByText('Unpaid bookings').parentElement).toHaveTextContent('1');
    const payButtons = screen.getAllByRole('button', { name: 'Pay now' });
    await user.click(payButtons[0]);
    expect(checkout.startPayment).toHaveBeenCalledWith('b1');
  });
});

describe('my bookings', () => {
  it('switches tabs and pages', async () => {
    clientApi.listMyBookings.mockResolvedValue({ data: [booking()], meta: { page: 1, limit: 20, total: 30 } });
    const user = userEvent.setup();
    renderApp('/client/bookings');

    await screen.findByText('Basic Driving');
    expect(clientApi.listMyBookings).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'upcoming', page: 1 }));
    await user.click(screen.getByRole('tab', { name: 'Cancelled' }));
    await waitFor(() => expect(clientApi.listMyBookings).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'cancelled' })));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(clientApi.listMyBookings).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'cancelled', page: 2 })),
    );
  });

  it('shows payment, receipt, history and only the valid actions', async () => {
    clientApi.getMyBooking.mockResolvedValue(
      booking({
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        receiptNumber: 'OR-0042',
        canPay: false,
        canCancel: false,
        canReschedule: false,
        history: [
          { id: 'h1', action: 'CONFIRMED', fromStatus: 'PENDING', toStatus: 'CONFIRMED', reason: null, actor: { id: 'i1', fullName: 'Juan Dela Cruz' }, actorRole: 'INSTRUCTOR', createdAt: PAST },
          { id: 'h2', action: 'RESCHEDULED', fromStatus: 'CONFIRMED', toStatus: 'CONFIRMED', reason: 'Rain', oldScheduledAt: PAST, newScheduledAt: PAST, actor: { id: 'i1', fullName: 'Juan Dela Cruz' }, actorRole: 'INSTRUCTOR', createdAt: PAST },
        ],
      }),
    );
    renderApp('/client/bookings/b1');

    expect(await screen.findByText('OR-0042')).toBeInTheDocument();
    expect(screen.getAllByText(/Juan Dela Cruz \(Instructor\)/)).toHaveLength(2);
    expect(screen.getByText('Reason: Rain')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay|Reschedule|Cancel booking/ })).not.toBeInTheDocument();
  });

  it('reschedules into an open slot with a reason', async () => {
    clientApi.getMyBooking.mockResolvedValue(booking());
    publicApi.getInstructorSlots.mockResolvedValue({ date: '2031-01-15', dayOff: false, slots: [SLOT] });
    clientApi.rescheduleMyBooking.mockResolvedValue({});
    const user = userEvent.setup();
    renderApp('/client/bookings/b1');

    await user.click(await screen.findByRole('button', { name: 'Reschedule' }));
    const dialog = screen.getByRole('dialog', { name: 'Reschedule booking' });
    await user.click(await within(dialog).findByRole('button', { name: '09:00' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save new time' }));
    expect(await within(dialog).findByText('Tell your instructor why')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Exam');
    await user.click(within(dialog).getByRole('button', { name: 'Save new time' }));

    await waitFor(() => expect(clientApi.rescheduleMyBooking).toHaveBeenCalledWith('b1', SLOT.start, 'Exam'));
  });

  it('after checkout shows "Confirming payment…" and polls until the webhook marks it paid', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const unpaid = booking({ paymentMethod: 'ONLINE', paymentStatus: 'UNPAID' });
    clientApi.getMyBooking.mockResolvedValueOnce(unpaid).mockResolvedValueOnce(unpaid).mockResolvedValue({ ...unpaid, paymentStatus: 'PAID', canPay: false });
    renderApp('/client/bookings/b1?payment=return');

    expect(await screen.findByText(/Confirming payment/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(await screen.findByText('Payment received. Thank you!')).toBeInTheDocument();
    expect(clientApi.getMyBooking).toHaveBeenCalledTimes(3);
  });
});

describe('client profile', () => {
  it('saves name, phone and saved location, and shows a taken phone under the field', async () => {
    allowGeolocation();
    geoApi.reverseGeocode.mockResolvedValue(null);
    clientApi.updateProfile
      .mockRejectedValueOnce(
        Object.assign(new Error('x'), {
          response: { status: 409, data: { error: { code: 'PHONE_ALREADY_REGISTERED', message: 'That phone number is already in use' } } },
        }),
      )
      .mockResolvedValue({});
    const user = userEvent.setup();
    renderApp('/client/profile');

    await user.type(await screen.findByLabelText('Mobile number'), '+639171112233');
    await user.type(screen.getByLabelText('City'), 'Makati');
    await user.click(screen.getByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('14.5560, 121.0230')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('That phone number is already in use')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(clientApi.updateProfile).toHaveBeenLastCalledWith({
        fullName: 'Cleo Client',
        phone: '+639171112233',
        savedLocation: { city: 'Makati', latitude: 14.556, longitude: 121.023 },
      }),
    );
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/change-password');
  });
});

describe('current location without a place name', () => {
  it('prefills an empty pickup address when found, and falls back to coordinates when the lookup fails', async () => {
    allowGeolocation();
    publicApi.listServiceAreas.mockResolvedValue([{ id: 'mm', name: 'Metro Manila' }]);
    geoApi.reverseGeocode.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderApp('/client/book');

    await user.click(await screen.findByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('your current location')).toBeInTheDocument();
    expect(screen.getByText(/nearest branch Makati/)).toBeInTheDocument();
    expect(screen.getByLabelText('Pickup address')).toHaveValue('');

    geoApi.reverseGeocode.mockResolvedValueOnce({ label: 'Poblacion, Makati', city: 'Makati', address: '12 Mabini St, Poblacion, Makati' });
    await user.click(screen.getByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('Poblacion, Makati')).toBeInTheDocument();
    expect(screen.getByLabelText('Pickup address')).toHaveValue('12 Mabini St, Poblacion, Makati');
  });
});
