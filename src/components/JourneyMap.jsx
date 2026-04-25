import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { BELFAST, BELFAST_BOUNDS } from '../config/map';
import { classifyFeature } from '../services/routeScoring';

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

function FeatureMarker({ el }) {
  const c = classifyFeature(el);
  const good = (c.tactileYes ? 1 : 0) + (c.audioYes ? 1 : 0) + (c.lowKerb ? 1 : 0);
  const bad = (c.tactileNo ? 1 : 0) + (c.highKerb ? 1 : 0);
  const color = bad > good ? '#c0392b' : good > 0 ? '#0a8754' : '#f1c40f';
  return (
    <CircleMarker
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
}

export default function JourneyMap({ hint, loading, start, end, scored, chosen, chosenIndex, onMapClick }) {
  return (
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
        <ClickHandler onClick={onMapClick} />
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
        {chosen && chosen.near.map(el => <FeatureMarker key={el.id} el={el} />)}
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
