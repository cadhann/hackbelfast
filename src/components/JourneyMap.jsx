import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { BELFAST, BELFAST_BOUNDS } from '../config/map';
import { haversine } from '../utils/geo';
import { classifyFeature } from '../services/routeScoring';

const SUPPORT_MARKER_STYLES = {
  toilet: { color: '#00897b', label: 'WC', title: 'Toilet' },
  seating: { color: '#ef6c00', label: 'B', title: 'Seating' },
  station: { color: '#5e35b1', label: 'ST', title: 'Station access' },
  report: { color: '#b3261e', label: '!', title: 'Route report' }
};

const METERS_PER_DEGREE_LAT = 111320;

function offsetPoint(lat, lon, eastMeters, northMeters) {
  const latOffset = northMeters / METERS_PER_DEGREE_LAT;
  const lonOffset = eastMeters / (METERS_PER_DEGREE_LAT * Math.cos(lat * Math.PI / 180));
  return [lat + latOffset, lon + lonOffset];
}

function buildSupportIcon(kind) {
  const style = SUPPORT_MARKER_STYLES[kind];
  return L.divIcon({
    className: 'support-div-icon',
    html: `<span class="support-marker-badge ${kind}" style="--marker-color:${style.color}">${style.label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14]
  });
}

const SUPPORT_MARKER_ICONS = Object.fromEntries(
  Object.keys(SUPPORT_MARKER_STYLES).map(kind => [kind, buildSupportIcon(kind)])
);

function buildSupportMarkers(chosen) {
  const items = [
    ...(chosen?.toiletsNear || []).map(feature => ({ kind: 'toilet', feature })),
    ...(chosen?.seatingNear || []).map(feature => ({ kind: 'seating', feature })),
    ...(chosen?.stationAccessNear || []).map(feature => ({ kind: 'station', feature })),
    ...(chosen?.communityReportsNear || []).map(feature => ({ kind: 'report', feature }))
  ];

  const groups = [];
  for (const item of items) {
    const point = [item.feature.lat, item.feature.lon];
    const group = groups.find(candidate => haversine(candidate.center, point) <= 18);
    if (group) {
      group.items.push(item);
      continue;
    }
    groups.push({ center: point, items: [item] });
  }

  return groups.flatMap(group => {
    if (group.items.length === 1) {
      const [lat, lon] = group.center;
      return [{ ...group.items[0], position: [lat, lon], fannedOut: false }];
    }

    const radiusMeters = 16;
    return group.items.map((item, index) => {
      const angle = (-Math.PI / 2) + ((2 * Math.PI * index) / group.items.length);
      const east = Math.cos(angle) * radiusMeters;
      const north = Math.sin(angle) * radiusMeters;
      const [lat, lon] = offsetPoint(group.center[0], group.center[1], east, north);
      return { ...item, position: [lat, lon], fannedOut: true };
    });
  });
}

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      if (!L.latLngBounds(BELFAST_BOUNDS).contains(e.latlng)) return;
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

// Pans the map to follow the user's GPS position during active navigation.
// Only moves the map when the user has moved more than 3 m to avoid jitter.
function MapFollower({ position, follow }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (!follow || !position) return;
    if (prevRef.current) {
      const moved = haversine(
        [position.lat, position.lng],
        [prevRef.current.lat, prevRef.current.lng]
      );
      if (moved < 3) return;
    }
    prevRef.current = position;
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 17), {
      animate: true,
      duration: 0.5,
    });
  }, [position, follow, map]);
  return null;
}

function FeatureMarker({ el }) {
  const c = classifyFeature(el);
  const tags = el.tags || {};
  const good = (c.tactileYes ? 1 : 0) + (c.audioYes ? 1 : 0) + (c.lowKerb ? 1 : 0);
  const bad = (c.tactileNo ? 1 : 0) + (c.highKerb ? 1 : 0);
  const color = bad > good ? '#c0392b' : good > 0 ? '#0a8754' : '#f1c40f';
  const note = tags.demo_issue || tags.demo_note;
  return (
    <CircleMarker
      center={[el.lat, el.lon]}
      radius={6}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
    >
      <Popup>
        <div style={{ fontSize: 12 }}>
          <strong>{tags.name || tags.highway || 'feature'}</strong>
          {note && <p style={{ margin: '4px 0 0 0' }}>{note}</p>}
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {Object.entries(tags).map(([k, v]) => (
              <li key={k}><code>{k}</code> = {v}</li>
            ))}
          </ul>
        </div>
      </Popup>
    </CircleMarker>
  );
}

function SupportMarker({ feature, kind }) {
  const tags = feature.tags || {};
  const style = SUPPORT_MARKER_STYLES[kind];
  if (!style) return null;

  const note = feature.summary || tags.fixture_note || tags.report_note || tags.demo_note || tags.demo_issue || null;
  const name = tags.name || feature.summary || style.title;

  return (
    <Marker
      position={feature.position || [feature.lat, feature.lon]}
      icon={SUPPORT_MARKER_ICONS[kind]}
    >
      <Popup>
        <div style={{ fontSize: 12 }}>
          <strong>{name}</strong>
          <div style={{ color: '#5f6368', marginTop: 4 }}>{style.title}</div>
          {feature.fannedOut && (
            <div style={{ color: '#5f6368', marginTop: 4 }}>
              Marker nudged slightly so nearby items do not overlap.
            </div>
          )}
          {note && <p style={{ margin: '6px 0 0 0' }}>{note}</p>}
        </div>
      </Popup>
    </Marker>
  );
}

export default function JourneyMap({ hint, loading, start, end, scored, chosen, chosenIndex, visibleIndices, onMapClick, userPosition, followUser }) {
  const supportMarkers = useMemo(() => buildSupportMarkers(chosen), [chosen]);
  const [showIcons, setShowIcons] = useState(true);
  return (
    <div className="map-area">
      {hint && <div className="map-hint">{hint}</div>}
      {loading && <div className="loading">Loading…</div>}
      <div className="map-controls">
        <button
          type="button"
          className={`map-icons-toggle${showIcons ? '' : ' off'}`}
          onClick={() => setShowIcons(v => !v)}
          aria-pressed={showIcons}
          title={showIcons ? 'Hide map icons' : 'Show map icons'}
        >
          <span aria-hidden="true">{showIcons ? '👁' : '🚫'}</span>
          <span className="map-icons-toggle-label">{showIcons ? 'Icons' : 'Icons off'}</span>
        </button>
      </div>
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
          bounds={BELFAST_BOUNDS}
        />
        <MapSizeFix />
        <MapFollower position={userPosition} follow={followUser} />
        <ClickHandler onClick={onMapClick} />
        {scored.map((s, i) => {
          if (i === chosenIndex) return null;
          // Only render alternatives the user can actually pick from the
          // option list — keeps the map free of overlapping dashed lines.
          if (visibleIndices && !visibleIndices.has(i)) return null;
          return (
            <Polyline
              key={`alt-${i}`}
              positions={s.route.coords}
              pathOptions={{ color: '#9aa5b1', weight: 4, opacity: 0.55, dashArray: '6 6' }}
            />
          );
        })}
        {chosen && (
          <>
            <Polyline
              positions={chosen.route.coords}
              pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }}
            />
            <Polyline
              positions={chosen.route.coords}
              pathOptions={{ color: '#1a73e8', weight: 6, opacity: 1 }}
            />
          </>
        )}
        {showIcons && chosen && chosen.near.map(el => <FeatureMarker key={el.id} el={el} />)}
        {showIcons && supportMarkers.map(item => (
          <SupportMarker key={`${item.kind}-${item.feature.id}`} feature={item} kind={item.kind} />
        ))}
        {/* Live GPS position — outer ring + inner dot */}
        {userPosition && (
          <>
            <CircleMarker
              center={[userPosition.lat, userPosition.lng]}
              radius={20}
              pathOptions={{ color: '#1a73e8', fillColor: '#1a73e8', fillOpacity: 0.12, weight: 0 }}
            />
            <CircleMarker
              center={[userPosition.lat, userPosition.lng]}
              radius={8}
              pathOptions={{ color: '#ffffff', fillColor: '#1a73e8', fillOpacity: 1, weight: 2.5 }}
            >
              <Popup>Your location</Popup>
            </CircleMarker>
          </>
        )}
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
  );
}
