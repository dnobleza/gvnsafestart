import { CalendarCheckIcon, CarProfileIcon, MapPinAreaIcon, PackageIcon } from '@phosphor-icons/react';

import Container from '../../components/Container';
import Reveal from '../../components/Reveal';

const POINTS = [
  { icon: MapPinAreaIcon, value: '8', label: 'service areas' },
  { icon: PackageIcon, value: '4', label: 'package options' },
  { icon: CalendarCheckIcon, value: '7', label: 'days a week' },
  { icon: CarProfileIcon, value: 'Door to door', label: 'we come to you' },
];

export default function TrustStrip() {
  return (
    <section className="border-surface-800 bg-surface-900 border-y py-8">
      <Container>
        <Reveal>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-7 lg:grid-cols-4">
            {POINTS.map((point) => (
              <li key={point.label} className="flex items-center gap-3">
                <point.icon size={24} weight="duotone" className="text-accent-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{point.value}</p>
                  <p className="text-ink-500 text-xs">{point.label}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
