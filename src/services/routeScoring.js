import { PENALTIES } from '../config/preferences';
import { haversine, minDistanceToCoords } from '../utils/geo';

export function classifyFeature(el) {
  const t = el.tags || {};
  const tactileYes = t.tactile_paving === 'yes';
  const tactileNo = t.tactile_paving === 'no';
  const audioYes = t['traffic_signals:sound'] === 'yes';
  const lowKerb = t.kerb === 'lowered' || t.kerb === 'flush' || t.kerb === 'no';
  const highKerb = t.kerb === 'raised';
  return { tactileYes, tactileNo, audioYes, lowKerb, highKerb };
}

function nodesNearRoute(nodes, coords, threshold = 30) {
  const out = [];
  for (const el of nodes) {
    const d = minDistanceToCoords([el.lat, el.lon], coords);
    if (d < threshold) out.push(el);
  }
  return out;
}

function metersOnRoute(ways, coords, threshold) {
  let meters = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversine(a, b);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let near = false;
    for (const w of ways) {
      for (const g of w.geometry) {
        if (haversine(mid, [g.lat, g.lon]) < threshold) { near = true; break; }
      }
      if (near) break;
    }
    if (near) meters += segLen;
  }
  return meters;
}

function busyMetersOnRoute(busyWays, coords, threshold = 12) {
  return metersOnRoute(busyWays, coords, threshold);
}

function forbiddenMetersOnRoute(forbiddenWays, coords, threshold = 10) {
  if (!forbiddenWays || forbiddenWays.length === 0) return 0;
  return metersOnRoute(forbiddenWays, coords, threshold);
}

export function scoreRoute(route, accData, filters) {
  const near = nodesNearRoute(accData.nodes, route.coords);
  let penalty = 0;
  let pos = 0, neg = 0, unknown = 0;

  const forbiddenMeters = forbiddenMetersOnRoute(accData.forbiddenWays || [], route.coords);
  const blocked = forbiddenMeters > 5;

  for (const el of near) {
    const t = el.tags || {};
    const c = classifyFeature(el);
    const isCrossing = t.highway === 'crossing';
    const isSignalised = t.crossing === 'traffic_signals' || t.crossing === 'signals';

    if (filters.tactile && isCrossing) {
      if (c.tactileYes) { pos++; penalty -= PENALTIES.tactile_bonus; }
      else if (c.tactileNo) { neg++; penalty += PENALTIES.tactile_missing; }
      else unknown++;
    }
    if (filters.audio && isSignalised) {
      if (c.audioYes) { pos++; penalty -= PENALTIES.audio_bonus; }
      else { neg++; penalty += PENALTIES.audio_missing; }
    }
    if (filters.kerb && (isCrossing || t.kerb)) {
      if (c.lowKerb) { pos++; penalty -= PENALTIES.kerb_bonus; }
      else if (c.highKerb) { neg++; penalty += PENALTIES.kerb_raised; }
      else if (t.kerb) unknown++;
    }
  }

  let busyMeters = 0;
  if (filters.avoid_busy) {
    busyMeters = busyMetersOnRoute(accData.busyWays, route.coords);
    penalty += busyMeters * PENALTIES.busy_per_meter;
  }

  const total = pos + neg + unknown;
  let score = null;
  if (total > 0) {
    const raw = (pos - neg) / total;
    score = Math.max(0, Math.min(1, (raw + 1) / 2));
  }

  return {
    near,
    penalty,
    busyMeters,
    forbiddenMeters,
    blocked,
    pos, neg, unknown,
    effective: blocked ? Infinity : route.distance + penalty,
    score
  };
}

export function getFeatureStats(chosen) {
  if (!chosen) return { crossings: 0, tactileYes: 0, tactileNo: 0, lowKerbs: 0 };
  let crossings = 0, tactileYes = 0, tactileNo = 0, lowKerbs = 0;
  for (const el of chosen.near) {
    const t = el.tags || {};
    if (t.highway === 'crossing') crossings++;
    if (t.tactile_paving === 'yes') tactileYes++;
    if (t.tactile_paving === 'no') tactileNo++;
    if (t.kerb === 'lowered' || t.kerb === 'flush') lowKerbs++;
  }
  return { crossings, tactileYes, tactileNo, lowKerbs };
}
