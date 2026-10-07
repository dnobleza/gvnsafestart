import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getPublicInstructor } from '../../../api/public';
import Button from '../../../components/Button';
import PageHeader from '../../../components/PageHeader';
import { addDaysToDate, toLocalDate } from '../../../utils/format';
import { useProfile } from '../hooks/useClientResources';
import AreaStep from './AreaStep';
import DateTimeStep from './DateTimeStep';
import InstructorStep from './InstructorStep';
import PackageStep from './PackageStep';
import PaymentStep from './PaymentStep';
import ReviewStep from './ReviewStep';

const STEPS = ['Area', 'Package', 'Instructor', 'Date & time', 'Payment', 'Review'];

// Highest step the current answers allow, so a reload or a hand-edited URL can
// never land on a step whose earlier choices are missing.
const reachable = (b) => {
  if (!b.serviceArea || !b.trainingType || b.pickupAddress.trim().length < 5 || !b.location) return 1;
  if (!b.packageDef) return 2;
  if (!b.instructor) return 3;
  if (!b.slot) return 4;
  if (!b.paymentMethod) return 5;
  return 6;
};

export default function BookingWizard() {
  const [params, setParams] = useSearchParams();
  const profile = useProfile();
  const today = toLocalDate();
  const [booking, setBooking] = useState({
    serviceArea: null,
    trainingType: 'OWN_CAR',
    pickupAddress: '',
    location: null,
    packageDef: null,
    instructor: null,
    date: addDaysToDate(today, 1),
    slot: null,
    paymentMethod: null,
  });
  const [notice, setNotice] = useState(null);
  // From "Book with …" on the landing page; read once, since step changes rewrite the query.
  const [preselectId] = useState(() => params.get('instructor'));

  useEffect(() => {
    if (!preselectId) return undefined;
    let alive = true;
    getPublicInstructor(preselectId)
      .then((instructor) => alive && setBooking((b) => (b.instructor ? b : { ...b, instructor })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [preselectId]);

  const saved = profile.data?.savedLocation;
  useEffect(() => {
    if (saved?.latitude != null && !booking.location) {
      setBooking((b) => ({
        ...b,
        location: { latitude: saved.latitude, longitude: saved.longitude, label: saved.city || 'your saved location', branchId: null },
      }));
    }
  }, [saved, booking.location]);

  const step = Math.min(Math.max(Number(params.get('step')) || 1, 1), reachable(booking));
  const go = (n) => {
    setNotice(null);
    setParams({ step: String(n) });
  };
  const update = (changes) => setBooking((b) => ({ ...b, ...changes }));
  const duration = booking.packageDef ? booking.packageDef.hoursPerSession * 60 : 300;

  return (
    <>
      <PageHeader title="Book a lesson" />
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Booking steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const current = n === step;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={
                'rounded-full border px-3 py-1 text-xs ' +
                (current
                  ? 'border-accent-500 text-accent-300'
                  : n < step
                    ? 'border-surface-600 text-ink-100'
                    : 'border-surface-700 text-ink-500')
              }
            >
              {n}. {label}
            </li>
          );
        })}
      </ol>
      {booking.instructor && preselectId === booking.instructor.id ? (
        <p className="border-accent-600 mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm" role="status">
          Booking with <span className="text-ink-100 font-medium">{booking.instructor.fullName}</span>
          {booking.instructor.branch ? <span className="text-ink-500">· {booking.instructor.branch.name}</span> : null}
          <Button variant="ghost" size="sm" onClick={() => update({ instructor: null, slot: null })}>
            Change
          </Button>
        </p>
      ) : null}
      {notice ? (
        <p role="alert" className="text-danger-300 mb-4 text-sm">
          {notice}
        </p>
      ) : null}

      {step === 1 ? <AreaStep booking={booking} update={update} onNext={() => go(2)} /> : null}
      {step === 2 ? <PackageStep booking={booking} update={update} onBack={() => go(1)} onNext={() => go(3)} /> : null}
      {step === 3 ? (
        <InstructorStep
          location={booking.location}
          date={booking.date}
          duration={duration}
          minDate={today}
          onDateChange={(date) => update({ date, slot: null })}
          instructor={booking.instructor}
          onSelect={(instructor) => update({ instructor, slot: null })}
          onBack={() => go(2)}
          onNext={() => go(4)}
        />
      ) : null}
      {step === 4 ? (
        <DateTimeStep
          booking={{ ...booking, duration }}
          update={update}
          minDate={today}
          onBack={() => go(3)}
          onNext={() => go(5)}
        />
      ) : null}
      {step === 5 ? (
        <PaymentStep
          packageDef={booking.packageDef}
          value={booking.paymentMethod}
          onChange={(paymentMethod) => update({ paymentMethod })}
          onBack={() => go(4)}
          onNext={() => go(6)}
        />
      ) : null}
      {step === 6 ? (
        <ReviewStep
          booking={booking}
          onBack={() => go(5)}
          onSlotLost={(message) => {
            update({ slot: null });
            go(4);
            setNotice(`${message}. Please pick another time.`);
          }}
        />
      ) : null}
    </>
  );
}
