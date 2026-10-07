import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../src/api/auth';
import * as clientApi from '../src/api/clientPortal';
import * as publicApi from '../src/api/public';
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

const client = { id: 'c1', email: 'cleo@test.local', fullName: 'Cleo Client', role: 'CLIENT', mustChangePassword: false };

const top = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `i${i + 1}`,
    fullName: `Juan Number${i + 1}`,
    branch: { name: 'Makati' },
    average: 4.9 - i * 0.1,
    count: 23 - i,
    comment: i === 0 ? 'Very patient and clear.' : null,
  }));

const renderApp = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const booking = (overrides = {}) => ({
  id: 'b1',
  lessonType: 'Option 2',
  scheduledAt: '2031-01-15T02:00:00.000Z',
  durationMinutes: 300,
  status: 'CONFIRMED',
  paymentMethod: 'CASH',
  paymentStatus: 'AWAITING_CASH',
  price: null,
  instructor: { id: 'i1', fullName: 'Juan Dela Cruz', branch: { id: 'br1', name: 'Makati' } },
  canPay: false,
  canCancel: false,
  canReschedule: false,
  canRate: false,
  ratingState: 'NOT_YET',
  rating: null,
  history: [],
  package: null,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  authApi.refresh.mockRejectedValue(new Error('no session'));
  resetAuthBootstrap();
  useAuthStore.setState({ user: null, accessToken: null, status: 'checking' });
  clientApi.listNotifications.mockResolvedValue({ data: [], meta: { page: 1, limit: 5, total: 0, unread: 0 } });
});

describe('Top Rated Instructors on the landing page', () => {
  it('shows up to five cards with stars, average, review count and comment', async () => {
    publicApi.getTopInstructors.mockResolvedValue(top(5));
    renderApp('/');

    const section = (await screen.findByRole('heading', { name: 'Top Rated Instructors' })).closest('section');
    const cards = within(section).getAllByRole('article');
    expect(cards).toHaveLength(5);
    expect(within(cards[0]).getByText('4.9')).toBeInTheDocument();
    expect(within(cards[0]).getByText('(23 reviews)')).toBeInTheDocument();
    expect(within(cards[0]).getByText('“Very patient and clear.”')).toBeInTheDocument();
    expect(within(cards[0]).getByRole('link', { name: 'Book with Juan' })).toHaveAttribute('href', '/client/book?instructor=i1');
  });

  it('shows only those who qualify, and hides the section when nobody does', async () => {
    publicApi.getTopInstructors.mockResolvedValueOnce(top(2));
    const { unmount } = renderApp('/');
    const section = (await screen.findByRole('heading', { name: 'Top Rated Instructors' })).closest('section');
    expect(within(section).getAllByRole('article')).toHaveLength(2);
    unmount();

    publicApi.getTopInstructors.mockResolvedValueOnce([]);
    renderApp('/');
    await waitFor(() => expect(publicApi.getTopInstructors).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('heading', { name: 'Top Rated Instructors' })).not.toBeInTheDocument();
  });

  it('a logged-out visitor logs in and lands in the booking flow with the instructor preselected', async () => {
    publicApi.getTopInstructors.mockResolvedValue(top(1));
    publicApi.getPublicInstructor.mockResolvedValue({
      id: 'i1',
      fullName: 'Juan Number1',
      branch: { id: 'br1', name: 'Makati' },
      rating: { isNew: false, display: '4.9', count: 23 },
    });
    publicApi.listServiceAreas.mockResolvedValue([]);
    publicApi.listLocations.mockResolvedValue([]);
    clientApi.getProfile.mockResolvedValue({ id: 'c1', fullName: 'Cleo', savedLocation: null });
    authApi.login.mockResolvedValue({ user: client, accessToken: 't' });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: 'Book with Juan' }));
    await user.type(await screen.findByLabelText('Email'), 'cleo@test.local');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Book a lesson' })).toBeInTheDocument();
    expect(await screen.findByText(/Booking with/)).toHaveTextContent('Booking with Juan Number1');
    expect(publicApi.getPublicInstructor).toHaveBeenCalledWith('i1');
  });
});

describe('rating panel on a booking', () => {
  beforeEach(() => useAuthStore.setState({ user: client, accessToken: 't', status: 'authenticated' }));

  it.each([
    ['NOT_YET', 'You can rate after your session is completed.'],
    ['RATED', 'You already rated this session.'],
    ['EXPIRED', 'The rating period has ended.'],
  ])('explains %s instead of hiding the panel', async (ratingState, text) => {
    clientApi.getMyBooking.mockResolvedValue(
      booking({ ratingState, status: ratingState === 'NOT_YET' ? 'CONFIRMED' : 'COMPLETED', rating: ratingState === 'RATED' ? { stars: 4 } : null }),
    );
    renderApp('/client/bookings/b1');

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit rating' })).not.toBeInTheDocument();
  });

  it('shows the form when rating is open and surfaces the API message', async () => {
    clientApi.getMyBooking.mockResolvedValue(
      booking({ status: 'COMPLETED', ratingState: 'OPEN', canRate: true, rateUntil: '2031-01-29T02:00:00.000Z' }),
    );
    clientApi.rateBooking.mockRejectedValue(
      Object.assign(new Error('x'), {
        response: { status: 409, data: { error: { code: 'ALREADY_RATED', message: 'You already rated this session' } } },
      }),
    );
    const user = userEvent.setup();
    renderApp('/client/bookings/b1');

    await user.click(await screen.findByLabelText('5 stars'));
    await user.click(screen.getByRole('button', { name: 'Submit rating' }));
    expect(await screen.findByText('You already rated this session')).toBeInTheDocument();
  });
});
