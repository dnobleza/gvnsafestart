import { useCallback, useState } from 'react';

// Resolves to { latitude, longitude } or null. A refusal, timeout or missing
// API is not an error the user needs to see: callers fall back to choosing a
// branch from the list.
export default function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const locate = useCallback(
    () =>
      new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          setUnavailable(true);
          resolve(null);
          return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocating(false);
            setUnavailable(false);
            resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          },
          () => {
            setLocating(false);
            setUnavailable(true);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
        );
      }),
    [],
  );

  return { locate, locating, unavailable };
}
