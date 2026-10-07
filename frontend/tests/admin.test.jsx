import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as adminApi from '../src/api/admin';
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
  getAutoCompleteStatus: vi.fn(),
  listAutoCompleteRuns: vi.fn(),
  runAutoCompleteNow: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const admin = { id: 'a1', email: 'admin@test.local', fullName: 'Ada Admin', role: 'ADMIN', mustChangePassword: false };
const client = { ...admin, id: 'c1', role: 'CLIENT', fullName: 'Cleo Client' };

const page = (data, extra = {}) => ({ data, meta: { page: 1, limit: 20, total: data.length, ...extra } });

const apiError = (status, error) =>
  Object.assign(new Error(error.code), { response: { status, data: { success: false, error } } });

const signIn = (user) => useAuthStore.setState({ user, accessToken: 't', status: 'authenticated' });

const renderApp = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const booking = {
  id: 'b1',
  lessonType: 'Beginner lesson',
  area: 'Quezon City',
  scheduledAt: '2030-01-15T02:00:00.000Z',
  durationMinutes: 60,
  status: 'PENDING',
  notes: null,
  cancelReason: null,
  createdAt: '2029-12-01T00:00:00.000Z',
  client: { id: 'c1', fullName: 'Cleo Client', email: 'cleo@test.local', phone: null },
};

beforeEach(() => {
  vi.resetAllMocks();
  adminApi.listNotifications.mockResolvedValue({ data: [], meta: { page: 1, limit: 5, total: 0, unread: 0 } });
  authApi.refresh.mockRejectedValue(new Error('no session'));
  resetAuthBootstrap();
  useAuthStore.setState({ user: null, accessToken: null, status: 'checking' });
  adminApi.getOverview.mockResolvedValue({
    todaysBookings: 3,
    revenueThisMonth: { amount: '12500.00', currency: 'PHP' },
    pendingBookings: 5,
    failedPayments: 2,
  });
});

