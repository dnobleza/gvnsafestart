const ratingService = require('../../services/rating.service');
const cashService = require('../../services/cash.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const list = async (req, res) => {
  const { data, instructors, meta: pageMeta } = await ratingService.forAdmin(req.query);
  res.json({ success: true, data: { ratings: data, instructors }, meta: pageMeta });
};

const hide = async (req, res) => {
  const rating = await ratingService.setHidden(req.user, req.params.id, req.body.hidden, meta(req));
  res.json({ success: true, data: { rating } });
};

const listVoidRequests = async (req, res) => {
  const { data, meta: pageMeta } = await cashService.listVoidRequests(req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const reviewVoid = async (req, res) => {
  const voidRequest = await cashService.reviewVoid(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { voidRequest } });
};

module.exports = { list, hide, listVoidRequests, reviewVoid };
