import { offsetWaypoint } from '../utils/geo';
import { friendlyFetchError } from './http';

const ROUTE_OFFSETS_METERS = [0, 800, -800, 1600, -1600];
const MAX_UNIQUE_ROUTES = 3;
const ROUTING_BASE_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';

function normalizeRoute(route) {
  const steps = [];
  for (const leg of route.legs || []) {
    for (const step of leg.steps || []) {
      steps.push({
        distance: step.distance,
        duration: step.duration,
        name: step.name,
        instruction: step.maneuver?.type || '',
        modifier: step.maneuver?.modifier || ''
      });
    }
  }

  return {
    coords: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distance: route.distance,
    duration: route.duration,
    steps
  };
}

async function fetchOsrmRoutes(coords, { alternatives = false, signal } = {}) {
  const path = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true'
  });
  if (alternatives) params.set('alternatives', '3');

  const url = `${ROUTING_BASE_URL}/${path}?${params.toString()}`;
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    throw new Error(`Routing service unreachable: ${friendlyFetchError(e)}`);
  }
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  if (!data.routes || data.routes.length === 0) throw new Error('No route found');
  return data.routes.map(normalizeRoute);
}

function routeFingerprint(coords) {
  if (coords.length === 0) return '';
  const samples = 18;
  const step = Math.max(1, Math.floor(coords.length / samples));
  const parts = [];
  for (let i = 0; i < coords.length; i += step) {
    const [lat, lon] = coords[i];
    parts.push(`${lat.toFixed(3)},${lon.toFixed(3)}`);
  }
  return parts.join('|');
}

function pickPrimaryError(settled) {
  for (const s of settled) {
    if (s.status !== 'rejected') continue;
    const reason = s.reason;
    if (reason instanceof Error && reason.message && !reason.message.includes('bad offset')) {
      return reason.message;
    }
  }
  for (const s of settled) {
    if (s.status === 'rejected') return friendlyFetchError(s.reason);
  }
  return null;
}

export async function fetchRoutes(start, end, { signal } = {}) {
  if (signal?.aborted) throw new Error('Request cancelled');
  const tasks = ROUTE_OFFSETS_METERS.map(off => {
    if (off === 0) return fetchOsrmRoutes([start, end], { alternatives: true, signal });
    const via = offsetWaypoint(start, end, off);
    if (!via) return Promise.reject(new Error('bad offset'));
    return fetchOsrmRoutes([start, via, end], { signal });
  });
  const settled = await Promise.allSettled(tasks);
  if (signal?.aborted) throw new Error('Request cancelled');

  const ok = settled
    .filter(s => s.status === 'fulfilled')
    .flatMap(s => s.value);

  if (ok.length === 0) {
    const reason = pickPrimaryError(settled);
    throw new Error(reason ? `All routing attempts failed: ${reason}` : 'All routing attempts failed');
  }

  const seen = new Set();
  const unique = [];
  for (const r of ok) {
    const fp = routeFingerprint(r.coords);
    if (seen.has(fp)) continue;
    seen.add(fp);
    unique.push(r);
    if (unique.length >= MAX_UNIQUE_ROUTES) break;
  }
  return unique.sort((a, b) => a.distance - b.distance || a.duration - b.duration);
}
