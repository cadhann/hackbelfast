import { haversine } from '../utils/geo';
import { PENALTIES } from '../config/preferences';

// ---------------------------------------------------------------------------
// Min-heap priority queue keyed on .f (estimated total cost)
// ---------------------------------------------------------------------------

class MinHeap {
  constructor() { this.data = []; }
  get size() { return this.data.length; }

  push(item) {
    this.data.push(item);
    this._up(this.data.length - 1);
  }

  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) { this.data[0] = last; this._down(0); }
    return top;
  }

  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }

  _down(i) {
    const n = this.data.length;
    for (;;) {
      let s = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].f < this.data[s].f) s = l;
      if (r < n && this.data[r].f < this.data[s].f) s = r;
      if (s === i) break;
      [this.data[s], this.data[i]] = [this.data[i], this.data[s]];
      i = s;
    }
  }
}

// ---------------------------------------------------------------------------
// Edge cost function — translates OSM tags + user weights into a cost in
// "virtual metres" so A* treats accessibility preferences as extra distance.
// ---------------------------------------------------------------------------

const ROUGH_SURFACES = new Set([
  'cobblestone', 'cobblestone:flattened', 'compacted', 'dirt', 'earth',
  'grass', 'grass_paver', 'gravel', 'ground', 'mud', 'pebblestone',
  'sand', 'sett', 'unpaved', 'woodchips'
]);
const SMOOTH_SURFACES = new Set([
  'asphalt', 'concrete', 'concrete:lanes', 'concrete:plates',
  'fine_gravel', 'paved', 'paving_stones'
]);
const BAD_SMOOTHNESS  = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable']);
const GOOD_SMOOTHNESS = new Set(['excellent', 'good', 'intermediate']);
const MIN_BUSY_LANES = 4;

function parseInclinePct(value) {
  if (!value) return null;
  const s = String(value).toLowerCase().trim();
  if (s === 'up' || s === 'down' || s === 'steep') return 8;
  const n = parseFloat(s.replace('%', ''));
  return Number.isFinite(n) ? Math.abs(n) : null;
}

