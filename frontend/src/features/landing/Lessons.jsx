import Container from '../../components/Container';
import Reveal from '../../components/Reveal';
import SectionHeading from '../../components/SectionHeading';

const FEATURED = {
  name: 'Beginner Driving Lessons',
  tag: 'Most popular',
  body: 'Start from zero. Learn vehicle control, road rules, and safe driving habits from the ground up, guided at your own pace.',
  image: '/lesson-beginner.jpg',
  alt: 'A GVN-Safestart student seated at the wheel during a lesson',
};

const OTHERS = [
  {
    name: 'Refresher Driving Lessons',
    body: 'Already licensed but out of practice. Rebuild confidence on real roads with an instructor beside you.',
  },
  {
    name: 'Own Car Training',
    body: 'Learn in the car you actually drive, so nothing feels unfamiliar once the lessons end.',
  },
  {
    name: 'Car Rental Training',
    body: 'No car yet. Train in ours and book only the sessions you need.',
  },
];

export default function Lessons() {
  return (
    <section id="lessons" className="py-24 sm:py-32">
      <Container>
        <Reveal>
          <p className="text-accent-400 text-xs font-medium tracking-[0.18em] uppercase">
            Our lessons
          </p>
          <SectionHeading
            className="mt-4"
            title="Driving lessons tailored to you"
            body="Private, one-on-one tutorials for every type of student. Automatic and manual transmission both available."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <article className="border-surface-800 bg-surface-900 flex h-full flex-col overflow-hidden rounded-xl border">
              <img
                src={FEATURED.image}
                alt={FEATURED.alt}
                width="1000"
                height="1183"
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-1 flex-col p-7">
                <p className="text-accent-400 text-xs font-medium tracking-wider uppercase">
                  {FEATURED.tag}
                </p>
                <h3 className="mt-2 text-xl font-semibold">{FEATURED.name}</h3>
                <p className="text-ink-400 mt-3 text-sm leading-relaxed">{FEATURED.body}</p>
              </div>
            </article>
          </Reveal>

          <div className="grid gap-5 lg:col-span-2">
            {OTHERS.map((lesson, i) => (
              <Reveal key={lesson.name} delay={0.07 * (i + 1)}>
                <article className="border-surface-800 bg-surface-900 hover:border-accent-700 h-full rounded-xl border p-6 transition-colors">
                  <h3 className="text-base font-semibold">{lesson.name}</h3>
                  <p className="text-ink-400 mt-2.5 text-sm leading-relaxed">{lesson.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
