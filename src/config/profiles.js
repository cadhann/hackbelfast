// Bundled profiles. Selecting a profile applies pace + filters + recommended mode,
// but every individual control remains independently toggleable afterwards.

const ALL_FILTERS_OFF = {
  tactile: false,
  audio: false,
  kerb: false,
  avoid_busy: false,
  avoid_steps: false,
  pavement_width: false,
  streetlights: false,
  surface_quality: false,
  gentle_slope: false,
  simple_navigation: false,
  rest_points: false,
  station_access: false,
  verified_reports: false,
  avoid_crash: false,
  prefer_shopping: false,
  prefer_pleasant: false
};

function withFilters(overrides) {
  return { ...ALL_FILTERS_OFF, ...overrides };
}

export const PROFILES = [
  {
    id: 'default',
    label: 'Default',
    icon: '🚶',
    description: 'Balanced settings for most walkers.',
    paceId: 'accessible',
    customPaceMps: null,
    modeId: 'balanced',
    // Default profile keeps a light preference for high-street stretches so
    // walkers aren't routed through housing estates by accident.
    filters: withFilters({ avoid_busy: true, prefer_shopping: true })
  },
  {
    id: 'wheelchair',
    label: 'Wheelchair',
    icon: '♿',
    description: 'Step-free, low kerbs, even surfaces, gentle slopes.',
    paceId: 'wheelchair_manual',
    customPaceMps: null,
    modeId: 'beacon',
    filters: withFilters({
      kerb: true,
      avoid_steps: true,
      pavement_width: true,
      surface_quality: true,
      gentle_slope: true,
      avoid_busy: true
    })
  },
  {
    id: 'blind',
    label: 'Blind / low vision',
    icon: '🦯',
    description: 'Tactile paving, audible signals, simple navigation, well lit.',
    paceId: 'accessible',
    customPaceMps: null,
    modeId: 'beacon',
    filters: withFilters({
      tactile: true,
      audio: true,
      simple_navigation: true,
      streetlights: true,
      avoid_busy: true
    })
  },
  {
    id: 'pram',
    label: 'With pram',
    icon: '👶',
    description: 'No steps, low kerbs, wider footways, smoother surfaces.',
    paceId: 'pram',
    customPaceMps: null,
    modeId: 'balanced',
    filters: withFilters({
      kerb: true,
      avoid_steps: true,
      pavement_width: true,
      surface_quality: true
    })
  },
  {
    id: 'older',
    label: 'Older walker',
    icon: '👵',
    description: 'Slower pace with rest points, gentle slopes, quieter streets.',
    paceId: 'walking_aid',
    customPaceMps: null,
    modeId: 'balanced',
    filters: withFilters({
      rest_points: true,
      gentle_slope: true,
      avoid_busy: true,
      kerb: true
    })
  },
  {
    id: 'pleasant',
    label: 'Pleasant',
    icon: '🌳',
    description: 'Lively shop streets, park edges and pedestrian zones — even if a bit longer.',
    paceId: 'average',
    customPaceMps: null,
    modeId: 'balanced',
    filters: withFilters({
      streetlights: true,
      gentle_slope: true,
      prefer_shopping: true,
      prefer_pleasant: true
    })
  },
  {
    id: 'quickest',
    label: 'Quickest',
    icon: '⚡',
    description: 'Shortest walking time — fewer accessibility nudges.',
    paceId: 'average',
    customPaceMps: null,
    modeId: 'fastest',
    filters: withFilters({})
  }
];

export const DEFAULT_PROFILE_ID = 'default';

export function getProfileById(id) {
  return PROFILES.find(p => p.id === id) || null;
}

// Compare current state against a profile. Returns true if every value matches.
export function matchesProfile(profile, { paceId, customPaceMps, modeId, filters }) {
  if (!profile) return false;
  if (profile.paceId !== paceId) return false;
  if ((profile.customPaceMps ?? null) !== (customPaceMps ?? null)) return false;
  if (profile.modeId !== modeId) return false;
  for (const key of Object.keys(profile.filters)) {
    if (!!profile.filters[key] !== !!filters[key]) return false;
  }
  return true;
}