// Exported so graphRouter can use it directly without re-importing PENALTIES.
export function edgeCost(edge, destNode, weights) {
  const d = edge.distanceMeters;
  const tags = edge.tags || {};
  const detour = edge._detourPenalty || 1;

  const highway    = (tags.highway    || '').toLowerCase();
  const surface    = (tags.surface    || '').toLowerCase();
  const smoothness = (tags.smoothness || '').toLowerCase();

  const isSteps       = highway === 'steps';
  const lanes         = parseInt(tags.lanes, 10);
  const isBusy        = Number.isFinite(lanes) && lanes >= MIN_BUSY_LANES;
  const isRough       = ROUGH_SURFACES.has(surface) || BAD_SMOOTHNESS.has(smoothness);
  const isSmooth      = SMOOTH_SURFACES.has(surface) || GOOD_SMOOTHNESS.has(smoothness);
  const isPedestrian  = highway === 'pedestrian' || highway === 'living_street';
  const isResidential = highway === 'residential';
  const isService     = highway === 'service';
  const widthM        = parseFloat(tags.width);
  const isNarrow      = Number.isFinite(widthM) && widthM > 0 && widthM < 1.5;
  const isLit         = tags.lit === 'yes';
  const isUnlit       = tags.lit === 'no';
  const incline       = parseInclinePct(tags.incline);
  const isSteep       = incline !== null && incline >= 6;
  const isGentle      = incline !== null && incline > 0 && incline <= 3;

  // Steps with a strong avoidance preference become effectively impassable so
  // A* routes around them naturally.
  if (isSteps && (weights.avoid_steps || 0) >= 0.5) return d * 80 * detour;

  let cost = d; // base: physical metres

  // Always-on terrain surcharges (even with weights=0) so the bare graph
  // prefers footways over main roads as a baseline.
  if (isSteps) cost += d * 3;
  if (isBusy)  cost += d * 0.5;

  // Weight-scaled per-metre costs
  const W = weights;
  if (isSteps)     cost += d * PENALTIES.steps_per_meter             * (W.avoid_steps     || 0);
  if (isBusy)      cost += d * PENALTIES.busy_per_meter              * (W.avoid_busy       || 0);
  if (isRough)     cost += d * PENALTIES.rough_surface_per_meter     * (W.surface_quality  || 0);
  if (isSmooth)    cost -= d * PENALTIES.smooth_surface_per_meter_bonus * (W.surface_quality || 0);
  if (isSteep)     cost += d * PENALTIES.steep_per_meter             * (W.gentle_slope     || 0);
  if (isGentle)    cost -= d * PENALTIES.gentle_per_meter_bonus      * (W.gentle_slope     || 0);
  if (isNarrow)    cost += d * PENALTIES.narrow_per_meter            * (W.pavement_width   || 0);
  if (isUnlit)     cost += d * PENALTIES.unlit_per_meter             * (W.streetlights     || 0);
  if (isLit)       cost -= d * PENALTIES.lit_per_meter_bonus         * (W.streetlights     || 0);

  // Always-on shop-front infrastructure bias: high-street ways (pedestrian
  // zones, living streets, retail-tagged ways) typically have better footways,
  // lighting and dropped kerbs. Applied at the mode level regardless of user
  // filter toggles, so even Fastest nudges away from estate cut-throughs.
  if (edge.shopFront) cost -= d * (W.shopFrontBias || 0);

  // Shopping-street / pleasant-walk biases
  const shopW    = W.prefer_shopping || 0;
  const pleasantW = W.prefer_pleasant || 0;
  if (isPedestrian) {
    cost -= d * PENALTIES.pedestrian_per_meter_bonus * (shopW + pleasantW);
  }
  if (isResidential) cost += d * PENALTIES.residential_per_meter * shopW;
  if (isService)     cost += d * PENALTIES.service_per_meter     * (shopW + pleasantW * 0.6);

  // Crossing-node penalties applied at the destination node of this edge
  const ct = destNode?.crossingTags;
  if (ct) {
    const tactile  = ct.tactile_paving;
    const kerb     = ct.kerb;
    const sound    = ct['traffic_signals:sound'];
    const isSignal = ct.crossing === 'traffic_signals' || ct.crossing_ref === 'traffic_signals';
    if (tactile === 'no')  cost += PENALTIES.tactile_missing * (W.tactile || 0);
    if (tactile === 'yes') cost -= PENALTIES.tactile_bonus   * (W.tactile || 0);
    if (kerb === 'raised') cost += PENALTIES.kerb_raised     * (W.kerb    || 0);
    if (kerb === 'lowered' || kerb === 'flush') cost -= PENALTIES.kerb_bonus * (W.kerb || 0);
    if (isSignal && sound === 'no')  cost += PENALTIES.audio_missing * (W.audio || 0);
    if (isSignal && sound === 'yes') cost -= PENALTIES.audio_bonus   * (W.audio || 0);
  }

  return Math.max(cost, 0.5) * detour;
}

// ---------------------------------------------------------------------------
// A* search
// ---------------------------------------------------------------------------

function reconstructPath(prev, endId) {
  const path = [];
  let cur = endId;
  while (cur !== undefined) {
    path.push(cur);
    cur = prev.get(cur);
  }
  return path.reverse();
}

// Returns an array of node IDs forming the path, or null if unreachable.
export function runAstar(adjacency, nodes, startId, endId, weights) {
  const endNode = nodes.get(endId);
  if (!endNode) return null;

  const endLat = endNode.lat;
  const endLon = endNode.lon;
  const h = (id) => {
    const n = nodes.get(id);
    return n ? haversine([n.lat, n.lon], [endLat, endLon]) : 0;
  };

  const open   = new MinHeap();
  const gScore = new Map();
  const prev   = new Map();

  gScore.set(startId, 0);
  open.push({ id: startId, g: 0, f: h(startId) });

  const MAX_ITER = 700_000;
  let iter = 0;

  while (open.size > 0 && iter++ < MAX_ITER) {
    const { id: cur, g: popG } = open.pop();

    // Lazy deletion: skip stale open-set entries
    if (popG > (gScore.get(cur) ?? Infinity) + 0.01) continue;

    if (cur === endId) return reconstructPath(prev, endId);

    for (const edge of adjacency.get(cur) ?? []) {
      const nb = edge.to;
      const tentative = popG + edgeCost(edge, nodes.get(nb), weights);
      if (tentative < (gScore.get(nb) ?? Infinity)) {
        gScore.set(nb, tentative);
        prev.set(nb, cur);
        open.push({ id: nb, g: tentative, f: tentative + h(nb) });
      }
    }
  }

  return null; // no path found within iteration budget
}

