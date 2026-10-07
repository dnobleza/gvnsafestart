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

export const describeAction = (action) =>
  action
    ? `${ACTION_LABEL[action.action] || action.action} by ${actorLabel(action.actorName, action.actorRole)} · ${formatDateTime(action.at)}`
    : null;
