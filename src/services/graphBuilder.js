import { haversine } from '../utils/geo';
import { fetchJson, friendlyFetchError } from './http';

const OVERPASS_TIMEOUT_MS = 32000;

// Spatial grid cell size in degrees (~88 m). Used to build a node index so
// nearest-node lookups don't scan the entire graph.
const GRID_DEG = 0.0008;

function gridKey(lat, lon) {
  return `${Math.floor(lat / GRID_DEG)},${Math.floor(lon / GRID_DEG)}`;
}

function buildSpatialGrid(nodes) {
  const grid = new Map();
  for (const [id, node] of nodes) {
    const key = gridKey(node.lat, node.lon);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(id);
  }
  return grid;
}

// Find the graph node closest to (lat, lon) within maxDistM metres.
export function findNearestNode(grid, nodes, lat, lon, maxDistM = 300) {
  let bestId = null;
  let bestDist = maxDistM;
  const gl = Math.floor(lat / GRID_DEG);
  const gn = Math.floor(lon / GRID_DEG);
  for (let dl = -2; dl <= 2; dl++) {
    for (let dn = -2; dn <= 2; dn++) {
      const key = `${gl + dl},${gn + dn}`;
      for (const id of grid.get(key) ?? []) {
        const node = nodes.get(id);
        const d = haversine([lat, lon], [node.lat, node.lon]);
        if (d < bestDist) { bestDist = d; bestId = id; }
      }
    }
  }
  return bestId;
}

// Annotate graph nodes that are OSM crossing nodes so the edge cost function
// can apply tactile / kerb / audio signal penalties at destination nodes.
function enrichCrossingNodes(nodes, grid, crossingNodes) {
  for (const cn of crossingNodes) {
    const id = findNearestNode(grid, nodes, cn.lat, cn.lon, 10);
    if (id !== null) nodes.get(id).crossingTags = cn.tags || {};
  }
}

// Build a node adjacency list from the raw Overpass way elements.
// Each edge: { to, fromLat, fromLon, toLat, toLon, distanceMeters, tags }
export function buildGraph(ways, crossingNodes = []) {
  const nodes = new Map();     // nodeId → { lat, lon, crossingTags }
  const adjacency = new Map(); // nodeId → Edge[]

  for (const way of ways) {
    const wayNodes = way.nodes;
    const geom = way.geometry;
    if (!wayNodes || !geom || wayNodes.length < 2) continue;

    const tags = way.tags || {};
    const highway = (tags.highway || '').toLowerCase();

    // Hard exclusions
    if (highway === 'motorway' || highway === 'motorway_link' ||
        highway === 'construction' || highway === 'proposed') continue;

    const foot = (tags.foot || '').toLowerCase();
    if (foot === 'no' || foot === 'private') continue;
    const access = (tags.access || '').toLowerCase();
    const footExplicit = foot === 'yes' || foot === 'designated' || foot === 'permissive';
    if ((access === 'no' || access === 'private') && !footExplicit) continue;

    // Oneway tag only limits direction if foot isn't explicitly allowed both ways
    const isOneway = tags.oneway === 'yes' && !footExplicit;

    for (let i = 0; i < wayNodes.length - 1; i++) {
      const fromId = wayNodes[i];
      const toId = wayNodes[i + 1];
      const fg = geom[i];
      const tg = geom[i + 1];
      if (!fg || !tg) continue;

      if (!nodes.has(fromId)) nodes.set(fromId, { lat: fg.lat, lon: fg.lon, crossingTags: null });
      if (!nodes.has(toId))   nodes.set(toId,   { lat: tg.lat, lon: tg.lon, crossingTags: null });

      const dist = haversine([fg.lat, fg.lon], [tg.lat, tg.lon]);
      if (dist < 0.05) continue; // skip zero-length degenerate edges

      // Ways fronting shops / retail areas tend to have better footway
      // infrastructure (wider pavements, dropped kerbs, lighting) even when
      // not explicitly mapped. Flag them so the router can apply a baseline
      // preference independent of user filter toggles.
      const shopFront =
        highway === 'pedestrian' ||
        highway === 'living_street' ||
        !!(tags.shop) ||
        tags.landuse === 'retail' || tags.landuse === 'commercial';

      const fwd = { to: toId, fromLat: fg.lat, fromLon: fg.lon, toLat: tg.lat, toLon: tg.lon, distanceMeters: dist, tags, shopFront };
      if (!adjacency.has(fromId)) adjacency.set(fromId, []);
      adjacency.get(fromId).push(fwd);

      if (!isOneway) {
        const rev = { to: fromId, fromLat: tg.lat, fromLon: tg.lon, toLat: fg.lat, toLon: fg.lon, distanceMeters: dist, tags, shopFront };
        if (!adjacency.has(toId)) adjacency.set(toId, []);
        adjacency.get(toId).push(rev);
      }
    }
  }

  const grid = buildSpatialGrid(nodes);
  enrichCrossingNodes(nodes, grid, crossingNodes);
  return { nodes, adjacency, grid };
}

// Fetch all foot-traversable ways in bbox from Overpass. Returns raw way elements
// (each with .nodes[], .geometry[], .tags).
export async function fetchGraphData(bbox, { signal } = {}) {
  const [s, w, n, e] = bbox;

  // Request all highway types that pedestrians are likely to use, plus any
  // way explicitly tagged foot=yes. Exclude known non-foot ways via the filter.
  const query = `[out:json][timeout:30];(` +
    `way["highway"~"^(footway|path|pedestrian|living_street|residential|service|tertiary|unclassified|steps|track|cycleway|secondary|primary)$"]` +
    `["foot"!~"^(no|private)$"]["access"!~"^(no|private)$"](${s},${w},${n},${e});` +
    `way["foot"~"^(yes|designated|permissive)$"]["access"!~"^(no|private)$"](${s},${w},${n},${e});` +
    `);out body geom;`;

  const encoded = encodeURIComponent(query);
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
  const errors = [];

    if (signal?.aborted) throw new Error('Request cancelled');
    try {
      const data = await fetchJson(
        "https://concord.lacklab.net/overpass/api/interpreter",
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: `data=${encoded}`,
          signal
        },
        OVERPASS_TIMEOUT_MS
      );
      const ways = (data.elements || []).filter(el => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2);
      if (ways.length === 0) {
        errors.push(`${ep}: returned 0 ways`);
      }
      return ways;
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) throw new Error('Request cancelled');
      errors.push(`${ep}: ${friendlyFetchError(err)}`);
    }

  throw new Error(`Graph fetch failed on all endpoints — ${errors[errors.length - 1] || 'unknown error'}`);
}
