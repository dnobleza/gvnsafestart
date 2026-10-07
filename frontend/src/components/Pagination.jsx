import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

import Button from './Button';

export default function Pagination({ meta, onPageChange, disabled }) {
  if (!meta || meta.total === 0) return null;

  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-4" aria-label="Pagination">
      <p className="text-ink-400 text-sm tabular-nums">
        {first}–{last} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={disabled || meta.page <= 1}
          aria-label="Previous page"
        >
          <CaretLeftIcon size={14} aria-hidden="true" />
          Prev
        </Button>
        <span className="text-ink-400 text-sm tabular-nums">
          Page {meta.page} of {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={disabled || meta.page >= pages}
          aria-label="Next page"
        >
          Next
          <CaretRightIcon size={14} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
