const config = require('../config');
const logger = require('../config/logger');

const CACHE_MS = 24 * 3600000;
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 5000;

const cache = new Map();
let queue = Promise.resolve();
let lastCallAt = 0;

const first = (...values) => values.find((v) => typeof v === 'string' && v.trim()) || null;

// Nominatim names Philippine barangays inconsistently (quarter, suburb,
// village, neighbourhood), so take the first one present.
const toPlace = (body) => {
  const a = (body && body.address) || {};
  const barangay = first(a.quarter, a.suburb, a.village, a.neighbourhood, a.hamlet);
  const city = first(a.city, a.town, a.municipality, a.city_district, a.county);
  const province = first(a.province, a.state, a.region);
  if (!barangay && !city) return null;
  const street = first([a.house_number, a.road].filter(Boolean).join(' '));
  return {
    label: [barangay, city].filter(Boolean).join(', '),
    barangay,
    city,
    province,
    address: [street, barangay, city, province].filter(Boolean).join(', '),
  };
};

// One request per second at most, as Nominatim's usage policy requires.
const throttled = (fn) => {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
};

const lookup = async (lat, lng) => {
  const url = new URL(`${config.geocoder.baseUrl}/reverse`);
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'en',
  }).toString();
  const contact = config.geocoder.contactEmail ? ` (${config.geocoder.contactEmail})` : '';
  const res = await fetch(url, {
    headers: { 'User-Agent': `GVN-Safestart/1.0${contact}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`geocoder responded ${res.status}`);
  return toPlace(await res.json());
};

// Turns coordinates into a barangay/city. A lookup failure is not the
// caller's problem: it gets null and shows coordinates instead.
const reverse = async ({ lat, lng }) => {
  if (config.geocoder.provider === 'off') return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.place;
  try {
    const place = await throttled(() => lookup(lat, lng));
    cache.set(key, { at: Date.now(), place });
    return place;
  } catch (err) {
    logger.warn(`Reverse geocoding failed: ${err.message}`);
    return null;
  }
};

const clearCache = () => cache.clear();

module.exports = { reverse, toPlace, clearCache };
