import Container from '../../components/Container';
import Reveal from '../../components/Reveal';
import SectionHeading from '../../components/SectionHeading';

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

export default function Areas() {
  return (
    <section id="areas" className="py-24 sm:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            title="We come to you"
            body="Door-to-door driving tutorials across Metro Manila and the surrounding provinces."
          />
        </Reveal>

        <Reveal delay={0.08}>
          <ul className="mt-12 flex flex-wrap gap-3">
            {AREAS.map((area) => (
              <li
                key={area}
                className="border-surface-700 text-ink-100 rounded-full border px-5 py-2.5 text-sm"
              >
                {area}
              </li>
            ))}
          </ul>
          <p className="text-ink-500 mt-8 text-sm">
            Not on the list? Get in touch, we may still be able to reach you.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
