import { BELFAST_DEMO_ROUTE_CORRIDORS, BELFAST_DEMO_SOURCE } from '../data/belfastDemoSeed';
import { haversine, offsetWaypoint } from '../utils/geo';
import { friendlyFetchError } from './http';

const DEMO_CORRIDOR_MATCH_METERS = 180;
const DEMO_WALKING_METERS_PER_SECOND = 1.25;

async function fetchOsrm(coords) {
  const path = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/foot/${path}?overview=full&geometries=geojson&steps=true`;
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
  const steps = [];
  for (const leg of r.legs || []) {
    for (const step of leg.steps || []) {
      steps.push({
        distance: step.distance,
        duration: step.duration,
        name: step.name,
        instruction: step.maneuver?.type || ''
      });
    }
  }
  return {
    coords: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distance: r.distance,
    duration: r.duration,
    steps
  };
}

function routeFingerprint(coords) {
  if (coords.length === 0) return '';
  const samples = 12;
  const step = Math.max(1, Math.floor(coords.length / samples));
  const parts = [];
  for (let i = 0; i < coords.length; i += step) {
    const [lat, lon] = coords[i];
    parts.push(`${lat.toFixed(3)},${lon.toFixed(3)}`);
  }
  return parts.join('|');
}

function routeDistance(coords) {
  let distance = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    distance += haversine(coords[i], coords[i + 1]);
  }
  return distance;
}

function distanceToEndpoint(point, endpoint) {
  return haversine([point.lat, point.lng], [endpoint.lat, endpoint.lng]);
}

function getDemoCorridorDirection(corridor, start, end) {
  const [a, b] = corridor.endpoints;
  const forward =
    distanceToEndpoint(start, a) <= DEMO_CORRIDOR_MATCH_METERS &&
    distanceToEndpoint(end, b) <= DEMO_CORRIDOR_MATCH_METERS;
  if (forward) return 'forward';

  const reverse =
    distanceToEndpoint(start, b) <= DEMO_CORRIDOR_MATCH_METERS &&
    distanceToEndpoint(end, a) <= DEMO_CORRIDOR_MATCH_METERS;
  return reverse ? 'reverse' : null;
}

function getDemoRouteCandidates(start, end) {
  const corridor = BELFAST_DEMO_ROUTE_CORRIDORS.find(c => getDemoCorridorDirection(c, start, end));
  if (!corridor) return [];
  const direction = getDemoCorridorDirection(corridor, start, end);

  return corridor.candidates.map(candidate => {
    const coords = direction === 'reverse' ? [...candidate.coords].reverse() : candidate.coords;
    const distance = routeDistance(coords);
    return {
      coords,
      distance,
      duration: distance / DEMO_WALKING_METERS_PER_SECOND,
      steps: [],
      source: BELFAST_DEMO_SOURCE,
      label: candidate.label
    };
  });
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
  const offsets = [0, 600, -600, 1200, -1200, 2000, -2000];
  const tasks = offsets.map(off => {
    if (off === 0) return fetchOsrm([start, end]);
    const via = offsetWaypoint(start, end, off);
    if (!via) return Promise.reject(new Error('bad offset'));
    return fetchOsrm([start, via, end]);
  });
  const settled = await Promise.allSettled(tasks);
  if (signal?.aborted) throw new Error('Request cancelled');

  const ok = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
  if (ok.length === 0) {
    const demoRoutes = getDemoRouteCandidates(start, end);
    if (demoRoutes.length > 0) return demoRoutes;

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
  }
  return unique;
}
