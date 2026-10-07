import { CaretDownIcon } from '@phosphor-icons/react';

import Container from '../../components/Container';
import Reveal from '../../components/Reveal';
import SectionHeading from '../../components/SectionHeading';

// Published answers from gvnsafestart.com, grouped so seventeen rows do not
// read as one undifferentiated list. Native details/summary is used rather than
// a hand-built disclosure: it is keyboard operable and findable with the
// browser's own in-page search for free.
const GROUPS = [
  {
    heading: 'The service',
    items: [
      {
        q: 'What is GVN-SafeStart Driving Lesson?',
        a: 'GVN-SafeStart Driving Lesson is a private, one-on-one practical driving tutorial service designed to build driving confidence, improve practical skills, and develop safe driving habits through actual road experience.',
      },
      {
        q: 'Is the program for beginners or experienced drivers?',
        a: 'Both. Beginners can choose Option 2 for a structured 3-session program, while experienced drivers and refreshers can choose Option 1, Option 1+, or Option 3 depending on their needs.',
      },
      {
        q: 'Do you provide an official LTO certificate?',
        a: 'No. GVN-SafeStart provides private practical driving tutorials and does not issue LTO certificates for driver licence applications.',
      },
      {
        q: 'What is the main goal of the lessons?',
        a: 'The goal is to help students become more confident, responsible, and skilled drivers through practical experience and real-world driving situations.',
      },
    ],
  },
  {
    heading: 'Packages and sessions',
    items: [
      {
        q: 'What packages are available?',
        a: 'Option 1 is one session of 5 hours. Option 1+ is two sessions of 5 hours each. Option 2 is three sessions of 5 hours per day. Option 3 is one extended session of 12 hours.',
      },
      {
        q: 'How many sessions does a beginner usually need?',
        a: 'Option 2 is designed as the structured beginner package, consisting of 3 sessions of 5 hours each.',
      },
      {
        q: 'Can I book just one session?',
        a: 'Yes. Option 1 provides one 5-hour driving session and is suitable for refreshers or students who want a single practical session.',
      },
    ],
  },
  {
    heading: 'During the lesson',
    items: [
      {
        q: 'What can I learn during the lesson?',
        a: "Training may include vehicle control, parking, road awareness, road signs and markings, city driving, highway or expressway driving, defensive driving, and other practical driving situations depending on the student's needs.",
      },
      {
        q: 'Can I focus on a specific weakness?',
        a: 'Yes. Lessons can be adjusted to focus on areas such as parking, traffic driving, night driving, road confidence, or other specific skills.',
      },
      {
        q: 'Do you offer automatic and manual transmission?',
        a: 'Yes, both automatic and manual transmission training are available, subject to instructor and vehicle availability.',
      },
      {
        q: 'Do I need my own car?',
        a: 'No. Students may use their own vehicle or choose an available car-rental option. Rates vary by area and training type.',
      },
    ],
  },
  {
    heading: 'Coverage and rates',
    items: [
      {
        q: 'What areas do you serve?',
        a: 'GVN-SafeStart serves Metro Manila, Rizal, Cavite, Laguna, Batangas, Bulacan, Pampanga, and Tarlac.',
      },
      {
        q: 'Do you provide door-to-door service?',
        a: 'Yes. GVN-SafeStart provides door-to-door driving tutorials within its service areas, subject to location and availability.',
      },
      {
        q: 'Do rates vary by location?',
        a: 'Yes. Rates vary depending on the service area, training package, and whether the student uses their own car or a rental vehicle.',
      },
      {
        q: 'How much does a driving lesson cost?',
        a: 'Rates vary depending on the area, package, and whether you use your own car or a rental vehicle. Check the packages section above for the applicable rates.',
      },
    ],
  },
  {
    heading: 'Booking',
    items: [
      {
        q: 'How do I book a driving lesson?',
        a: 'Choose your preferred area and package, then book. You will be taken to the official booking form where you provide your details, select your schedule, complete the reservation and payment, upload proof of payment where required, and submit. The admin team then confirms the schedule and assigns an instructor.',
      },
      {
        q: 'Do you offer weekend or evening schedules?',
        a: 'Schedules are available seven days a week, subject to instructor availability and scheduling.',
      },
    ],
  },
];

function FaqItem({ q, a, defaultOpen }) {
  return (
    <details
      open={defaultOpen}
      className="border-surface-700 bg-surface-950 group rounded-xl border px-5 open:pb-1"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {q}
        <CaretDownIcon
          size={16}
          className="text-accent-400 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <p className="text-ink-400 pb-4 text-sm leading-relaxed">{a}</p>
    </details>
  );
}

export default function Faq() {
  return (
    <section id="faqs" className="py-24 sm:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            title="Frequently asked questions"
            body="What students ask most often, answered before you book."
          />
        </Reveal>

        <div className="mt-14 max-w-3xl space-y-10">
            {GROUPS.map((group, gi) => (
              <Reveal key={group.heading} delay={gi * 0.04}>
                <h3 className="text-accent-300 mb-4 flex items-center gap-3 text-sm font-semibold">
                  {group.heading}
                  <span className="gold-rule h-px flex-1 opacity-30" aria-hidden="true" />
                </h3>
                <div className="space-y-3">
                  {group.items.map((item, i) => (
                    <FaqItem
                      key={item.q}
                      q={item.q}
                      a={item.a}
                      defaultOpen={gi === 0 && i === 0}
                    />
                  ))}
                </div>
              </Reveal>
            ))}
        </div>
      </Container>
    </section>
  );
}
