import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../src/api/auth';
import * as clientApi from '../src/api/clientPortal';
import * as instructorApi from '../src/api/instructor';
import Toaster from '../src/components/Toaster';
import { resetAuthBootstrap } from '../src/features/auth/hooks/useAuthBootstrap';
import AppRoutes from '../src/routes';
import { useAuthStore } from '../src/store/authStore';

// Every export becomes a mock, so pages that import more than these tests use still load.
const { mockAll } = vi.hoisted(() => ({
  mockAll: async (load) => Object.fromEntries(Object.keys(await load()).map((name) => [name, vi.fn()])),
}));

vi.mock('../src/api/auth', (load) => mockAll(load));
vi.mock('../src/api/clientPortal', (load) => mockAll(load));
vi.mock('../src/api/instructor', (load) => mockAll(load));

const HOUR = 3600000;
const client = { id: 'c1', email: 'cleo@test.local', fullName: 'Cleo Client', role: 'CLIENT', mustChangePassword: false };
const instructor = { id: 'i1', email: 'ian@test.local', fullName: 'Ian Instructor', role: 'INSTRUCTOR', mustChangePassword: false };

const page = (data, extra = {}) => ({ data, meta: { page: 1, limit: 20, total: data.length, ...extra } });

const ENDED = new Date(Date.now() - 4 * HOUR).toISOString();

const booking = (overrides = {}) => ({
  id: 'b1',
  lessonType: 'Basic Driving',
  scheduledAt: new Date(Date.now() - 5 * HOUR).toISOString(),
  endsAt: ENDED,
  durationMinutes: 60,
  status: 'CONFIRMED',
  paymentMethod: 'ONLINE',
  paymentStatus: 'PAID',
  price: '800.00',
  payments: [],
  instructor: { id: 'i1', fullName: 'Juan Dela Cruz', branch: null },
  client: { id: 'c1', fullName: 'Cleo Client', phone: null },
  lastAction: null,
  autoCompleted: false,
  autoCompletedAt: null,
  rating: null,
  history: [],
  ...overrides,
});

const autoCompleted = (overrides = {}) =>
  booking({
    status: 'COMPLETED',
    autoCompleted: true,
    autoCompletedAt: new Date(Date.parse(ENDED) + 2 * HOUR + 5 * 60000).toISOString(),
    ...overrides,
  });

const completedNotice = {
  id: 'n1',
  type: 'BOOKING_COMPLETED',
  title: 'Your session with Juan Dela Cruz was marked completed.',
  message: 'How was your session? Rate your instructor.',
  bookingId: 'b1',
  isRead: false,
  createdAt: new Date().toISOString(),
};

const renderApp = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
      <Toaster />
    </MemoryRouter>,
  );

const nextPoll = async () => {
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  authApi.refresh.mockRejectedValue(new Error('no session'));
  resetAuthBootstrap();
});

afterEach(() => vi.useRealTimers());

describe('client: auto-completed sessions', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: client, accessToken: 't', status: 'authenticated' });
    clientApi.listNotifications.mockResolvedValueOnce(page([], { unread: 0 }));
    clientApi.listNotifications.mockResolvedValue(page([completedNotice], { unread: 1 }));
  });

  it('refreshes Upcoming when the poll brings the completion, toasts, and shows it under Past with an Auto tag', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let completed = false;
    clientApi.listMyBookings.mockImplementation(async ({ tab }) => {
      if (tab === 'upcoming') return page(completed ? [] : [booking()]);
      if (tab === 'past') return page(completed ? [autoCompleted()] : []);
      return page([]);
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/client/bookings');

    expect(await screen.findByText('Basic Driving')).toBeInTheDocument();
    completed = true;
    await nextPoll();

    expect(await screen.findByText('Your session with Juan Dela Cruz was marked completed.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Basic Driving')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'Past' }));
    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Basic Driving')).toBeInTheDocument();
    const badge = within(table).getByText('Auto').closest('[title]');
    expect(badge).toHaveTextContent('Completed');
    expect(badge).toHaveAttribute('title', 'Completed automatically 2h 5m after the session ended');
  });

  it('shows a "Rate your session" card with inline stars once the session is auto-completed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const empty = { nextSession: null, upcoming: [], unpaid: [], toRate: [], packages: [], counts: { upcoming: 0, unpaid: 0, toRate: 0 } };
    clientApi.getDashboard.mockResolvedValueOnce(empty);
    clientApi.getDashboard.mockResolvedValue({
      ...empty,
      toRate: [autoCompleted({ canRate: true, ratingState: 'OPEN', rateUntil: new Date(Date.now() + 13 * 24 * HOUR).toISOString() })],
      counts: { upcoming: 0, unpaid: 0, toRate: 1 },
    });
    clientApi.rateBooking.mockResolvedValue({});
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/client');

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByText('Rate your session')).not.toBeInTheDocument();
    await nextPoll();

    expect(await screen.findByRole('heading', { name: 'Rate your session' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit rating' }));
    await waitFor(() => expect(clientApi.rateBooking).toHaveBeenCalledWith('b1', { stars: 4 }));
  });
});

describe('instructor: correcting an auto-completed session', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: instructor, accessToken: 't', status: 'authenticated' });
    instructorApi.listNotifications.mockResolvedValue(page([], { unread: 0 }));
    instructorApi.getBookingHistory.mockResolvedValue([]);
  });

  it('offers "Mark as no-show" with a countdown inside the 24-hour window', async () => {
    instructorApi.getMyBooking.mockResolvedValue(
      autoCompleted({ correctableUntil: new Date(Date.now() + 19.5 * HOUR).toISOString(), canCorrectNoShow: true }),
    );
    instructorApi.correctNoShow.mockResolvedValue({ booking: autoCompleted({ status: 'NO_SHOW' }) });
    const user = userEvent.setup();
    renderApp('/instructor/bookings/b1');

    expect(await screen.findByText('19h left to correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark Cleo Client as no-show' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('A reason is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Reason'), 'Client never arrived');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Confirm no-show' }));
    await waitFor(() => expect(instructorApi.correctNoShow).toHaveBeenCalledWith('b1', 'Client never arrived'));
  });

  it('hides the button and says the window closed after 24 hours', async () => {
    instructorApi.getMyBooking.mockResolvedValue(
      autoCompleted({ correctableUntil: new Date(Date.now() - HOUR).toISOString(), canCorrectNoShow: false }),
    );
    renderApp('/instructor/bookings/b1');

    expect(await screen.findByText('Correction window closed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /no-show/ })).not.toBeInTheDocument();
  });
});
