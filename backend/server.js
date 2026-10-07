const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/config/logger');
const prisma = require('./src/config/prisma');
const bookingSweeper = require('./src/jobs/bookingSweeper');

const server = app.listen(config.port, () => {
  logger.info(`API listening on http://localhost:${config.port}/api/v1 (${config.env})`);
});

bookingSweeper.start();

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.stack : reason });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { stack: err.stack });
  process.exit(1);
});
