import { TIMED_ACCESS_PLACES, isOpenAt, minutesOfDay, nextOpenLabel } from '../config/timedAccess';
import { haversine } from '../utils/geo';

// Sample the polyline — every Nth coord — and check whether any sample is within
// a place's buffer. Returns the list of timed places the route enters.
function placesTouchedByRoute(routeCoords) {
  if (!Array.isArray(routeCoords) || routeCoords.length === 0) return [];
  const stride = Math.max(1, Math.floor(routeCoords.length / 80));
  const touched = new Set();
  for (let i = 0; i < routeCoords.length; i += stride) {
    const c = routeCoords[i];
    for (const place of TIMED_ACCESS_PLACES) {
      if (touched.has(place.id)) continue;
      if (haversine(c, place.center) <= place.radius) {
        touched.add(place.id);
      }
    }
  }
  // also test the last coord
  const last = routeCoords[routeCoords.length - 1];
  for (const place of TIMED_ACCESS_PLACES) {
    if (touched.has(place.id)) continue;
    if (haversine(last, place.center) <= place.radius) {
      touched.add(place.id);
    }
  }
  return TIMED_ACCESS_PLACES.filter(p => touched.has(p.id));
}

// Estimate when the user will reach the closest sample of a place along the route.
// arrivalMinutes is the minute-of-day they'd be at that point given departureMinutes
// and the route progression (we approximate using fraction of distance × duration).
function estimateArrivalAtPlace(routeCoords, place, departureMinutes, totalDurationS) {
  if (!routeCoords?.length) return departureMinutes;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < routeCoords.length; i++) {
    const d = haversine(routeCoords[i], place.center);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  const fraction = bestI / Math.max(1, routeCoords.length - 1);
  const offsetMin = (totalDurationS * fraction) / 60;
  return Math.round(departureMinutes + offsetMin) % (24 * 60);
}

/**
 * Evaluate timed-access conflicts for a route at a given departure time.
 * @param {Array<[number,number]>} routeCoords - polyline as [lat,lng] pairs
 * @param {Date} departureDate - when the journey starts
 * @param {number} totalDurationS - estimated walking duration in seconds
 * @returns {Array} conflicts [{ place, willBeOpen, arrivalLabel, hoursLabel }]
 */
export function evaluateRouteTimedClosures(routeCoords, departureDate, totalDurationS) {
  const places = placesTouchedByRoute(routeCoords);
  if (places.length === 0) return [];
  const depMin = minutesOfDay(departureDate);
  const depWeekday = departureDate.getDay();
  return places.map(place => {
    const arrivalMin = estimateArrivalAtPlace(routeCoords, place, depMin, totalDurationS);
    // Determine weekday for that arrival (rolls over if arrival next day)
    const dayOffset = arrivalMin < depMin ? 1 : 0;
    const arrivalWeekday = (depWeekday + dayOffset) % 7;
    const willBeOpen = isOpenAt(place, arrivalWeekday, arrivalMin);
    return {
      place,
      willBeOpen,
      arrivalLabel: minutesToHHMM(arrivalMin),
      hoursLabel: nextOpenLabel(place, arrivalWeekday)
    };
  });
}

function minutesToHHMM(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
