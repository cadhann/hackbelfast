import { mergeDemoAccessibilityData } from '../data/belfastDemoSeed';
import { fetchJson, friendlyFetchError } from './http';
import { minDistanceToWayMeters } from '../utils/geo';

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

function parseFirstNumeric(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches?.length) return null;
  const numbers = matches.map(entry => Number.parseFloat(entry)).filter(Number.isFinite);
  if (!numbers.length) return null;
  return Math.max(...numbers);
}

function crashRiskLevel(score) {
  if (score >= 6) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function crashRiskWeight(level) {
  if (level === 'high') return 3;
  if (level === 'medium') return 2;
  return 1;
}

function compactFactors(factors) {
  return [...new Set(factors.filter(Boolean))];
}

function isSignalizedCrossing(tags) {
  if (!tags) return false;
  return tags.crossing === 'traffic_signals' || tags.crossing_ref === 'traffic_signals';
}

function hasCrossingRefuge(tags) {
  if (!tags) return false;
  return tags['crossing:island'] === 'yes' || tags.crossing_island === 'yes' || tags.refuge === 'yes';
}

function buildCrashRiskWay(way, score, factors, source) {
  const riskLevel = crashRiskLevel(score);
  const riskFactors = compactFactors(factors);
  return {
    ...way,
    riskLevel,
    riskScore: score,
    riskBasis: 'derived_osm',
    summary: `${way.tags?.name || 'Busy road corridor'} has ${riskLevel} collision risk from ${riskFactors.join(', ')}.`,
    tags: {
      ...(way.tags || {}),
      risk_level: riskLevel,
      risk_score: String(score),
      risk_kind: 'corridor',
      risk_basis: 'derived_osm',
      risk_factors: riskFactors.join(', '),
      crash_risk: riskLevel,
      collision_risk: riskLevel,
      crash_note: `${way.tags?.name || 'Corridor'} is derived as a higher-conflict walking edge because of ${riskFactors.join(', ')}.`,
      source: source ? `${source} + derived_crash_risk` : 'derived_crash_risk'
    }
  };
}

function buildCrashRiskNode(node, score, factors, source, relatedWays) {
  const riskLevel = crashRiskLevel(score);
  const riskFactors = compactFactors(factors);
  return {
    ...node,
    riskLevel,
    riskScore: score,
    riskBasis: 'derived_osm',
    relatedWayIds: relatedWays.map(way => way.id),
    summary: `${node.tags?.name || 'Crossing hotspot'} has ${riskLevel} collision risk from ${riskFactors.join(', ')}.`,
    tags: {
      ...(node.tags || {}),
      risk_level: riskLevel,
      risk_score: String(score),
      risk_kind: node.tags?.highway === 'crossing' ? 'crossing_hotspot' : 'junction_hotspot',
      risk_basis: 'derived_osm',
      risk_factors: riskFactors.join(', '),
      crash_risk: riskLevel,
      collision_risk: riskLevel,
      related_way_ids: relatedWays.map(way => way.id).join(','),
      crash_note: `${node.tags?.name || 'Hotspot'} is derived as a higher-conflict point because of ${riskFactors.join(', ')}.`,
      source: source ? `${source} + derived_crash_risk` : 'derived_crash_risk'
    }
  };
}

function deriveCrashRiskWays(busyWays, source) {
  return busyWays.flatMap(way => {
    const tags = way.tags || {};
    const highway = (tags.highway || '').toLowerCase();
    const factors = [];
    let score = 0;

    if (highway === 'trunk' || highway === 'trunk_link') {
      score += 4;
      factors.push('trunk-class traffic');
    } else if (highway === 'primary' || highway === 'primary_link') {
      score += 3;
      factors.push('primary road traffic');
    } else if (highway === 'secondary' || highway === 'secondary_link') {
      score += 2;
      factors.push('secondary road traffic');
    }

    const lanes = parseFirstNumeric(tags.lanes) ?? parseFirstNumeric(tags['lanes:forward']);
    if (lanes >= 4) {
      score += 2;
      factors.push('4+ lanes');
    } else if (lanes >= 3) {
      score += 1;
      factors.push('3 lanes');
    }

    const maxspeed = parseFirstNumeric(tags.maxspeed);
    if (maxspeed >= 40) {
      score += 2;
      factors.push('40+ speed limit');
    } else if (maxspeed >= 30) {
      score += 1;
      factors.push('30+ speed limit');
    }

    if (tags.junction === 'roundabout') {
      score += 2;
      factors.push('roundabout geometry');
    }

    if (tags['turn:lanes'] || tags.turn_lanes) {
      score += 1;
      factors.push('turn lanes');
    }

    if (tags.busway === 'lane' || tags.psv === 'yes' || tags['bus:lanes']) {
      score += 1;
      factors.push('bus-heavy movements');
    }

    if (score < 3) return [];
    return [buildCrashRiskWay(way, score, factors, source)];
  });
}

function deriveCrashRiskNodes(nodes, crashRiskWays, busyWays, source) {
  return nodes.flatMap(node => {
    const tags = node.tags || {};
    const highway = tags.highway;
    if (!['crossing', 'traffic_signals', 'mini_roundabout'].includes(highway)) return [];

    const point = [node.lat, node.lon];
    const nearbyRiskWays = crashRiskWays.filter(way => minDistanceToWayMeters(point, way.geometry) <= 18);
    const nearbyBusyWays = busyWays.filter(way => minDistanceToWayMeters(point, way.geometry) <= 14);
    const factors = [];
    let score = 0;

    if (nearbyRiskWays.length) {
      const highestRisk = Math.max(...nearbyRiskWays.map(way => crashRiskWeight(way.riskLevel)));
      score += highestRisk + Math.max(0, nearbyRiskWays.length - 1);
      factors.push(`${nearbyRiskWays.length} nearby crash-risk corridor${nearbyRiskWays.length > 1 ? 's' : ''}`);
    }

    if (nearbyBusyWays.length > nearbyRiskWays.length) {
      score += 1;
      factors.push('multiple busy carriageways');
    }

    if (highway === 'crossing') {
      if (!isSignalizedCrossing(tags)) {
        score += 2;
        factors.push('unsignalized crossing control');
      } else {
        factors.push('signalized crossing on busy road');
      }

      if (!hasCrossingRefuge(tags)) {
        score += 1;
        factors.push('no refuge island');
      }
    }

    if (highway === 'mini_roundabout') {
      score += 2;
      factors.push('mini-roundabout junction');
    }

    if (highway === 'traffic_signals' && nearbyRiskWays.length >= 2) {
      score += 2;
      factors.push('signalized multi-arm junction');
    }

    if (score < 3) return [];
    return [buildCrashRiskNode(node, score, factors, source, nearbyRiskWays)];
  });
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
  const crashRiskNodes = [];
  const crashRiskWays = [];
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
  crashRiskWays.push(...deriveCrashRiskWays(busyWays, source));
  crashRiskNodes.push(...deriveCrashRiskNodes(nodes, crashRiskWays, busyWays, source));
  return mergeDemoAccessibilityData(
    {
      nodes,
      busyWays,
      forbiddenWays,
      crashRiskNodes,
      crashRiskWays,
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
    },
    bbox
  );
}
