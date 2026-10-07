import { CarProfileIcon, GearIcon, MapPinAreaIcon, UserFocusIcon } from '@phosphor-icons/react';

import Container from '../../components/Container';
import Reveal from '../../components/Reveal';

const POINTS = [
  {
    icon: UserFocusIcon,
    title: 'Private, one-on-one',
    body: 'Never a group class. The whole session is yours, with one instructor who learns how you drive.',
  },
  {
    icon: MapPinAreaIcon,
    title: 'Door-to-door service',
    body: 'We meet you where you are, across Metro Manila and the nearby provinces.',
  },
  {
    icon: GearIcon,
    title: 'Automatic and manual',
    body: 'Train on the transmission you will actually be driving, not whichever car is free.',
  },
  {
    icon: CarProfileIcon,
    title: 'Your pace, your schedule',
    body: 'Weekdays, weekends and evenings. Patient instructors who adapt rather than rush.',
  },
];

export default function About() {
  return (
    <section id="about" className="bg-surface-900 border-surface-800 border-y py-24 sm:py-32">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <p className="text-accent-500 font-mono text-5xl">4,000+</p>
            <p className="text-ink-500 mt-2 text-sm">students served</p>
            <h2 className="mt-8 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Professional private driving tutorials
            </h2>
            <p className="text-ink-400 mt-5 max-w-[52ch] leading-relaxed">
              A private, one-on-one practical driving tutorial service built to improve your skills
              and develop safe habits through real road experience, across Metro Manila and the
              surrounding provinces.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <ul className="space-y-8">
              {POINTS.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <point.icon
                    size={22}
                    weight="duotone"
                    className="text-accent-500 mt-0.5 shrink-0"
                  />
                  <div>
                    <h3 className="font-medium">{point.title}</h3>
                    <p className="text-ink-400 mt-1.5 text-sm leading-relaxed">{point.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
