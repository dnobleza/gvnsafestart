import { StarIcon } from '@phosphor-icons/react';

export default function Stars({ value, size = 14 }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          size={size}
          weight={n <= value ? 'fill' : 'regular'}
          className={n <= value ? 'text-accent-500' : 'text-ink-500'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
