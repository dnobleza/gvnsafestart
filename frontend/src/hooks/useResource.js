import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '../api/client';

// Fetches whenever `params` changes (compared by value). Responses that arrive
// after a newer request has started are dropped, so typing quickly in a filter
// can never leave an older result on screen.
export default function useResource(fetcher, params, { enabled = true } = {}) {
  const key = JSON.stringify(params ?? null);
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null });
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await fetcher(JSON.parse(key));
      if (id !== latest.current) return;
      const isList = result && typeof result === 'object' && 'data' in result && 'meta' in result;
      setState({
        data: isList ? result.data : result,
        meta: isList ? result.meta : null,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (id !== latest.current) return;
      setState((s) => ({ ...s, loading: false, error: toApiError(err) }));
    }
  }, [fetcher, key]);

  useEffect(() => {
    if (enabled) load();
  }, [load, enabled]);

  return { ...state, refetch: load };
}
