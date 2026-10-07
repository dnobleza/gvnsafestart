import { getTopInstructors } from '../../api/public';
import Button from '../../components/Button';
import Container from '../../components/Container';
import Reveal from '../../components/Reveal';
import SectionHeading from '../../components/SectionHeading';
import Stars from '../../components/Stars';
import useResource from '../../hooks/useResource';

const firstName = (fullName) => fullName.split(' ')[0];

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-busy="true" aria-label="Loading top instructors">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface-800 h-56 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

// Only instructors with at least three ratings qualify. With nobody to show the
// whole section is left out rather than rendering an empty box.
export default function TopInstructors() {
  const { data, loading, error } = useResource(getTopInstructors);

  if (error || (!loading && !data?.length)) return null;

  return (
    <section id="top-instructors" className="py-24 sm:py-28" aria-labelledby="top-instructors-heading">
      <Container>
        <Reveal>
          <SectionHeading
            title={<span id="top-instructors-heading">Top Rated Instructors</span>}
            body="Rated by students after their sessions."
          />
        </Reveal>
        <div className="mt-12">
          {loading && !data ? (
            <Skeleton />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {data.map((i, index) => (
                <Reveal as="li" key={i.id} delay={index * 0.05} className="h-full">
                  <article className="border-surface-700 bg-surface-900 flex h-full flex-col gap-3 rounded-xl border p-5">
                    <div>
                      <h3 className="text-ink-100 text-base font-semibold">{i.fullName}</h3>
                      {i.branch ? <p className="text-ink-500 text-xs">{i.branch.name}</p> : null}
                    </div>
                    <p className="flex flex-wrap items-center gap-1.5 text-sm">
                      <Stars value={Math.round(i.average)} />
                      <span className="text-ink-100 font-medium tabular-nums">{i.average.toFixed(1)}</span>
                      <span className="text-ink-500 text-xs">
                        ({i.count} review{i.count === 1 ? '' : 's'})
                      </span>
                    </p>
                    {i.comment ? <p className="text-ink-400 text-sm leading-relaxed">“{i.comment}”</p> : null}
                    <div className="mt-auto pt-2">
                      <Button size="sm" to={`/client/book?instructor=${i.id}`}>
                        Book with {firstName(i.fullName)}
                      </Button>
                    </div>
                  </article>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}
