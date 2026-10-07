import client, { refreshSession } from './client';

export const register = (body) => client.post('/auth/register', body).then((res) => res.data.data);

export const login = (body) => client.post('/auth/login', body).then((res) => res.data.data);

export const refresh = () => refreshSession();

export const changePassword = (body) =>
  client.post('/auth/change-password', body).then((res) => res.data.data);

export const logout =() => client.post('/auth/logout').then((res) => res.data.data);
