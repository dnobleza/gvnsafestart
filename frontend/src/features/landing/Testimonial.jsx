import Container from '../../components/Container';
import Reveal from '../../components/Reveal';

// A recommendation published on the business's own Facebook page and site.
export default function Testimonial() {
  return (
    <section id="testimonials" className="border-surface-800 bg-surface-900 border-y py-24 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <blockquote className="text-2xl leading-snug font-medium tracking-tight text-balance sm:text-3xl">
            “Who would have thought I would learn how to drive and gain confidence behind the wheel
            in just three sessions? Smooth, hassle free, and truly worthwhile.”
          </blockquote>
          <figcaption className="text-ink-400 mt-8 text-sm">
            <span className="text-ink-100 font-medium">Allyssa dela Rosa</span>
            {', '}
            Facebook recommendation
          </figcaption>
        </Reveal>
      </Container>
    </section>
  );
}
