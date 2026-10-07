const TIME_ZONE = 'Asia/Manila';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateOnly = new Intl.DateTimeFormat('en-PH', { timeZone: TIME_ZONE, dateStyle: 'medium' });

export const formatMoney = (amount, currency = 'PHP') =>
  currency === 'PHP'
    ? money.format(Number(amount))
    : new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(amount));

export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '—');

export const formatDate = (value) => (value ? dateOnly.format(new Date(value)) : '—');

// <input type="datetime-local"> works in the browser's zone, which for this
// business is Manila; converting through Date keeps the API value in UTC ISO.
export const toLocalInputValue = (value) => {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatAddress = (address) =>
  address ? [address.street, address.barangay, address.city, address.province].filter(Boolean).join(', ') : null;

const timeOnly = new Intl.DateTimeFormat('en-PH', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' });

const weekday = new Intl.DateTimeFormat('en-PH', { timeZone: TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' });

const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export const formatTime = (value) => (value ? timeOnly.format(new Date(value)) : '—');

export const formatDay = (value) => (value ? weekday.format(new Date(value)) : '—');

// Calendar date (YYYY-MM-DD) of an instant as seen in Manila.
export const toLocalDate = (value = new Date()) => isoDay.format(new Date(value));

export const addDaysToDate = (isoDate, days) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
};

// Must match the reason the API's auto-complete job writes.
export const NOT_CONFIRMED_REASON = 'Not confirmed before session start';

export const ROLE_LABEL = { ADMIN: 'Admin', INSTRUCTOR: 'Instructor', CLIENT: 'Client', SYSTEM: 'System' };

export const ACTION_LABEL = {
  CREATED: 'Booked',
  CONFIRMED: 'Confirmed',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  NO_SHOW: 'Marked no-show',
  CANCELLED: 'Cancelled',
  CASH_RECORDED: 'Cash recorded',
  PAYMENT_RECEIVED: 'Online payment received',
};

// "Confirmed by Juan Dela Cruz (Instructor) · Oct 6, 10:15 AM"
export const actorLabel = (name, role) =>
  role === 'SYSTEM' ? 'System' : `${name || 'A removed user'} (${ROLE_LABEL[role] || role})`;

const isAutoCompletion = (action, role) => action === 'COMPLETED' && role === 'SYSTEM';

// "Completed automatically · Oct 7, 4:00 PM" for the system's completions.
export const describeAction = (action) => {
  if (!action) return null;
  if (isAutoCompletion(action.action, action.actorRole)) return `Completed automatically · ${formatDateTime(action.at)}`;
  return `${ACTION_LABEL[action.action] || action.action} by ${actorLabel(action.actorName, action.actorRole)} · ${formatDateTime(action.at)}`;
};

export const historyLabel = (entry) =>
  isAutoCompletion(entry.action, entry.actorRole) ? 'Completed automatically' : ACTION_LABEL[entry.action] || entry.action;

// "2h 5m", "45m"
export const formatDuration = (ms) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const autoCompletedNote = (booking) =>
  `Completed automatically ${formatDuration(new Date(booking.autoCompletedAt) - new Date(booking.endsAt))} after the session ended`;

// "19h left to correct"
export const timeLeft = (until, now = Date.now()) => {
  const ms = new Date(until) - now;
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3600000);
  return hours >= 1 ? `${hours}h left` : `${Math.max(1, Math.ceil(ms / 60000))}m left`;
};
