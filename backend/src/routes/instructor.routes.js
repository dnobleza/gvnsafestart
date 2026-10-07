const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const requireAuth = require('../middlewares/requireAuth');
const requireRole = require('../middlewares/requireRole');
const schemas = require('../validators/instructor.validator');
const notificationSchemas = require('../validators/notification.validator');
const profile = require('../controllers/instructor/profile.controller');
const bookings = require('../controllers/instructor/booking.controller');
const workspace = require('../controllers/instructor/workspace.controller');
const notifications = require('../controllers/notification.controller');

const router = Router();

router.use(requireAuth, requireRole('INSTRUCTOR'));

router.get('/profile', validate(schemas.profileSchema), asyncHandler(profile.get));
router.get('/dashboard', validate(schemas.dashboardSchema), asyncHandler(bookings.dashboard));

router.get('/bookings', validate(schemas.bookingsListSchema), asyncHandler(bookings.list));
router.get('/bookings/:id', validate(schemas.bookingGetSchema), asyncHandler(bookings.get));
router.get('/bookings/:id/history', validate(schemas.bookingGetSchema), asyncHandler(bookings.history));
router.patch('/bookings/:id/confirm', validate(schemas.bookingActionSchema), asyncHandler(bookings.confirm));
router.patch('/bookings/:id/reschedule', validate(schemas.rescheduleSchema), asyncHandler(bookings.reschedule));
router.patch('/bookings/:id/complete', validate(schemas.bookingActionSchema), asyncHandler(bookings.complete));
router.patch('/bookings/:id/no-show', validate(schemas.bookingActionSchema), asyncHandler(bookings.noShow));
router.patch('/bookings/:id/cancel', validate(schemas.cancelSchema), asyncHandler(bookings.cancel));
router.post('/bookings/:id/cash', validate(schemas.cashSchema), asyncHandler(bookings.recordCash));

router.get('/schedule', validate(schemas.scheduleSchema), asyncHandler(bookings.schedule));

router.get('/clients', validate(schemas.clientsListSchema), asyncHandler(workspace.listClients));
router.get('/clients/:id', validate(schemas.clientGetSchema), asyncHandler(workspace.getClient));
router.post('/clients/:id/notes', validate(schemas.noteSchema), asyncHandler(workspace.addNote));

router.get('/availability', validate(schemas.availabilityGetSchema), asyncHandler(workspace.getAvailability));
router.put('/availability', validate(schemas.availabilityPutSchema), asyncHandler(workspace.putAvailability));
router.get('/availability/slots', validate(schemas.slotsSchema), asyncHandler(workspace.slots));
router.post('/days-off', validate(schemas.dayOffCreateSchema), asyncHandler(workspace.addDayOff));
router.delete('/days-off/:id', validate(schemas.dayOffDeleteSchema), asyncHandler(workspace.removeDayOff));

router.get('/cash', validate(schemas.cashListSchema), asyncHandler(workspace.listCash));
router.post('/cash/:id/void-request', validate(schemas.voidRequestSchema), asyncHandler(workspace.requestVoid));

router.get('/notifications', validate(notificationSchemas.listSchema), asyncHandler(notifications.list));
router.patch('/notifications/read-all', validate(notificationSchemas.readAllSchema), asyncHandler(notifications.markAllRead));
router.patch('/notifications/:id/read', validate(notificationSchemas.readSchema), asyncHandler(notifications.markRead));

router.get('/ratings', validate(schemas.ratingsSchema), asyncHandler(workspace.ratings));

module.exports = router;
