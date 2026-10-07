import { WarningCircleIcon } from '@phosphor-icons/react';

import Button from './Button';

const SKELETON_ROWS = 5;

export default function DataTable({ columns, rows, loading, error, onRetry, emptyMessage, caption, rowKey = 'id' }) {
  const hasRows = Boolean(rows?.length);

  let body;
  if (error) {
    body = (
      <tr>
        <td colSpan={columns.length} className="px-4 py-12">
          <div role="alert" className="flex flex-col items-center gap-3 text-center">
            <WarningCircleIcon size={28} className="text-danger-300" aria-hidden="true" />
            <p className="text-ink-100">{error.message}</p>
            {onRetry ? (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
    );
  } else if (loading && !hasRows) {
    body = Array.from({ length: SKELETON_ROWS }, (_, i) => (
      <tr key={i} className="border-surface-800 border-b last:border-0">
        {columns.map((col) => (
          <td key={col.key} className="px-4 py-4">
            <div className="bg-surface-700 h-4 w-3/4 animate-pulse rounded-xl" />
          </td>
        ))}
      </tr>
    ));
  } else if (!hasRows) {
    body = (
      <tr>
        <td colSpan={columns.length} className="text-ink-400 px-4 py-12 text-center">
          {emptyMessage}
        </td>
      </tr>
    );
  } else {
    body = rows.map((row) => (
      <tr key={row[rowKey]} className="border-surface-800 hover:bg-surface-800/60 border-b last:border-0">
        {columns.map((col) => (
          <td key={col.key} className={`px-4 py-3 align-middle ${col.className || ''}`}>
            {col.render ? col.render(row) : row[col.key]}
          </td>
        ))}
      </tr>
    ));
  }

  return (
    <div className="border-surface-700 bg-surface-900 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-left text-sm" aria-busy={loading || undefined}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-surface-700 text-ink-400 border-b">
            {columns.map((col) => (
              <th key={col.key} scope="col" className={`px-4 py-3 font-medium whitespace-nowrap ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={loading && hasRows ? 'opacity-60' : undefined}>{body}</tbody>
      </table>
    </div>
  );
}
