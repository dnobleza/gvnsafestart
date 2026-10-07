const config = require('../../config');
const logger = require('../../config/logger');
const consoleSender = require('./console.sender');
const smtpSender = require('./smtp.sender');

const SENDERS = { console: consoleSender, smtp: smtpSender };

const send = (payload) => SENDERS[config.email.provider].send(payload);

// Runs after the database change has committed. A failed email is logged and
// dropped so it can never undo or fail the change that triggered it.
const sendAll = async (messages) => {
  await Promise.all(
    messages
      .filter((m) => m.to)
      .map((m) =>
        send(m).catch((err) => {
          logger.error(`Email to ${m.to} failed: ${err.message}`, { subject: m.subject });
        }),
      ),
  );
};

module.exports = { send, sendAll };
