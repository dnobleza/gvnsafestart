import {
  getBooking,
  getBookingHistory,
  getInstructor,
  getOverview,
  listAdmins,
  listAuditLogs,
  listBookings,
  listBranches,
  listBranchOptions,
  listInstructors,
  listPayments,
  listRatings,
  listVoidRequests,
} from '../../../api/admin';
import useResource from '../../../hooks/useResource';
import { PAGE_SIZE } from '../../../hooks/useListParams';

const withPage = (filters, page) => ({ ...filters, page, limit: PAGE_SIZE });

const fetchInstructor = ({ id }) => getInstructor(id);
const fetchBooking = ({ id }) => getBooking(id).then((d) => d.booking);
const fetchHistory = ({ id }) => getBookingHistory(id).then((d) => d.history);
const fetchInstructorOptions = () => listInstructors({ page: 1, limit: 100, status: 'active' });

export const useOverview = () => useResource(getOverview);

export const usePayments = (filters, page) => useResource(listPayments, withPage(filters, page));

export const useBookings = (filters, page) => useResource(listBookings, withPage(filters, page));

export const useInstructors = (filters, page) => useResource(listInstructors, withPage(filters, page));

export const useInstructor = (id) => useResource(fetchInstructor, { id }, { enabled: Boolean(id) });

export const useAdmins = (filters, page) => useResource(listAdmins, withPage(filters, page));

export const useBranches = (filters, page) => useResource(listBranches, withPage(filters, page));

export const useBranchOptions = () => useResource(listBranchOptions);

export const useAuditLogs = (filters, page) => useResource(listAuditLogs, withPage(filters, page));

export const useBooking = (id) => useResource(fetchBooking, { id }, { enabled: Boolean(id) });

export const useBookingHistory = (id) => useResource(fetchHistory, { id }, { enabled: Boolean(id) });

export const useInstructorOptions = () => useResource(fetchInstructorOptions);

export const useRatings = (filters, page) => useResource(listRatings, withPage(filters, page));

export const useVoidRequests = (filters, page) => useResource(listVoidRequests, withPage(filters, page));
