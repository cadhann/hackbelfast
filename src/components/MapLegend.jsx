export default function MapLegend() {
  return (
    <details className="legend-details">
      <summary>Map legend</summary>
      <div className="legend">
        <div className="legend-item"><span className="legend-dot" style={{ background: '#1a73e8' }} /> Chosen route</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#9aa5b1' }} /> Alternative routes</div>
        <div className="legend-item"><span className="hazard-marker-badge legend-badge" style={{'--hazard-color':'#0a8754'}}>⊕</span> Crossing — accessible</div>
        <div className="legend-item"><span className="hazard-marker-badge legend-badge" style={{'--hazard-color':'#c0392b'}}>⊕</span> Crossing — missing features</div>
        <div className="legend-item"><span className="hazard-marker-badge legend-badge" style={{'--hazard-color':'#f59e0b'}}>⊕</span> Crossing — unknown / partial</div>
        <div className="legend-item"><span className="hazard-marker-badge legend-badge" style={{'--hazard-color':'#f57c00'}}>⬆</span> Raised kerb</div>
        <div className="legend-item"><span className="hazard-marker-badge legend-badge" style={{'--hazard-color':'#607d8b'}}>≡</span> Steps / stairs</div>
        <div className="legend-item"><span className="support-marker-badge toilet legend-badge">WC</span> Toilet near chosen route</div>
        <div className="legend-item"><span className="support-marker-badge seating legend-badge">B</span> Seating near chosen route</div>
        <div className="legend-note">Hazard markers show crossings, kerbs, and stairs along the route. Support markers show nearby amenities; close ones are fanned apart slightly so they do not overlap.</div>
      </div>
    </details>
  );
}
