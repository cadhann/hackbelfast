export const ROUTE_MODES = [
  {
    id: 'fastest',
    title: 'Fastest',
    shortLabel: 'Shortest walk',
    description: 'Minimizes distance first while still applying a light version of the active accessibility preferences.',
    defaultWeights: {
      tactile: 0, audio: 0, kerb: 0,
      avoid_busy: 0, avoid_steps: 0, pavement_width: 0, streetlights: 0,
      surface_quality: 0, gentle_slope: 0, simple_navigation: 0,
      rest_points: 0, station_access: 0, verified_reports: 0, avoid_crash: 0,
      forbidden: 0
    },
    preferenceBoosts: {
      tactile: 0.12, audio: 0.09, kerb: 0.12,
      avoid_busy: 0.08, avoid_steps: 0.16, pavement_width: 0.08, streetlights: 0.08,
      surface_quality: 0.1, gentle_slope: 0.1, simple_navigation: 0.1,
      rest_points: 0.08, station_access: 0.08, verified_reports: 0.1, avoid_crash: 0.14,
      forbidden: 0
    }
  },
  {
    id: 'balanced',
    title: 'Balanced',
    shortLabel: 'Direct + usable',
    description: 'Keeps the route direct while applying a lighter accessibility preference weighting.',
    defaultWeights: {
      tactile: 0.25, audio: 0.15, kerb: 0.25,
      avoid_busy: 0.2, avoid_steps: 0.3, pavement_width: 0.15, streetlights: 0.15,
      surface_quality: 0.2, gentle_slope: 0.2, simple_navigation: 0.2,
      rest_points: 0.15, station_access: 0.18, verified_reports: 0.2, avoid_crash: 0.25,
      forbidden: 0.6
    },
    preferenceBoosts: {
      tactile: 0.25, audio: 0.2, kerb: 0.25,
      avoid_busy: 0.2, avoid_steps: 0.3, pavement_width: 0.25, streetlights: 0.25,
      surface_quality: 0.3, gentle_slope: 0.3, simple_navigation: 0.35,
      rest_points: 0.25, station_access: 0.3, verified_reports: 0.35, avoid_crash: 0.35,
      forbidden: 0
    }
  },
  {
    id: 'beacon',
    title: 'Beacon Accessible',
    shortLabel: 'Confidence first',
    description: 'Prioritizes the selected accessibility preferences, even when the route is slightly longer.',
    defaultWeights: {
      tactile: 0.7, audio: 0.55, kerb: 0.7,
      avoid_busy: 0.45, avoid_steps: 0.7, pavement_width: 0.45, streetlights: 0.4,
      surface_quality: 0.6, gentle_slope: 0.6, simple_navigation: 0.55,
      rest_points: 0.45, station_access: 0.5, verified_reports: 0.55, avoid_crash: 0.65,
      forbidden: 1.1
    },
    preferenceBoosts: {
      tactile: 0.5, audio: 0.45, kerb: 0.5,
      avoid_busy: 0.45, avoid_steps: 0.6, pavement_width: 0.55, streetlights: 0.55,
      surface_quality: 0.55, gentle_slope: 0.55, simple_navigation: 0.65,
      rest_points: 0.45, station_access: 0.55, verified_reports: 0.6, avoid_crash: 0.7,
      forbidden: 0
    }
  }
];

export const DEFAULT_ROUTE_MODE_ID = 'beacon';
