const config = require('../../config');
const paymongo = require('./paymongo.provider');
const fake = require('./fake.provider');

const PROVIDERS = { paymongo, fake };

const active = () => PROVIDERS[config.payments.provider];

module.exports = { active };
