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

const M_PER_DEG_LAT = 111320;
function toLocalXY(p, originLat) {
  const cosLat = Math.cos(originLat * Math.PI / 180);
  return [p[1] * M_PER_DEG_LAT * cosLat, p[0] * M_PER_DEG_LAT];
}

export function pointToSegmentMeters(point, segA, segB) {
  const originLat = (segA[0] + segB[0]) / 2;
  const [px, py] = toLocalXY(point, originLat);
  const [ax, ay] = toLocalXY(segA, originLat);
  const [bx, by] = toLocalXY(segB, originLat);
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function minDistanceToWayMeters(point, geometry) {
  if (!geometry || geometry.length === 0) return Infinity;
  if (geometry.length === 1) return haversine(point, [geometry[0].lat, geometry[0].lon]);
  let min = Infinity;
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = [geometry[i].lat, geometry[i].lon];
    const b = [geometry[i + 1].lat, geometry[i + 1].lon];
    const d = pointToSegmentMeters(point, a, b);
    if (d < min) min = d;
    if (min === 0) return 0;
  }
  return min;
}

export function wayBoundingBox(way) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const g of way.geometry || []) {
    if (g.lat < minLat) minLat = g.lat;
    if (g.lat > maxLat) maxLat = g.lat;
    if (g.lon < minLon) minLon = g.lon;
    if (g.lon > maxLon) maxLon = g.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

export function bboxesOverlap(a, b, paddingDeg = 0) {
  return !(a.maxLat + paddingDeg < b.minLat ||
           a.minLat - paddingDeg > b.maxLat ||
           a.maxLon + paddingDeg < b.minLon ||
           a.minLon - paddingDeg > b.maxLon);
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

export function routeBoundingBox(coords) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [lat, lon] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

export function samePoint(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001;
}
