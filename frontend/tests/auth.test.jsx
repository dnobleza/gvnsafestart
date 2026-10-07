import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../src/api/auth';
import { resetAuthBootstrap } from '../src/features/auth/hooks/useAuthBootstrap';
import AppRoutes from '../src/routes';
import { useAuthStore } from '../src/store/authStore';

vi.mock('../src/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
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

const session = {
  user: { id: 'u1', email: 'ana@example.com', fullName: 'Ana Cruz', role: 'CLIENT' },
  accessToken: 'token',
};

const apiError = (status, error) => Object.assign(new Error(error.code), { response: { status, data: { success: false, error } } });

const renderApp = (route = '/') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const fillRegister = async (user, overrides = {}) => {
  const values = {
    'Full name': 'Ana Cruz',
    Email: 'ana@example.com',
    Password: 'Secret123',
    'Confirm password': 'Secret123',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(label), value);
  }
};

beforeEach(() => {
  vi.resetAllMocks();
  authApi.refresh.mockRejectedValue(apiError(401, { code: 'INVALID_REFRESH_TOKEN', message: 'x' }));
  resetAuthBootstrap();
  useAuthStore.setState({ user: null, accessToken: null, status: 'checking' });
});

describe('booking guard', () => {
  it('sends a signed-out visitor from Book now to the login page', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByRole('link', { name: 'Book now' })[0]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });

  it('takes a signed-in visitor straight to booking', async () => {
    useAuthStore.setState({ ...session, status: 'authenticated' });
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByRole('link', { name: 'Book now' })[0]);

    expect(screen.getByRole('heading', { level: 1, name: 'Book a lesson' })).toBeInTheDocument();
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it('signs out to the home page, not the login page', async () => {
    authApi.logout.mockResolvedValue({ loggedOut: true });
    useAuthStore.setState({ ...session, status: 'authenticated' });
    const user = userEvent.setup();
    renderApp('/book');

    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    expect(await screen.findByRole('heading', { level: 1, name: /build confidence/i })).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('restores the session from the refresh cookie on load', async () => {
    authApi.refresh.mockResolvedValue(session);
    renderApp('/book');

    expect(await screen.findByRole('heading', { level: 1, name: 'Book a lesson' })).toBeInTheDocument();
  });
});

describe('login', () => {
  it('shows field errors without calling the API', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows the API message for wrong credentials', async () => {
    authApi.login.mockRejectedValue(
      apiError(401, { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' }),
    );
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('disables the button while the request is in flight', async () => {
    let resolve;
    authApi.login.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled();
    resolve(session);
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
  });

  it('returns to the booking page the visitor came from', async () => {
    authApi.login.mockResolvedValue(session);
    const user = userEvent.setup();
    renderApp('/book');

    await screen.findByRole('heading', { level: 1, name: 'Log in' });
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Book a lesson' })).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'Secret123' });
  });

  it('links to registration and back', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('link', { name: 'Register' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Log in' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });
});

describe('registration', () => {
  it('validates password rules and matching confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/register');

    await fillRegister(user, { Password: 'short', 'Confirm password': 'other' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('puts a duplicate email error under the email field', async () => {
    authApi.register.mockRejectedValue(
      apiError(409, { code: 'EMAIL_ALREADY_REGISTERED', message: 'That email already has an account' }),
    );
    const user = userEvent.setup();
    renderApp('/register');

    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('That email already has an account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('maps API validation details onto fields', async () => {
    authApi.register.mockRejectedValue(
      apiError(400, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: [{ field: 'fullName', message: 'Name is not allowed' }],
      }),
    );
    const user = userEvent.setup();
    renderApp('/register');

    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Name is not allowed')).toBeInTheDocument();
  });

  it('signs the new client in and continues to booking', async () => {
    authApi.register.mockResolvedValue(session);
    const user = userEvent.setup();
    renderApp('/book');

    await user.click(await screen.findByRole('link', { name: 'Register' }));
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Book a lesson' })).toBeInTheDocument();
    expect(authApi.register).toHaveBeenCalledWith({
      fullName: 'Ana Cruz',
      email: 'ana@example.com',
      password: 'Secret123',
    });
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
});