// ---------------------------------------------------------------------------
// Turn-by-turn step generation
// ---------------------------------------------------------------------------

function compassBearing(fromLat, fromLon, toLat, toLon) {
  const lat1 = fromLat * Math.PI / 180;
  const lat2 = toLat   * Math.PI / 180;
  const dLon = (toLon - fromLon) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function turnModifier(inBearing, outBearing) {
  const diff = ((outBearing - inBearing) + 540) % 360 - 180; // –180 … +180
  if (Math.abs(diff) < 22)  return 'straight';
  if (diff > 130)           return 'sharp right';
  if (diff < -130)          return 'sharp left';
  if (diff > 60)            return 'right';
  if (diff < -60)           return 'left';
  return diff > 0 ? 'slight right' : 'slight left';
}

// Convert a list of node IDs into OSRM-compatible step objects.
// Groups consecutive edges that share a street name into one step, then emits
// a turn step at each name boundary.
export function buildSteps(pathIds, nodes, adjacency) {
  if (pathIds.length < 2) return [];

  // Build a fast fromId:toId → edge lookup
  const edgeMap = new Map();
  for (const [fromId, edges] of adjacency) {
    for (const edge of edges) edgeMap.set(`${fromId}:${edge.to}`, edge);
  }

  // Collect path edges in order
  const pathEdges = [];
  for (let i = 0; i < pathIds.length - 1; i++) {
    const edge = edgeMap.get(`${pathIds[i]}:${pathIds[i + 1]}`);
    if (edge) pathEdges.push({ edge, nodeId: pathIds[i] });
  }

  if (pathEdges.length === 0) return [];

  const steps = [];
  let i = 0;
  let inBearing = null;

  while (i < pathEdges.length) {
    const { edge: first, nodeId: segNodeId } = pathEdges[i];
    const name = first.tags?.name || '';
    const segNode = nodes.get(segNodeId);

    // Accumulate edges sharing the same name
    let segDist = 0;
    let j = i;
    while (j < pathEdges.length && (pathEdges[j].edge.tags?.name || '') === name) {
      segDist += pathEdges[j].edge.distanceMeters;
      j++;
    }

    const outBearing = compassBearing(first.fromLat, first.fromLon, first.toLat, first.toLon);
    let instruction, modifier;

    if (i === 0) {
      instruction = 'depart';
      modifier    = '';
    } else if (inBearing !== null) {
      modifier    = turnModifier(inBearing, outBearing);
      instruction = modifier === 'straight' ? 'continue' : 'turn';
    } else {
      instruction = 'continue';
      modifier    = 'straight';
    }

    steps.push({
      distance: segDist,
      duration: segDist / 1.35,
      name,
      instruction,
      modifier,
      location: segNode ? [segNode.lat, segNode.lon] : null
    });

    // The bearing leaving this segment becomes the inBearing for the next
    const lastEdge = pathEdges[j - 1].edge;
    inBearing = compassBearing(lastEdge.fromLat, lastEdge.fromLon, lastEdge.toLat, lastEdge.toLon);
    i = j;
  }

  // Arrival step at destination node
  const lastNode = nodes.get(pathIds[pathIds.length - 1]);
  steps.push({
    distance: 0, duration: 0, name: '',
    instruction: 'arrive', modifier: '',
    location: lastNode ? [lastNode.lat, lastNode.lon] : null
  });

  return steps;
}
