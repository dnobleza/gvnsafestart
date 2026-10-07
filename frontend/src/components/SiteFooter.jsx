import { Link } from 'react-router-dom';

import BrandMark from './BrandMark';
import Container from './Container';

const AREAS = [
  'Metro Manila',
  'Rizal',
  'Cavite',
  'Laguna',
  'Batangas',
  'Bulacan',
  'Pampanga',
  'Tarlac',
];

const GROUPS = [
  {
    heading: 'Lessons',
    links: [
      { label: 'Beginner lessons', href: '#lessons' },
      { label: 'Refresher lessons', href: '#lessons' },
      { label: 'Own car training', href: '#lessons' },
      { label: 'Car rental training', href: '#lessons' },
    ],
  },
  {
    heading: 'Portal',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Book now', to: '/book' },
      { label: 'Packages & Rates', href: '#packages' },
      { label: 'FAQs', href: '#faqs' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-surface-800 bg-surface-950 border-t">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <BrandMark height={46} />
            <p className="text-ink-400 mt-5 max-w-[40ch] text-sm leading-relaxed">
              Private driving tutorials across Metro Manila and nearby provinces. Automatic and
              manual, door to door.
            </p>
            <a
              href="mailto:info@gvnsafestart.com"
              className="text-accent-300 hover:text-accent-200 mt-5 inline-block text-sm"
            >
              info@gvnsafestart.com
            </a>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {GROUPS.map((group) => (
              <div key={group.heading}>
                <h3 className="text-sm font-semibold">{group.heading}</h3>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link
                          to={link.to}
                          className="text-ink-400 hover:text-accent-300 text-sm transition-colors"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="text-ink-400 hover:text-accent-300 text-sm transition-colors"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <h3 className="text-sm font-semibold">Areas we serve</h3>
              <ul className="text-ink-400 mt-4 space-y-2 text-sm">
                {AREAS.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="border-surface-800 text-ink-500 mt-14 border-t pt-8 text-sm">
          &copy; {new Date().getFullYear()} GVN-Safestart Driving Lesson. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
