import { useState } from 'react';
import { ListIcon, XIcon } from '@phosphor-icons/react';

import BrandMark from './BrandMark';
import Button from './Button';
import Container from './Container';

// Their navigation, in their wording and order. Every target is a real section
// on this page, so none of these are dead anchors.
const LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'Driving Lessons', href: '#lessons' },
  { label: 'Packages & Rates', href: '#packages' },
  { label: 'Areas We Serve', href: '#areas' },
  { label: 'About Us', href: '#about' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'FAQs', href: '#faqs' },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-surface-800 bg-surface-950/90 fixed inset-x-0 top-0 z-40 border-b backdrop-blur-md">
      <Container>
        {/* The full bar needs about 1000px once the larger logo is in, so the
            desktop layout starts at xl rather than lg. */}
        <nav className="flex h-20 items-center justify-between gap-6" aria-label="Main">
          <BrandMark height={52} />

          <ul className="hidden items-center gap-6 xl:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-ink-400 hover:text-accent-300 text-sm whitespace-nowrap transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden xl:block">
            <Button to="/book">Book now</Button>
          </div>

          <button
            type="button"
            className="text-ink-100 -mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <XIcon size={22} /> : <ListIcon size={22} />}
          </button>
        </nav>
      </Container>

      {open ? (
        <div id="mobile-nav" className="border-surface-800 border-t xl:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-ink-100 hover:bg-surface-800 rounded-xl px-3 py-2.5 text-sm"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Button to="/login" variant="secondary">
                Sign in
              </Button>
              <Button to="/book">Book now</Button>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
