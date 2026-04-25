import { ROUTE_MODES } from '../config/routeModes';
import { formatDistance } from '../utils/format';
import { scoreRouteAnalysis } from './routeScoring';

const WEIGHT_KEYS = [
  'tactile',
  'audio',
  'kerb',
  'avoid_busy',
  'avoid_steps',
  'pavement_width',
  'streetlights',
  'surface_quality',
  'gentle_slope',
  'simple_navigation',
  'rest_points',
  'station_access',
  'verified_reports',
  'avoid_crash'
];

function buildModeWeights(mode, preferences) {
  const weights = {
    forbidden: mode.defaultWeights.forbidden || 0
  };

  for (const key of WEIGHT_KEYS) {
    const base = mode.defaultWeights[key] || 0;
    const boost = preferences[key] ? (mode.preferenceBoosts[key] || 0) : 0;
    weights[key] = base + boost;
  }

  return weights;
}

function chooseRouteIndex(scoredCandidates) {
  if (scoredCandidates.length === 0) return -1;

  let best = -1;
  for (let i = 0; i < scoredCandidates.length; i++) {
    const candidate = scoredCandidates[i];
    if (candidate.blocked) continue;
    if (best === -1) {
      best = i;
      continue;
    }

    const currentBest = scoredCandidates[best];
    if (candidate.effective < currentBest.effective - 1) {
      best = i;
      continue;
    }

    if (Math.abs(candidate.effective - currentBest.effective) <= 40) {
      if ((candidate.decisionWeight || 0) < (currentBest.decisionWeight || 0) - 0.1) {
        best = i;
        continue;
      }
      if (
        Math.abs((candidate.decisionWeight || 0) - (currentBest.decisionWeight || 0)) <= 0.1 &&
        ((candidate.reportIssueUnits || 0) + (candidate.crashRiskUnits || 0)) <
          (((currentBest.reportIssueUnits || 0) + (currentBest.crashRiskUnits || 0)) - 0.1)
      ) {
        best = i;
      }
    }
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
    const evidence = analysis.evidenceSummary || {};
    return (
      analysis.near.length > 0 ||
      analysis.busyMeters > 0 ||
      analysis.forbiddenMeters > 0 ||
      analysis.roughMeters > 0 ||
      analysis.steepMeters > 0 ||
      analysis.toiletCount > 0 ||
      analysis.seatingCount > 0 ||
      analysis.stationCount > 0 ||
      analysis.reportCount > 0 ||
      analysis.crashHotspotCount > 0 ||
      analysis.crashRiskMeters > 0 ||
      (analysis.decisionPoints || 0) > 0 ||
      Object.values(analysis.signals).some(Boolean) ||
      (evidence.known || 0) > 0 ||
      (evidence.reported || 0) > 0 ||
      (evidence.unknown || 0) > 0
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

function buildSelectionReason(mode, context) {
  if (!context.hasAccessibilityEvidence && mode.id !== 'fastest') {
    return 'No accessibility lookup data returned, so this mode falls back to distance-only ranking.';
  }
  if (context.sameAsFastest && context.allModesUseSameRoute) {
    return 'Same path as Fastest because the shortest route also scores best on the available accessibility signals.';
  }
  if (context.sameAsFastest) {
    return 'Same path as Fastest because no alternative scores better overall on the available accessibility signals.';
  }
  if (mode.id === 'fastest') {
    return 'Keeps the route as short as possible while applying a light version of the active accessibility preferences.';
  }
  if (mode.id === 'balanced') {
    return 'Balances distance with route conditions, support places, and the selected accessibility preferences.';
  }
  return 'Prioritizes route conditions, support places, and the selected accessibility preferences even when the route is longer.';
}

function buildScoreReason(scoredRoute) {
  const evidence = scoredRoute.evidenceSummary || {};
  const known = evidence.known || 0;
  const reported = evidence.reported || 0;
  const unknown = evidence.unknown || 0;

  if (scoredRoute.score !== null) {
    const parts = [];
    if (known > 0) parts.push(`${known} known signal${known === 1 ? '' : 's'}`);
    if (reported > 0) parts.push(`${reported} reported issue${reported === 1 ? '' : 's'}`);
    if (unknown > 0) parts.push(`${unknown} unknown item${unknown === 1 ? '' : 's'}`);
    if (parts.length > 0) {
      return `${parts.join(', ')} shape an accessibility score of ${formatAccessibilityScore(scoredRoute.score)}.`;
    }
    return `Available route conditions give an accessibility score of ${formatAccessibilityScore(scoredRoute.score)}.`;
  }

  if (reported > 0) {
    return `${pluralize(reported, 'reported issue')} were found near this route, but the available data is still too sparse for a score.`;
  }
  if (known > 0 || unknown > 0) {
    return 'Some route conditions are known, but the evidence is still too thin for a confident score.';
  }
  return 'No nearby accessibility evidence was found in the current data, so the score is unknown.';
}

function buildConditionReason(scoredRoute) {
  const parts = [];

  if (scoredRoute.stepsMeters > 0) parts.push(`${formatDistance(scoredRoute.stepsMeters)} of steps`);
  if (scoredRoute.roughMeters > 0) parts.push(`${formatDistance(scoredRoute.roughMeters)} of rough surface`);
  if (scoredRoute.steepMeters > 0) parts.push(`${formatDistance(scoredRoute.steepMeters)} of steeper gradient`);
  if ((scoredRoute.decisionPoints || 0) > 0) {
    parts.push(pluralize(scoredRoute.decisionPoints, 'decision point'));
  }

  if (parts.length === 0) return null;
  if (parts.length === 1) return `${parts[0]} add route complexity or physical effort.`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]} add route complexity or physical effort.`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]} add route complexity or physical effort.`;
}

function buildSupportReason(scoredRoute) {
  const parts = [];

  if (scoredRoute.toiletCount > 0) parts.push(pluralize(scoredRoute.toiletCount, 'toilet'));
  if (scoredRoute.seatingCount > 0) parts.push(pluralize(scoredRoute.seatingCount, 'seating point'));
  if (scoredRoute.accessibleStationCount > 0) parts.push(pluralize(scoredRoute.accessibleStationCount, 'accessible station link'));

  if (parts.length === 0) return null;
  if (parts.length === 1) return `${parts[0]} sit close to this route as support places.`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]} sit close to this route as support places.`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]} sit close to this route as support places.`;
}

