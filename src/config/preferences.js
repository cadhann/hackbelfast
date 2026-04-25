export const PENALTIES = {
  tactile_missing: 600,
  tactile_bonus: 200,
  audio_missing: 350,
  audio_bonus: 200,
  kerb_raised: 600,
  kerb_bonus: 150,
  busy_per_meter: 6
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
    desc: 'Penalise crossings without audible/vibrating signals.'
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
    id: 'avoid_crash',
    title: 'Avoid collision-prone areas',
    desc: 'Display-only — NI vehicle crash dataset not yet ingested.'
  }
];
