import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../src/api/auth';
import * as instructorApi from '../src/api/instructor';
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

vi.mock('../src/api/instructor', () => ({
  getMyProfile: vi.fn(),
  getDashboard: vi.fn(),
  listMyBookings: vi.fn(),
  getMyBooking: vi.fn(),
  getBookingHistory: vi.fn(),
  confirmBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  cancelBooking: vi.fn(),
  recordCash: vi.fn(),
  getSchedule: vi.fn(),
  getSlots: vi.fn(),
  listClients: vi.fn(),
  getClient: vi.fn(),
  addClientNote: vi.fn(),
  getAvailability: vi.fn(),
  saveAvailability: vi.fn(),
  addDayOff: vi.fn(),
  removeDayOff: vi.fn(),
  listCash: vi.fn(),
  requestVoid: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  listRatings: vi.fn(),
}));

const instructor = { id: 'i1', email: 'ian@test.local', fullName: 'Ian Instructor', role: 'INSTRUCTOR', mustChangePassword: false };

const FUTURE = '2031-01-15T02:00:00.000Z';
const PAST = '2020-01-15T02:00:00.000Z';

const booking = (overrides = {}) => ({
  id: 'b1',
  lessonType: 'Basic Driving',
  area: null,
  scheduledAt: FUTURE,
  endsAt: FUTURE,
  durationMinutes: 60,
  status: 'PENDING',
  notes: null,
  cancelReason: null,
  createdAt: PAST,
  paymentStatus: 'AWAITING_CASH',
  payments: [],
  instructor: { id: 'i1', fullName: 'Ian Instructor', branch: null },
  lastAction: null,
  rated: false,
  client: { id: 'c1', fullName: 'Cleo Client', phone: null },
  ...overrides,
});

const page = (data, extra = {}) => ({ data, meta: { page: 1, limit: 20, total: data.length, ...extra } });

const noNotifications = page([], { unread: 0 });

const renderApp = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const actionsFor = (name) => screen.getAllByRole('button', { name: new RegExp(`for ${name}$`) }).map((b) => b.textContent);

beforeEach(() => {
  vi.resetAllMocks();
  authApi.refresh.mockRejectedValue(new Error('no session'));
  resetAuthBootstrap();
  useAuthStore.setState({ user: instructor, accessToken: 't', status: 'authenticated' });
  instructorApi.listNotifications.mockResolvedValue(noNotifications);
});

afterEach(() => vi.useRealTimers());

describe('instructor home', () => {
  const dashboard = {
    today: [booking({ status: 'CONFIRMED', scheduledAt: PAST }), booking({ id: 'b2', client: { id: 'c2', fullName: 'Dan Driver', phone: null } })],
    upcoming: [booking({ id: 'b3', client: { id: 'c3', fullName: 'Eva Early', phone: null } })],
    counts: { awaitingConfirmation: 4, cashToCollectToday: 1, needsCompletion: 2 },
    cashToday: { amount: '1500.00', count: 1, currency: 'PHP' },
    rating: { average: null, count: 1, isNew: true, display: 'New', breakdown: {} },
  };

  it('shows today, counts, cash and rating, with quick actions', async () => {
    instructorApi.getDashboard.mockResolvedValue(dashboard);
    instructorApi.confirmBooking.mockResolvedValue({ booking: booking({ status: 'CONFIRMED' }) });
    const user = userEvent.setup();
    renderApp('/instructor');

    expect(await screen.findByText('Cleo Client')).toBeInTheDocument();
    expect(screen.getByText('Awaiting confirmation').parentElement).toHaveTextContent('4');
    expect(screen.getByText('My average rating').parentElement).toHaveTextContent('New');
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument();
    expect(screen.getByText('Eva Early')).toBeInTheDocument();
    expect(screen.getByText('Cash due')).toBeInTheDocument();

    expect(actionsFor('Cleo Client')).toEqual(['Mark completed', 'Mark no-show', 'Record cash']);
    expect(actionsFor('Dan Driver')).toEqual(['Confirm']);

    await user.click(screen.getByRole('button', { name: 'Confirm for Dan Driver' }));
    expect(instructorApi.confirmBooking).toHaveBeenCalledWith('b2');
    await waitFor(() => expect(instructorApi.getDashboard).toHaveBeenCalledTimes(2));
  });

  it('shows an error with retry', async () => {
    instructorApi.getDashboard.mockRejectedValueOnce(
      Object.assign(new Error('x'), { response: { status: 500, data: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } } } }),
    );
    instructorApi.getDashboard.mockResolvedValue({ ...dashboard, today: [] });
    const user = userEvent.setup();
    renderApp('/instructor');

    const alert = await screen.findByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No sessions today.')).toBeInTheDocument();
  });
});

