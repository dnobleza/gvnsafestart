import { get, list, patch, post } from './request';

export const getDashboard = () => get('/client/dashboard');

export const createBooking = (body) => post('/client/bookings', body);

export const listMyBookings = list('/client/bookings');

export const getMyBooking = (id) => get(`/client/bookings/${id}`).then((d) => d.booking);

export const cancelMyBooking = (id, reason) => patch(`/client/bookings/${id}/cancel`, { reason });

export const rescheduleMyBooking = (id, scheduledAt, reason) =>
  patch(`/client/bookings/${id}/reschedule`, { scheduledAt, reason });

export const payBooking = (id) => post(`/client/bookings/${id}/pay`);

export const rateBooking = (id, body) => post(`/client/bookings/${id}/rating`, body);

export const getProfile = () => get('/client/profile').then((d) => d.profile);

export const updateProfile = (body) => patch('/client/profile', body).then((d) => d.profile);

export const listNotifications = list('/client/notifications');

export const markNotificationRead = (id) => patch(`/client/notifications/${id}/read`);

export const markAllNotificationsRead = () => patch('/client/notifications/read-all');

export const purchasePackage = (body) => post('/client/packages', body);

export const listMyPackages = list('/client/packages');

export const getMyPackage = (id) => get(`/client/packages/${id}`).then((d) => d.package);

export const bookNextSession = (id, scheduledAt) => post(`/client/packages/${id}/sessions`, { scheduledAt }).then((d) => d.package);

export const payPackage = (id) => post(`/client/packages/${id}/pay`);

export const cancelPackage = (id, reason) => patch(`/client/packages/${id}/cancel`, { reason }).then((d) => d.package);
