// Belfast locations with gated / timed pedestrian access.
// Hours are best-effort approximations for routing demo purposes — not authoritative.
// Times are in 24-hour local time (Europe/London).

// Days: 0=Sun, 1=Mon … 6=Sat (matches JS Date.getDay)

export const TIMED_ACCESS_PLACES = [
  {
    id: 'botanic_gardens',
    name: 'Botanic Gardens',
    note: 'Park gates close around dusk — plan to be out before then.',
    // Approx centre + buffer covering the park footprint
    center: [54.5828, -5.9347],
    radius: 320,
    hours: { default: [['07:30', '21:00']] }
  },
  {
    id: 'belfast_castle',
    name: 'Belfast Castle Estate',
    note: 'Estate gates locked overnight.',
    center: [54.6398, -5.9543],
    radius: 380,
    hours: { default: [['09:00', '22:00']] }
  },
  {
    id: 'cave_hill',
    name: 'Cave Hill Country Park',
    note: 'Park closes at dusk; trails unlit.',
    center: [54.6492, -5.9568],
    radius: 600,
    hours: { default: [['06:00', '21:00']] }
  },
  {
    id: 'stormont_estate',
    name: 'Stormont Estate',
    note: 'Estate gates close late evening.',
    center: [54.6042, -5.8336],
    radius: 600,
    hours: { default: [['06:00', '22:00']] }
  },
  {
    id: 'ormeau_park',
    name: 'Ormeau Park',
    note: 'Park gates close at dusk.',
    center: [54.5816, -5.9123],
    radius: 380,
    hours: { default: [['07:30', '21:00']] }
  },
  {
    id: 'falls_park',
    name: 'Falls Park',
    note: 'Park gates close at dusk.',
    center: [54.5803, -5.9764],
    radius: 320,
    hours: { default: [['08:00', '21:00']] }
  },
  {
    id: 'lanark_way_gate',
    name: 'Lanark Way Peace Gate',
    note: 'Interface gate closes overnight; access can be cut earlier on Sundays.',
    center: [54.6000, -5.9606],
    radius: 90,
    hours: {
      // Mon-Thu: 06–22:00, Fri-Sat: 06–22:30, Sun: 09–18:00
      0: [['09:00', '18:00']],
      5: [['06:00', '22:30']],
      6: [['06:00', '22:30']],
      default: [['06:00', '22:00']]
    }
  },
  {
    id: 'workman_avenue_gate',
    name: 'Workman Avenue Peace Gate',
    note: 'Interface gate closes overnight.',
    center: [54.6027, -5.9556],
    radius: 90,
    hours: {
      0: [['09:00', '18:00']],
      default: [['07:00', '21:30']]
    }
  },
  {
    id: 'alexandra_park_gate',
    name: 'Alexandra Park Peace Gate',
    note: 'Interface gate inside the park closes around dusk.',
    center: [54.6195, -5.9290],
    radius: 100,
    hours: { default: [['09:00', '15:00']] }
  },
  {
    id: 'city_cemetery',
    name: 'City Cemetery',
    note: 'Cemetery gates close late afternoon.',
    center: [54.5870, -5.9760],
    radius: 240,
    hours: {
      0: [['08:00', '17:00']],
      6: [['08:00', '17:00']],
      default: [['08:00', '16:00']]
    }
  }
];

export function parseHHMM(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

export function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function intervalsForDay(place, weekday) {
  const h = place.hours || {};
  return h[weekday] || h.default || [];
}

// Returns true if `minutes` (0-1440) falls inside any open window for that weekday.
export function isOpenAt(place, weekday, minutes) {
  const intervals = intervalsForDay(place, weekday);
  if (intervals.length === 0) return false;
  for (const [openStr, closeStr] of intervals) {
    const open = parseHHMM(openStr);
    const close = parseHHMM(closeStr);
    if (open == null || close == null) continue;
    if (minutes >= open && minutes < close) return true;
  }
  return false;
}

export function nextOpenLabel(place, weekday) {
  const intervals = intervalsForDay(place, weekday);
  if (intervals.length === 0) return null;
  return `${intervals[0][0]}–${intervals[0][1]}`;
}
