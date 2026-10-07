import { useState } from 'react';
import { StarIcon } from '@phosphor-icons/react';

import { rateBooking } from '../../api/clientPortal';
import FormAlert from '../../components/FormAlert';
import SubmitButton from '../../components/SubmitButton';
import useAction from '../../hooks/useAction';
import { formatDate, formatDateTime } from '../../utils/format';

export default function RateInstructorForm({ booking, onRated, heading = 'Rate your instructor' }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const { run, loading, error } = useAction(rateBooking);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!stars) return setFieldError('Choose 1 to 5 stars');
    setFieldError(null);
    const result = await run(booking.id, { stars, ...(comment.trim() ? { comment: comment.trim() } : {}) });
    if (result.ok) onRated();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="border-accent-600 bg-surface-900 rounded-xl border p-5">
      <h2 className="text-sm font-semibold tracking-tight">{heading}</h2>
      <p className="text-ink-500 mb-4 text-xs">
        {booking.lessonType} on {formatDateTime(booking.scheduledAt)}. How was {booking.instructor?.fullName}? You can rate until {formatDate(booking.rateUntil)}. Your name is not shown to
        the instructor.
      </p>
      <FormAlert>{error?.message}</FormAlert>
      <fieldset>
        <legend className="sr-only">Stars</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="stars"
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
                className="peer sr-only"
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
              />
              <StarIcon
                size={28}
                weight={n <= stars ? 'fill' : 'regular'}
                className={`peer-focus-visible:ring-accent-500 rounded-full peer-focus-visible:ring-2 ${n <= stars ? 'text-accent-500' : 'text-ink-500'}`}
                aria-hidden="true"
              />
            </label>
          ))}
        </div>
        {fieldError ? <p className="text-danger-300 mt-2 text-sm">{fieldError}</p> : null}
      </fieldset>
      <label htmlFor={`rating-comment-${booking.id}`} className="text-ink-100 mt-4 block text-sm font-medium">
        Comment (optional)
      </label>
      <textarea
        id={`rating-comment-${booking.id}`}
        rows={3}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="bg-surface-900 text-ink-100 border-surface-600 focus:border-accent-500 focus:ring-accent-500/30 mt-2 block w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
      />
      <p className="text-ink-500 mt-1 text-right text-xs tabular-nums">{comment.length}/500</p>
      <SubmitButton size="md" loading={loading} loadingLabel="Sending…">
        Submit rating
      </SubmitButton>
    </form>
  );
}
