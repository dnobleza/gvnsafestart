import { get } from './request';

export const reverseGeocode = (lat, lng) => get('/geo/reverse', { lat, lng }).then((d) => d.place);
