import { useEffect, useRef } from 'react';

import useResource from '../../../hooks/useResource';
import { emitBookingChange } from '../../../utils/bookingEvents';
import { showToast } from '../../../utils/toast';

export const POLL_MS = 30000;

const PREVIEW = { page: 1, limit: 5 };

// Polls the newest few notifications; the list endpoint's meta carries the
// unread count, so one request keeps both the badge and the dropdown fresh.
// Notifications that arrive between polls refresh open booking views, and a
// completed session also shows a toast. The first load only sets the baseline.
export default function useNotificationFeed(listNotifications) {
  const feed = useResource(listNotifications, PREVIEW);
  const { refetch, data } = feed;
  const seen = useRef(null);

  useEffect(() => {
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [refetch]);

  useEffect(() => {
    if (!data) return;
    if (seen.current) {
      const fresh = data.filter((n) => !seen.current.has(n.id) && !n.isRead);
      const aboutBookings = fresh.filter((n) => n.bookingId);
      if (aboutBookings.length) emitBookingChange(aboutBookings);
      fresh.filter((n) => n.type === 'BOOKING_COMPLETED').forEach((n) => showToast(n.title, { tone: 'success' }));
    } else {
      seen.current = new Set();
    }
    data.forEach((n) => seen.current.add(n.id));
  }, [data]);

  return { ...feed, unread: feed.meta?.unread ?? 0 };
}