function buildExposureReason(scoredRoute) {
  if (scoredRoute.blocked) {
    return `Only restricted candidates are available; this one has ${Math.round(scoredRoute.forbiddenMeters)} m flagged near restricted ways.`;
  }
  if (scoredRoute.reportCount > 0) {
    const verified = scoredRoute.verifiedReportCount || 0;
    return `${pluralize(scoredRoute.reportCount, 'community report')} are near this route${verified > 0 ? `, including ${verified} verified` : ''}.`;
  }
  if (scoredRoute.crashHotspotCount > 0) {
    const severe = scoredRoute.severeCrashHotspotCount || 0;
    return `${pluralize(scoredRoute.crashHotspotCount, 'crash-risk hotspot')} are near this route${severe > 0 ? `, including ${severe} higher-risk junction${severe === 1 ? '' : 's'}` : ''}.`;
  }
  if (scoredRoute.crashRiskMeters > 0) {
    return `${formatDistance(scoredRoute.crashRiskMeters)} follows higher-risk road approaches or junction corridors.`;
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
  return null;
}

function buildTrustReason(scoredRoute) {
  const unknown = scoredRoute.evidenceSummary?.unknown || 0;
  if (unknown > 0) {
    return `${pluralize(unknown, 'signal')} are still unknown, so this recommendation stays cautious where data is sparse.`;
  }
  return null;
}

function buildModeReasons(scoredRoute, mode, context) {
  if (!scoredRoute) return [];

  const reasons = [
    buildSelectionReason(mode, context),
    buildScoreReason(scoredRoute),
    buildConditionReason(scoredRoute),
    buildSupportReason(scoredRoute),
    buildExposureReason(scoredRoute),
    buildTrustReason(scoredRoute)
  ].filter(Boolean);

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