describe('instructor bookings', () => {
  it('offers only the actions valid for each status', async () => {
    instructorApi.listMyBookings.mockResolvedValue(
      page([
        booking({ id: 'p', client: { id: 'a', fullName: 'Pending Pat', phone: null } }),
        booking({ id: 'f', status: 'CONFIRMED', client: { id: 'b', fullName: 'Future Fay', phone: null } }),
        booking({ id: 'd', status: 'COMPLETED', scheduledAt: PAST, paymentStatus: 'PAID', client: { id: 'c', fullName: 'Done Don', phone: null } }),
        booking({ id: 'x', status: 'CANCELLED', client: { id: 'd', fullName: 'Gone Gil', phone: null } }),
      ]),
    );
    renderApp('/instructor/bookings');

    await screen.findByText('Pending Pat');
    expect(actionsFor('Pending Pat')).toEqual(['Confirm', 'Reschedule', 'Cancel']);
    expect(actionsFor('Future Fay')).toEqual(['Record cash', 'Reschedule', 'Cancel']);
    expect(screen.queryByRole('button', { name: /for Done Don$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /for Gone Gil$/ })).not.toBeInTheDocument();
  });

  it('asks for a reason before cancelling and confirms before a no-show', async () => {
    instructorApi.listMyBookings.mockResolvedValue(page([booking({ status: 'CONFIRMED', scheduledAt: PAST })]));
    instructorApi.cancelBooking.mockResolvedValue({});
    instructorApi.markNoShow.mockResolvedValue({});
    const user = userEvent.setup();
    renderApp('/instructor/bookings');

    await user.click(await screen.findByRole('button', { name: 'Cancel for Cleo Client' }));
    let dialog = screen.getByRole('dialog', { name: 'Cancel session?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel session' }));
    expect(await within(dialog).findByText('A reason is required')).toBeInTheDocument();
    expect(instructorApi.cancelBooking).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Reason'), 'Car trouble');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel session' }));
    await waitFor(() => expect(instructorApi.cancelBooking).toHaveBeenCalledWith('b1', 'Car trouble'));

    await user.click(await screen.findByRole('button', { name: 'Mark no-show for Cleo Client' }));
    dialog = screen.getByRole('dialog', { name: 'Mark as no-show?' });
    expect(instructorApi.markNoShow).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Mark no-show' }));
    await waitFor(() => expect(instructorApi.markNoShow).toHaveBeenCalledWith('b1'));
  });

  it('reschedules only into an open slot, with a reason', async () => {
    instructorApi.listMyBookings.mockResolvedValue(page([booking()]));
    instructorApi.getSlots.mockResolvedValue({
      date: '2031-01-15',
      dayOff: false,
      slots: [
        { start: '2031-01-15T01:00:00.000Z', time: '09:00' },
        { start: '2031-01-15T05:00:00.000Z', time: '13:00' },
      ],
    });
    instructorApi.rescheduleBooking.mockResolvedValue({});
    const user = userEvent.setup();
    renderApp('/instructor/bookings');

    await user.click(await screen.findByRole('button', { name: 'Reschedule for Cleo Client' }));
    const dialog = screen.getByRole('dialog', { name: 'Reschedule session' });
    await waitFor(() => expect(instructorApi.getSlots).toHaveBeenCalledWith({ date: '2031-01-15', bookingId: 'b1' }));
    await user.click(await within(dialog).findByRole('button', { name: '13:00' }));
    await user.type(within(dialog).getByLabelText('Reason'), 'Road closure');
    await user.click(within(dialog).getByRole('button', { name: 'Save new time' }));

    await waitFor(() =>
      expect(instructorApi.rescheduleBooking).toHaveBeenCalledWith('b1', '2031-01-15T05:00:00.000Z', 'Road closure'),
    );
  });
});

