import { useCallback, useState } from 'react';

import { toApiError } from '../../../api/client';
import { useAuthStore } from '../../../store/authStore';

export default function useAuthSubmit(request) {
  const setSession = useAuthStore((state) => state.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(
    async (body) => {
      setLoading(true);
      setError(null);
      try {
        const session = await request(body);
        setSession(session);
        return { ok: true };
      } catch (err) {
        const apiError = toApiError(err);
        setError(apiError);
        return { ok: false, error: apiError };
      } finally {
        setLoading(false);
      }
    },
    [request, setSession],
  );

  return { submit, loading, error };
}
