import { useEffect } from 'react';

import { onBookingChange } from '../utils/bookingEvents';

// Refetches this view whenever a booking-related notification arrives.
export default function useBookingRefresh(refetch) {
  useEffect(() => onBookingChange(() => refetch()), [refetch]);
}
