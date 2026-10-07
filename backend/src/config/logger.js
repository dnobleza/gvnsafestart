const winston = require('winston');
const config = require('./index');

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${message}${rest}`;
  }),
);

const logger = winston.createLogger({
  level: config.logLevel,
  format: config.isProduction
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : devFormat,
  transports: [new winston.transports.Console()],
  silent: config.env === 'test',
});

module.exports = logger;
