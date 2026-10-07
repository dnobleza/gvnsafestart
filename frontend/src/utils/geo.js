const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in km between two { latitude, longitude } points.
export const distanceKm = (a, b) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

export const nearestBranch = (point, branches = []) =>
  branches.reduce((best, branch) => {
    const km = distanceKm(point, branch);
    return !best || km < best.km ? { ...branch, km } : best;
  }, null);
