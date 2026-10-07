const crypto = require('crypto');

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_+=';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;
const LENGTH = 16;

const pick = (set) => set[crypto.randomInt(set.length)];

const generateTempPassword = () => {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < LENGTH) chars.push(pick(ALL));

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};

module.exports = { generateTempPassword };
