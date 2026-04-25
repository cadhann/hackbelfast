import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import './App.css';

const BELFAST = [54.5973, -5.9301];
const BELFAST_BOUNDS = L.latLngBounds([54.52, -6.10], [54.68, -5.78]);

const PENALTIES = {
  tactile_missing: 600,
  tactile_bonus: 200,
  audio_missing: 350,
  audio_bonus: 200,
  kerb_raised: 600,
  kerb_bonus: 150,
  busy_per_meter: 6
};

const FILTERS = [
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

const OVERPASS_TIMEOUT_MS = 30000;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://h24.atownsend.org.uk/api/interpreter'
];

function isLocalDevHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function getOverpassEndpoints() {
  return isLocalDevHost() ? ['/api/overpass', ...OVERPASS_ENDPOINTS] : OVERPASS_ENDPOINTS;
}

function friendlyFetchError(error) {
  if (error.name === 'AbortError') return 'request timed out';
  if (error instanceof TypeError) return 'network blocked or unreachable';
  return error.message || 'request failed';
}

async function fetchJson(url, options = {}, timeoutMs = OVERPASS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new Error('non-JSON response');
    }
  } finally {
    clearTimeout(timeout);
  }
}

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      if (!BELFAST_BOUNDS.contains(e.latlng)) return;
      onClick(e.latlng);
    }
  });
  return null;
}

function MapSizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
  }, [map]);
  return null;
}

function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLat = lat2 - lat1;
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function minDistanceToCoords(point, coords) {
  let min = Infinity;
  for (const c of coords) {
    const d = haversine(point, c);
    if (d < min) min = d;
  }
  return min;
}

function offsetWaypoint(start, end, perpMeters) {
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;
  const len = Math.sqrt(dLat * dLat + dLng * dLng);
  if (len === 0) return null;
  const pLat = -dLng / len;
  const pLng = dLat / len;
  const dLatDeg = (perpMeters / 111000) * pLat;
  const dLngDeg = (perpMeters / (111000 * Math.cos(midLat * Math.PI / 180))) * pLng;
  return { lat: midLat + dLatDeg, lng: midLng + dLngDeg };
}

async function fetchOsrm(coords) {
  const path = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/foot/${path}?overview=full&geometries=geojson&steps=false`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Routing service unreachable: ${friendlyFetchError(e)}`);
  }
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  if (!data.routes || data.routes.length === 0) throw new Error('No route found');
  const r = data.routes[0];
  return {
    coords: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distance: r.distance,
    duration: r.duration
  };
}

function routeFingerprint(coords) {
  return coords
    .filter((_, i) => i % Math.max(1, Math.floor(coords.length / 25)) === 0)
    .map(([lat, lon]) => `${lat.toFixed(4)},${lon.toFixed(4)}`)
    .join('|');
}

async function fetchRoutes(start, end) {
  const offsets = [0, 300, -300];
  const tasks = offsets.map(off => {
    if (off === 0) return fetchOsrm([start, end]);
    const via = offsetWaypoint(start, end, off);
    if (!via) return Promise.reject(new Error('bad offset'));
    return fetchOsrm([start, via, end]);
  });
  const settled = await Promise.allSettled(tasks);
  const ok = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
  if (ok.length === 0) {
    const reason = settled
      .filter(s => s.status === 'rejected')
      .map(s => friendlyFetchError(s.reason))
      .filter(Boolean)[0];
    throw new Error(reason ? `All routing attempts failed: ${reason}` : 'All routing attempts failed');
  }

  const seen = new Set();
  const unique = [];
  for (const r of ok) {
    const fp = routeFingerprint(r.coords);
    if (seen.has(fp)) continue;
    seen.add(fp);
    unique.push(r);
  }
  return unique;
}

