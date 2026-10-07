const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middlewares/validate');
const requireAuth = require('../../middlewares/requireAuth');
const requireRole = require('../../middlewares/requireRole');
const schemas = require('../../validators/admin.validator');
const dashboard = require('../../controllers/admin/dashboard.controller');
const payments = require('../../controllers/admin/payment.controller');
const bookings = require('../../controllers/admin/booking.controller');
const instructors = require('../../controllers/admin/instructor.controller');
const admins = require('../../controllers/admin/admin.controller');
const branches = require('../../controllers/admin/branch.controller');
const audit = require('../../controllers/admin/audit.controller');
const ratings = require('../../controllers/admin/rating.controller');
const settings = require('../../controllers/admin/settings.controller');
const catalog = require('../../controllers/admin/catalog.controller');
const autoComplete = require('../../controllers/admin/autoComplete.controller');
const notifications = require('../../controllers/notification.controller');
const notificationSchemas = require('../../validators/notification.validator');

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/overview', validate(schemas.overviewSchema), asyncHandler(dashboard.overview));

router.get('/payments', validate(schemas.paymentsListSchema), asyncHandler(payments.list));
router.get('/void-requests', validate(schemas.voidRequestListSchema), asyncHandler(ratings.listVoidRequests));
router.patch('/void-requests/:id', validate(schemas.reviewVoidSchema), asyncHandler(ratings.reviewVoid));

router.get('/ratings', validate(schemas.ratingsListSchema), asyncHandler(ratings.list));
router.patch('/ratings/:id/hide', validate(schemas.hideRatingSchema), asyncHandler(ratings.hide));

router.get('/bookings', validate(schemas.bookingsListSchema), asyncHandler(bookings.list));
router.get('/bookings/:id', validate(schemas.bookingHistorySchema), asyncHandler(bookings.get));
router.get('/bookings/:id/history', validate(schemas.bookingHistorySchema), asyncHandler(bookings.history));
router.post('/bookings/:id/approve', validate(schemas.approveBookingSchema), asyncHandler(bookings.approve));
router.post('/bookings/:id/reschedule', validate(schemas.rescheduleBookingSchema), asyncHandler(bookings.reschedule));
router.post('/bookings/:id/cancel', validate(schemas.cancelBookingSchema), asyncHandler(bookings.cancel));

router.get('/instructors', validate(schemas.instructorListSchema), asyncHandler(instructors.list));
router.post('/instructors', validate(schemas.createInstructorSchema), asyncHandler(instructors.create));
router.get('/instructors/:id', validate(schemas.instructorGetSchema), asyncHandler(instructors.get));
router.patch('/instructors/:id', validate(schemas.updateInstructorSchema), asyncHandler(instructors.update));
router.post('/instructors/:id/deactivate', validate(schemas.accountActionSchema), asyncHandler(instructors.deactivate));
router.post('/instructors/:id/reset-password', validate(schemas.accountActionSchema), asyncHandler(instructors.resetPassword));

router.get('/admins', validate(schemas.adminListSchema), asyncHandler(admins.list));
router.post('/admins', validate(schemas.createAdminSchema), asyncHandler(admins.create));
router.post('/admins/:id/deactivate', validate(schemas.accountActionSchema), asyncHandler(admins.deactivate));
router.post('/admins/:id/reset-password', validate(schemas.accountActionSchema), asyncHandler(admins.resetPassword));

router.get('/branches', validate(schemas.branchListSchema), asyncHandler(branches.list));
router.get('/branches/options', validate(schemas.branchOptionsSchema), asyncHandler(branches.options));
router.post('/branches', validate(schemas.createBranchSchema), asyncHandler(branches.create));
router.patch('/branches/:id', validate(schemas.updateBranchSchema), asyncHandler(branches.update));

router.get('/packages', validate(schemas.packagesAdminListSchema), asyncHandler(catalog.listPackages));
router.post('/packages', validate(schemas.createPackageSchema), asyncHandler(catalog.createPackage));
router.patch('/packages/:id', validate(schemas.updatePackageSchema), asyncHandler(catalog.updatePackage));
router.get('/package-rates', validate(schemas.rateGridSchema), asyncHandler(catalog.rateGrid));
router.put('/package-rates', validate(schemas.saveRatesSchema), asyncHandler(catalog.saveRates));
router.get('/service-areas', validate(schemas.serviceAreasAdminListSchema), asyncHandler(catalog.listAreas));
router.patch('/service-areas/:id', validate(schemas.updateServiceAreaSchema), asyncHandler(catalog.updateArea));

router.get('/payment-provider', validate(schemas.settingsGetSchema), asyncHandler(settings.paymentProvider));
router.post('/payment-provider/test', validate(schemas.paymentProviderTestSchema), asyncHandler(settings.testPaymentProvider));

router.get('/settings', validate(schemas.settingsGetSchema), asyncHandler(settings.get));
router.patch('/settings', validate(schemas.settingsUpdateSchema), asyncHandler(settings.update));

router.get('/audit-logs', validate(schemas.auditListSchema), asyncHandler(audit.list));

router.get('/auto-complete', validate(schemas.autoCompleteStatusSchema), asyncHandler(autoComplete.status));
router.get('/auto-complete/runs', validate(schemas.autoCompleteRunsSchema), asyncHandler(autoComplete.runs));
router.post('/auto-complete/run', validate(schemas.autoCompleteRunSchema), asyncHandler(autoComplete.run));

router.get('/notifications', validate(notificationSchemas.listSchema), asyncHandler(notifications.list));
router.patch('/notifications/read-all', validate(notificationSchemas.readAllSchema), asyncHandler(notifications.markAllRead));
router.patch('/notifications/:id/read', validate(notificationSchemas.readSchema), asyncHandler(notifications.markRead));

module.exports = router;
