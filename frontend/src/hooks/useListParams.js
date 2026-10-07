import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const PAGE_SIZE = 20;

// Filters and page live in the URL so refresh, back and shared links all keep
// the admin's current view. `filterKeys` must be a stable (module-level) array.
export default function useListParams(filterKeys) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => Object.fromEntries(filterKeys.map((key) => [key, searchParams.get(key) ?? ''])),
    [searchParams, filterKeys],
  );
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const update = useCallback(
    (changes) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === '' || value === null || value === undefined) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const setFilter = useCallback((key, value) => update({ [key]: value, page: '' }), [update]);
  const setPage = useCallback((value) => update({ page: value > 1 ? value : '' }), [update]);
  const resetFilters = useCallback(
    () => update(Object.fromEntries([...filterKeys, 'page'].map((key) => [key, '']))),
    [update, filterKeys],
  );

  return { filters, page, setFilter, setPage, resetFilters };
}
