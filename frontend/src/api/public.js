import { get, list } from './request';

export const listLocations = () => get('/locations').then((d) => d.locations);

export const listInstructors = list('/instructors');

export const getRecommended = (params) => get('/instructors/recommended', params).then((d) => d.instructors);

export const getInstructorSlots = (id, params) => get(`/instructors/${id}/slots`, params);

export const listServiceAreas = () => get('/service-areas').then((d) => d.serviceAreas);

export const listPackages = (params) => get('/packages', params).then((d) => d.packages);

export const getTopInstructors = () => get('/public/top-instructors').then((d) => d.instructors);

export const getPublicInstructor = (id) => get(`/instructors/${id}`).then((d) => d.instructor);
