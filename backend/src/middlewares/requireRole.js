const AppError = require('../utils/AppError');

module.exports = function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('FORBIDDEN', `Requires role: ${roles.join(' or ')}`));
    }
    return next();
  };
};
