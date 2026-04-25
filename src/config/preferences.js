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
  lamp_bonus: 60
};

export const FILTERS = [
  {
    id: 'tactile',
    title: 'Tactile paving at crossings',
    desc: 'Penalise crossings without raised paving textures (blind / low vision).'
  },
  {
    id: 'audio',
    title: 'Audio + physical crossing cues',
    desc: 'Penalise crossings tagged as missing audible/vibrating signals.'
  },
  {
    id: 'kerb',
    title: 'Low curbs / dropped kerbs',
    desc: 'Penalise raised kerbs (wheelchair, stroller, mobility).'
  },
  {
    id: 'avoid_busy',
    title: 'Avoid busy multi-lane streets',
    desc: 'Penalise primary/secondary/trunk roads along the route.'
  },
  {
    id: 'avoid_steps',
    title: 'Avoid stairs / steps',
    desc: 'Strongly penalise highway=steps segments (wheelchair, stroller, cane).'
  },
  {
    id: 'pavement_width',
    title: 'Wider pavements',
    desc: 'Penalise footways tagged narrower than 1.5 m (wheelchair clearance).'
  },
  {
    id: 'streetlights',
    title: 'Well-lit streets',
    desc: 'Reward street lamps and lit=yes ways; penalise lit=no segments.'
  },
  {
    id: 'avoid_crash',
    title: 'Avoid collision-prone areas',
    desc: 'Coming soon — NI vehicle crash dataset not yet ingested.',
    disabled: true
  }
];
