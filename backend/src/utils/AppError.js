class AppError extends Error {
  constructor(code, statusCode, message, details) {
    super(message || code);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    if (details) this.details = details;
    Error.captureStackTrace(this, AppError);
  }

  static badRequest(code, message, details) {
    return new AppError(code, 400, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required') {
    return new AppError(code, 401, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'Not allowed to access this resource') {
    return new AppError(code, 403, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found') {
    return new AppError(code, 404, message);
  }

  static conflict(code, message) {
    return new AppError(code, 409, message);
  }
}

module.exports = AppError;
