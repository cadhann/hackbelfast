// Custom preference-weighted graph router.
//
// Replaces the OSRM call with a two-step process:
//   1. Fetch the full foot network for the area from Overpass.
//   2. Run A* with edge costs derived from OSM tags + the active user weights,
//      so the algorithm natively avoids steps, rough surfaces, busy roads, etc.
//      rather than ranking OSRM candidates after the fact.
//
// The three route modes (fastest / balanced / beacon) each produce a different
// weight vector. Running A* separately for each mode and deduplicating gives up
// to three genuinely distinct path candidates that downstream scoring can rank.

import { ROUTE_MODES } from '../config/routeModes';
import { fetchGraphData, buildGraph, findNearestNode } from './graphBuilder';
import { runAstar, buildSteps } from './astar';

const MAX_ROUTES = 3;
// How much more expensive penalised edges become when seeking a diverse
// alternative route. 4× is enough to divert A* onto a different corridor
// without sending it on absurd detours.
const DETOUR_FACTOR = 4.0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bboxFromEndpoints(start, end) {
  // ~2.2 km padding on each side. Generous enough for alternative corridors
  // on cross-city Belfast routes without requesting an unreasonable Overpass area.
  const pad = 0.02;
  return [
    Math.min(start.lat, end.lat) - pad,
    Math.min(start.lng, end.lng) - pad,
    Math.max(start.lat, end.lat) + pad,
    Math.max(start.lng, end.lng) + pad
  ];
}

// Sample 18 evenly-spaced coordinates and hash them to a string. Two routes
// with the same fingerprint are considered duplicates.
function routeFingerprint(coords) {
  if (coords.length === 0) return '';
  const step = Math.max(1, Math.floor(coords.length / 18));
  const parts = [];
  for (let i = 0; i < coords.length; i += step) {
    parts.push(`${coords[i][0].toFixed(3)},${coords[i][1].toFixed(3)}`);
  }
  return parts.join('|');
}

// Compute the combined weight vector for a given mode + active filter flags.
// Mirrors buildModeWeights in routeModes.js but kept local to avoid coupling.
const WEIGHT_KEYS = [
  'tactile', 'audio', 'kerb', 'avoid_busy', 'avoid_steps', 'pavement_width',
  'streetlights', 'surface_quality', 'gentle_slope', 'simple_navigation',
  'rest_points', 'station_access', 'verified_reports', 'avoid_crash',
  'prefer_shopping', 'prefer_pleasant'
];

function modeWeights(mode, filters) {
  const w = { forbidden: mode.defaultWeights.forbidden || 0 };
  for (const key of WEIGHT_KEYS) {
    const base  = mode.defaultWeights[key]    || 0;
    const boost = filters[key] ? (mode.preferenceBoosts[key] || 0) : 0;
    w[key] = base + boost;
  }
  return w;
}

// Mark every edge on a path (both directions) with a detour penalty so the
// next A* run is pushed onto a different corridor.
function penalisePathEdges(adjacency, pathIds) {
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = pathIds[i], b = pathIds[i + 1];
    for (const e of adjacency.get(a) ?? []) if (e.to === b) e._detourPenalty = DETOUR_FACTOR;
    for (const e of adjacency.get(b) ?? []) if (e.to === a) e._detourPenalty = DETOUR_FACTOR;
  }
}

function clearEdgePenalties(adjacency) {
  for (const edges of adjacency.values())
    for (const e of edges) delete e._detourPenalty;
}

// Convert a node-ID path into the { coords, distance, duration, steps } shape
// that the rest of the app expects (same as OSRM normalizeRoute output).
function pathToRoute(pathIds, nodes, adjacency) {
  const coords = pathIds.map(id => {
    const n = nodes.get(id);
    return n ? [n.lat, n.lon] : null;
  }).filter(Boolean);

  let distance = 0;
  for (let i = 0; i < pathIds.length - 1; i++) {
    for (const edge of adjacency.get(pathIds[i]) ?? []) {
      if (edge.to === pathIds[i + 1]) { distance += edge.distanceMeters; break; }
    }
  }

  const steps    = buildSteps(pathIds, nodes, adjacency);
  const duration = distance / 1.35; // ~1.35 m/s average walking pace
  return { coords, distance, duration, steps };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function fetchGraphRoutes(start, end, { filters = {}, signal } = {}) {
  const bbox = bboxFromEndpoints(start, end);
  const ways = await fetchGraphData(bbox, { signal });
  if (signal?.aborted) throw new Error('Request cancelled');

  const { nodes, adjacency, grid } = buildGraph(ways);

  const startId = findNearestNode(grid, nodes, start.lat, start.lng);
  const endId   = findNearestNode(grid, nodes, end.lat,   end.lng);

  if (startId === null) throw new Error('Could not snap the start location to the foot network');
  if (endId   === null) throw new Error('Could not snap the destination to the foot network');
  if (startId === endId) throw new Error('Start and destination are the same graph node');

  const collected = [];
  const seen = new Set();

  // Iterate modes ordered so the most accessible (beacon) runs first — that
  // route is likely the most useful and becomes the primary candidate.
  const orderedModes = [...ROUTE_MODES].sort((a, b) =>
    (b.defaultWeights.avoid_steps || 0) - (a.defaultWeights.avoid_steps || 0)
  );

  for (const mode of orderedModes) {
    if (signal?.aborted) throw new Error('Request cancelled');
    if (collected.length >= MAX_ROUTES) break;

    const weights = modeWeights(mode, filters);
    const pathIds = runAstar(adjacency, nodes, startId, endId, weights);
    if (!pathIds || pathIds.length < 2) continue;

    const route = pathToRoute(pathIds, nodes, adjacency);
    const fp    = routeFingerprint(route.coords);

    if (!seen.has(fp)) {
      seen.add(fp);
      collected.push(route);
    }

    // Try to find a diverse alternative by penalising this path's edges and
    // re-running A* with the same weights. This is analogous to Yen's algorithm
    // but much simpler: the detour penalty forces A* onto a different corridor.
    if (collected.length < MAX_ROUTES) {
      penalisePathEdges(adjacency, pathIds);
      if (!signal?.aborted) {
        const altPathIds = runAstar(adjacency, nodes, startId, endId, weights);
        if (altPathIds && altPathIds.length >= 2) {
          const altRoute = pathToRoute(altPathIds, nodes, adjacency);
          const altFp    = routeFingerprint(altRoute.coords);
          if (!seen.has(altFp)) {
            seen.add(altFp);
            collected.push(altRoute);
          }
        }
      }
      clearEdgePenalties(adjacency);
    }
  }

  if (collected.length === 0) throw new Error('No path found in the foot network between these two locations');

  // Return shortest first (downstream scoring re-ranks by preference anyway)
  return collected.sort((a, b) => a.distance - b.distance);
}
