import {
  getAvailability,
  getBookingHistory,
  getClient,
  getDashboard,
  getMyBooking,
  getSchedule,
  getSlots,
  listCash,
  listClients,
  listMyBookings,
  listRatings,
} from '../../../api/instructor';
import useResource from '../../../hooks/useResource';
import { PAGE_SIZE } from '../../../hooks/useListParams';

const withPage = (filters, page) => ({ ...filters, page, limit: PAGE_SIZE });

const byId = (request) => ({ id }) => request(id);
const fetchBooking = byId(getMyBooking);
const fetchHistory = byId(getBookingHistory);
const fetchClient = byId(getClient);

export const useDashboard = () => useResource(getDashboard);

export const useMyBookings = (filters, page) => useResource(listMyBookings, withPage(filters, page));

export const useMyBooking = (id) => useResource(fetchBooking, { id }, { enabled: Boolean(id) });

export const useBookingHistory = (id) => useResource(fetchHistory, { id }, { enabled: Boolean(id) });

export const useSchedule = (from, to) => useResource(getSchedule, { from, to });

export const useSlots = (date, bookingId) =>
  useResource(getSlots, { date, bookingId }, { enabled: Boolean(date && bookingId) });

export const useClients = (page) => useResource(listClients, { page, limit: PAGE_SIZE });

export const useClient = (id) => useResource(fetchClient, { id }, { enabled: Boolean(id) });

export const useAvailability = () => useResource(getAvailability);

export const useCash = (filters, page) => useResource(listCash, withPage(filters, page));

export const useRatings = (page) => useResource(listRatings, { page, limit: PAGE_SIZE });
