const listeners = new Set();
let nextId = 0;

export const TOAST_MS = 6000;

export const onToast = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const showToast = (message, { tone = 'info' } = {}) => {
  nextId += 1;
  const toast = { id: nextId, message, tone };
  listeners.forEach((listener) => listener(toast));
  return toast.id;
};
