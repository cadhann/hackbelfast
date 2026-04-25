import { BELFAST_BOUNDS } from '../config/map';
import { DESTINATIONS } from '../data/destinations';
import { haversine } from '../utils/geo';
import { friendlyFetchError } from './http';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;
const LOCAL_SEARCH_LIMIT = 3;
const REMOTE_MIN_QUERY_CHARS = 3;
const SEARCH_TIMEOUT_MS = 15000;
const REVERSE_TIMEOUT_MS = 15000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const REVERSE_CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_REMOTE_INTERVAL_MS = 350;
const NEARBY_SEED_MATCH_METERS = 250;
const AREA_SEED_MATCH_METERS = 1000;
const DIRECT_GEOCODER_BASE = 'https://nominatim.openstreetmap.org';
const LOCAL_SOURCE = 'destinations_seed';
const REMOTE_SOURCE = 'nominatim';
const PIN_SOURCE = 'manual_pin';

const SEARCH_CACHE = new Map();
const REVERSE_CACHE = new Map();
const INFLIGHT_REQUESTS = new Map();
let nextRemoteSlotAt = 0;
let lastGeocodingIssue = null;

const SEED_RESULTS = DESTINATIONS
  .filter(item => isInsideBelfast(item.lat, item.lng))
  .map(normalizeSeedResult);

