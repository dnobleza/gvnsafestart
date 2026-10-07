import Container from '../../components/Container';
import Reveal from '../../components/Reveal';
import SectionHeading from '../../components/SectionHeading';

// The real booking flow from gvnsafestart.com. Verb headings, not "Step 1":
// the order on the page already carries the sequence.
const STAGES = [
  {
    title: 'Choose your area and package',
    body: 'Pick where you are and which option suits you. The rate for your area is confirmed before anything is booked.',
  },
  {
    title: 'Complete the booking form',
    body: 'Send your schedule and details through the official booking form, so nothing gets lost in a chat thread.',
  },
  {
    title: 'Pay the reservation fee',
    body: 'A reservation fee holds your slot. The balance is settled on the day of your session.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            title="Booking a lesson"
            body="Three steps from first message to a confirmed slot with your instructor."
          />
        </Reveal>

        <div className="mt-16 flex flex-col">
          {STAGES.map((stage, i) => (
            <Reveal key={stage.title} delay={i * 0.08}>
              <div className="border-surface-800 grid gap-4 border-t py-10 sm:grid-cols-[auto_1fr] sm:gap-10">
                <p
                  aria-hidden="true"
                  className="text-accent-500/45 font-mono text-4xl leading-none sm:w-20"
                >
                  {i + 1}
                </p>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">{stage.title}</h3>
                  <p className="text-ink-400 mt-3 max-w-[62ch] leading-relaxed">{stage.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
