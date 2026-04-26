import { fetchJson, friendlyFetchError } from './http';
import { minDistanceToWayMeters } from '../utils/geo';

const OVERPASS_TIMEOUT_MS = 30000;

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
      node["highway"="traffic_signals"](${s},${w},${n},${e});
      node["highway"="mini_roundabout"](${s},${w},${n},${e});
      node["kerb"](${s},${w},${n},${e});
      node["highway"="street_lamp"](${s},${w},${n},${e});
      node["amenity"="toilets"](${s},${w},${n},${e});
      node["amenity"="bench"](${s},${w},${n},${e});
      node["railway"="station"](${s},${w},${n},${e});
      node["public_transport"="station"](${s},${w},${n},${e});
      node["amenity"="bus_station"](${s},${w},${n},${e});
      node["shop"](${s},${w},${n},${e});
      node["amenity"~"^(cafe|restaurant|pub|bar|fast_food|bakery|pharmacy|bank|post_office|cinema|theatre|marketplace|ice_cream)$"](${s},${w},${n},${e});
      way["highway"~"^(primary|secondary|trunk|primary_link|secondary_link|trunk_link)$"](${s},${w},${n},${e});
      way["highway"~"^(motorway|motorway_link)$"](${s},${w},${n},${e});
      way["foot"~"^(no|private)$"](${s},${w},${n},${e});
      way["access"~"^(no|private)$"]["foot"!~"^(yes|designated|permissive)$"](${s},${w},${n},${e});
      way["highway"="steps"](${s},${w},${n},${e});
      way["highway"="residential"](${s},${w},${n},${e});
      way["highway"="service"](${s},${w},${n},${e});
      way["highway"~"^(pedestrian|living_street)$"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|residential|service|living_street)$"]["lit"~"^(no|yes)$"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk)$"]["width"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|living_street|residential|service)$"]["surface"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|living_street|residential|service)$"]["smoothness"](${s},${w},${n},${e});
      way["highway"~"^(footway|path|pedestrian|sidewalk|living_street|residential|service)$"]["incline"](${s},${w},${n},${e});
      way["leisure"~"^(park|garden|nature_reserve|common|recreation_ground)$"](${s},${w},${n},${e});
      way["landuse"~"^(forest|grass|recreation_ground|village_green|meadow)$"](${s},${w},${n},${e});
      way["natural"~"^(wood|water|heath|grassland)$"](${s},${w},${n},${e});
    );
    out body geom;
  `;
  const encodedQuery = encodeURIComponent(query);
  const attempts = [];
  let data = null;
  let source = null;

  const endpoint = "https://concord.lacklab.net/overpass/api/interpreter";
  const methods = ['GET', 'POST'];
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
  const shopPois = [];
  const residentialWays = [];
  const serviceWays = [];
  const pedestrianFriendlyWays = [];
  const greenSpaceWays = [];

  const SHOP_AMENITIES = new Set([
    'cafe', 'restaurant', 'pub', 'bar', 'fast_food', 'bakery',
    'pharmacy', 'bank', 'post_office', 'cinema', 'theatre',
    'marketplace', 'ice_cream'
  ]);
  const GREEN_LEISURE = new Set(['park', 'garden', 'nature_reserve', 'common', 'recreation_ground']);
  const GREEN_LANDUSE = new Set(['forest', 'grass', 'recreation_ground', 'village_green', 'meadow']);
  const GREEN_NATURAL = new Set(['wood', 'water', 'heath', 'grassland']);
  for (const el of data.elements || []) {
    if (el.type === 'node') {
      const t = el.tags || {};
      if (t.highway === 'street_lamp') streetLamps.push(el);
      else if (t.amenity === 'toilets') toilets.push(el);
      else if (t.amenity === 'bench') seating.push(el);
      else if (isStationNode(t)) stations.push(el);
      else if (t.shop || (t.amenity && SHOP_AMENITIES.has(t.amenity))) shopPois.push(el);
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
      } else if (parseInt(t.lanes, 10) >= 4) {
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

      if (t.highway === 'residential') residentialWays.push(el);
      // Service ways are usually driveways/parking aisles/alleys — treat as
      // estate-like / undesirable for shopping pleasantness unless explicitly
      // tagged as a footway-friendly alley.
      if (t.highway === 'service') serviceWays.push(el);
      if (t.highway === 'pedestrian' || t.highway === 'living_street') {
        pedestrianFriendlyWays.push(el);
      }

      if (
        (t.leisure && GREEN_LEISURE.has(t.leisure)) ||
        (t.landuse && GREEN_LANDUSE.has(t.landuse)) ||
        (t.natural && GREEN_NATURAL.has(t.natural))
      ) {
        greenSpaceWays.push(el);
      }
    }
  }
  return {
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
      shopPois,
      residentialWays,
      serviceWays,
      pedestrianFriendlyWays,
      greenSpaceWays,
      source
    };
}