function isLocalDevHost() {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function getGeocoderBases() {
  const configuredBase = typeof import.meta !== 'undefined'
    ? (import.meta.env.VITE_GEOCODER_BASE_URL || '').trim()
    : '';
  if (configuredBase) {
    return isLocalDevHost() ? uniqueStrings(['/api/geocode', configuredBase]) : [configuredBase];
  }
  return isLocalDevHost() ? ['/api/geocode', DIRECT_GEOCODER_BASE] : [DIRECT_GEOCODER_BASE];
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clampLimit(limit) {
  const numeric = Number.parseInt(limit, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, numeric);
}

function getBounds() {
  const [[south, west], [north, east]] = BELFAST_BOUNDS;
  return { south, west, north, east };
}

function getViewbox() {
  const { south, west, north, east } = getBounds();
  return `${west},${north},${east},${south}`;
}

export function isInsideBelfast(lat, lng) {
  const { south, west, north, east } = getBounds();
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

function normalizeWhitespace(value) {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function humanizeToken(value) {
  const cleaned = normalizeWhitespace(value)
    .replace(/_/g, ' ')
    .replace(/\bpoi\b/gi, 'POI');
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getPrimaryName(result) {
  const address = result.address || {};
  const candidates = [
    result.name,
    address.amenity,
    address.tourism,
    address.attraction,
    address.building,
    address.shop,
    address.leisure,
    address.office,
    address.road,
    address.pedestrian,
    address.footway,
    address.cycleway,
    address.path,
    address.neighbourhood,
    address.suburb,
    result.display_name ? result.display_name.split(',')[0] : ''
  ];

  for (const candidate of candidates) {
    const text = normalizeWhitespace(candidate);
    if (text) return text;
  }
  return 'Dropped pin';
}

function getResultType(result) {
  const address = result.address || {};
  const rawType = normalizeWhitespace(
    result.addresstype ||
    result.type ||
    result.class ||
    address.amenity ||
    address.tourism ||
    address.building ||
    address.railway
  );
  return humanizeToken(rawType || 'Place');
}

function getAreaLabel(result) {
  const address = result.address || {};
  const candidates = [
    address.suburb,
    address.city_district,
    address.neighbourhood,
    address.quarter,
    address.city,
    address.town,
    address.village,
    address.county
  ];
  for (const candidate of candidates) {
    const text = normalizeWhitespace(candidate);
    if (text) return text;
  }
  return 'Belfast';
}

function getContextLabel(result, primaryName) {
  const displayName = normalizeWhitespace(result.display_name);
  if (!displayName) return '';
  const parts = displayName
    .split(',')
    .map(part => normalizeWhitespace(part))
    .filter(Boolean);
  if (parts.length <= 1) return '';
  return parts
    .slice(1)
    .filter(part => part !== primaryName)
    .slice(0, 3)
    .join(', ');
}

function normalizeRemoteResult(result) {
  const lat = Number.parseFloat(result.lat);
  const lng = Number.parseFloat(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isInsideBelfast(lat, lng)) return null;
  const name = getPrimaryName(result);

  return {
    id: `${REMOTE_SOURCE}:${result.osm_type || 'place'}:${result.osm_id || result.place_id || `${lat},${lng}`}`,
    name,
    type: getResultType(result),
    area: getAreaLabel(result),
    lat,
    lng,
    source: 'live',
    sourceLabel: 'Live',
    context: getContextLabel(result, name),
    displayName: normalizeWhitespace(result.display_name)
  };
}

function normalizeSeedResult(result) {
  return {
    id: result.id || `${LOCAL_SOURCE}:${result.name}:${result.lat}:${result.lng}`,
    name: result.name,
    type: result.type || 'Place',
    area: result.area || 'Belfast',
    lat: Number.parseFloat(result.lat),
    lng: Number.parseFloat(result.lng),
    source: 'seed',
    sourceLabel: 'Seeded'
  };
}

function readCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) return { hit: false, value: null };
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

function writeCache(cache, key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function onceInflight(key, task) {
  if (INFLIGHT_REQUESTS.has(key)) return INFLIGHT_REQUESTS.get(key);
  const promise = Promise.resolve()
    .then(task)
    .finally(() => INFLIGHT_REQUESTS.delete(key));
  INFLIGHT_REQUESTS.set(key, promise);
  return promise;
}

function makeAbortError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function waitFor(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(makeAbortError('Request cancelled'));
    }

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(makeAbortError('Request cancelled'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

async function waitForRemoteSlot(signal) {
  const waitMs = Math.max(0, nextRemoteSlotAt - Date.now());
  await waitFor(waitMs, signal);
  nextRemoteSlotAt = Date.now() + MIN_REMOTE_INTERVAL_MS;
}

async function fetchGeocoderJson(url, { signal, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let removeAbortListener = null;

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeout);
      throw makeAbortError('Request cancelled');
    }
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener('abort', onAbort);
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-GB,en;q=0.9'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new Error('non-JSON response');
    }
  } catch (error) {
    if (signal?.aborted) throw makeAbortError('Request cancelled');
    if (error?.name === 'AbortError') throw makeAbortError('request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
    removeAbortListener?.();
  }
}

async function fetchFirstSuccessful(pathname, params, timeoutMs, signal) {
  const attempts = [];
  const query = params.toString();
  for (const base of getGeocoderBases()) {
    const url = `${base}${pathname}?${query}`;
    try {
      await waitForRemoteSlot(signal);
      return await fetchGeocoderJson(url, { signal, timeoutMs });
    } catch (error) {
      if (signal?.aborted) throw error;
      attempts.push(`${url}: ${friendlyFetchError(error)}`);
    }
  }

  const detail = attempts[attempts.length - 1] || 'no endpoint attempted';
  throw new Error(`Geocoder unavailable (${detail})`);
}

function resultDedupeKey(result) {
  return [
    normalizeWhitespace(result.name).toLowerCase(),
    Number(result.lat).toFixed(5),
    Number(result.lng).toFixed(5)
  ].join('|');
}

function dedupeResults(results) {
  const seen = new Set();
  const unique = [];
  for (const result of results) {
    if (!result) continue;
    const key = resultDedupeKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return unique;
}

function scoreSeedMatch(result, query) {
  const q = normalizeWhitespace(query).toLowerCase();
  if (!q) return 0;
  const aliases = (DESTINATIONS.find(item => item.id === result.id)?.aliases || []).map(alias => alias.toLowerCase());
  const name = result.name.toLowerCase();
  const type = result.type.toLowerCase();
  const area = result.area.toLowerCase();
  const haystack = [name, type, area, ...aliases].join(' ');
  const words = q.split(' ').filter(Boolean);
  if (name === q || aliases.includes(q)) return 0;
  if (name.startsWith(q)) return 1;
  if (aliases.some(alias => alias.startsWith(q))) return 2;
  if (words.every(word => haystack.includes(word))) return 3;
  if (haystack.includes(q)) return 4;
  return Infinity;
}

function searchSeedResults(query, limit = DEFAULT_LIMIT) {
  const q = normalizeWhitespace(query);
  if (!q) return SEED_RESULTS.slice(0, limit);

  return SEED_RESULTS
    .map(result => ({ result, score: scoreSeedMatch(result, q) }))
    .filter(entry => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.result.name.localeCompare(b.result.name))
    .slice(0, limit)
    .map(entry => entry.result);
}

async function fetchRemoteSearch(query, limit, signal) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: `${limit}`,
    bounded: '1',
    viewbox: getViewbox(),
    countrycodes: 'gb',
    addressdetails: '1',
    dedupe: '1'
  });

  const data = await fetchFirstSuccessful('/search', params, SEARCH_TIMEOUT_MS, signal);
  return Array.isArray(data) ? data.map(normalizeRemoteResult).filter(Boolean) : [];
}

function buildDroppedPin(lat, lng, nearestSeed = null) {
  const roundedLat = lat.toFixed(5);
  const roundedLng = lng.toFixed(5);
  if (nearestSeed?.distanceMeters <= NEARBY_SEED_MATCH_METERS) {
    return {
      id: `${PIN_SOURCE}:${roundedLat}:${roundedLng}`,
      name: `Near ${nearestSeed.result.name}`,
      type: nearestSeed.result.type,
      area: nearestSeed.result.area,
      lat,
      lng,
      source: 'pin',
      sourceLabel: 'Pin'
    };
  }
  return {
    id: `${PIN_SOURCE}:${roundedLat}:${roundedLng}`,
    name: 'Dropped pin',
    type: 'Location',
    area: nearestSeed?.distanceMeters <= AREA_SEED_MATCH_METERS ? nearestSeed.result.area : 'Belfast',
    lat,
    lng,
    source: 'pin',
    sourceLabel: 'Pin'
  };
}

function nearestSeedResult(lat, lng) {
  let closest = null;
  for (const result of SEED_RESULTS) {
    const distanceMeters = haversine([lat, lng], [result.lat, result.lng]);
    if (!closest || distanceMeters < closest.distanceMeters) {
      closest = { result, distanceMeters };
    }
  }
  return closest;
}

async function fetchRemoteReverse(lat, lng, signal) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: `${lat}`,
    lon: `${lng}`,
    zoom: '18',
    addressdetails: '1'
  });

  const data = await fetchFirstSuccessful('/reverse', params, REVERSE_TIMEOUT_MS, signal);
  return data ? normalizeRemoteResult(data) : null;
}

