const AppError = require('../utils/AppError');

module.exports = function notFound(req, _res, next) {
  next(AppError.notFound('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
};