function combinedBbox(routes, padding = 0.0015) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const r of routes) {
    for (const [lat, lon] of r.coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  return [minLat - padding, minLon - padding, maxLat + padding, maxLon + padding];
}

async function fetchAccessibilityData(bbox) {
  const [s, w, n, e] = bbox;
  const query = `
    [out:json][timeout:25];
    (
      node["highway"="crossing"](${s},${w},${n},${e});
      node["kerb"](${s},${w},${n},${e});
      way["highway"~"^(primary|secondary|trunk|primary_link|secondary_link|trunk_link)$"](${s},${w},${n},${e});
    );
    out body geom;
  `;
  const encodedQuery = encodeURIComponent(query);
  const attempts = [];
  let data = null;
  let source = null;

  for (const endpoint of getOverpassEndpoints()) {
    const methods = endpoint.startsWith('/') ? ['POST'] : ['GET', 'POST'];
    for (const method of methods) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          data = await fetchJson(
            method === 'GET' ? `${endpoint}?data=${encodedQuery}` : endpoint,
            method === 'POST'
              ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                  body: `data=${encodedQuery}`
                }
              : { method: 'GET' }
          );
          source = endpoint;
          break;
        } catch (e) {
          attempts.push(`${endpoint} ${method}: ${friendlyFetchError(e)}`);
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (data) break;
    }
    if (data) break;
  }

  if (!data) {
    const last = attempts[attempts.length - 1] || 'no endpoint attempted';
    throw new Error(`Overpass blocked or unavailable (${last})`);
  }

  const nodes = [];
  const busyWays = [];
  for (const el of data.elements || []) {
    if (el.type === 'node') nodes.push(el);
    else if (el.type === 'way' && el.geometry) busyWays.push(el);
  }
  return { nodes, busyWays, source };
}

function classifyFeature(el) {
  const t = el.tags || {};
  const tactileYes = t.tactile_paving === 'yes';
  const tactileNo = t.tactile_paving === 'no';
  const audioYes = t['traffic_signals:sound'] === 'yes';
  const lowKerb = t.kerb === 'lowered' || t.kerb === 'flush' || t.kerb === 'no';
  const highKerb = t.kerb === 'raised';
  return { tactileYes, tactileNo, audioYes, lowKerb, highKerb };
}

function nodesNearRoute(nodes, coords, threshold = 30) {
  const out = [];
  for (const el of nodes) {
    const d = minDistanceToCoords([el.lat, el.lon], coords);
    if (d < threshold) out.push(el);
  }
  return out;
}

function busyMetersOnRoute(busyWays, coords, threshold = 12) {
  let meters = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversine(a, b);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let near = false;
    for (const w of busyWays) {
      for (const g of w.geometry) {
        if (haversine(mid, [g.lat, g.lon]) < threshold) { near = true; break; }
      }
      if (near) break;
    }
    if (near) meters += segLen;
  }
  return meters;
}

function scoreRoute(route, accData, filters) {
  const near = nodesNearRoute(accData.nodes, route.coords);
  let penalty = 0;
  let pos = 0, neg = 0, unknown = 0;

  for (const el of near) {
    const t = el.tags || {};
    const c = classifyFeature(el);
    const isCrossing = t.highway === 'crossing';
    const isSignalised = t.crossing === 'traffic_signals' || t.crossing === 'signals';

    if (filters.tactile && isCrossing) {
      if (c.tactileYes) { pos++; penalty -= PENALTIES.tactile_bonus; }
      else if (c.tactileNo) { neg++; penalty += PENALTIES.tactile_missing; }
      else unknown++;
    }
    if (filters.audio && isSignalised) {
      if (c.audioYes) { pos++; penalty -= PENALTIES.audio_bonus; }
      else { neg++; penalty += PENALTIES.audio_missing; }
    }
    if (filters.kerb && (isCrossing || t.kerb)) {
      if (c.lowKerb) { pos++; penalty -= PENALTIES.kerb_bonus; }
      else if (c.highKerb) { neg++; penalty += PENALTIES.kerb_raised; }
      else if (t.kerb) unknown++;
    }
  }

  let busyMeters = 0;
  if (filters.avoid_busy) {
    busyMeters = busyMetersOnRoute(accData.busyWays, route.coords);
    penalty += busyMeters * PENALTIES.busy_per_meter;
  }

  const total = pos + neg + unknown;
  let score = null;
  if (total > 0) {
    const raw = (pos - neg) / total;
    score = Math.max(0, Math.min(1, (raw + 1) / 2));
  }

  return {
    near,
    penalty,
    busyMeters,
    pos, neg, unknown,
    effective: route.distance + penalty,
    score
  };
}

