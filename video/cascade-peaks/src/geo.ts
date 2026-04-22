// Geographic helpers — converting lat/lon pairs into the local East-North-Up
// frame established by <EastNorthUpFrame/> around a vantage point. We use a
// simple tangent-plane approximation (equirectangular about the vantage lat)
// which is plenty accurate for the 30-80 km distances in this video; the
// error at the Cascade skyline from Aubrey Butte is well under a pixel at
// 1080p.

const R_EARTH_M = 6_378_137;

export type LatLon = { lat: number; lon: number };

/**
 * Return [east_m, north_m] of `point` relative to `origin` on the tangent
 * plane at `origin.lat`. Positive east = +x, positive north = +y (matches
 * the 3d-tiles-renderer EastNorthUpFrame convention).
 */
export const tangentOffsetM = (origin: LatLon, point: LatLon): [number, number] => {
  const dLat = ((point.lat - origin.lat) * Math.PI) / 180;
  const dLon = ((point.lon - origin.lon) * Math.PI) / 180;
  const meanLat = ((origin.lat + point.lat) / 2) * (Math.PI / 180);
  const north = dLat * R_EARTH_M;
  const east = dLon * R_EARTH_M * Math.cos(meanLat);
  return [east, north];
};

/**
 * Bearing in degrees (0 = north, 90 = east) from origin to point on the
 * tangent plane.
 */
export const bearingDeg = (origin: LatLon, point: LatLon): number => {
  const [e, n] = tangentOffsetM(origin, point);
  const rad = Math.atan2(e, n); // atan2(east, north) = compass bearing
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
};

/**
 * Great-circle-ish distance in meters on the tangent plane.
 */
export const distanceM = (origin: LatLon, point: LatLon): number => {
  const [e, n] = tangentOffsetM(origin, point);
  return Math.hypot(e, n);
};
