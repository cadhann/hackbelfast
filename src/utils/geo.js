export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLat = lat2 - lat1;
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function minDistanceToCoords(point, coords) {
  let min = Infinity;
  for (const c of coords) {
    const d = haversine(point, c);
    if (d < min) min = d;
  }
  return min;
}

export function offsetWaypoint(start, end, perpMeters) {
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;
  const len = Math.sqrt(dLat * dLat + dLng * dLng);
  if (len === 0) return null;
  const pLat = -dLng / len;
  const pLng = dLat / len;
  const dLatDeg = (perpMeters / 111000) * pLat;
  const dLngDeg = (perpMeters / (111000 * Math.cos(midLat * Math.PI / 180))) * pLng;
  return { lat: midLat + dLatDeg, lng: midLng + dLngDeg };
}

export function combinedBbox(routes, padding = 0.0015) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const r of routes) {
    for (const [lat, lon] of r.coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  return [minLat - padding, minLon - padding, maxLat + padding, maxLon + padding];
}

export function samePoint(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001;
}
