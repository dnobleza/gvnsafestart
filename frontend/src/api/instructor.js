import { del, get, list, patch, post, put } from './request';

export const getMyProfile = () => get('/instructor/profile');

export const getDashboard = () => get('/instructor/dashboard');

export const listMyBookings = list('/instructor/bookings');

export const getMyBooking = (id) => get(`/instructor/bookings/${id}`).then((d) => d.booking);

export const getBookingHistory = (id) => get(`/instructor/bookings/${id}/history`).then((d) => d.history);

export const confirmBooking = (id) => patch(`/instructor/bookings/${id}/confirm`);

export const rescheduleBooking = (id, scheduledAt, reason) =>
  patch(`/instructor/bookings/${id}/reschedule`, { scheduledAt, reason });

export const completeBooking = (id) => patch(`/instructor/bookings/${id}/complete`);

export const markNoShow = (id) => patch(`/instructor/bookings/${id}/no-show`);

export const cancelBooking = (id, reason) => patch(`/instructor/bookings/${id}/cancel`, { reason });

export const recordCash = (id, body) => post(`/instructor/bookings/${id}/cash`, body);

export const getSchedule = (params) => get('/instructor/schedule', params).then((d) => d.bookings);

export const getSlots = (params) => get('/instructor/availability/slots', params);

export const listClients = list('/instructor/clients');

export const getClient = (id) => get(`/instructor/clients/${id}`);

export const addClientNote = (id, note) => post(`/instructor/clients/${id}/notes`, { note });

export const getAvailability = () => get('/instructor/availability');

export const saveAvailability = (weekly) => put('/instructor/availability', { weekly });

export const addDayOff = (body) => post('/instructor/days-off', body);

export const removeDayOff = (id) => del(`/instructor/days-off/${id}`);

export const listCash = list('/instructor/cash');

export const requestVoid = (paymentId, reason) => post(`/instructor/cash/${paymentId}/void-request`, { reason });

export const listNotifications = list('/instructor/notifications');

export const markNotificationRead = (id) => patch(`/instructor/notifications/${id}/read`);

export const markAllNotificationsRead = () => patch('/instructor/notifications/read-all');

export const listRatings = (params) =>
  list('/instructor/ratings')(params).then(({ data, meta }) => ({
    data: data.ratings,
    meta: { ...meta, summary: data.summary },
  }));
