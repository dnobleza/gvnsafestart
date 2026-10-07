import Button from '../../components/Button';
import Container from '../../components/Container';
import Reveal from '../../components/Reveal';

export default function CtaBand() {
  return (
    <section className="py-24 sm:py-28">
      <Container>
        <Reveal>
          <div className="brand-gradient border-surface-700 flex flex-col items-start gap-8 rounded-xl border px-8 py-14 sm:px-14 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Book your driving lesson today
              </h2>
              <p className="text-ink-400 mt-4 max-w-[48ch] leading-relaxed">
                Take the first step toward driving independence. Tell us your area and we will
                confirm your rate and schedule.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button to="/book" size="lg">
                Book now
              </Button>
              <Button href="mailto:info@gvnsafestart.com" variant="outlineOnMedia" size="lg">
                Send an inquiry
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
