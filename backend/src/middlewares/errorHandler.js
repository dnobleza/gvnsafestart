const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
const config = require('../config');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const { formatIssues } = require('./validate');

const PRISMA_CODE_MAP = {
  P2002: { statusCode: 409, code: 'DUPLICATE_RESOURCE', message: 'Resource already exists' },
  P2003: { statusCode: 400, code: 'INVALID_REFERENCE', message: 'Referenced resource does not exist' },
  P2025: { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' },
};

module.exports = function errorHandler(err, req, res, _next) {
  const mapped = mapError(err);

  // A deliberate AppError is a handled outcome even at 5xx (e.g. a provider that
  // is not configured), so it is not treated as an internal fault.
  const isUnexpected = !(err instanceof AppError) && mapped.statusCode >= 500;

  const logMeta = { id: req.id, code: mapped.code, status: mapped.statusCode };
  if (isUnexpected) {
    logger.error(err.message, { ...logMeta, stack: err.stack });
  } else {
    logger.warn(err.message, logMeta);
  }

  const body = {
    success: false,
    error: { code: mapped.code, message: mapped.message },
  };
  if (mapped.details) body.error.details = mapped.details;
  if (!config.isProduction && isUnexpected) body.error.stack = err.stack;

  res.status(mapped.statusCode).json(body);
};

function mapError(err) {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message, details: err.details };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: formatIssues(err),
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA_CODE_MAP[err.code]) {
    return PRISMA_CODE_MAP[err.code];
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: 400, code: 'INVALID_QUERY', message: 'Invalid database query' };
  }

  if (err.type === 'entity.parse.failed') {
    return { statusCode: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong' };
}
