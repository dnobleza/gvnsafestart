const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const requireCronSecret = require('../middlewares/requireCronSecret');
const { authLimiter } = require('../middlewares/rateLimit');
const { emptyBody } = require('../validators/common');
const cron = require('../controllers/cron.controller');

const router = Router();

router.post('/auto-complete', authLimiter, requireCronSecret, validate(emptyBody), asyncHandler(cron.autoCompleteRun));

module.exports = router;