describe('notification bell', () => {
  it('polls every 30 seconds and opens the related booking with its history', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    instructorApi.getDashboard.mockResolvedValue({
      today: [],
      upcoming: [],
      counts: { awaitingConfirmation: 0, cashToCollectToday: 0, needsCompletion: 0 },
      cashToday: { amount: '0.00', count: 0, currency: 'PHP' },
      rating: { average: null, count: 0, isNew: true, display: 'New', breakdown: {} },
    });
    instructorApi.listNotifications.mockResolvedValueOnce(noNotifications);
    instructorApi.listNotifications.mockResolvedValue(
      page(
        [{ id: 'n1', type: 'BOOKING_CREATED', title: 'New booking request', message: 'Cleo booked', bookingId: 'b1', isRead: false, createdAt: PAST }],
        { unread: 1 },
      ),
    );
    instructorApi.markNotificationRead.mockResolvedValue({});
    instructorApi.getMyBooking.mockResolvedValue(booking());
    instructorApi.getBookingHistory.mockResolvedValue([
      { id: 'h1', action: 'CREATED', fromStatus: null, toStatus: 'PENDING', reason: null, actor: { id: 'c1', fullName: 'Cleo Client' }, actorRole: 'CLIENT', createdAt: PAST },
    ]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/instructor');

    const bell = await screen.findByRole('button', { name: 'Notifications' });
    expect(instructorApi.listNotifications).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    await waitFor(() => expect(instructorApi.listNotifications).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBe(bell);

    await user.click(bell);
    await user.click(await screen.findByRole('button', { name: /New booking request/ }));

    expect(instructorApi.markNotificationRead).toHaveBeenCalledWith('n1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Booking' })).toBeInTheDocument();
    expect(await screen.findByText('Booked')).toBeInTheDocument();
    expect(screen.getByText(/Cleo Client \(Client\)/)).toBeInTheDocument();
  });
});

describe('instructor ratings', () => {
  it('shows the average, breakdown 5 to 1, and comments with session dates', async () => {
    instructorApi.listRatings.mockResolvedValue({
      data: [{ id: 'r1', stars: 5, comment: 'Very patient', sessionDate: '2026-09-20T01:00:00.000Z', createdAt: PAST }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        summary: {
          average: 4.3,
          count: 3,
          isNew: false,
          display: '4.3',
          breakdown: [
            { stars: 5, count: 2 },
            { stars: 4, count: 0 },
            { stars: 3, count: 0 },
            { stars: 2, count: 1 },
            { stars: 1, count: 0 },
          ],
        },
      },
    });
    renderApp('/instructor/ratings');

    expect(await screen.findByText('Very patient')).toBeInTheDocument();
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('Sep 20, 2026')).toBeInTheDocument();
    const rows = screen.getAllByText(/^[1-5]★$/).map((n) => n.textContent);
    expect(rows).toEqual(['5★', '4★', '3★', '2★', '1★']);
    expect(screen.queryByText(/hidden/i)).not.toBeInTheDocument();
  });
});

describe('record cash', () => {
  it('prefills the lesson price and shows the OR number the system issued', async () => {
    instructorApi.listMyBookings.mockResolvedValue(
      page([booking({ status: 'CONFIRMED', paymentStatus: 'AWAITING_CASH', price: '1200.00' })]),
    );
    instructorApi.recordCash.mockResolvedValue({
      booking: booking({ status: 'CONFIRMED', paymentStatus: 'PAID', receiptNumber: 'OR-2026-000042' }),
    });
    const user = userEvent.setup();
    renderApp('/instructor/bookings');

    await user.click(await screen.findByRole('button', { name: 'Record cash for Cleo Client' }));
    const dialog = screen.getByRole('dialog', { name: 'Record cash payment' });
    expect(within(dialog).getByLabelText('Amount received (PHP)')).toHaveValue('1200.00');
    expect(within(dialog).queryByLabelText(/Receipt number/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Record cash' }));

    await waitFor(() => expect(instructorApi.recordCash).toHaveBeenCalledWith('b1', { amount: '1200.00' }));
    const done = await screen.findByRole('dialog', { name: 'Cash recorded' });
    expect(within(done).getByText('OR-2026-000042')).toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(instructorApi.listMyBookings).toHaveBeenCalledTimes(2);
  });
});

describe('package sessions', () => {
  it('shows session x of n and the pickup address, and prefills the package balance for cash', async () => {
    const pkg = {
      id: 'pk1',
      name: 'Option 2',
      sessionNumber: 2,
      sessionsTotal: 3,
      trainingType: 'OWN_CAR',
      serviceArea: { id: 'mm', name: 'Metro Manila' },
      pickupAddress: '12 Mabini St, Makati',
      paymentStatus: 'RESERVED',
      price: '7000.00',
      amountPaid: '1000.00',
      balance: '6000.00',
    };
    instructorApi.listMyBookings.mockResolvedValue(
      page([booking({ status: 'CONFIRMED', paymentStatus: 'AWAITING_CASH', lessonType: 'Option 2', package: pkg })]),
    );
    const user = userEvent.setup();
    renderApp('/instructor/bookings');

    expect(await screen.findByText(/Option 2 · session 2 of 3/)).toBeInTheDocument();
    expect(screen.getByText('Pickup: 12 Mabini St, Makati')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record cash for Cleo Client' }));
    const dialog = screen.getByRole('dialog', { name: 'Record cash payment' });
    expect(within(dialog).getByLabelText('Amount received (PHP)')).toHaveValue('6000.00');
  });
});
