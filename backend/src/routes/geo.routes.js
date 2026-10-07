const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const requireAuth = require('../middlewares/requireAuth');
const { publicLimiter } = require('../middlewares/rateLimit');
const schemas = require('../validators/geo.validator');
const geo = require('../controllers/geo.controller');

const router = Router();

router.get('/reverse', requireAuth, publicLimiter, validate(schemas.reverseSchema), asyncHandler(geo.reverse));

module.exports = router;
