const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { status: 'ok', uptime: Math.round(process.uptime()) } });
  }),
);

module.exports = router;
