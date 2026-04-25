import { PENALTIES } from '../config/preferences';
import {
  bboxesOverlap,
  haversine,
  minDistanceToCoords,
  pointToSegmentMeters,
  routeBoundingBox,
  wayBoundingBox
} from '../utils/geo';

const FORBIDDEN_BLOCK_METERS = 120;
const FORBIDDEN_BLOCK_RATIO = 0.08;

export function classifyFeature(el) {
  const t = el.tags || {};
  const tactileYes = t.tactile_paving === 'yes';
  const tactileNo = t.tactile_paving === 'no';
  const audioYes = t['traffic_signals:sound'] === 'yes';
  const audioNo = t['traffic_signals:sound'] === 'no';
  const lowKerb = t.kerb === 'lowered' || t.kerb === 'flush' || t.kerb === 'no';
  const highKerb = t.kerb === 'raised';
  return { tactileYes, tactileNo, audioYes, audioNo, lowKerb, highKerb };
}

function nodesNearRoute(nodes, coords, threshold = 30) {
  const out = [];
  for (const el of nodes) {
    const d = minDistanceToCoords([el.lat, el.lon], coords);
    if (d < threshold) out.push(el);
  }
  return out;
}

function metersOnRouteAlongWays(ways, coords, threshold) {
  if (!ways || ways.length === 0 || coords.length < 2) return 0;

  const routeBbox = routeBoundingBox(coords);
  const padDeg = (threshold + 5) / 111320;
  const candidates = [];
  for (const w of ways) {
    if (!w.geometry || w.geometry.length === 0) continue;
    const wb = w._bbox || (w._bbox = wayBoundingBox(w));
    if (!bboxesOverlap(routeBbox, wb, padDeg)) continue;
    candidates.push(w);
  }
  if (candidates.length === 0) return 0;

  let meters = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversine(a, b);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    let near = false;
    for (const w of candidates) {
      const wb = w._bbox;
      if (mid[0] < wb.minLat - padDeg || mid[0] > wb.maxLat + padDeg ||
          mid[1] < wb.minLon - padDeg || mid[1] > wb.maxLon + padDeg) {
        continue;
      }
      const geom = w.geometry;
      for (let j = 0; j < geom.length - 1; j++) {
        const segA = [geom[j].lat, geom[j].lon];
        const segB = [geom[j + 1].lat, geom[j + 1].lon];
        if (pointToSegmentMeters(mid, segA, segB) < threshold) { near = true; break; }
      }
      if (near) break;
    }
    if (near) meters += segLen;
  }
  return meters;
}

function busyMetersOnRoute(busyWays, coords, threshold = 12) {
  return metersOnRouteAlongWays(busyWays, coords, threshold);
}

function forbiddenMetersOnRoute(forbiddenWays, coords, threshold = 10) {
  return metersOnRouteAlongWays(forbiddenWays, coords, threshold);
}

function collectRouteSignals(near) {
  let crossings = 0;
  let tactileYes = 0, tactileNo = 0, tactileUnknown = 0;
  let audioYes = 0, audioNo = 0, audioUnknown = 0;
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
      else if (c.audioNo) audioNo++;
      else audioUnknown++;
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
    audioUnknown,
    kerbLow,
    kerbHigh,
    kerbUnknown
  };
}

function computeIntrinsicScore(signals) {
  const pos = signals.tactileYes + signals.audioYes + signals.kerbLow;
  const neg = signals.tactileNo + signals.audioNo + signals.kerbHigh;
  const total = pos + neg;
  if (total === 0) return null;
  const raw = (pos - neg) / total;
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

export function analyzeRoute(route, accData) {
  const near = nodesNearRoute(accData.nodes, route.coords);
  const signals = collectRouteSignals(near);
  const busyMeters = busyMetersOnRoute(accData.busyWays || [], route.coords);
  const forbiddenMeters = forbiddenMetersOnRoute(accData.forbiddenWays || [], route.coords);
  const blocked = forbiddenMeters > Math.max(FORBIDDEN_BLOCK_METERS, route.distance * FORBIDDEN_BLOCK_RATIO);
  const intrinsicScore = computeIntrinsicScore(signals);

  return {
    route,
    near,
    signals,
    busyMeters,
    forbiddenMeters,
    blocked,
    intrinsicScore
  };
}

export function scoreRouteAnalysis(analysis, weights) {
  let penalty = 0;

  penalty += analysis.signals.tactileYes * PENALTIES.tactile_bonus * -weights.tactile;
  penalty += analysis.signals.tactileNo * PENALTIES.tactile_missing * weights.tactile;
  penalty += analysis.signals.audioYes * PENALTIES.audio_bonus * -weights.audio;
  penalty += analysis.signals.audioNo * PENALTIES.audio_missing * weights.audio;
  penalty += analysis.signals.kerbLow * PENALTIES.kerb_bonus * -weights.kerb;
  penalty += analysis.signals.kerbHigh * PENALTIES.kerb_raised * weights.kerb;
  penalty += analysis.busyMeters * PENALTIES.busy_per_meter * weights.avoid_busy;
  penalty += analysis.forbiddenMeters * PENALTIES.forbidden_per_meter * (weights.forbidden || 0);

  return {
    ...analysis,
    penalty,
    score: analysis.intrinsicScore,
    effective: analysis.blocked ? Infinity : analysis.route.distance + penalty
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
