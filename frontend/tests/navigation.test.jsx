import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import AppRoutes from '../src/routes';

vi.mock('../src/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(() => Promise.reject(new Error('no session'))),
}));

const renderApp = (route = '/') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('routing', () => {
  it('renders the landing page at the root', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/build confidence\. drive safely\./i);
  });

  it('takes a signed-out visitor from Book now to the login screen', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByRole('link', { name: 'Book now' })[0]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });

  it('takes Sign in to the login screen', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByRole('link', { name: 'Sign in' })[0]);

    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });

  it('lets a visitor cross between the two auth screens', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('link', { name: 'Register' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();
  });

  it('shows a not-found page for an unknown route', () => {
    renderApp('/nope');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/cannot find that page/i);
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});

describe('mobile menu', () => {
  it('opens and closes on the toggle', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const toggle = screen.getByRole('button', { name: 'Close menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
