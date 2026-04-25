import { offsetWaypoint } from '../utils/geo';
import { friendlyFetchError } from './http';

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
  const offsets = [0, 300, -300];
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
