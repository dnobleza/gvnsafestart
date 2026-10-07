const partsOf = (date, timeZone) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const out = {};
  for (const { type, value } of fmt.formatToParts(date)) out[type] = Number(value);
  return out;
};

const offsetMs = (date, timeZone) => {
  const p = partsOf(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

// Date.UTC normalises overflow (day 32, month 13), so callers can ask for "next
// day" or "next month" by adding one. Two passes settle the offset across a DST jump.
const zonedTime = (year, month, day, minutes, timeZone) => {
  const naive = Date.UTC(year, month - 1, day) + minutes * 60000;
  const first = naive - offsetMs(new Date(naive), timeZone);
  return new Date(naive - offsetMs(new Date(first), timeZone));
};

const zonedMidnight = (year, month, day, timeZone) => zonedTime(year, month, day, 0, timeZone);

const dayBounds = (now, timeZone) => {
  const p = partsOf(now, timeZone);
  return {
    start: zonedMidnight(p.year, p.month, p.day, timeZone),
    end: zonedMidnight(p.year, p.month, p.day + 1, timeZone),
  };
};

const monthBounds = (now, timeZone) => {
  const p = partsOf(now, timeZone);
  return {
    start: zonedMidnight(p.year, p.month, 1, timeZone),
    end: zonedMidnight(p.year, p.month + 1, 1, timeZone),
  };
};

const dateRange = ({ from, to }, timeZone) => {
  const range = {};
  if (from) {
    const [y, m, d] = from.split('-').map(Number);
    range.gte = zonedMidnight(y, m, d, timeZone);
  }
  if (to) {
    const [y, m, d] = to.split('-').map(Number);
    range.lt = zonedMidnight(y, m, d + 1, timeZone);
  }
  return range;
};

const pad = (n) => String(n).padStart(2, '0');

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// Wall-clock view of an instant in the app zone: the calendar date, weekday
// (0 = Sunday) and minutes since local midnight.
const localParts = (date, timeZone) => {
  const p = partsOf(date, timeZone);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    dayOfWeek: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(),
    minutes: p.hour * 60 + p.minute,
  };
};

const zonedDateTime = (isoDate, minutes, timeZone) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return zonedTime(y, m, d, minutes, timeZone);
};

const addDays = (isoDate, days) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
};

module.exports = {
  dayBounds,
  monthBounds,
  dateRange,
  localParts,
  zonedDateTime,
  addDays,
  toMinutes,
  toHHMM,
};
