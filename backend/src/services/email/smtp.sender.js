const nodemailer = require('nodemailer');
const config = require('../../config');

let transport;

const getTransport = () => {
  if (!transport) {
    const { host, port, user, pass } = config.email.smtp;
    transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }
  return transport;
};

const send = async ({ to, subject, text }) => {
  await getTransport().sendMail({ from: config.email.from, to, subject, text });
  return { provider: 'smtp', delivered: true };
};

module.exports = { send };
