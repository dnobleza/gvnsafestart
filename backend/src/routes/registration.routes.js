const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const requireAuth = require('../middlewares/requireAuth');
const requireRole = require('../middlewares/requireRole');
const schemas = require('../validators/registration.validator');
const controller = require('../controllers/registration.controller');

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', validate(schemas.listSchema), asyncHandler(controller.list));
router.get('/:id', validate(schemas.idSchema), asyncHandler(controller.getOne));

module.exports = router;
