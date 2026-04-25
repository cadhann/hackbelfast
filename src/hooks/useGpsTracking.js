import { useEffect, useRef, useState } from 'react';

// Wraps navigator.geolocation.watchPosition.
// Returns { position: { lat, lng, accuracy, heading } | null, gpsError: string | null }
export function useGpsTracking(enabled) {
  const [position, setPosition] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setPosition(null);
      setGpsError(null);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by this browser.');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          heading: coords.heading,
        });
        setGpsError(null);
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  return { position, gpsError };
}
