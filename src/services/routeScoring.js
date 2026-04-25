import { PENALTIES } from '../config/preferences';
import { haversine, minDistanceToCoords } from '../utils/geo';

const FORBIDDEN_BLOCK_METERS = 120;
const FORBIDDEN_BLOCK_RATIO = 0.08;

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

function collectRouteSignals(near) {
  let crossings = 0;
  let tactileYes = 0, tactileNo = 0, tactileUnknown = 0;
  let audioYes = 0, audioNo = 0;
  let kerbLow = 0, kerbHigh = 0, kerbUnknown = 0;

  for (const el of near) {
    const t = el.tags || {};
    const c = classifyFeature(el);
    const isCrossing = t.highway === 'crossing';
    const isSignalised = t.crossing === 'traffic_signals' || t.crossing === 'signals';

    if (isCrossing) {
      crossings++;
      if (c.tactileYes) tactileYes++;
      else if (c.tactileNo) tactileNo++;
      else tactileUnknown++;
    }

    if (isSignalised) {
      if (c.audioYes) audioYes++;
      else audioNo++;
    }

    if (isCrossing || t.kerb) {
      if (c.lowKerb) kerbLow++;
      else if (c.highKerb) kerbHigh++;
      else if (t.kerb) kerbUnknown++;
    }
  }

  return {
    crossings,
    tactileYes,
    tactileNo,
    tactileUnknown,
    audioYes,
    audioNo,
    kerbLow,
    kerbHigh,
    kerbUnknown
  };
}

export function analyzeRoute(route, accData) {
  const near = nodesNearRoute(accData.nodes, route.coords);
  const signals = collectRouteSignals(near);
  const busyMeters = busyMetersOnRoute(accData.busyWays || [], route.coords);
  const forbiddenMeters = forbiddenMetersOnRoute(accData.forbiddenWays || [], route.coords);
  const blocked = forbiddenMeters > Math.max(FORBIDDEN_BLOCK_METERS, route.distance * FORBIDDEN_BLOCK_RATIO);

  return {
    route,
    near,
    signals,
    busyMeters,
    forbiddenMeters,
    blocked
  };
}

export function scoreRouteAnalysis(analysis, weights) {
  let penalty = 0;
  let pos = 0, neg = 0, unknown = 0;

  penalty += analysis.signals.tactileYes * PENALTIES.tactile_bonus * -weights.tactile;
  penalty += analysis.signals.tactileNo * PENALTIES.tactile_missing * weights.tactile;
  penalty += analysis.signals.audioYes * PENALTIES.audio_bonus * -weights.audio;
  penalty += analysis.signals.audioNo * PENALTIES.audio_missing * weights.audio;
  penalty += analysis.signals.kerbLow * PENALTIES.kerb_bonus * -weights.kerb;
  penalty += analysis.signals.kerbHigh * PENALTIES.kerb_raised * weights.kerb;
  penalty += analysis.busyMeters * PENALTIES.busy_per_meter * weights.avoid_busy;
  penalty += analysis.forbiddenMeters * PENALTIES.forbidden_per_meter * (weights.forbidden || 0);

  pos += analysis.signals.tactileYes * weights.tactile;
  pos += analysis.signals.audioYes * weights.audio;
  pos += analysis.signals.kerbLow * weights.kerb;

  neg += analysis.signals.tactileNo * weights.tactile;
  neg += analysis.signals.audioNo * weights.audio;
  neg += analysis.signals.kerbHigh * weights.kerb;

  unknown += analysis.signals.tactileUnknown * weights.tactile;
  unknown += analysis.signals.kerbUnknown * weights.kerb;

  const total = pos + neg + unknown;
  let score = null;
  if (total > 0) {
    const raw = (pos - neg) / total;
    score = Math.max(0, Math.min(1, (raw + 1) / 2));
  }

  return {
    ...analysis,
    penalty,
    pos, neg, unknown,
    effective: analysis.blocked ? Infinity : analysis.route.distance + penalty,
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
