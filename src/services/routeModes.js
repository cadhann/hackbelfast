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

function formatAccessibilityScore(score) {
  if (score === null) return 'unknown';
  return `${Math.round(score * 100)} / 100`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getCrossingCount(scoredRoute) {
  return scoredRoute.signals.crossings || 0;
}

function buildSelectionReason(mode, context) {
  if (!context.hasAccessibilityEvidence && mode.id !== 'fastest') {
    return 'No accessibility lookup data returned, so this mode falls back to distance-only ranking.';
  }
  if (context.sameAsFastest && context.allModesUseSameRoute) {
    return 'Same path as Fastest because the direct route also scores best for accessibility.';
  }
  if (context.sameAsFastest) {
    return 'Same path as Fastest because no accessible alternative scores better overall.';
  }
  if (mode.id === 'fastest') {
    return 'Chooses the shortest walking route before applying accessibility preferences.';
  }
  if (mode.id === 'balanced') {
    return 'Balances distance with the selected accessibility preferences.';
  }
  return 'Prioritizes the selected accessibility preferences, even when the route is longer.';
}

function buildScoreReason(scoredRoute) {
  const crossings = getCrossingCount(scoredRoute);
  if (scoredRoute.score !== null && crossings > 0) {
    return `${pluralize(crossings, 'crossing')} checked; known map tags give an accessibility score of ${formatAccessibilityScore(scoredRoute.score)}.`;
  }
  if (scoredRoute.score !== null) {
    return `No crossings were found, but nearby kerb or access tags give an accessibility score of ${formatAccessibilityScore(scoredRoute.score)}.`;
  }
  if (crossings > 0) {
    return `${pluralize(crossings, 'crossing')} checked, but tactile, audio, and kerb tags are too sparse for a score.`;
  }
  return 'No nearby crossings were found in the map data, so the accessibility score is unknown.';
}

function buildSignalReason(scoredRoute) {
  const signals = scoredRoute.signals;
  const helpful = signals.tactileYes + signals.audioYes + signals.kerbLow;
  const difficult = signals.tactileNo + signals.audioNo + signals.kerbHigh;
  const unknown = signals.tactileUnknown + signals.kerbUnknown;

  if (helpful > 0 && difficult > 0) {
    return `${pluralize(helpful, 'supportive tag')} and ${pluralize(difficult, 'missing or difficult tag')} pull the score in opposite directions.`;
  }
  if (helpful > 0) {
    return `${pluralize(helpful, 'supportive tag')} such as tactile paving, audio signals, or lowered kerbs improve the score.`;
  }
  if (difficult > 0) {
    return `${pluralize(difficult, 'missing or difficult tag')} such as absent tactile paving or raised kerbs lower the score.`;
  }
  if (unknown > 0) {
    return `${pluralize(unknown, 'nearby feature')} need better tagging, so the score stays cautious.`;
  }
  return null;
}

function buildExposureReason(scoredRoute) {
  if (scoredRoute.blocked) {
    return `Only restricted candidates are available; this one has ${Math.round(scoredRoute.forbiddenMeters)} m flagged.`;
  }
  if (scoredRoute.forbiddenMeters > 0 && scoredRoute.busyMeters > 0) {
    return `${formatDistance(scoredRoute.forbiddenMeters)} near restricted ways and ${formatDistance(scoredRoute.busyMeters)} near busy roads add risk.`;
  }
  if (scoredRoute.forbiddenMeters > 0) {
    return `${formatDistance(scoredRoute.forbiddenMeters)} runs near restricted ways, which lowers accessibility confidence.`;
  }
  if (scoredRoute.busyMeters > 0) {
    return `${formatDistance(scoredRoute.busyMeters)} runs near busy roads, which matters when avoiding traffic exposure.`;
  }
  return 'No restricted-way proximity was detected on this candidate.';
}

function buildModeReasons(scoredRoute, mode, context) {
  if (!scoredRoute) return [];

  return [
    buildSelectionReason(mode, context),
    buildScoreReason(scoredRoute),
    buildSignalReason(scoredRoute),
    buildExposureReason(scoredRoute)
  ].filter(Boolean).slice(0, 4);
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
