const AppError = require('../utils/AppError');
const tokenService = require('../services/token.service');
const userRepository = require('../repositories/user.repository');

const authenticate = ({ allowPasswordChangePending = false } = {}) =>
  async function requireAuth(req, _res, next) {
    try {
      const header = req.get('authorization') || '';
      const [scheme, token] = header.split(' ');

      if (scheme !== 'Bearer' || !token) {
        throw AppError.unauthorized('UNAUTHORIZED', 'Bearer access token required');
      }

      const payload = tokenService.verifyAccessToken(token);
      const user = await userRepository.findById(payload.sub);

      if (!user) throw AppError.unauthorized('UNAUTHORIZED', 'Account no longer exists');
      if (!user.isActive) throw AppError.forbidden('ACCOUNT_INACTIVE', 'Account is disabled');
      if (user.mustChangePassword && !allowPasswordChangePending) {
        throw AppError.forbidden('PASSWORD_CHANGE_REQUIRED', 'You must change your password first');
      }

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };

module.exports = authenticate();
module.exports.allowPasswordChangePending = authenticate({ allowPasswordChangePending: true });
module.exports.authenticate = authenticate;
