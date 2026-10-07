import client from './client';

const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const list = (path) => (params) =>
  client.get(path, { params: clean(params) }).then((res) => ({ data: res.data.data, meta: res.data.meta }));

export const get = (path, params) => client.get(path, { params: clean(params) }).then((res) => res.data.data);

export const post = (path, body) => client.post(path, body).then((res) => res.data.data);

export const patch = (path, body) => client.patch(path, body).then((res) => res.data.data);

export const put = (path, body) => client.put(path, body).then((res) => res.data.data);

export const del = (path) => client.delete(path).then((res) => res.data.data);
