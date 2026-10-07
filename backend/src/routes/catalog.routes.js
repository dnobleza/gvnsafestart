const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { publicLimiter } = require('../middlewares/rateLimit');
const schemas = require('../validators/catalog.validator');
const catalog = require('../controllers/catalog.controller');

const router = Router();

router.get('/locations', publicLimiter, validate(schemas.locationsSchema), asyncHandler(catalog.locations));
router.get('/service-areas', publicLimiter, validate(schemas.serviceAreasSchema), asyncHandler(catalog.serviceAreas));
router.get('/packages', publicLimiter, validate(schemas.packagesSchema), asyncHandler(catalog.packages));
router.get('/instructors', publicLimiter, validate(schemas.instructorsSchema), asyncHandler(catalog.instructors));
router.get(
  '/instructors/recommended',
  publicLimiter,
  validate(schemas.recommendedSchema),
  asyncHandler(catalog.recommended),
);
router.get('/instructors/:id', publicLimiter, validate(schemas.instructorSchema), asyncHandler(catalog.instructor));
router.get('/public/top-instructors', publicLimiter, validate(schemas.topSchema), asyncHandler(catalog.top));
router.get('/instructors/:id/slots', publicLimiter, validate(schemas.slotsSchema), asyncHandler(catalog.slots));

// Public: authenticated by the provider's signature, not by a user session.
router.post('/payments/webhooks/paymongo', asyncHandler(catalog.paymongoWebhook));

module.exports = router;
