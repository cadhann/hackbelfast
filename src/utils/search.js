import { DESTINATIONS } from '../data/destinations';

export function searchDestinations(query) {
  const q = query.trim().toLowerCase();
  const matches = q
    ? DESTINATIONS.filter(d => {
        const haystack = [d.name, d.type, d.area, ...(d.aliases || [])].join(' ').toLowerCase();
        return haystack.includes(q);
      })
    : DESTINATIONS;
  return matches.slice(0, 5);
}
