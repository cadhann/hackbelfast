const MAX_ENTRIES = 24;
const cache = new Map();

function pointKey(p) {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

export function cacheKey(start, end) {
  return `${pointKey(start)}|${pointKey(end)}`;
}

export function getCached(key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function setCached(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}
