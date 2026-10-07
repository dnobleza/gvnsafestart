import { useEffect } from 'react';

import useResource from '../../../hooks/useResource';

export const POLL_MS = 30000;

const PREVIEW = { page: 1, limit: 5 };

// Polls the newest few notifications; the list endpoint's meta carries the
// unread count, so one request keeps both the badge and the dropdown fresh.
export default function useNotificationFeed(listNotifications) {
  const feed = useResource(listNotifications, PREVIEW);
  const { refetch } = feed;

  useEffect(() => {
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [refetch]);

  return { ...feed, unread: feed.meta?.unread ?? 0 };
}
