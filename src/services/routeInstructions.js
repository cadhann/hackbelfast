import { DESTINATIONS } from '../data/destinations';
import { haversine } from '../utils/geo';

const LANDMARK_ROUTE_THRESHOLD_METERS = 120;
const ENDPOINT_ROUTE_THRESHOLD_METERS = 160;
const MIN_ANCHOR_SPACING_METERS = 220;

function buildCumulativeDistances(coords) {
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) {
    cumulative[i] = cumulative[i - 1] + haversine(coords[i - 1], coords[i]);
  }
  return cumulative;
}

function locatePointOnRoute(point, coords, cumulative) {
  if (!point || coords.length === 0) return null;

  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const distance = haversine(point, coords[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  const totalMeters = cumulative[cumulative.length - 1] || 0;
  const alongMeters = cumulative[bestIndex] || 0;
  return {
    alongMeters,
    distanceToRoute: bestDistance,
    progress: totalMeters ? alongMeters / totalMeters : 0
  };
}

function locateFeatureOnRoute(feature, coords, cumulative) {
  return locatePointOnRoute([feature.lat, feature.lon], coords, cumulative);
}

function buildAnchor(base, kind, alongMeters, progress, extra = {}) {
  return {
    id: base.id || `${kind}-${base.name || 'point'}`,
    name: base.name || (kind === 'start' ? 'your start point' : 'your destination'),
    area: base.area || null,
    kind,
    alongMeters,
    progress,
    ...extra
  };
}

function resolveEndpointAnchor(selectedPlace, point, role, coords, cumulative) {
  const totalMeters = cumulative[cumulative.length - 1] || 0;
  if (selectedPlace) {
    return buildAnchor(selectedPlace, role, role === 'start' ? 0 : totalMeters, role === 'start' ? 0 : 1);
  }

  const nearest = DESTINATIONS
    .map(destination => {
      const location = locatePointOnRoute([destination.lat, destination.lng], coords, cumulative);
      return location
        ? {
            ...destination,
            ...location
          }
        : null;
    })
    .filter(Boolean)
    .filter(destination => destination.distanceToRoute <= ENDPOINT_ROUTE_THRESHOLD_METERS)
    .filter(destination => role === 'start' ? destination.progress <= 0.18 : destination.progress >= 0.82)
    .sort((a, b) => a.distanceToRoute - b.distanceToRoute)[0];

  if (nearest) {
    return buildAnchor(nearest, role, role === 'start' ? 0 : totalMeters, role === 'start' ? 0 : 1);
  }

  return buildAnchor(
    { id: `${role}-point`, name: role === 'start' ? 'your start point' : 'your destination' },
    role,
    role === 'start' ? 0 : totalMeters,
    role === 'start' ? 0 : 1,
    { generated: true }
  );
}

function collectLandmarkAnchors(coords, cumulative, startAnchor, destinationAnchor) {
  return DESTINATIONS
    .map(destination => {
      const location = locatePointOnRoute([destination.lat, destination.lng], coords, cumulative);
      return location
        ? buildAnchor(destination, 'landmark', location.alongMeters, location.progress, {
            distanceToRoute: location.distanceToRoute
          })
        : null;
    })
    .filter(Boolean)
    .filter(anchor => anchor.distanceToRoute <= LANDMARK_ROUTE_THRESHOLD_METERS)
    .filter(anchor => anchor.progress > 0.1 && anchor.progress < 0.9)
    .filter(anchor => anchor.id !== startAnchor.id && anchor.id !== destinationAnchor.id)
    .sort((a, b) => a.alongMeters - b.alongMeters || a.distanceToRoute - b.distanceToRoute);
}

function collectRoadAnchors(route, totalMeters) {
  if (!Array.isArray(route.steps) || route.steps.length === 0 || totalMeters <= 0) return [];

  const anchors = [];
  const seenNames = new Set();
  let runningMeters = 0;

  for (const step of route.steps) {
    runningMeters += step.distance || 0;
    const name = (step.name || '').trim();
    if (!name) continue;

    const normalized = name.toLowerCase();
    if (seenNames.has(normalized)) continue;

    const alongMeters = Math.max(0, Math.min(totalMeters, runningMeters));
    const progress = alongMeters / totalMeters;
    if (progress <= 0.12 || progress >= 0.88) continue;

    anchors.push(buildAnchor({ id: `road-${anchors.length}-${normalized}`, name }, 'road', alongMeters, progress));
    seenNames.add(normalized);
  }

  return anchors;
}

function desiredIntermediateCount(totalMeters) {
  if (totalMeters >= 2200) return 3;
  if (totalMeters >= 1400) return 2;
  if (totalMeters >= 650) return 1;
  return 0;
}

function targetFractions(count) {
  if (count === 1) return [0.45];
  if (count === 2) return [0.32, 0.65];
  if (count === 3) return [0.24, 0.5, 0.76];
  return [];
}

function pickBestAnchor(candidates, targetFraction, totalMeters, chosenAnchors) {
  let best = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    if (chosenAnchors.some(anchor => Math.abs(anchor.alongMeters - candidate.alongMeters) < MIN_ANCHOR_SPACING_METERS)) {
      continue;
    }

    const score =
      Math.abs(candidate.progress - targetFraction) * totalMeters +
      (candidate.distanceToRoute || 0);

    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function chooseIntermediateAnchors(landmarks, roads, totalMeters) {
  const count = desiredIntermediateCount(totalMeters);
  const targets = targetFractions(count);
  const chosen = [];

  for (const target of targets) {
    const landmark = pickBestAnchor(landmarks, target, totalMeters, chosen);
    if (landmark) {
      chosen.push(landmark);
      continue;
    }

    const road = pickBestAnchor(roads, target, totalMeters, chosen);
    if (road) chosen.push(road);
  }

  return chosen.sort((a, b) => a.alongMeters - b.alongMeters);
}

function labelForAnchor(anchor) {
  return anchor?.name || 'your destination';
}

function towardPhrase(anchor) {
  if (!anchor) return 'your destination';
  if (anchor.area && anchor.area !== anchor.name) return anchor.area;
  return anchor.name || anchor.area || 'your destination';
}

function cleanNote(text) {
  return (text || '').replace(/^(Seed note|Issue example):\s*/i, '').trim();
}

function featureCue(feature) {
  const tags = feature.tags || {};
  const name = tags.name || 'Crossing';

  if (tags.demo_issue) return `${name}: ${cleanNote(tags.demo_issue)}`;
  if (tags.demo_note) return `${name}: ${cleanNote(tags.demo_note)}`;

  const signals = [];
  if (tags.tactile_paving === 'yes') signals.push('tactile paving present');
  else if (tags.tactile_paving === 'no') signals.push('no tactile paving');

  if (tags['traffic_signals:sound'] === 'yes') signals.push('audible signal present');
  else if (tags['traffic_signals:sound'] === 'no') signals.push('no audible signal');

  if (tags.kerb === 'lowered' || tags.kerb === 'flush' || tags.kerb === 'no') signals.push('lowered kerb');
  else if (tags.kerb === 'raised') signals.push('raised kerb');

  if (signals.length === 0) return null;
  return `${name}: ${signals.join(', ')}.`;
}

function pickSegmentCue(features, startMeters, endMeters) {
  if (features.length === 0) return null;

  const midpoint = (startMeters + endMeters) / 2;
  const match = features
    .filter(feature => feature.alongMeters >= startMeters - 30 && feature.alongMeters <= endMeters + 30)
    .sort((a, b) => {
      const aTags = a.feature.tags || {};
      const bTags = b.feature.tags || {};
      const aPriority = aTags.demo_issue ? 0 : aTags.demo_note ? 1 : 2;
      const bPriority = bTags.demo_issue ? 0 : bTags.demo_note ? 1 : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return Math.abs(a.alongMeters - midpoint) - Math.abs(b.alongMeters - midpoint);
    })[0];

  return match ? featureCue(match.feature) : null;
}

function instructionText(current, next) {
  if (next.kind === 'destination') {
    const destinationName = labelForAnchor(next);
    const destinationTarget = towardPhrase(next);
    if (current.kind === 'start') {
      if (destinationTarget !== destinationName) {
        return `Leave ${labelForAnchor(current)} and continue toward ${destinationTarget}, then approach ${destinationName}.`;
      }
      return `Leave ${labelForAnchor(current)} and continue toward ${destinationName}.`;
    }
    if (current.kind === 'road') {
      if (destinationTarget !== destinationName) {
        return `Stay on ${labelForAnchor(current)} toward ${destinationTarget}, then approach ${destinationName}.`;
      }
      return `Stay on ${labelForAnchor(current)} toward ${destinationName}.`;
    }
    const onward = towardPhrase(current);
    if (onward !== labelForAnchor(current)) {
      return `Continue past ${labelForAnchor(current)} toward ${onward}, then approach ${destinationName}.`;
    }
    return `Continue past ${labelForAnchor(current)} toward ${destinationName}.`;
  }

  if (current.kind === 'start') {
    if (next.kind === 'road') return `Leave ${labelForAnchor(current)} and follow ${labelForAnchor(next)}.`;
    return `Leave ${labelForAnchor(current)} and continue toward ${towardPhrase(next)}.`;
  }

  if (current.kind === 'road') {
    if (next.kind === 'road') return `Stay on ${labelForAnchor(current)} toward ${labelForAnchor(next)}.`;
    return `Stay on ${labelForAnchor(current)} toward ${towardPhrase(next)}.`;
  }

  if (next.kind === 'road') {
    return `Continue past ${labelForAnchor(current)} and follow ${labelForAnchor(next)}.`;
  }

  const onward = towardPhrase(current);
  if (onward !== labelForAnchor(current)) {
    return `Continue past ${labelForAnchor(current)} toward ${onward}.`;
  }
  return `Continue past ${labelForAnchor(current)} toward ${towardPhrase(next)}.`;
}

function segmentLabel(index, lastIndex) {
  if (lastIndex === 0) return 'Route';
  if (index === 0) return 'Start';
  if (index === lastIndex) return 'Approach';
  return 'Continue';
}

export function buildRouteInstructionCards(chosen, { selectedStart, selectedDestination } = {}) {
  if (!chosen?.route?.coords || chosen.route.coords.length === 0) return [];

  const coords = chosen.route.coords;
  const cumulative = buildCumulativeDistances(coords);
  const totalMeters = cumulative[cumulative.length - 1] || chosen.route.distance || 0;

  const startAnchor = resolveEndpointAnchor(selectedStart, coords[0] ? { lat: coords[0][0], lng: coords[0][1] } : null, 'start', coords, cumulative);
  const destinationAnchor = resolveEndpointAnchor(
    selectedDestination,
    coords[coords.length - 1] ? { lat: coords[coords.length - 1][0], lng: coords[coords.length - 1][1] } : null,
    'destination',
    coords,
    cumulative
  );

  const landmarks = collectLandmarkAnchors(coords, cumulative, startAnchor, destinationAnchor);
  const roads = collectRoadAnchors(chosen.route, totalMeters);
  const intermediateAnchors = chooseIntermediateAnchors(landmarks, roads, totalMeters);
  const featureLocations = (chosen.near || [])
    .map(feature => {
      const location = locateFeatureOnRoute(feature, coords, cumulative);
      return location ? { feature, ...location } : null;
    })
    .filter(Boolean);

  const anchorChain = [startAnchor, ...intermediateAnchors, destinationAnchor];
  const cards = [];

  for (let i = 0; i < anchorChain.length - 1; i++) {
    const current = anchorChain[i];
    const next = anchorChain[i + 1];
    const startMeters = i === 0 ? 0 : current.alongMeters;
    const endMeters = i === anchorChain.length - 2 ? totalMeters : next.alongMeters;
    const distance = Math.max(0, endMeters - startMeters);
    const duration = totalMeters > 0 ? chosen.route.duration * (distance / totalMeters) : 0;

    cards.push({
      id: `${current.id}-${next.id}-${i}`,
      label: segmentLabel(i, anchorChain.length - 2),
      text: instructionText(current, next),
      distance,
      duration,
      cue: pickSegmentCue(featureLocations, startMeters, endMeters)
    });
  }

  return cards;
}
