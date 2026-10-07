import axios from 'axios';

import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
});

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/change-password'];

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh tokens are single-use and a replay revokes every session, so
// concurrent 401s must share one refresh call rather than each starting one.
let refreshing = null;

export const refreshSession = () => {
  if (!refreshing) {
    refreshing = client
      .post('/auth/refresh')
      .then((res) => {
        useAuthStore.getState().setSession(res.data.data);
        return res.data.data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const skip = !config || config._retried || NO_REFRESH.some((path) => config.url?.endsWith(path));

    if (response?.status !== 401 || skip) throw error;

    config._retried = true;
    try {
      await refreshSession();
    } catch {
      useAuthStore.getState().clearSession();
      throw error;
    }
    return client(config);
  },
);

export function toApiError(error) {
  const body = error?.response?.data?.error;

  if (!body) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
      fieldErrors: {},
    };
  }

  const fieldErrors = {};
  for (const detail of body.details || []) {
    if (detail.field && !fieldErrors[detail.field]) fieldErrors[detail.field] = detail.message;
  }

  return { code: body.code, message: body.message, fieldErrors };
}

export default client;
