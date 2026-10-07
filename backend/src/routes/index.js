const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const registrationRoutes = require('./registration.routes');
const adminRoutes = require('./admin');
const instructorRoutes = require('./instructor.routes');
const clientRoutes = require('./client.routes');
const catalogRoutes = require('./catalog.routes');
const geoRoutes = require('./geo.routes');
const cronRoutes = require('./cron.routes');
const noStore = require('../middlewares/noStore');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', noStore, authRoutes);
router.use('/registrations', noStore, registrationRoutes);
router.use('/admin', noStore, adminRoutes);
router.use('/instructor', noStore, instructorRoutes);
router.use('/client', noStore, clientRoutes);
router.use('/geo', noStore, geoRoutes);
router.use('/cron', noStore, cronRoutes);
router.use(catalogRoutes);

module.exports = router;
