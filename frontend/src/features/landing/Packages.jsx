import Container from '../../components/Container';
import Reveal from '../../components/Reveal';
import SectionHeading from '../../components/SectionHeading';

// Prices are the "from" figures published on gvnsafestart.com. The site states
// rates vary by area and training type, so they are not shown as fixed.
const PACKAGES = [
  {
    option: 'Option 1',
    sessions: '1 session, 5 hours',
    price: '₱2,500',
    body: 'One session of five hours actual driving. Good for a quick refresher or an initial assessment.',
  },
  {
    option: 'Option 1+',
    sessions: '2 sessions, 5 hours each',
    price: '₱5,000',
    body: 'Two days of five hours each, with time between to let the first session settle.',
  },
  {
    option: 'Option 2',
    sessions: '3 sessions, 5 hours each',
    price: '₱7,000',
    body: 'The usual path for a complete beginner, spread across three days.',
  },
  {
    option: 'Option 3',
    sessions: '1 extended session, 12 hours',
    price: '₱5,000',
    body: 'One long day behind the wheel when your schedule will not allow several visits.',
  },
];

export default function Packages() {
  return (
    <section id="packages" className="bg-surface-900 border-surface-800 border-y py-24 sm:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            title="Packages and rates"
            body="Four clear options. Rates vary by area and training type, so these are starting prices."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {PACKAGES.map((pkg, i) => (
            <Reveal key={pkg.option} delay={0.06 * i}>
              <article className="border-surface-700 bg-surface-950 hover:border-accent-700 flex h-full flex-col rounded-xl border p-7 transition-colors">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-lg font-semibold">{pkg.option}</h3>
                  <p className="text-accent-400 font-mono text-lg">{pkg.price}</p>
                </div>
                <p className="text-ink-500 mt-1 font-mono text-xs">{pkg.sessions}</p>
                <div className="gold-rule my-5 h-px w-full opacity-40" aria-hidden="true" />
                <p className="text-ink-400 text-sm leading-relaxed">{pkg.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
