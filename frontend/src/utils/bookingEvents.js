// Lets the notification poll tell open booking views to refetch, without
// putting server data in a global store.
const listeners = new Set();

export const onBookingChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const emitBookingChange = (notifications) => {
  listeners.forEach((listener) => listener(notifications));
};
