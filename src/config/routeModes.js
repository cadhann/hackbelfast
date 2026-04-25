export const ROUTE_MODES = [
  {
    id: 'fastest',
    title: 'Fastest',
    shortLabel: 'Shortest walk',
    description: 'Minimizes distance first. Accessibility signals are shown, but do not drive the choice.',
    defaultWeights: {
      tactile: 0,
      audio: 0,
      kerb: 0,
      avoid_busy: 0,
      forbidden: 0
    },
    preferenceBoosts: {
      tactile: 0,
      audio: 0,
      kerb: 0,
      avoid_busy: 0,
      forbidden: 0
    }
  },
  {
    id: 'balanced',
    title: 'Balanced',
    shortLabel: 'Direct + usable',
    description: 'Keeps the route direct while applying a lighter accessibility preference weighting.',
    defaultWeights: {
      tactile: 0.25,
      audio: 0.15,
      kerb: 0.25,
      avoid_busy: 0.2,
      forbidden: 0.6
    },
    preferenceBoosts: {
      tactile: 0.25,
      audio: 0.2,
      kerb: 0.25,
      avoid_busy: 0.2,
      forbidden: 0
    }
  },
  {
    id: 'beacon',
    title: 'Beacon Accessible',
    shortLabel: 'Confidence first',
    description: 'Prioritizes the selected accessibility preferences, even when the route is slightly longer.',
    defaultWeights: {
      tactile: 0.7,
      audio: 0.55,
      kerb: 0.7,
      avoid_busy: 0.45,
      forbidden: 1.1
    },
    preferenceBoosts: {
      tactile: 0.5,
      audio: 0.45,
      kerb: 0.5,
      avoid_busy: 0.45,
      forbidden: 0
    }
  }
];

export const DEFAULT_ROUTE_MODE_ID = 'beacon';