export async function searchBelfastPlaces(query, { limit = DEFAULT_LIMIT, signal } = {}) {
  const normalizedQuery = normalizeWhitespace(query);
  const normalizedLimit = clampLimit(limit);
  const cacheKey = `search:${normalizedQuery.toLowerCase()}:${normalizedLimit}`;
  const cached = readCache(SEARCH_CACHE, cacheKey);
  if (cached.hit) return cached.value;

  return onceInflight(cacheKey, async () => {
    const seedResults = searchSeedResults(normalizedQuery, Math.min(LOCAL_SEARCH_LIMIT, normalizedLimit));
    if (!normalizedQuery) {
      lastGeocodingIssue = null;
      writeCache(SEARCH_CACHE, cacheKey, seedResults, SEARCH_CACHE_TTL_MS);
      return seedResults;
    }

    if (normalizedQuery.length < REMOTE_MIN_QUERY_CHARS) {
      lastGeocodingIssue = null;
      writeCache(SEARCH_CACHE, cacheKey, seedResults, SEARCH_CACHE_TTL_MS);
      return seedResults;
    }

    try {
      const remoteResults = await fetchRemoteSearch(normalizedQuery, normalizedLimit, signal);
      const mergedResults = dedupeResults([...seedResults, ...remoteResults]).slice(0, normalizedLimit);
      const finalResults = mergedResults.length > 0 ? mergedResults : seedResults;
      lastGeocodingIssue = null;
      writeCache(SEARCH_CACHE, cacheKey, finalResults, SEARCH_CACHE_TTL_MS);
      return finalResults;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastGeocodingIssue = friendlyFetchError(error);
      writeCache(SEARCH_CACHE, cacheKey, seedResults, 30000);
      return seedResults;
    }
  });
}

export async function reverseGeocodeBelfast(point, { signal } = {}) {
  const lat = Number.parseFloat(point?.lat);
  const lng = Number.parseFloat(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isInsideBelfast(lat, lng)) return null;

  const cacheKey = `reverse:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = readCache(REVERSE_CACHE, cacheKey);
  if (cached.hit) return cached.value;

  return onceInflight(cacheKey, async () => {
    const nearestSeed = nearestSeedResult(lat, lng);
    try {
      const remoteResult = await fetchRemoteReverse(lat, lng, signal);
      const finalResult = remoteResult || buildDroppedPin(lat, lng, nearestSeed);
      lastGeocodingIssue = null;
      writeCache(REVERSE_CACHE, cacheKey, finalResult, REVERSE_CACHE_TTL_MS);
      return finalResult;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastGeocodingIssue = friendlyFetchError(error);
      const fallback = buildDroppedPin(lat, lng, nearestSeed);
      writeCache(REVERSE_CACHE, cacheKey, fallback, Math.max(60000, REVERSE_CACHE_TTL_MS / 2));
      return fallback;
    }
  });
}

export function clearGeocodingCache() {
  SEARCH_CACHE.clear();
  REVERSE_CACHE.clear();
  INFLIGHT_REQUESTS.clear();
  lastGeocodingIssue = null;
  nextRemoteSlotAt = 0;
}

export function getLastGeocodingIssue() {
  return lastGeocodingIssue;
}

export async function searchPlaces(query, options = {}) {
  const results = await searchBelfastPlaces(query, options);
  const issue = getLastGeocodingIssue();
  const attemptedRemote = normalizeWhitespace(query).length >= REMOTE_MIN_QUERY_CHARS;
  const hasLiveResult = results.some(result => result?.source === 'live');
  return {
    results,
    warning: attemptedRemote && issue && !hasLiveResult
      ? `Live Belfast search is unavailable right now (${issue}).`
      : null
  };
}

export async function reverseGeocodePoint(point, options = {}) {
  return reverseGeocodeBelfast(point, options);
}

export function coordinateLabel(point) {
  return `${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}`;
}