function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatDuration(s) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export default function App() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [accData, setAccData] = useState({ nodes: [], busyWays: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [filters, setFilters] = useState({
    tactile: false,
    audio: false,
    kerb: false,
    avoid_busy: false,
    avoid_crash: false
  });

  const handleMapClick = (latlng) => {
    setError(null); setWarning(null);
    if (!start) setStart(latlng);
    else if (!end) setEnd(latlng);
    else {
      setStart(latlng); setEnd(null);
      setRoutes([]); setAccData({ nodes: [], busyWays: [] });
    }
  };

  const reset = () => {
    setStart(null); setEnd(null); setRoutes([]);
    setAccData({ nodes: [], busyWays: [] }); setError(null); setWarning(null);
  };

  const computeRoute = async () => {
    if (!start || !end) return;
    setLoading(true); setError(null); setWarning(null);
    try {
      const rs = await fetchRoutes(start, end);
      setRoutes(rs);
      const bbox = combinedBbox(rs);
      try {
        const data = await fetchAccessibilityData(bbox);
        setAccData(data);
      } catch (e) {
        setAccData({ nodes: [], busyWays: [] });
        setWarning(
          'Route shown without accessibility scoring because the OSM accessibility lookup is blocked or unreachable on this network. ' +
          e.message
        );
      }
    } catch (e) {
      setError(e.message);
      setRoutes([]); setAccData({ nodes: [], busyWays: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (start && end) computeRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const scored = useMemo(() => {
    return routes.map(r => ({ route: r, ...scoreRoute(r, accData, filters) }));
  }, [routes, accData, filters]);

  const chosenIndex = useMemo(() => {
    if (scored.length === 0) return -1;
    let best = 0;
    for (let i = 1; i < scored.length; i++) {
      if (scored[i].effective < scored[best].effective) best = i;
    }
    return best;
  }, [scored]);

  const chosen = chosenIndex >= 0 ? scored[chosenIndex] : null;

  const featureStats = useMemo(() => {
    if (!chosen) return { crossings: 0, tactileYes: 0, tactileNo: 0, lowKerbs: 0 };
    let crossings = 0, tactileYes = 0, tactileNo = 0, lowKerbs = 0;
    for (const el of chosen.near) {
      const t = el.tags || {};
      if (t.highway === 'crossing') crossings++;
      if (t.tactile_paving === 'yes') tactileYes++;
      if (t.tactile_paving === 'no') tactileNo++;
      if (t.kerb === 'lowered' || t.kerb === 'flush') lowKerbs++;
    }
    return { crossings, tactileYes, tactileNo, lowKerbs };
  }, [chosen]);

  const hint = !start
    ? 'Click in Belfast to set your start point'
    : !end
    ? 'Click again to set your destination'
    : null;

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Route controls">
        <h1>Accessible Walk — Belfast</h1>
        <p className="subtitle">Walking navigation built around accessibility features in OpenStreetMap.</p>

        {error && <div className="error" role="alert">{error}</div>}
        {warning && <div className="warning" role="status">{warning}</div>}

        <div className="section">
          <h2>Points</h2>
          <div className="point-row">
            <span className="point-dot start" aria-hidden="true" />
            <span className="point-coords">
              {start ? `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}` : <span className="point-empty">click map to set start</span>}
            </span>
          </div>
          <div className="point-row">
            <span className="point-dot end" aria-hidden="true" />
            <span className="point-coords">
              {end ? `${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}` : <span className="point-empty">click map to set destination</span>}
            </span>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={reset} disabled={!start && !end}>Clear</button>
            <button className="btn primary" onClick={computeRoute} disabled={!start || !end || loading}>
              {loading ? 'Routing…' : 'Recompute'}
            </button>
          </div>
        </div>

        <div className="section">
          <h2>Accessibility preferences</h2>
          <div className="toggle-list">
            {FILTERS.map(f => (
              <label key={f.id} className="toggle">
                <input
                  type="checkbox"
                  checked={filters[f.id]}
                  onChange={(e) => setFilters(prev => ({ ...prev, [f.id]: e.target.checked }))}
                />
                <span className="toggle-text">
                  <span className="toggle-title">{f.title}</span>
                  <span className="toggle-desc">{f.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {scored.length > 0 && (
          <div className="section">
            <h2>Candidate routes ({scored.length})</h2>
            <div className="summary" style={{ padding: 0 }}>
              {scored.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    borderBottom: i < scored.length - 1 ? '1px solid #eef1f5' : 'none',
                    background: i === chosenIndex ? '#eaf3ff' : 'transparent'
                  }}
                >
                  <div className="stat">
                    <span className="stat-label">
                      <strong>Route {i + 1}</strong>
                      {i === chosenIndex && <span style={{ color: '#0066cc', marginLeft: 6 }}>● chosen</span>}
                    </span>
                    <span className="stat-value">{formatDistance(s.route.distance)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Penalty</span>
                    <span className="stat-value">+{Math.round(s.penalty)} m</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Effective length</span>
                    <span className="stat-value">{formatDistance(s.effective)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {chosen && (
          <div className="section">
            <h2>Chosen route detail</h2>
            <div className="summary">
              <div className="stat"><span className="stat-label">Distance</span><span className="stat-value">{formatDistance(chosen.route.distance)}</span></div>
              <div className="stat"><span className="stat-label">Walking time</span><span className="stat-value">{formatDuration(chosen.route.duration)}</span></div>
              <div className="stat"><span className="stat-label">Crossings near route</span><span className="stat-value">{featureStats.crossings}</span></div>
              <div className="stat"><span className="stat-label">Tactile paving (yes)</span><span className="stat-value">{featureStats.tactileYes}</span></div>
              <div className="stat"><span className="stat-label">Tactile paving (no)</span><span className="stat-value">{featureStats.tactileNo}</span></div>
              <div className="stat"><span className="stat-label">Low / flush kerbs</span><span className="stat-value">{featureStats.lowKerbs}</span></div>
              {filters.avoid_busy && (
                <div className="stat"><span className="stat-label">Busy-road meters</span><span className="stat-value">{Math.round(chosen.busyMeters)} m</span></div>
              )}
              {chosen.score !== null && (
                <>
                  <div className="stat" style={{ marginTop: 6 }}>
                    <span className="stat-label">Accessibility score</span>
                    <span className="stat-value">{Math.round(chosen.score * 100)} / 100</span>
                  </div>
                  <div className="score-bar" aria-hidden="true">
                    <div className="score-fill" style={{ width: `${chosen.score * 100}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="section">
          <h2>Map legend</h2>
          <div className="legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: '#0066cc' }} /> Chosen route</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#9aa5b1' }} /> Alternative routes</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#0a8754' }} /> Crossing — accessible</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#c0392b' }} /> Crossing — missing features</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#f1c40f' }} /> Crossing — unknown / partial</div>
          </div>
        </div>

        <p className="subtitle" style={{ fontSize: 11, marginTop: 18 }}>
          Picks among OSRM foot alternatives by adding accessibility penalties to each route's length, then choosing the lowest effective length. Tactile/audio/kerb penalties come from OSM crossing tags within 30 m of the route. Busy-road penalty multiplies meters of the route adjacent to primary/secondary/trunk ways. Crash data toggle is display-only until NI dataset is wired in.
        </p>
      </aside>

      <div className="map-area">
        {hint && <div className="map-hint">{hint}</div>}
        {loading && <div className="loading">Loading…</div>}
        <MapContainer
          center={BELFAST}
          zoom={14}
          minZoom={12}
          maxZoom={19}
          maxBounds={BELFAST_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            subdomains={['a', 'b', 'c']}
            maxZoom={19}
            bounds={BELFAST_BOUNDS}
          />
          <MapSizeFix />
          <ClickHandler onClick={handleMapClick} />
          {scored.map((s, i) => i !== chosenIndex && (
            <Polyline
              key={`alt-${i}`}
              positions={s.route.coords}
              pathOptions={{ color: '#9aa5b1', weight: 4, opacity: 0.55, dashArray: '6 6' }}
            />
          ))}
          {chosen && (
            <Polyline
              positions={chosen.route.coords}
              pathOptions={{ color: '#0066cc', weight: 6, opacity: 0.9 }}
            />
          )}
          {chosen && chosen.near.map(el => {
            const c = classifyFeature(el);
            const good = (c.tactileYes ? 1 : 0) + (c.audioYes ? 1 : 0) + (c.lowKerb ? 1 : 0);
            const bad = (c.tactileNo ? 1 : 0) + (c.highKerb ? 1 : 0);
            const color = bad > good ? '#c0392b' : good > 0 ? '#0a8754' : '#f1c40f';
            return (
              <CircleMarker
                key={el.id}
                center={[el.lat, el.lon]}
                radius={6}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
              >
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <strong>{(el.tags && el.tags.highway) || 'feature'}</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {Object.entries(el.tags || {}).map(([k, v]) => (
                        <li key={k}><code>{k}</code> = {v}</li>
                      ))}
                    </ul>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          {start && (
            <CircleMarker
              center={[start.lat, start.lng]}
              radius={9}
              pathOptions={{ color: '#ffffff', fillColor: '#0a8754', fillOpacity: 1, weight: 3 }}
            >
              <Popup>Journey start</Popup>
            </CircleMarker>
          )}
          {end && (
            <CircleMarker
              center={[end.lat, end.lng]}
              radius={9}
              pathOptions={{ color: '#ffffff', fillColor: '#c0392b', fillOpacity: 1, weight: 3 }}
            >
              <Popup>Journey end</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
