// These responses carry access tokens, one-time passwords or personal data, so
// no browser or proxy cache may keep a copy.
module.exports = function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
};
