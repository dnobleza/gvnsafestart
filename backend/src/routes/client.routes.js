const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const requireAuth = require('../middlewares/requireAuth');
const requireRole = require('../middlewares/requireRole');
const schemas = require('../validators/client.validator');
const notificationSchemas = require('../validators/notification.validator');
const client = require('../controllers/client.controller');
const packages = require('../controllers/clientPackage.controller');
const notifications = require('../controllers/notification.controller');

const router = Router();

router.use(requireAuth, requireRole('CLIENT'));

router.get('/dashboard', validate(schemas.dashboardSchema), asyncHandler(client.dashboard));

router.get('/bookings', validate(schemas.bookingsListSchema), asyncHandler(client.listBookings));
router.post('/bookings', validate(schemas.createBookingSchema), asyncHandler(client.createBooking));
router.get('/bookings/:id', validate(schemas.bookingGetSchema), asyncHandler(client.getBooking));
router.patch('/bookings/:id/reschedule', validate(schemas.rescheduleSchema), asyncHandler(client.rescheduleBooking));
router.patch('/bookings/:id/cancel', validate(schemas.cancelSchema), asyncHandler(client.cancelBooking));
router.post('/bookings/:id/pay', validate(schemas.paySchema), asyncHandler(client.pay));
router.post('/bookings/:id/rating', validate(schemas.ratingSchema), asyncHandler(client.rate));

router.get('/packages', validate(schemas.packagesListSchema), asyncHandler(packages.list));
router.post('/packages', validate(schemas.purchaseSchema), asyncHandler(packages.purchase));
router.get('/packages/:id', validate(schemas.packageGetSchema), asyncHandler(packages.get));
router.post('/packages/:id/sessions', validate(schemas.nextSessionSchema), asyncHandler(packages.bookNext));
router.post('/packages/:id/pay', validate(schemas.packagePaySchema), asyncHandler(packages.pay));
router.patch('/packages/:id/cancel', validate(schemas.packageCancelSchema), asyncHandler(packages.cancel));

router.get('/notifications', validate(notificationSchemas.listSchema), asyncHandler(notifications.list));
router.patch('/notifications/read-all', validate(notificationSchemas.readAllSchema), asyncHandler(notifications.markAllRead));
router.patch('/notifications/:id/read', validate(notificationSchemas.readSchema), asyncHandler(notifications.markRead));

router.get('/profile', validate(schemas.profileGetSchema), asyncHandler(client.getProfile));
router.patch('/profile', validate(schemas.profileUpdateSchema), asyncHandler(client.updateProfile));

module.exports = router;
