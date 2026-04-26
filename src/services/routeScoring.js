import { PENALTIES } from '../config/preferences';
import {
  bboxesOverlap,
  haversine,
  pointToSegmentMeters,
  routeBoundingBox,
  wayBoundingBox
} from '../utils/geo';

const FORBIDDEN_BLOCK_METERS = 120;
const FORBIDDEN_BLOCK_RATIO = 0.08;

const ROUGH_SURFACES = new Set([
  'cobblestone',
  'cobblestone:flattened',
  'compacted',
  'dirt',
  'earth',
  'grass',
  'grass_paver',
  'gravel',
  'ground',
  'mud',
  'pebblestone',
  'sand',
  'sett',
  'unpaved'
]);

const SMOOTH_SURFACES = new Set([
  'asphalt',
  'concrete',
  'concrete:lanes',
  'concrete:plates',
  'fine_gravel',
  'paved',
  'paving_stones'
]);

const BAD_SMOOTHNESS = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable']);
const GOOD_SMOOTHNESS = new Set(['excellent', 'good', 'intermediate']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getTags(feature) {
  return feature?.tags || feature?.properties || {};
}

function getFeaturePoint(feature) {
  if (!feature) return null;
  if (Number.isFinite(feature.lat) && Number.isFinite(feature.lon)) return [feature.lat, feature.lon];
  if (Number.isFinite(feature.lat) && Number.isFinite(feature.lng)) return [feature.lat, feature.lng];
  if (Number.isFinite(feature.latitude) && Number.isFinite(feature.longitude)) {
    return [feature.latitude, feature.longitude];
  }
  if (Array.isArray(feature.coords) && feature.coords.length === 2) return feature.coords;
  if (Array.isArray(feature.geometry?.coordinates) && feature.geometry.type === 'Point') {
    return [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
  }
  return null;
}

function featureKey(feature, fallbackIndex) {
  const point = getFeaturePoint(feature);
  if (feature?.id !== undefined && feature.id !== null) return `id:${feature.id}`;
  if (feature?.osm_id !== undefined && feature.osm_id !== null) return `osm:${feature.osm_id}`;
  if (point) return `pt:${point[0].toFixed(6)},${point[1].toFixed(6)}`;
  const tags = getTags(feature);
  return `fallback:${tags.name || tags.ref || fallbackIndex}`;
}

function mergeFeatureArrays(source, keys) {
  const out = [];
  const seen = new Set();
  let fallbackIndex = 0;

  for (const key of keys) {
    const items = source?.[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const dedupeKey = featureKey(item, fallbackIndex++);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(item);
    }
  }

  return out;
}

function getWayGeometry(way) {
  if (Array.isArray(way?.geometry)) return way.geometry;
  if (way?.geometry?.type === 'LineString' && Array.isArray(way.geometry.coordinates)) {
    return way.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  }
  if (Array.isArray(way?.coords)) {
    return way.coords.map(([lat, lon]) => ({ lat, lon }));
  }
  return null;
}

function minDistanceToRouteMeters(point, coords) {
  if (!point || coords.length === 0) return Infinity;
  if (coords.length === 1) return haversine(point, coords[0]);

  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentMeters(point, coords[i], coords[i + 1]);
    if (d < min) min = d;
    if (min === 0) return 0;
  }
  return min;
}

function pointsNearRoute(items, coords, threshold = 30) {
  const out = [];
  for (const item of items) {
    const point = getFeaturePoint(item);
    if (!point) continue;
    const distance = minDistanceToRouteMeters(point, coords);
    if (distance < threshold) out.push({ item, distance });
  }
  return out;
}

function nearestPointDistance(items, coords) {
  let min = Infinity;
  for (const item of items) {
    const point = getFeaturePoint(item);
    if (!point) continue;
    const distance = minDistanceToRouteMeters(point, coords);
    if (distance < min) min = distance;
  }
  return Number.isFinite(min) ? min : null;
}

function nodesNearRoute(nodes, coords, threshold = 30) {
  return pointsNearRoute(nodes, coords, threshold).map(entry => entry.item);
}

function metersOnRouteAlongWays(ways, coords, threshold) {
  if (!ways || ways.length === 0 || coords.length < 2) return 0;

  const routeBbox = routeBoundingBox(coords);
  const padDeg = (threshold + 5) / 111320;
  const candidates = [];
  for (const way of ways) {
    const geometry = getWayGeometry(way);
    if (!geometry || geometry.length === 0) continue;
    const bbox = way._bbox || (way._bbox = wayBoundingBox({ geometry }));
    if (!bboxesOverlap(routeBbox, bbox, padDeg)) continue;
    candidates.push({ way, geometry, bbox });
  }
  if (candidates.length === 0) return 0;

  let meters = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversine(a, b);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    let near = false;
    for (const candidate of candidates) {
      const bbox = candidate.bbox;
      if (
        mid[0] < bbox.minLat - padDeg ||
        mid[0] > bbox.maxLat + padDeg ||
        mid[1] < bbox.minLon - padDeg ||
        mid[1] > bbox.maxLon + padDeg
      ) {
        continue;
      }
      for (let j = 0; j < candidate.geometry.length - 1; j++) {
        const segA = [candidate.geometry[j].lat, candidate.geometry[j].lon];
        const segB = [candidate.geometry[j + 1].lat, candidate.geometry[j + 1].lon];
        if (pointToSegmentMeters(mid, segA, segB) < threshold) {
          near = true;
          break;
        }
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

function stepsMetersOnRoute(stepsWays, coords, threshold = 10) {
  return metersOnRouteAlongWays(stepsWays, coords, threshold);
}

function narrowMetersOnRoute(narrowWays, coords, threshold = 8) {
  return metersOnRouteAlongWays(narrowWays, coords, threshold);
}

function litMetersOnRoute(litWays, coords, threshold = 14) {
  return metersOnRouteAlongWays(litWays, coords, threshold);
}

function unlitMetersOnRoute(unlitWays, coords, threshold = 14) {
  return metersOnRouteAlongWays(unlitWays, coords, threshold);
}

function lampsNearRoute(streetLamps, coords, threshold = 25) {
  return pointsNearRoute(streetLamps, coords, threshold).length;
}

function shopsNearRoute(shopPois, coords, threshold = 30) {
  return pointsNearRoute(shopPois, coords, threshold).length;
}

function residentialMetersOnRoute(residentialWays, coords, threshold = 12) {
  return metersOnRouteAlongWays(residentialWays, coords, threshold);
}

function serviceMetersOnRoute(serviceWays, coords, threshold = 10) {
  return metersOnRouteAlongWays(serviceWays, coords, threshold);
}

function pedestrianMetersOnRoute(pedestrianWays, coords, threshold = 12) {
  return metersOnRouteAlongWays(pedestrianWays, coords, threshold);
}

// "Park-adjacent" meters: how much of the route runs near a green-space edge.
// We treat the polygon ring as a way and check proximity, which approximates
// "walking alongside a park" without needing point-in-polygon.
function parkAdjacentMetersOnRoute(greenWays, coords, threshold = 30) {
  return metersOnRouteAlongWays(greenWays, coords, threshold);
}

function parseInclinePercent(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.abs(value) : null;

  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text === 'up' || text === 'down') return 6;
  if (text === 'steep') return 10;

  const numeric = parseFloat(text.replace('%', ''));
  return Number.isFinite(numeric) ? Math.abs(numeric) : null;
}

function classifyFeature(el) {
  const tags = getTags(el);
  const tactileYes = tags.tactile_paving === 'yes';
  const tactileNo = tags.tactile_paving === 'no';
  const audioYes = tags['traffic_signals:sound'] === 'yes';
  const audioNo = tags['traffic_signals:sound'] === 'no';
  const lowKerb = tags.kerb === 'lowered' || tags.kerb === 'flush' || tags.kerb === 'no';
  const highKerb = tags.kerb === 'raised';
  return { tactileYes, tactileNo, audioYes, audioNo, lowKerb, highKerb };
}

function collectRouteSignals(near) {
  let crossings = 0;
  let tactileYes = 0;
  let tactileNo = 0;
  let tactileUnknown = 0;
  let audioYes = 0;
  let audioNo = 0;
  let audioUnknown = 0;
  let kerbLow = 0;
  let kerbHigh = 0;
  let kerbUnknown = 0;

  for (const el of near) {
    const tags = getTags(el);
    const classified = classifyFeature(el);
    const isCrossing = tags.highway === 'crossing';
    const isSignalised = tags.crossing === 'traffic_signals' || tags.crossing === 'signals';

    if (isCrossing) {
      crossings++;
      if (classified.tactileYes) tactileYes++;
      else if (classified.tactileNo) tactileNo++;
      else tactileUnknown++;
    }

    if (isSignalised) {
      if (classified.audioYes) audioYes++;
      else if (classified.audioNo) audioNo++;
      else audioUnknown++;
    }

    if (isCrossing || tags.kerb) {
      if (classified.lowKerb) kerbLow++;
      else if (classified.highKerb) kerbHigh++;
      else if (tags.kerb) kerbUnknown++;
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

function combineExplicitAndDerivedWays(explicitKeys, derivedKey, data, classifier) {
  const explicit = mergeFeatureArrays(data, explicitKeys);
  const derived = [];
  const genericWays = Array.isArray(data?.[derivedKey]) ? data[derivedKey] : [];

  for (const way of genericWays) {
    const result = classifier(way);
    if (result) derived.push(way);
  }

  return mergeFeatureArrays({ combined: [...explicit, ...derived] }, ['combined']);
}

function isRoughSurfaceWay(way) {
  const tags = getTags(way);
  const surface = String(tags.surface || '').toLowerCase();
  const smoothness = String(tags.smoothness || '').toLowerCase();
  return ROUGH_SURFACES.has(surface) || BAD_SMOOTHNESS.has(smoothness);
}

function isSmoothSurfaceWay(way) {
  const tags = getTags(way);
  const surface = String(tags.surface || '').toLowerCase();
  const smoothness = String(tags.smoothness || '').toLowerCase();
  return SMOOTH_SURFACES.has(surface) || GOOD_SMOOTHNESS.has(smoothness);
}

function isSteepWay(way) {
  const tags = getTags(way);
  const incline = parseInclinePercent(tags.incline ?? tags.grade ?? tags.slope_pct);
  return incline !== null && incline >= 6;
}

function isGentleWay(way) {
  const tags = getTags(way);
  const incline = parseInclinePercent(tags.incline ?? tags.grade ?? tags.slope_pct);
  return incline !== null && incline > 0 && incline <= 3;
}

function classifyAmenityAccessibility(item) {
  const tags = getTags(item);
  const wheelchair = String(tags.wheelchair || '').toLowerCase();
  const stepFree = String(tags.step_free || tags.stepfree || '').toLowerCase();
  const ramp = String(tags.ramp || '').toLowerCase();
  const lift = String(tags.lift || '').toLowerCase();

  if (wheelchair === 'yes' || stepFree === 'yes' || ramp === 'yes' || lift === 'yes') return 'accessible';
  if (wheelchair === 'no' || stepFree === 'no') return 'inaccessible';
  return 'unknown';
}

function summarizeToilets(toilets, coords) {
  const nearby = pointsNearRoute(toilets, coords, 60);
  let accessibleToiletCount = 0;
  let inaccessibleToiletCount = 0;
  let unknownToiletCount = 0;

  for (const entry of nearby) {
    const status = classifyAmenityAccessibility(entry.item);
    if (status === 'accessible') accessibleToiletCount++;
    else if (status === 'inaccessible') inaccessibleToiletCount++;
    else unknownToiletCount++;
  }

  return {
    toiletsNear: nearby.map(entry => entry.item),
    toiletCount: nearby.length,
    accessibleToiletCount,
    inaccessibleToiletCount,
    unknownToiletCount,
    nearestToiletMeters: nearestPointDistance(toilets, coords)
  };
}

function summarizeSeating(seating, coords) {
  const nearby = pointsNearRoute(seating, coords, 45);
  return {
    seatingNear: nearby.map(entry => entry.item),
    seatingCount: nearby.length,
    nearestSeatingMeters: nearestPointDistance(seating, coords)
  };
}

function classifyStationAccess(item) {
  const tags = getTags(item);
  const wheelchair = String(tags.wheelchair || '').toLowerCase();
  const stepFree = String(tags.step_free || tags.stepfree || '').toLowerCase();
  const lift = String(tags.lift || '').toLowerCase();
  const ramp = String(tags.ramp || '').toLowerCase();
  const stairs = String(tags.stairs || '').toLowerCase();

  if (wheelchair === 'yes' || stepFree === 'yes' || lift === 'yes' || ramp === 'yes') return 'accessible';
  if (wheelchair === 'no' || stepFree === 'no' || stairs === 'yes') return 'inaccessible';
  return 'unknown';
}

function summarizeStations(stations, coords) {
  const nearby = pointsNearRoute(stations, coords, 65);
  let accessibleStationCount = 0;
  let inaccessibleStationCount = 0;
  let unknownStationCount = 0;

  for (const entry of nearby) {
    const status = classifyStationAccess(entry.item);
    if (status === 'accessible') accessibleStationCount++;
    else if (status === 'inaccessible') inaccessibleStationCount++;
    else unknownStationCount++;
  }

  return {
    stationAccessNear: nearby.map(entry => entry.item),
    stationCount: nearby.length,
    accessibleStationCount,
    inaccessibleStationCount,
    unknownStationCount,
    nearestStationMeters: nearestPointDistance(stations, coords)
  };
}

function parseDaysSince(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const timestamp = Date.parse(String(value));
  if (!Number.isNaN(timestamp)) {
    const diff = Date.now() - timestamp;
    return diff >= 0 ? diff / (1000 * 60 * 60 * 24) : null;
  }

  const numeric = parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : null;
}

function classifyCommunityReport(item) {
  const tags = getTags(item);
  const status = String(item?.status || tags.status || tags.state || tags.report_status || tags.resolution || '').toLowerCase();
  const type = String(item?.category || tags.category || tags.type || tags.report_type || tags.report_category || '').toLowerCase();
  const verifiedValue = String(item?.verification || tags.verification || tags.verified || tags.confirmed || tags.moderated || tags.report_verification || '').toLowerCase();
  const severityValue = String(item?.severity || tags.severity || tags.priority || tags.report_severity || '').toLowerCase();
  const freshnessValue = String(item?.freshness || tags.freshness || tags.report_freshness || '').toLowerCase();
  const days = parseDaysSince(
    item?.reportedAt ??
    item?.verifiedAt ??
    tags.age_days ??
    tags.days_old ??
    tags.updated_at ??
    tags.reported_at ??
    tags.date
  );

  const verified = verifiedValue === 'yes' || verifiedValue === 'true' || verifiedValue === 'verified' || verifiedValue === 'confirmed';
  const resolved = /resolved|cleared|fixed|closed|completed/.test(status);
  const issue = resolved ? false : /issue|hazard|barrier|closure|blocked|obstruction|surface|lighting|crossing|step|stairs|crowd|complex/.test(type || status);
  const positive = resolved || /clear|passable|accessible|open/.test(type);
  const fresh = freshnessValue === 'recent' || (days !== null ? days <= 45 : false);
  const stale = freshnessValue === 'stale' || (days !== null ? days > 120 : false);

  let severity = 1;
  if (/critical|high|severe|blocking/.test(severityValue)) severity = 1.5;
  else if (/low|minor|info/.test(severityValue)) severity = 0.6;

  const freshnessFactor = fresh ? 1.25 : stale ? 0.7 : 1;
  const verificationFactor = verified ? 1.3 : 0.9;

  return {
    issue,
    positive,
    verified,
    fresh,
    stale,
    ambiguous: !issue && !positive,
    issueUnits: issue ? severity * freshnessFactor * verificationFactor : 0,
    clearUnits: positive ? 0.55 * severity * freshnessFactor * verificationFactor : 0
  };
}

function summarizeReports(reports, coords) {
  const nearby = pointsNearRoute(reports, coords, 45);
  let reportCount = nearby.length;
  let verifiedReportCount = 0;
  let reportedReportCount = 0;
  let freshReportCount = 0;
  let staleReportCount = 0;
  let ambiguousReportCount = 0;
  let reportIssueUnits = 0;
  let reportClearUnits = 0;

  for (const entry of nearby) {
    const summary = classifyCommunityReport(entry.item);
    if (summary.verified) verifiedReportCount++;
    if (summary.issue && !summary.verified) reportedReportCount++;
    if (summary.fresh) freshReportCount++;
    if (summary.stale) staleReportCount++;
    if (summary.ambiguous) ambiguousReportCount++;
    reportIssueUnits += summary.issueUnits;
    reportClearUnits += summary.clearUnits;
  }

  return {
    communityReportsNear: nearby.map(entry => entry.item),
    reportCount,
    verifiedReportCount,
    reportedReportCount,
    freshReportCount,
    staleReportCount,
    ambiguousReportCount,
    reportIssueUnits,
    reportClearUnits
  };
}

function classifyCrashHotspot(item) {
  const tags = getTags(item);
  const severityValue = String(
    item?.severity ??
    item?.riskLevel ??
    tags.severity ??
    tags.risk_level ??
    tags.crash_severity ??
    tags.priority ??
    ''
  ).toLowerCase();
  const userGroup = String(item?.userGroup ?? tags.user_group ?? tags.road_user ?? tags.mode ?? '').toLowerCase();
  const collisionCount = Number.parseFloat(
    item?.collisionCount ??
    item?.crashCount ??
    item?.count ??
    tags.collision_count ??
    tags.crash_count ??
    tags.collisions ??
    tags.crashes ??
    tags.count ??
    0
  );
  const injuryCount = Number.parseFloat(
    item?.injuryCount ??
    item?.injuries ??
    tags.injury_count ??
    tags.injuries ??
    tags.casualties ??
    0
  );
  const fatalCount = Number.parseFloat(
    item?.fatalCount ??
    item?.fatalities ??
    tags.fatal_count ??
    tags.fatalities ??
    0
  );
  const recentDays = parseDaysSince(
    item?.reportedAt ??
    item?.updatedAt ??
    item?.date ??
    tags.reported_at ??
    tags.updated_at ??
    tags.date
  );

  let severityFactor = 1;
  if (
    fatalCount > 0 ||
    /fatal|critical|severe/.test(severityValue)
  ) {
    severityFactor = 1.8;
  } else if (
    injuryCount >= 2 ||
    /high|major/.test(severityValue)
  ) {
    severityFactor = 1.45;
  } else if (/low|minor/.test(severityValue)) {
    severityFactor = 0.8;
  }

  const exposureCount = Number.isFinite(collisionCount) && collisionCount > 0 ? collisionCount : 1;
  const recencyFactor = recentDays === null ? 1 : recentDays <= 365 ? 1.15 : 0.9;
  const vulnerableFactor = /pedestrian|cycle|wheelchair|accessible|active/.test(userGroup) ? 1.15 : 1;
  const hotspotUnits = exposureCount * severityFactor * recencyFactor * vulnerableFactor;

  return {
    severe: severityFactor >= 1.45,
    hotspotUnits
  };
}

function summarizeCrashHotspots(crashHotspots, coords) {
  const nearby = pointsNearRoute(crashHotspots, coords, 45);
  let severeCrashHotspotCount = 0;
  let crashRiskUnits = 0;

  for (const entry of nearby) {
    const summary = classifyCrashHotspot(entry.item);
    if (summary.severe) severeCrashHotspotCount++;
    crashRiskUnits += summary.hotspotUnits;
  }

  return {
    crashHotspotsNear: nearby.map(entry => entry.item),
    crashHotspotCount: nearby.length,
    severeCrashHotspotCount,
    crashRiskUnits,
    nearestCrashMeters: nearestPointDistance(crashHotspots, coords)
  };
}

function summarizeDecisionPoints(route) {
  const steps = Array.isArray(route?.steps) ? route.steps : [];
  let decisionPoints = 0;
  let complexDecisionPoints = 0;
  let decisionWeight = 0;

  for (const step of steps) {
    const instruction = String(step.instruction || '').toLowerCase();
    const modifier = String(step.modifier || '').toLowerCase();
    const distance = Number(step.distance || 0);

    if (distance > 0 && distance < 8 && instruction !== 'roundabout' && instruction !== 'fork') {
      continue;
    }

    const minor = instruction === 'depart' || instruction === 'arrive' || instruction === 'notification';
    const straight = instruction === 'continue' && (!modifier || modifier === 'straight');
    const roadRename = instruction === 'new name';
    if (minor || straight || roadRename) continue;

    decisionPoints++;
    let weight = 1;
    if (
      instruction === 'roundabout' ||
      instruction === 'rotary' ||
      instruction === 'fork' ||
      instruction === 'merge' ||
      instruction === 'end of road' ||
      modifier === 'uturn' ||
      modifier === 'sharp left' ||
      modifier === 'sharp right'
    ) {
      complexDecisionPoints++;
      weight = 2;
    } else if (modifier === 'slight left' || modifier === 'slight right') {
      complexDecisionPoints++;
      weight = 1.5;
    }
    decisionWeight += weight;
  }

  const perKm = route?.distance > 0 ? decisionWeight / Math.max(route.distance / 1000, 0.25) : 0;
  let complexityBand = 'low';
  if (perKm >= 6 || complexDecisionPoints >= 4) complexityBand = 'high';
  else if (perKm >= 3 || complexDecisionPoints >= 2 || decisionPoints >= 5) complexityBand = 'medium';

  return { decisionPoints, complexDecisionPoints, decisionWeight, decisionDensity: perKm, complexityBand };
}

function summarizeEvidence(signals, summary) {
  const knownFromSignals =
    signals.tactileYes +
    signals.tactileNo +
    signals.audioYes +
    signals.audioNo +
    signals.kerbLow +
    signals.kerbHigh;

  const knownFromDerived =
    summary.toiletCount +
    summary.seatingCount +
    summary.accessibleStationCount +
    summary.inaccessibleStationCount +
    summary.crashHotspotCount +
    Math.round(summary.crashRiskMeters / 160) +
    summary.decisionPoints +
    summary.complexDecisionPoints +
    Math.round(summary.busyMeters / 180) +
    Math.round(summary.stepsMeters / 120) +
    Math.round(summary.narrowMeters / 120) +
    Math.round(summary.roughMeters / 120) +
    Math.round(summary.smoothMeters / 160) +
    Math.round(summary.steepMeters / 120) +
    Math.round(summary.gentleMeters / 160);

  const unknown =
    signals.tactileUnknown +
    signals.audioUnknown +
    signals.kerbUnknown +
    summary.unknownToiletCount +
    summary.unknownStationCount +
    summary.ambiguousReportCount;

  return {
    known: knownFromSignals + knownFromDerived,
    reported: summary.reportCount,
    unknown
  };
}

function computeIntrinsicScore(signals, summary) {
  const supportive =
    signals.tactileYes +
    signals.audioYes +
    signals.kerbLow +
    summary.accessibleToiletCount * 0.75 +
    summary.toiletCount * 0.15 +
    summary.seatingCount * 0.35 +
    summary.accessibleStationCount * 0.9 +
    summary.smoothMeters / 170 +
    summary.gentleMeters / 160 +
    summary.litMeters / 260 +
    summary.streetLampCount * 0.18 +
    summary.reportClearUnits;

  const difficult =
    signals.tactileNo * 1.1 +
    signals.audioNo +
    signals.kerbHigh * 1.2 +
    summary.busyMeters / 180 +
    summary.forbiddenMeters / 70 +
    summary.stepsMeters / 50 +
    summary.narrowMeters / 90 +
    summary.unlitMeters / 240 +
    summary.inaccessibleStationCount * 1.2 +
    summary.roughMeters / 90 +
    summary.steepMeters / 70 +
    summary.crashRiskMeters / 120 +
    summary.crashRiskUnits * 0.95 +
    summary.reportIssueUnits * 1.15 +
    summary.decisionWeight * 0.25 +
    summary.complexDecisionPoints * 0.9;

  const total = supportive + difficult;
  if (total <= 0) return { intrinsicScore: null, supportiveEvidence: 0, difficultEvidence: 0, evidenceTotal: 0 };

  const raw = (supportive - difficult) / total;
  const confidence = clamp(total / 8, 0.25, 1);
  const intrinsicScore = clamp(0.5 + raw * 0.5 * confidence, 0, 1);

  return {
    intrinsicScore,
    supportiveEvidence: supportive,
    difficultEvidence: difficult,
    evidenceTotal: total
  };
}

export function analyzeRoute(route, accData) {
  const nodes = mergeFeatureArrays(accData, ['nodes', 'crossingNodes', 'officialCrossings']);
  const near = nodesNearRoute(nodes, route.coords);
  const signals = collectRouteSignals(near);

  const busyMeters = busyMetersOnRoute(accData?.busyWays || [], route.coords);
  const forbiddenMeters = forbiddenMetersOnRoute(accData?.forbiddenWays || [], route.coords);
  const stepsMeters = stepsMetersOnRoute(accData?.stepsWays || [], route.coords);
  const narrowMeters = narrowMetersOnRoute(accData?.narrowWays || [], route.coords);
  const litMeters = litMetersOnRoute(accData?.litWays || [], route.coords);
  const unlitMeters = unlitMetersOnRoute(accData?.unlitWays || [], route.coords);
  const streetLampCount = lampsNearRoute(accData?.streetLamps || [], route.coords);

  const roughWays = combineExplicitAndDerivedWays(
    ['roughWays', 'roughSurfaceWays', 'surfaceRiskWays'],
    'surfaceWays',
    accData,
    isRoughSurfaceWay
  );
  const smoothWays = combineExplicitAndDerivedWays(
    ['smoothSurfaceWays', 'goodSurfaceWays'],
    'surfaceWays',
    accData,
    isSmoothSurfaceWay
  );
  const steepWays = combineExplicitAndDerivedWays(
    ['steepWays'],
    'slopeWays',
    accData,
    isSteepWay
  );
  const gentleWays = combineExplicitAndDerivedWays(
    ['gentleSlopeWays', 'flatWays'],
    'slopeWays',
    accData,
    isGentleWay
  );

  const roughMeters = metersOnRouteAlongWays(roughWays, route.coords, 10);
  const smoothMeters = metersOnRouteAlongWays(smoothWays, route.coords, 10);
  const steepMeters = metersOnRouteAlongWays(steepWays, route.coords, 10);
  const gentleMeters = metersOnRouteAlongWays(gentleWays, route.coords, 10);

  const toilets = mergeFeatureArrays(accData, ['publicToilets', 'toilets', 'toiletNodes']);
  const seating = mergeFeatureArrays(accData, ['seating', 'restPoints', 'benches', 'seatingNodes']);
  const stationAccess = mergeFeatureArrays(accData, ['stations', 'stationAccess', 'stationAccessibility', 'stationEntrances']);
  const reports = mergeFeatureArrays(accData, ['communityReports', 'issueReports', 'reports']);
  const crashHotspots = mergeFeatureArrays(accData, ['crashHotspots', 'collisionHotspots', 'crashRiskNodes', 'crashPoints']);
  const crashRiskCorridors = mergeFeatureArrays(accData, ['crashRiskWays', 'collisionRiskWays', 'crashRiskSegments', 'collisionRiskSegments']);

  const toiletSummary = summarizeToilets(toilets, route.coords);
  const seatingSummary = summarizeSeating(seating, route.coords);
  const stationSummary = summarizeStations(stationAccess, route.coords);
  const reportSummary = summarizeReports(reports, route.coords);
  const crashSummary = summarizeCrashHotspots(crashHotspots, route.coords);
  const crashRiskMeters = metersOnRouteAlongWays(crashRiskCorridors, route.coords, 12);
  const complexityFromRoute = summarizeDecisionPoints(route);

  const shopCount = shopsNearRoute(accData?.shopPois || [], route.coords);
  const residentialMeters = residentialMetersOnRoute(accData?.residentialWays || [], route.coords);
  const serviceMeters = serviceMetersOnRoute(accData?.serviceWays || [], route.coords);
  const pedestrianMeters = pedestrianMetersOnRoute(accData?.pedestrianFriendlyWays || [], route.coords);
  const parkMeters = parkAdjacentMetersOnRoute(accData?.greenSpaceWays || [], route.coords);

  // Shop density per 100 m of walking. A high-street stretch in Belfast tends
  // to have ~5–15 shops per 100 m; a residential estate is usually 0.
  const distanceForDensity = Math.max(route.distance, 50);
  const shopDensityPer100m = (shopCount / distanceForDensity) * 100;

  const blocked = forbiddenMeters > Math.max(FORBIDDEN_BLOCK_METERS, route.distance * FORBIDDEN_BLOCK_RATIO);

  const summary = {
    busyMeters,
    forbiddenMeters,
    stepsMeters,
    narrowMeters,
    litMeters,
    unlitMeters,
    streetLampCount,
    roughMeters,
    smoothMeters,
    steepMeters,
    gentleMeters,
    crashRiskMeters,
    crashRiskUnits: crashSummary.crashRiskUnits + (crashRiskMeters / 75),
    shopCount,
    shopDensityPer100m,
    residentialMeters,
    serviceMeters,
    pedestrianMeters,
    parkMeters,
    decisionPoints: complexityFromRoute.decisionPoints,
    complexDecisionPoints: complexityFromRoute.complexDecisionPoints,
    decisionWeight: complexityFromRoute.decisionWeight,
    decisionDensity: complexityFromRoute.decisionDensity,
    complexityBand: complexityFromRoute.complexityBand,
    ...toiletSummary,
    ...seatingSummary,
    ...stationSummary,
    ...crashSummary,
    ...reportSummary
  };

  const evidenceSummary = summarizeEvidence(signals, summary);
  const scoreSummary = computeIntrinsicScore(signals, summary);

  return {
    route,
    near,
    signals,
    busyMeters,
    forbiddenMeters,
    stepsMeters,
    narrowMeters,
    litMeters,
    unlitMeters,
    streetLampCount,
    roughMeters,
    smoothMeters,
    steepMeters,
    gentleMeters,
    crashRiskMeters,
    shopCount,
    shopDensityPer100m,
    residentialMeters,
    serviceMeters,
    pedestrianMeters,
    parkMeters,
    decisionPoints: complexityFromRoute.decisionPoints,
    complexDecisionPoints: complexityFromRoute.complexDecisionPoints,
    decisionWeight: complexityFromRoute.decisionWeight,
    decisionDensity: complexityFromRoute.decisionDensity,
    complexityBand: complexityFromRoute.complexityBand,
    toiletsNear: toiletSummary.toiletsNear,
    toiletCount: toiletSummary.toiletCount,
    accessibleToiletCount: toiletSummary.accessibleToiletCount,
    inaccessibleToiletCount: toiletSummary.inaccessibleToiletCount,
    unknownToiletCount: toiletSummary.unknownToiletCount,
    nearestToiletMeters: toiletSummary.nearestToiletMeters,
    seatingNear: seatingSummary.seatingNear,
    seatingCount: seatingSummary.seatingCount,
    nearestSeatingMeters: seatingSummary.nearestSeatingMeters,
    stationAccessNear: stationSummary.stationAccessNear,
    stationCount: stationSummary.stationCount,
    accessibleStationCount: stationSummary.accessibleStationCount,
    inaccessibleStationCount: stationSummary.inaccessibleStationCount,
    unknownStationCount: stationSummary.unknownStationCount,
    nearestStationMeters: stationSummary.nearestStationMeters,
    crashHotspotsNear: crashSummary.crashHotspotsNear,
    crashHotspotCount: crashSummary.crashHotspotCount,
    severeCrashHotspotCount: crashSummary.severeCrashHotspotCount,
    crashRiskUnits: crashSummary.crashRiskUnits + (crashRiskMeters / 75),
    nearestCrashMeters: crashSummary.nearestCrashMeters,
    communityReportsNear: reportSummary.communityReportsNear,
    reportCount: reportSummary.reportCount,
    verifiedReportCount: reportSummary.verifiedReportCount,
    reportedReportCount: reportSummary.reportedReportCount,
    freshReportCount: reportSummary.freshReportCount,
    staleReportCount: reportSummary.staleReportCount,
    ambiguousReportCount: reportSummary.ambiguousReportCount,
    reportIssueUnits: reportSummary.reportIssueUnits,
    reportClearUnits: reportSummary.reportClearUnits,
    evidenceSummary,
    supportiveEvidence: scoreSummary.supportiveEvidence,
    difficultEvidence: scoreSummary.difficultEvidence,
    evidenceTotal: scoreSummary.evidenceTotal,
    blocked,
    intrinsicScore: scoreSummary.intrinsicScore
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
  penalty += analysis.busyMeters * PENALTIES.busy_per_meter * (weights.avoid_busy || 0);
  penalty += analysis.forbiddenMeters * PENALTIES.forbidden_per_meter * (weights.forbidden || 0);
  penalty += analysis.stepsMeters * PENALTIES.steps_per_meter * (weights.avoid_steps || 0);
  penalty += analysis.narrowMeters * PENALTIES.narrow_per_meter * (weights.pavement_width || 0);
  penalty += analysis.unlitMeters * PENALTIES.unlit_per_meter * (weights.streetlights || 0);
  penalty -= analysis.litMeters * PENALTIES.lit_per_meter_bonus * (weights.streetlights || 0);
  penalty -= analysis.streetLampCount * PENALTIES.lamp_bonus * (weights.streetlights || 0);
  penalty -= analysis.accessibleToiletCount * PENALTIES.accessible_toilet_bonus * (weights.rest_points || 0);
  penalty -= analysis.toiletCount * PENALTIES.toilet_bonus * (weights.rest_points || 0);
  penalty -= analysis.seatingCount * PENALTIES.seating_bonus * (weights.rest_points || 0);
  penalty -= analysis.accessibleStationCount * PENALTIES.accessible_station_bonus * (weights.station_access || 0);
  penalty += analysis.inaccessibleStationCount * PENALTIES.inaccessible_station_penalty * (weights.station_access || 0);
  penalty += analysis.roughMeters * PENALTIES.rough_surface_per_meter * (weights.surface_quality || 0);
  penalty -= analysis.smoothMeters * PENALTIES.smooth_surface_per_meter_bonus * (weights.surface_quality || 0);
  penalty += analysis.steepMeters * PENALTIES.steep_per_meter * (weights.gentle_slope || 0);
  penalty -= analysis.gentleMeters * PENALTIES.gentle_per_meter_bonus * (weights.gentle_slope || 0);
  penalty += analysis.reportIssueUnits * PENALTIES.report_issue_unit * (weights.verified_reports || 0);
  penalty -= analysis.reportClearUnits * PENALTIES.report_clear_bonus * (weights.verified_reports || 0);
  penalty += analysis.crashRiskUnits * PENALTIES.crash_risk_unit * (weights.avoid_crash || 0);
  penalty += analysis.decisionWeight * PENALTIES.decision_point_penalty * (weights.simple_navigation || 0);
  penalty += analysis.complexDecisionPoints * PENALTIES.complex_junction_penalty * (weights.simple_navigation || 0);

  // Shopping-streets bias: reward routes that stick to streets with retail
  // frontage rather than dipping through housing estates or service alleys.
  // Shop density gives the lion's share of the bonus; residential/service
  // mileage gets a per-meter penalty so the optimiser actively detours
  // around quiet estates when a parallel high-street option exists.
  const shopWeight = weights.prefer_shopping || 0;
  if (shopWeight > 0) {
    // Cap the density bonus so a single dense block doesn't dominate the score.
    const cappedDensity = Math.min(analysis.shopDensityPer100m || 0, 8);
    penalty -= cappedDensity * PENALTIES.shop_density_bonus * shopWeight;
    penalty += (analysis.residentialMeters || 0) * PENALTIES.residential_per_meter * shopWeight;
    penalty += (analysis.serviceMeters || 0) * PENALTIES.service_per_meter * shopWeight;
    penalty -= (analysis.pedestrianMeters || 0) * PENALTIES.pedestrian_per_meter_bonus * shopWeight;
  }

  // Pleasant-walk bias: prefer pedestrianised streets and park edges, and
  // soften (not block) routes through quiet residential estates.
  const pleasantWeight = weights.prefer_pleasant || 0;
  if (pleasantWeight > 0) {
    penalty -= (analysis.pedestrianMeters || 0) * PENALTIES.pedestrian_per_meter_bonus * pleasantWeight;
    penalty -= (analysis.parkMeters || 0) * PENALTIES.park_per_meter_bonus * pleasantWeight;
    // Pleasantness still slightly disfavours service alleys.
    penalty += (analysis.serviceMeters || 0) * PENALTIES.service_per_meter * (pleasantWeight * 0.6);
    // A modest density bonus too — a leafy park edge is great, but a
    // pleasant village street with a few cafes is also lovely.
    const cappedDensity = Math.min(analysis.shopDensityPer100m || 0, 5);
    penalty -= cappedDensity * PENALTIES.shop_density_bonus * (pleasantWeight * 0.5);
  }

  return {
    ...analysis,
    penalty,
    score: analysis.intrinsicScore,
    effective: analysis.blocked ? Infinity : analysis.route.distance + penalty
  };
}

export function getFeatureStats(chosen) {
  if (!chosen) return { crossings: 0, tactileYes: 0, tactileNo: 0, lowKerbs: 0 };
  let crossings = 0;
  let tactileYes = 0;
  let tactileNo = 0;
  let lowKerbs = 0;
  for (const el of chosen.near) {
    const tags = getTags(el);
    if (tags.highway === 'crossing') crossings++;
    if (tags.tactile_paving === 'yes') tactileYes++;
    if (tags.tactile_paving === 'no') tactileNo++;
    if (tags.kerb === 'lowered' || tags.kerb === 'flush') lowKerbs++;
  }
  return { crossings, tactileYes, tactileNo, lowKerbs };
}

export { classifyFeature };
