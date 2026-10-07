import { get, list, patch, post, put } from './request';

export const getOverview = () => get('/admin/overview');

export const listPayments = list('/admin/payments');

export const listBookings = list('/admin/bookings');

export const approveBooking = (id) => post(`/admin/bookings/${id}/approve`);

export const getBooking = (id) => get(`/admin/bookings/${id}`);

export const getBookingHistory = (id) => get(`/admin/bookings/${id}/history`);

export const rescheduleBooking = (id, scheduledAt, reason) => post(`/admin/bookings/${id}/reschedule`, { scheduledAt, reason });

export const cancelBooking = (id, reason) => post(`/admin/bookings/${id}/cancel`, { reason });

export const listInstructors = list('/admin/instructors');

export const getInstructor = (id) => get(`/admin/instructors/${id}`);

export const createInstructor = (body) => post('/admin/instructors', body);

export const updateInstructor = (id, body) => patch(`/admin/instructors/${id}`, body);

export const deactivateInstructor = (id) => post(`/admin/instructors/${id}/deactivate`);

export const resetInstructorPassword = (id) => post(`/admin/instructors/${id}/reset-password`);

export const listAdmins = list('/admin/admins');

export const createAdmin = (body) => post('/admin/admins', body);

export const deactivateAdmin = (id) => post(`/admin/admins/${id}/deactivate`);

export const resetAdminPassword = (id) => post(`/admin/admins/${id}/reset-password`);

export const listBranches = list('/admin/branches');

export const listBranchOptions = () => get('/admin/branches/options');

export const createBranch = (body) => post('/admin/branches', body);

export const updateBranch = (id, body) => patch(`/admin/branches/${id}`, body);

export const listAuditLogs = list('/admin/audit-logs');

export const listRatings = (params) =>
  list('/admin/ratings')(params).then(({ data, meta }) => ({ data: data.ratings, meta: { ...meta, instructors: data.instructors } }));

export const setRatingHidden = (id, hidden) => patch(`/admin/ratings/${id}/hide`, { hidden });

export const listVoidRequests = list('/admin/void-requests');

export const reviewVoidRequest = (id, decision) => patch(`/admin/void-requests/${id}`, { decision });

export const getSettings = () => get('/admin/settings').then((d) => d.settings);

export const updateSettings = (body) => patch('/admin/settings', body).then((d) => d.settings);

export const listAdminPackages = () => get('/admin/packages').then((d) => d.packages);

export const createPackage = (body) => post('/admin/packages', body).then((d) => d.package);

export const updatePackage = (id, body) => patch(`/admin/packages/${id}`, body).then((d) => d.package);

export const getPackageRates = (params) => get('/admin/package-rates', params);

export const savePackageRates = (body) => put('/admin/package-rates', body);

export const listAdminServiceAreas = () => get('/admin/service-areas').then((d) => d.serviceAreas);

export const updateServiceArea = (id, body) => patch(`/admin/service-areas/${id}`, body).then((d) => d.serviceArea);

export const getPaymentProvider = () => get('/admin/payment-provider');

export const testPaymentProvider = () => post('/admin/payment-provider/test');
