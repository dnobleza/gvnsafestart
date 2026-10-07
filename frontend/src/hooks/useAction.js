import { useCallback, useState } from 'react';

import { toApiError } from '../api/client';

export default function useAction(request) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        return { ok: true, data: await request(...args) };
      } catch (err) {
        const apiError = toApiError(err);
        setError(apiError);
        return { ok: false, error: apiError };
      } finally {
        setLoading(false);
      }
    },
    [request],
  );

  const reset = useCallback(() => setError(null), []);

  return { run, loading, error, reset };
}
