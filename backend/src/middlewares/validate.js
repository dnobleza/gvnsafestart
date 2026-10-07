const { z } = require('zod');
const AppError = require('../utils/AppError');

const TARGETS = ['body', 'query', 'params'];

module.exports = function validate(schemas) {
  return (req, _res, next) => {
    for (const target of TARGETS) {
      const schema = schemas[target];
      if (!schema) continue;

      const result = schema.safeParse(req[target]);
      if (!result.success) {
        return next(
          AppError.badRequest('VALIDATION_ERROR', `Invalid request ${target}`, formatIssues(result.error)),
        );
      }
      req[target] = result.data;
    }
    return next();
  };
};

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

module.exports.isZodError = (err) => err instanceof z.ZodError;
module.exports.formatIssues = formatIssues;
