import { ROUTE_MODES } from '../config/routeModes';
import { formatDistance } from '../utils/format';
import { scoreRouteAnalysis } from './routeScoring';

function buildModeWeights(mode, preferences) {
  return {
    tactile: mode.defaultWeights.tactile + (preferences.tactile ? mode.preferenceBoosts.tactile : 0),
    audio: mode.defaultWeights.audio + (preferences.audio ? mode.preferenceBoosts.audio : 0),
    kerb: mode.defaultWeights.kerb + (preferences.kerb ? mode.preferenceBoosts.kerb : 0),
    avoid_busy: mode.defaultWeights.avoid_busy + (preferences.avoid_busy ? mode.preferenceBoosts.avoid_busy : 0),
    forbidden: mode.defaultWeights.forbidden
  };
}

function chooseRouteIndex(scoredCandidates) {
  if (scoredCandidates.length === 0) return -1;

  let best = -1;
  for (let i = 0; i < scoredCandidates.length; i++) {
    if (scoredCandidates[i].blocked) continue;
    if (best === -1 || scoredCandidates[i].effective < scoredCandidates[best].effective) best = i;
  }

  if (best !== -1) return best;

  best = 0;
  for (let i = 1; i < scoredCandidates.length; i++) {
    if (scoredCandidates[i].forbiddenMeters < scoredCandidates[best].forbiddenMeters) best = i;
  }
  return best;
}

function hasAccessibilityEvidence(routeAnalyses) {
  return routeAnalyses.some(analysis => {
    const signals = analysis.signals;
    return (
      analysis.near.length > 0 ||
      analysis.busyMeters > 0 ||
      analysis.forbiddenMeters > 0 ||
      Object.values(signals).some(Boolean)
    );
  });
}

function buildModeReasons(scoredRoute, mode, context) {
  if (!scoredRoute) return [];

  const reasons = [];
  if (!context.hasAccessibilityEvidence && mode.id !== 'fastest') {
    reasons.push('No accessibility lookup data returned, so this mode falls back to distance-only ranking.');
  } else if (context.sameAsFastest && context.allModesUseSameRoute) {
    reasons.push('Same path as Fastest here because the direct candidate also wins the accessibility scoring.');
  } else if (context.sameAsFastest) {
    reasons.push('Same path as Fastest here because no accessible alternative beats the direct route.');
  } else if (mode.id === 'fastest') {
    reasons.push('Chooses the shortest available walking route.');
  } else if (mode.id === 'balanced') {
    reasons.push('Balances directness with accessibility preferences.');
  } else {
    reasons.push('Applies the full accessibility preference weighting.');
  }

  if (scoredRoute.blocked) {
    reasons.push(`Only restricted candidates available; this one has ${Math.round(scoredRoute.forbiddenMeters)} m flagged.`);
  }

  if (scoredRoute.score !== null) {
    reasons.push(`Accessibility confidence ${Math.round(scoredRoute.score * 100)} / 100 from nearby known features.`);
  } else {
    reasons.push('Accessibility confidence is unknown because nearby feature data is sparse.');
  }

  if (scoredRoute.busyMeters > 0) {
    reasons.push(`${formatDistance(scoredRoute.busyMeters)} near busy roads.`);
  }

  return reasons.slice(0, 4);
}

export function buildRouteModes(routeAnalyses, preferences) {
  if (routeAnalyses.length === 0) return [];
  const accessibilityEvidence = hasAccessibilityEvidence(routeAnalyses);

  const modes = ROUTE_MODES.map(mode => {
    const weights = buildModeWeights(mode, preferences);
    const scoredCandidates = routeAnalyses.map(analysis => scoreRouteAnalysis(analysis, weights));
    const routeIndex = chooseRouteIndex(scoredCandidates);
    const scoredRoute = routeIndex >= 0 ? scoredCandidates[routeIndex] : null;
    return {
      ...mode,
      weights,
      routeIndex,
      scoredRoute,
      effectiveLength: scoredRoute ? scoredRoute.effective : Infinity
    };
  });

  const fastestMode = modes.find(mode => mode.id === 'fastest') || modes[0];
  const allModesUseSameRoute = modes.every(mode => mode.routeIndex === fastestMode.routeIndex);

  return modes.map(mode => {
    const sameAsFastest = mode.id !== 'fastest' && mode.routeIndex === fastestMode.routeIndex;
    const context = {
      hasAccessibilityEvidence: accessibilityEvidence,
      allModesUseSameRoute,
      sameAsFastest
    };

    return {
      ...mode,
      accessibilityEvidence,
      allModesUseSameRoute,
      sameAsFastest,
      candidateLabel: mode.routeIndex >= 0 ? `Candidate ${mode.routeIndex + 1} of ${routeAnalyses.length}` : 'No candidate',
      reasons: buildModeReasons(mode.scoredRoute, mode, context)
    };
  });
}
