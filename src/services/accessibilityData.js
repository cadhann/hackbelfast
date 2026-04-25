import { mergeDemoAccessibilityData } from '../data/belfastDemoSeed';
import { fetchJson, friendlyFetchError } from './http';

const OVERPASS_TIMEOUT_MS = 30000;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://h24.atownsend.org.uk/api/interpreter'
];

function isLocalDevHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function getOverpassEndpoints() {
  return isLocalDevHost() ? ['/api/overpass', ...OVERPASS_ENDPOINTS] : OVERPASS_ENDPOINTS;
}

function isStationNode(tags) {
  return tags.railway === 'station' || tags.public_transport === 'station' || tags.amenity === 'bus_station';
}

function isRoughWay(tags) {
  const surface = (tags.surface || '').toLowerCase();
  const smoothness = (tags.smoothness || '').toLowerCase();
  return (
    ['bad', 'intermediate', 'very_bad', 'horrible', 'very_horrible', 'impassable'].includes(smoothness) ||
    ['sett', 'cobblestone', 'unpaved', 'gravel', 'compacted', 'ground', 'mud', 'dirt', 'grass', 'woodchips'].includes(surface)
  );
}

function isSteepWay(tags) {
  const incline = (tags.incline || '').toLowerCase().trim();
  if (!incline) return false;
  if (['up', 'down', 'steep', 'yes'].includes(incline)) return true;
  const numeric = Number.parseFloat(incline.replace('%', ''));
  return Number.isFinite(numeric) && Math.abs(numeric) >= 4;
}

export async function fetchAccessibilityData(bbox) {
  const [s, w, n, e] = bbox;
  const query = `
    [out:json][timeout:25];
    (
      node["highway"="crossing"](${s},${w},${n},${e});
      node["kerb"](${s},${w},${n},${e});
      node["highway"="street_lamp"](${s},${w},${n},${e});
      node["amenity"="toilets"](${s},${w},${n},${e});
      node["amenity"="bench"](${s},${w},${n},${e});
      node["railway"="station"](${s},${w},${n},${e});
      node["public_transport"="station"](${s},${w},${n},${e});
      node["amenity"="bus_station"](${s},${w},${n},${e});
      way["highway"~"^(primary|secondary|trunk|primary_link|secondary_link|trunk_link)$"](${s},${w},${n},${e});
      way["highway"~"^(motorway|motorway_link)$"](${s},${w},${n},${e});
      way["foot"~"^(no|private)$"](${s},${w},${n},${e});
      way["access"~"^(no|private)$"]["foot"!~"^(yes|designated|permissive)$"](${s},${w},${n},${e});
      way["highway"="steps"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|residential|service|living_street)$"]["lit"~"^(no|yes)$"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk)$"]["width"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|living_street|residential|service)$"]["surface"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|living_street|residential|service)$"]["smoothness"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|living_street|residential|service)$"]["incline"](${s},${w},${n},${e});
    );
    out body geom;
  `;
  const encodedQuery = encodeURIComponent(query);
  const attempts = [];
  let data = null;
  let source = null;

  for (const endpoint of getOverpassEndpoints()) {
    const methods = endpoint.startsWith('/') ? ['POST'] : ['GET', 'POST'];
    for (const method of methods) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          data = await fetchJson(
            method === 'GET' ? `${endpoint}?data=${encodedQuery}` : endpoint,
            method === 'POST'
              ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                  body: `data=${encodedQuery}`
                }
              : { method: 'GET' },
            OVERPASS_TIMEOUT_MS
          );
          source = endpoint;
          break;
        } catch (e) {
          attempts.push(`${endpoint} ${method}: ${friendlyFetchError(e)}`);
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (data) break;
    }
    if (data) break;
  }

  if (!data) {
    const last = attempts[attempts.length - 1] || 'no endpoint attempted';
    throw new Error(`Overpass blocked or unavailable (${last})`);
  }

  const nodes = [];
  const streetLamps = [];
  const busyWays = [];
  const forbiddenWays = [];
  const stepsWays = [];
  const litWays = [];
  const unlitWays = [];
  const narrowWays = [];
  const toilets = [];
  const seating = [];
  const stations = [];
  const roughWays = [];
  const steepWays = [];
  for (const el of data.elements || []) {
    if (el.type === 'node') {
      const t = el.tags || {};
      if (t.highway === 'street_lamp') streetLamps.push(el);
      else if (t.amenity === 'toilets') toilets.push(el);
      else if (t.amenity === 'bench') seating.push(el);
      else if (isStationNode(t)) stations.push(el);
      else nodes.push(el);
    } else if (el.type === 'way' && el.geometry) {
      const t = el.tags || {};
      const isMotorway = t.highway === 'motorway' || t.highway === 'motorway_link';
      const footAllowed = t.foot === 'yes' || t.foot === 'designated' || t.foot === 'permissive';
      const footForbidden = t.foot === 'no' || t.foot === 'private';
      const accessForbidden = (t.access === 'no' || t.access === 'private') && !footAllowed;
      const isSteps = t.highway === 'steps';
      if (isMotorway || footForbidden || accessForbidden) {
        forbiddenWays.push(el);
      } else if (isSteps) {
        stepsWays.push(el);
      } else if (t.highway === 'primary' || t.highway === 'secondary' || t.highway === 'trunk' ||
                 t.highway === 'primary_link' || t.highway === 'secondary_link' || t.highway === 'trunk_link') {
        busyWays.push(el);
      }
      if (t.lit === 'yes') litWays.push(el);
      else if (t.lit === 'no') unlitWays.push(el);
      const widthMeters = parseFloat(t.width);
      if (Number.isFinite(widthMeters) && widthMeters > 0 && widthMeters < 1.5) {
        narrowWays.push(el);
      }
      if (isRoughWay(t)) roughWays.push(el);
      if (isSteepWay(t)) steepWays.push(el);
    }
  }
  return mergeDemoAccessibilityData(
    {
      nodes,
      busyWays,
      forbiddenWays,
      stepsWays,
      narrowWays,
      litWays,
      unlitWays,
      streetLamps,
      toilets,
      seating,
      stations,
      communityReports: [],
      roughWays,
      steepWays,
      source
    },
    bbox
  );
}