describe('admin guard', () => {
  it('sends a signed-out visitor to login', async () => {
    renderApp('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });

  it('shows not authorized to a client', () => {
    signIn(client);
    renderApp('/admin/payments');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/do not have access/i);
    expect(adminApi.listPayments).not.toHaveBeenCalled();
  });

  it('forces a password change before the dashboard', async () => {
    signIn({ ...admin, mustChangePassword: true });
    authApi.changePassword.mockResolvedValue({ user: admin, accessToken: 't2' });
    const user = userEvent.setup();
    renderApp('/admin');

    expect(screen.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Current password'), 'Temp#Pass1234');
    await user.type(screen.getByLabelText('New password'), 'MyOwnPass1');
    await user.type(screen.getByLabelText('Confirm new password'), 'MyOwnPass1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(authApi.changePassword).toHaveBeenCalledWith({ currentPassword: 'Temp#Pass1234', newPassword: 'MyOwnPass1' });
  });
});

describe('overview', () => {
  it('shows the four KPI cards', async () => {
    signIn(admin);
    renderApp('/admin');

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText(/12,500\.00/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('payments', () => {
  const payment = {
    id: 'p1',
    amount: '1500.00',
    currency: 'PHP',
    status: 'FAILED',
    method: 'GCash',
    reference: null,
    paidAt: null,
    createdAt: '2030-01-10T02:00:00.000Z',
    client: { id: 'c1', fullName: 'Cleo Client', email: 'cleo@test.local' },
    booking: null,
  };

  it('shows totals and passes filters to the API', async () => {
    signIn(admin);
    adminApi.listPayments.mockResolvedValue(
      page([payment], {
        totals: {
          overall: { count: 1, amount: '1500.00' },
          byStatus: { FAILED: { count: 1, amount: '1500.00' } },
        },
      }),
    );
    const user = userEvent.setup();
    renderApp('/admin/payments');

    const totals = await screen.findByLabelText('Payment totals');
    await waitFor(() => expect(within(totals).getAllByText(/1,500\.00/).length).toBeGreaterThan(0));
    expect(screen.getByText('GCash')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'FAILED');
    await waitFor(() =>
      expect(adminApi.listPayments).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'FAILED', page: 1 })),
    );
  });

  it('shows an empty state', async () => {
    signIn(admin);
    adminApi.listPayments.mockResolvedValue(page([], { totals: { overall: { count: 0, amount: '0.00' }, byStatus: {} } }));
    renderApp('/admin/payments');
    expect(await screen.findByText('No payments match these filters.')).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    signIn(admin);
    adminApi.listPayments.mockRejectedValueOnce(apiError(500, { code: 'INTERNAL_ERROR', message: 'Something went wrong' }));
    adminApi.listPayments.mockResolvedValue(page([payment], { totals: null }));
    const user = userEvent.setup();
    renderApp('/admin/payments');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('GCash')).toBeInTheDocument();
  });

  it('pages through results', async () => {
    signIn(admin);
    adminApi.listPayments.mockResolvedValue({ data: [payment], meta: { page: 1, limit: 20, total: 45 } });
    const user = userEvent.setup();
    renderApp('/admin/payments');

    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(adminApi.listPayments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});

describe('bookings', () => {
  it('reschedules a booking and refreshes the list', async () => {
    signIn(admin);
    adminApi.listBookings.mockResolvedValue(page([booking]));
    adminApi.rescheduleBooking.mockResolvedValue({ booking: { ...booking } });
    const user = userEvent.setup();
    renderApp('/admin/bookings');

    await user.click(await screen.findByRole('button', { name: 'Reschedule booking for Cleo Client' }));
    const dialog = screen.getByRole('dialog', { name: 'Reschedule booking' });
    const input = within(dialog).getByLabelText('New date and time');
    await user.clear(input);
    await user.type(input, '2031-03-04T09:30');
    await user.click(within(dialog).getByRole('button', { name: 'Save new time' }));
    expect(await within(dialog).findByText('A reason is required')).toBeInTheDocument();
    expect(adminApi.rescheduleBooking).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Reason'), 'Branch closed');
    await user.click(within(dialog).getByRole('button', { name: 'Save new time' }));

    await waitFor(() =>
      expect(adminApi.rescheduleBooking).toHaveBeenCalledWith(
        'b1',
        new Date('2031-03-04T09:30').toISOString(),
        'Branch closed',
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminApi.listBookings).toHaveBeenCalledTimes(2);
  });

  it('shows an invalid transition from the API inside the dialog', async () => {
    signIn(admin);
    adminApi.listBookings.mockResolvedValue(page([booking]));
    adminApi.approveBooking.mockRejectedValue(
      apiError(400, { code: 'INVALID_BOOKING_TRANSITION', message: 'Booking can no longer be confirmed' }),
    );
    const user = userEvent.setup();
    renderApp('/admin/bookings');

    await user.click(await screen.findByRole('button', { name: 'Confirm booking for Cleo Client' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm booking' });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Booking can no longer be confirmed');
  });

  it('offers no actions on a cancelled booking', async () => {
    signIn(admin);
    adminApi.listBookings.mockResolvedValue(page([{ ...booking, status: 'CANCELLED' }]));
    renderApp('/admin/bookings');

    await screen.findByText('Cleo Client');
    expect(screen.queryByRole('button', { name: /booking for Cleo Client/ })).not.toBeInTheDocument();
  });
});

describe('instructors', () => {
  const branch = { id: 'br1', name: 'Quezon City' };
  const row = {
    id: 'i1',
    fullName: 'Ian Instructor',
    email: 'ian@test.local',
    isActive: true,
    mustChangePassword: true,
    createdAt: '2030-01-01T00:00:00.000Z',
    branch,
  };
  const address = { street: '12 Mabini St', barangay: 'San Roque', city: 'Quezon City', province: 'Metro Manila' };

  const fillCreate = async (user, form) => {
    await user.type(within(form).getByLabelText('Full name'), 'Ian Instructor');
    await user.type(within(form).getByLabelText('Email'), 'ian@test.local');
    await user.selectOptions(await within(form).findByLabelText('Location'), 'br1');
    await user.type(within(form).getByLabelText('Street'), address.street);
    await user.type(within(form).getByLabelText('Barangay'), address.barangay);
    await user.type(within(form).getByLabelText('City / municipality'), address.city);
    await user.type(within(form).getByLabelText('Province'), address.province);
  };

  beforeEach(() => {
    adminApi.listBranchOptions.mockResolvedValue([branch]);
  });

  it('requires name, email, location and every address part', async () => {
    signIn(admin);
    adminApi.listInstructors.mockResolvedValue(page([]));
    const user = userEvent.setup();
    renderApp('/admin/instructors');

    await user.click(await screen.findByRole('button', { name: 'Add instructor' }));
    const form = screen.getByRole('dialog', { name: 'Add instructor' });
    await user.click(within(form).getByRole('button', { name: 'Create account' }));

    const messages = [
      'Enter their full name',
      'Enter their email',
      'Choose a location',
      'Enter the street',
      'Enter the barangay',
      'Enter the city or municipality',
      'Enter the province',
    ];
    for (const msg of messages) {
      expect(await within(form).findByText(msg)).toBeInTheDocument();
    }
    expect(adminApi.createInstructor).not.toHaveBeenCalled();
  });

  it('creates an instructor and shows the temporary password once', async () => {
    signIn(admin);
    adminApi.listInstructors.mockResolvedValue(page([]));
    adminApi.createInstructor.mockResolvedValue({
      instructor: { ...row, address },
      temporaryPassword: 'Xk7#mP2q$Lw9vR4t',
    });
    const user = userEvent.setup();
    renderApp('/admin/instructors');

    await user.click(await screen.findByRole('button', { name: 'Add instructor' }));
    const form = screen.getByRole('dialog', { name: 'Add instructor' });
    await fillCreate(user, form);
    await user.click(within(form).getByRole('button', { name: 'Create account' }));

    const reveal = await screen.findByRole('dialog', { name: 'Instructor account created' });
    expect(within(reveal).getByLabelText('Temporary password')).toHaveTextContent('Xk7#mP2q$Lw9vR4t');
    expect(adminApi.createInstructor).toHaveBeenCalledWith({
      fullName: 'Ian Instructor',
      email: 'ian@test.local',
      address,
      branchId: 'br1',
    });

    await user.click(within(reveal).getByRole('button', { name: 'I have saved it' }));
    expect(screen.queryByText('Xk7#mP2q$Lw9vR4t')).not.toBeInTheDocument();
  });

  it('maps nested API address errors and inactive branch errors onto fields', async () => {
    signIn(admin);
    adminApi.listInstructors.mockResolvedValue(page([]));
    adminApi.createInstructor.mockRejectedValue(
      apiError(400, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: [
          { field: 'address.barangay', message: 'Barangay is too long' },
          { field: 'branchId', message: 'Choose an active branch' },
        ],
      }),
    );
    const user = userEvent.setup();
    renderApp('/admin/instructors');

    await user.click(await screen.findByRole('button', { name: 'Add instructor' }));
    const form = screen.getByRole('dialog', { name: 'Add instructor' });
    await fillCreate(user, form);
    await user.click(within(form).getByRole('button', { name: 'Create account' }));

    expect(await within(form).findByText('Barangay is too long')).toBeInTheDocument();
    expect(within(form).getByText('Choose an active branch')).toBeInTheDocument();
  });

  it('never shows an address in the list, only in the detail view', async () => {
    signIn(admin);
    adminApi.listInstructors.mockResolvedValue(page([row]));
    adminApi.getInstructor.mockResolvedValue({ instructor: { ...row, address } });
    const user = userEvent.setup();
    renderApp('/admin/instructors');

    const table = await screen.findByRole('table', { name: 'Instructor accounts' });
    await within(table).findByText('Ian Instructor');
    expect(within(table).getByText('Quezon City')).toBeInTheDocument();
    expect(screen.queryByText(/Mabini/)).not.toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'View Ian Instructor' }));
    const detail = await screen.findByRole('dialog', { name: 'Ian Instructor' });
    expect(await within(detail).findByText('12 Mabini St, San Roque, Quezon City, Metro Manila')).toBeInTheDocument();
    expect(adminApi.getInstructor).toHaveBeenCalledWith('i1');
  });

  it('sends only the changed fields when editing', async () => {
    signIn(admin);
    adminApi.listInstructors.mockResolvedValue(page([row]));
    adminApi.getInstructor.mockResolvedValue({ instructor: { ...row, address } });
    adminApi.updateInstructor.mockResolvedValue({ instructor: { ...row, address: { ...address, city: 'Marikina' } } });
    const user = userEvent.setup();
    renderApp('/admin/instructors');

    await user.click(await screen.findByRole('button', { name: 'View Ian Instructor' }));
    const detail = await screen.findByRole('dialog', { name: 'Ian Instructor' });
    await within(detail).findByText(/Mabini/);
    await user.click(within(detail).getByRole('button', { name: 'Edit' }));

    const form = await screen.findByRole('dialog', { name: 'Edit instructor' });
    const city = within(form).getByLabelText('City / municipality');
    await user.clear(city);
    await user.type(city, 'Marikina');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(adminApi.updateInstructor).toHaveBeenCalledWith('i1', { address: { ...address, city: 'Marikina' } }),
    );
  });

  it('resets a password after confirmation and reveals the new one', async () => {
    signIn(admin);
    adminApi.listInstructors.mockResolvedValue(page([row]));
    adminApi.resetInstructorPassword.mockResolvedValue({ temporaryPassword: 'Nw3$rT8pQz2#Vb6m' });
    const user = userEvent.setup();
    renderApp('/admin/instructors');

    await user.click(await screen.findByRole('button', { name: 'Reset password for Ian Instructor' }));
    const confirm = screen.getByRole('dialog', { name: 'Reset password' });
    await user.click(within(confirm).getByRole('button', { name: 'Reset password' }));

    const reveal = await screen.findByRole('dialog', { name: 'New temporary password' });
    expect(within(reveal).getByLabelText('Temporary password')).toHaveTextContent('Nw3$rT8pQz2#Vb6m');
    expect(adminApi.resetInstructorPassword).toHaveBeenCalledWith('i1');
  });
});

describe('admins', () => {
  const adminRow = (overrides) => ({
    isActive: true,
    mustChangePassword: false,
    createdAt: '2030-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('creates an admin with only name and email', async () => {
    signIn(admin);
    adminApi.listAdmins.mockResolvedValue(page([]));
    adminApi.createAdmin.mockResolvedValue({
      admin: adminRow({ id: 'a2', fullName: 'Bea Admin', email: 'bea@test.local', mustChangePassword: true }),
      temporaryPassword: 'Qq9$wE3rT6yU8iO1',
    });
    const user = userEvent.setup();
    renderApp('/admin/admins');

    await user.click(await screen.findByRole('button', { name: 'Add admin' }));
    const form = screen.getByRole('dialog', { name: 'Add admin' });
    await user.type(within(form).getByLabelText('Full name'), 'Bea Admin');
    await user.type(within(form).getByLabelText('Email'), 'bea@test.local');
    await user.click(within(form).getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('dialog', { name: 'Admin account created' })).toBeInTheDocument();
    expect(adminApi.createAdmin).toHaveBeenCalledWith({ fullName: 'Bea Admin', email: 'bea@test.local' });
  });

  it('does not offer actions on your own account', async () => {
    signIn(admin);
    adminApi.listAdmins.mockResolvedValue(page([adminRow({ id: 'a1', fullName: 'Ada Admin', email: 'admin@test.local' })]));
    renderApp('/admin/admins');

    await screen.findByText('(you)');
    expect(screen.queryByRole('button', { name: /Deactivate/ })).not.toBeInTheDocument();
  });
});

describe('branches', () => {
  it('adds a branch and shows a duplicate name under the field', async () => {
    signIn(admin);
    adminApi.listBranches.mockResolvedValue(page([]));
    adminApi.createBranch.mockRejectedValueOnce(
      apiError(409, { code: 'BRANCH_NAME_TAKEN', message: 'A branch with that name already exists' }),
    );
    adminApi.createBranch.mockResolvedValue({ branch: { id: 'br9', name: 'Pasig 2', isActive: true } });
    const user = userEvent.setup();
    renderApp('/admin/branches');

    await user.click(await screen.findByRole('button', { name: 'Add branch' }));
    const form = screen.getByRole('dialog', { name: 'Add branch' });
    await user.type(within(form).getByLabelText('Branch name'), 'Pasig');
    await user.click(within(form).getByRole('button', { name: 'Add branch' }));
    expect(await within(form).findByText('Enter the Latitude')).toBeInTheDocument();
    expect(adminApi.createBranch).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText('Latitude'), '14.5764');
    await user.type(within(form).getByLabelText('Longitude'), '121.0851');
    await user.click(within(form).getByRole('button', { name: 'Add branch' }));
    expect(await within(form).findByText('A branch with that name already exists')).toBeInTheDocument();

    await user.type(within(form).getByLabelText('Branch name'), ' 2');
    await user.click(within(form).getByRole('button', { name: 'Add branch' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminApi.createBranch).toHaveBeenLastCalledWith({ name: 'Pasig 2', latitude: 14.5764, longitude: 121.0851 });
  });

  it('deactivates a branch after confirmation', async () => {
    signIn(admin);
    adminApi.listBranches.mockResolvedValue(
      page([{ id: 'br1', name: 'Makati', isActive: true, createdAt: '2030-01-01T00:00:00.000Z', instructorCount: 2 }]),
    );
    adminApi.updateBranch.mockResolvedValue({ branch: { id: 'br1', name: 'Makati', isActive: false } });
    const user = userEvent.setup();
    renderApp('/admin/branches');

    await user.click(await screen.findByRole('button', { name: 'Deactivate Makati' }));
    const confirm = screen.getByRole('dialog', { name: 'Deactivate branch' });
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(adminApi.updateBranch).toHaveBeenCalledWith('br1', { isActive: false }));
  });
});

describe('instructor area', () => {
  const instructor = {
    id: 'i1',
    email: 'ian@test.local',
    fullName: 'Ian Instructor',
    role: 'INSTRUCTOR',
    mustChangePassword: false,
  };

  it('shows the instructor their own profile, address included, read-only', async () => {
    signIn(instructor);
    instructorApi.getMyProfile.mockResolvedValue({
      profile: {
        id: 'i1',
        fullName: 'Ian Instructor',
        email: 'ian@test.local',
        branch: { id: 'br1', name: 'Quezon City' },
        address: { street: '12 Mabini St', barangay: 'San Roque', city: 'Quezon City', province: 'Metro Manila' },
      },
    });
    renderApp('/instructor/profile');

    expect(await screen.findByText('12 Mabini St, San Roque, Quezon City, Metro Manila')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|save/i })).not.toBeInTheDocument();
  });

  it('keeps instructors out of the admin dashboard', () => {
    signIn(instructor);
    renderApp('/admin/instructors');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/do not have access/i);
    expect(adminApi.listInstructors).not.toHaveBeenCalled();
  });

  it('keeps admins out of the instructor area', () => {
    signIn(admin);
    renderApp('/instructor/profile');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/do not have access/i);
    expect(instructorApi.getMyProfile).not.toHaveBeenCalled();
  });
});

describe('audit log', () => {
  it('lists admin actions and spells out instructor changes', async () => {
    signIn(admin);
    adminApi.listAuditLogs.mockResolvedValue(
      page([
        {
          id: 'l1',
          action: 'INSTRUCTOR_UPDATED',
          targetType: 'USER',
          targetId: 'i1-uuid-value',
          metadata: {
            changes: {
              fullName: { from: 'Ian Instructor', to: 'Ian Reyes' },
              branch: { from: { id: 'br1', name: 'Quezon City' }, to: { id: 'br2', name: 'Makati' } },
            },
          },
          actorEmail: 'admin@test.local',
          actor: { id: 'a1', fullName: 'Ada Admin' },
          ip: '127.0.0.1',
          createdAt: '2030-01-01T00:00:00.000Z',
        },
      ]),
    );
    renderApp('/admin/audit-log');

    const table = await screen.findByRole('table', { name: 'Audit log' });
    expect(await within(table).findByText('Instructor updated')).toBeInTheDocument();
    expect(within(table).getByText('Ada Admin')).toBeInTheDocument();
    expect(within(table).getByText(/name: Ian Instructor → Ian Reyes/)).toBeInTheDocument();
    expect(within(table).getByText(/location: Quezon City → Makati/)).toBeInTheDocument();
  });
});
