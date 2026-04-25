import { offsetWaypoint } from '../utils/geo';
import { friendlyFetchError } from './http';

async function fetchOsrm(coords) {
  const path = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/foot/${path}?overview=full&geometries=geojson&steps=false`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Routing service unreachable: ${friendlyFetchError(e)}`);
  }
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  if (!data.routes || data.routes.length === 0) throw new Error('No route found');
  const r = data.routes[0];
  return {
    coords: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distance: r.distance,
    duration: r.duration
  };
}

function routeFingerprint(coords) {
  return coords
    .filter((_, i) => i % Math.max(1, Math.floor(coords.length / 25)) === 0)
    .map(([lat, lon]) => `${lat.toFixed(4)},${lon.toFixed(4)}`)
    .join('|');
}

export async function fetchRoutes(start, end) {
  const offsets = [0, 300, -300];
  const tasks = offsets.map(off => {
    if (off === 0) return fetchOsrm([start, end]);
    const via = offsetWaypoint(start, end, off);
    if (!via) return Promise.reject(new Error('bad offset'));
    return fetchOsrm([start, via, end]);
  });
  const settled = await Promise.allSettled(tasks);
  const ok = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
  if (ok.length === 0) {
    const reason = settled
      .filter(s => s.status === 'rejected')
      .map(s => friendlyFetchError(s.reason))
      .filter(Boolean)[0];
    throw new Error(reason ? `All routing attempts failed: ${reason}` : 'All routing attempts failed');
  }

  const seen = new Set();
  const unique = [];
  for (const r of ok) {
    const fp = routeFingerprint(r.coords);
    if (seen.has(fp)) continue;
    seen.add(fp);
    unique.push(r);
  }
  return unique;
}
