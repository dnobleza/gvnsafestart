import { getDashboard, getMyBooking, getMyPackage, getProfile, listMyBookings, listMyPackages } from '../../../api/clientPortal';
import {
  getInstructorSlots,
  getRecommended,
  listInstructors,
  listLocations,
  listPackages,
  listServiceAreas,
} from '../../../api/public';
import useResource from '../../../hooks/useResource';
import { PAGE_SIZE } from '../../../hooks/useListParams';

const fetchSlots = ({ id, date, duration }) => getInstructorSlots(id, { date, duration });
const fetchBooking = ({ id }) => getMyBooking(id);

export const useDashboard = () => useResource(getDashboard);

export const useLocations = () => useResource(listLocations);

export const useRecommended = (origin, date, duration) =>
  useResource(
    getRecommended,
    origin ? { lat: origin.latitude, lng: origin.longitude, date, duration } : null,
    { enabled: Boolean(origin && date) },
  );

export const useInstructorBrowse = (filters, page) =>
  useResource(listInstructors, { ...filters, page, limit: 10 });

export const useInstructorSlots = (id, date, duration) =>
  useResource(fetchSlots, { id, date, duration }, { enabled: Boolean(id && date) });

export const useMyBookings = (tab, page) => useResource(listMyBookings, { tab, page, limit: PAGE_SIZE });

export const useMyBooking = (id) => useResource(fetchBooking, { id }, { enabled: Boolean(id) });

export const useProfile = () => useResource(getProfile);

const fetchPackage = ({ id }) => getMyPackage(id);

export const useServiceAreas = () => useResource(listServiceAreas);

export const usePackages = (serviceAreaId, trainingType) =>
  useResource(listPackages, { serviceAreaId, trainingType }, { enabled: Boolean(serviceAreaId && trainingType) });

export const useMyPackages = (page) => useResource(listMyPackages, { page, limit: PAGE_SIZE });

export const useMyPackage = (id) => useResource(fetchPackage, { id }, { enabled: Boolean(id) });
