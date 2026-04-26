export const PENALTIES = {
  tactile_missing: 600,
  tactile_bonus: 200,
  audio_missing: 350,
  audio_bonus: 200,
  kerb_raised: 600,
  kerb_bonus: 150,
  busy_per_meter: 6,
  forbidden_per_meter: 8,
  steps_per_meter: 14,
  narrow_per_meter: 5,
  unlit_per_meter: 3,
  lit_per_meter_bonus: 1,
  lamp_bonus: 60,
  accessible_toilet_bonus: 180,
  toilet_bonus: 90,
  seating_bonus: 75,
  accessible_station_bonus: 220,
  inaccessible_station_penalty: 220,
  crash_risk_unit: 220,
  rough_surface_per_meter: 6,
  smooth_surface_per_meter_bonus: 1.5,
  steep_per_meter: 10,
  gentle_per_meter_bonus: 1.25,
  report_issue_unit: 180,
  report_clear_bonus: 90,
  decision_point_penalty: 40,
  complex_junction_penalty: 120,
  // Shopping-streets vs housing-estates bias.
  residential_per_meter: 1.5,
  service_per_meter: 3,
  pedestrian_per_meter_bonus: 2,
  shop_density_bonus: 80,
  park_per_meter_bonus: 2
};

export const FILTERS = [
  {
    id: 'tactile',
    title: 'Tactile paving at crossings',
    desc: 'Penalise crossings tagged without tactile paving.'
  },
  {
    id: 'audio',
    title: 'Audio + physical crossing cues',
    desc: 'Penalise crossings tagged as missing audible signals.'
  },
  {
    id: 'kerb',
    title: 'Low curbs / dropped kerbs',
    desc: 'Penalise raised kerbs on crossings and approaches.'
  },
  {
    id: 'avoid_busy',
    title: 'Avoid busy multi-lane streets',
    desc: 'Penalise primary, trunk, and other busier road links.'
  },
  {
    id: 'avoid_steps',
    title: 'Avoid stairs / steps',
    desc: 'Strongly penalise route segments tagged as steps.'
  },
  {
    id: 'pavement_width',
    title: 'Wider pavements',
    desc: 'Penalise narrower footways where width data is available.'
  },
  {
    id: 'streetlights',
    title: 'Well-lit streets',
    desc: 'Reward lit segments and street lamps; penalise unlit stretches.'
  },
  {
    id: 'surface_quality',
    title: 'Smoother surfaces',
    desc: 'Penalise rough or uneven surfaces such as setts, gravel, and bad smoothness tags.'
  },
  {
    id: 'gentle_slope',
    title: 'Gentler gradients',
    desc: 'Penalise steeper segments and prefer flatter links where known.'
  },
  {
    id: 'simple_navigation',
    title: 'Simpler route changes',
    desc: 'Prefer routes with fewer decision points and less junction complexity.'
  },
  {
    id: 'rest_points',
    title: 'Toilets + seating nearby',
    desc: 'Reward routes that stay close to toilets and seating where known.'
  },
  {
    id: 'station_access',
    title: 'Accessible station links',
    desc: 'Reward routes that stay close to step-free or wheelchair-friendly station access.'
  },
  {
    id: 'verified_reports',
    title: 'Use route reports cautiously',
    desc: 'Penalise routes with recent verified issue reports and surface community notes.'
  },
  {
    id: 'avoid_crash',
    title: 'Avoid collision-prone areas',
    desc: 'Penalise known crash-risk hotspots and difficult junctions where collisions are more common.'
  },
  {
    id: 'prefer_shopping',
    title: 'Streets with shops & cafes',
    desc: 'Prefer high-street stretches with shops, cafes and pedestrianised areas over housing estates or service alleys.'
  },
  {
    id: 'prefer_pleasant',
    title: 'Pleasant walks (parks & pedestrian zones)',
    desc: 'Reward routes along park edges, pedestrian streets and lively areas, even when slightly longer.'
  }
];
