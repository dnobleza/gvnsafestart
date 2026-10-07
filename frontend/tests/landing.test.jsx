import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import LandingPage from '../src/pages/LandingPage';

vi.mock('../src/api/public', () => ({ getTopInstructors: vi.fn().mockResolvedValue([]) }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );

describe('landing page structure', () => {
  it('has exactly one h1', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('leads with the value proposition', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /build confidence\. drive safely\./i,
    );
  });

  it('lists all four lessons offered', () => {
    renderPage();

    for (const name of [
      'Beginner Driving Lessons',
      'Refresher Driving Lessons',
      'Own Car Training',
      'Car Rental Training',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('explains how booking works', () => {
    renderPage();

    for (const stage of [
      'Choose your area and package',
      'Complete the booking form',
      'Pay the reservation fee',
    ]) {
      expect(screen.getByRole('heading', { name: stage })).toBeInTheDocument();
    }
  });

  it('attributes the testimonial to a person and a role', () => {
    renderPage();

    expect(screen.getByText('Allyssa dela Rosa')).toBeInTheDocument();
    expect(screen.getByText(/Facebook recommendation/)).toBeInTheDocument();
  });
});

describe('landing page FAQ', () => {
  it('renders every published question', () => {
    const { container } = renderPage();
    const questions = container.querySelectorAll('#faqs summary');

    expect(questions.length).toBe(17);
  });

  it('states plainly that no LTO certificate is issued', () => {
    renderPage();

    // Earlier drafts of this page wrongly claimed LTO accreditation. This locks
    // the correction in.
    expect(screen.getByText(/does not issue LTO certificates/i)).toBeInTheDocument();
  });

  it('opens the first question by default and leaves the rest closed', () => {
    const { container } = renderPage();
    const items = [...container.querySelectorAll('#faqs details')];

    expect(items[0].open).toBe(true);
    expect(items.slice(1).every((d) => !d.open)).toBe(true);
  });
});

describe('landing page call to action', () => {
  it('points the primary CTA at booking and the secondary at login', () => {
    renderPage();

    const book = screen.getAllByRole('link', { name: 'Book now' });
    const login = screen.getAllByRole('link', { name: 'Sign in' });

    expect(book.length).toBeGreaterThan(0);
    expect(login.length).toBeGreaterThan(0);
    book.forEach((link) => expect(link).toHaveAttribute('href', '/book'));
    login.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
  });

  it('uses one label per CTA intent', () => {
    renderPage();

    // Variants like "Request a quote" or "Talk to us" would mean two labels for
    // one intent, which is what this guards against.
    expect(
      screen.queryByRole('link', { name: /talk to us|contact sales|request a quote|get started|enrol now|book a lesson/i }),
    ).toBeNull();

    // Every booking link on the page, nav included, carries the one agreed label.
    const bookingLinks = [...document.querySelectorAll('a[href="/book"]')];
    expect(bookingLinks.length).toBeGreaterThan(1);
    const labels = new Set(bookingLinks.map((a) => a.textContent.trim()));
    expect([...labels]).toEqual(['Book now']);
  });
});

describe('landing page accessibility', () => {
  it('gives every meaningful image alt text', () => {
    const { container } = renderPage();
    const images = [...container.querySelectorAll('img')];

    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
      // An empty alt is only correct for a decorative image, and a decorative
      // image has to say so, otherwise it is just missing alt text.
      if (img.getAttribute('alt') === '') {
        expect(img).toHaveAttribute('role', 'presentation');
      }
    });
  });

  it('shows the real logo with meaningful alt text', () => {
    renderPage();

    // The logo is content, not decoration, so it must be named. Nav and footer
    // both carry it.
    const logos = screen.getAllByAltText('GVN-Safestart Driving Lesson');
    expect(logos.length).toBeGreaterThan(1);
    logos.forEach((img) => expect(img).toHaveAttribute('src', '/logo-gvn.png'));
  });

  it('lists the four package prices', () => {
    renderPage();

    for (const price of ['₱2,500', '₱5,000', '₱7,000']) {
      expect(screen.getAllByText(price).length).toBeGreaterThan(0);
    }
  });

  it('gives the hero photograph real alt text', () => {
    const { container } = renderPage();
    const img = container.querySelector('main section img');

    // It is the business's own photo now, not an arbitrary placeholder, so it
    // describes itself rather than being hidden from screen readers.
    expect(img).toHaveAttribute('src', '/hero-driving.jpg');
    expect(img.getAttribute('alt')).toMatch(/driving lesson/i);
    expect(img).not.toHaveAttribute('role', 'presentation');
  });

  it('carries every navigation link from the live site', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Main' });

    for (const label of [
      'Home',
      'Driving Lessons',
      'Packages & Rates',
      'Areas We Serve',
      'About Us',
      'Testimonials',
      'FAQs',
    ]) {
      expect(within(nav).getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('points every in-page nav link at a section that exists', () => {
    const { container } = renderPage();
    const nav = container.querySelector('nav[aria-label="Main"]');
    const anchors = [...nav.querySelectorAll('a[href^="#"]')];

    expect(anchors.length).toBe(7);
    // The whole point of this task: no link may scroll to nothing.
    for (const a of anchors) {
      const id = a.getAttribute('href').slice(1);
      expect(container.querySelector(`#${id}`), `missing section #${id}`).not.toBeNull();
    }
  });

  it('keeps Sign in out of the desktop nav but reachable in the footer', () => {
    const { container } = renderPage();
    const nav = container.querySelector('nav[aria-label="Main"]');

    expect(within(nav).queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(
      container.querySelector('footer a[href="/login"]'),
    ).not.toBeNull();
  });

  it('labels the main navigation and the mobile menu toggle', () => {
    renderPage();

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps all content inside landmark regions', () => {
    renderPage();

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
