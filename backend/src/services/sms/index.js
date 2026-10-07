const config = require('../../config');
const consoleSender = require('./console.sender');

const SENDERS = { console: consoleSender };

const sender = SENDERS[config.smsProvider];

const send = (payload) => sender.send(payload);

module.exports = { send };
