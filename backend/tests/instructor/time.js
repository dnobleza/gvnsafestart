const config = require('../../src/config');
const { localParts, zonedDateTime, addDays, toMinutes } = require('../../src/utils/timezone');

const todayLocal = () => localParts(new Date(), config.timezone).date;

// A local calendar date `days` from today, in APP_TIMEZONE.
const dayAhead = (days) => addDays(todayLocal(), days);

// An instant at local wall-clock `hhmm` on local date `isoDate`.
const at = (isoDate, hhmm) => zonedDateTime(isoDate, toMinutes(hhmm), config.timezone);

module.exports = { todayLocal, dayAhead, at };
