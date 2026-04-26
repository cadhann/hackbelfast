// Walking pace presets and timing helpers.
// Pace values are conservative typical speeds in metres / second.

export const PACE_PRESETS = [
  { id: 'average',            label: 'Average walker',         mps: 1.40, hint: '5.0 km/h' },
  { id: 'accessible',         label: 'Slower / accessible',    mps: 1.25, hint: '4.5 km/h' },
  { id: 'pram',               label: 'With pram or buggy',     mps: 1.15, hint: '4.1 km/h' },
  { id: 'walking_aid',        label: 'With walking aid',       mps: 0.90, hint: '3.2 km/h' },
  { id: 'wheelchair_manual',  label: 'Manual wheelchair',      mps: 1.05, hint: '3.8 km/h' },
  { id: 'wheelchair_powered', label: 'Powered wheelchair',     mps: 1.55, hint: '5.6 km/h' },
  { id: 'custom',             label: 'Custom speed…',          mps: null, hint: '' }
];

export const DEFAULT_PACE_ID = 'accessible';

// Average wait time added per signalised pedestrian crossing (s).
export const SIGNAL_DELAY_S = 22;
// Small constant penalty per turn / maneuver to reflect intersection navigation (s).
export const TURN_DELAY_S = 4;
// Cap intersection penalties so very long routes don't double-count
export const MAX_INTERSECTION_PENALTY_S = 600;

const MIN_CUSTOM_MPS = 0.3;
const MAX_CUSTOM_MPS = 3.0;

export function clampCustomMps(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(MIN_CUSTOM_MPS, Math.min(MAX_CUSTOM_MPS, n));
}

export function paceById(id) {
  return PACE_PRESETS.find(p => p.id === id) || null;
}

export function resolvePaceMps(paceId, customMps) {
  if (paceId === 'custom') {
    const c = clampCustomMps(customMps);
    return c ?? PACE_PRESETS.find(p => p.id === DEFAULT_PACE_ID).mps;
  }
  const preset = paceById(paceId);
  return preset?.mps ?? PACE_PRESETS.find(p => p.id === DEFAULT_PACE_ID).mps;
}

export function mpsToKmh(mps) {
  return mps * 3.6;
}

// signalCount: number of signalised pedestrian crossings traversed.
// turnCount: count of maneuver steps (excluding depart/arrive).
export function adjustedDurationSeconds(route, paceMps, { signalCount = 0, turnCount = 0 } = {}) {
  if (!route || !Number.isFinite(route.distance)) return route?.duration || 0;
  const base = route.distance / Math.max(paceMps, 0.1);
  const intersectionPenalty = Math.min(
    MAX_INTERSECTION_PENALTY_S,
    signalCount * SIGNAL_DELAY_S + turnCount * TURN_DELAY_S
  );
  return base + intersectionPenalty;
}
