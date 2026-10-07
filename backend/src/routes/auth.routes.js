const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const requireAuth = require('../middlewares/requireAuth');
const { authLimiter, otpLimiter } = require('../middlewares/rateLimit');
const schemas = require('../validators/auth.validator');
const controller = require('../controllers/auth.controller');

const router = Router();

router.post('/register', authLimiter, validate(schemas.registerSchema), asyncHandler(controller.register));
router.post('/login', authLimiter, validate(schemas.loginSchema), asyncHandler(controller.login));
router.post('/google', authLimiter, validate(schemas.googleSchema), asyncHandler(controller.google));
router.post('/facebook', authLimiter, validate(schemas.facebookSchema), asyncHandler(controller.facebook));

router.post('/phone/request-otp', otpLimiter, validate(schemas.requestOtpSchema), asyncHandler(controller.requestOtp));
router.post('/phone/verify-otp', otpLimiter, validate(schemas.verifyOtpSchema), asyncHandler(controller.verifyOtp));

router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', requireAuth.allowPasswordChangePending, asyncHandler(controller.me));
router.post(
  '/change-password',
  authLimiter,
  requireAuth.allowPasswordChangePending,
  validate(schemas.changePasswordSchema),
  asyncHandler(controller.changePassword),
);

module.exports = router;
