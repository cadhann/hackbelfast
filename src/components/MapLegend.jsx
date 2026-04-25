export default function MapLegend() {
  return (
    <details className="legend-details">
      <summary>Map legend</summary>
      <div className="legend">
        <div className="legend-item"><span className="legend-dot" style={{ background: '#1a73e8' }} /> Chosen route</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#9aa5b1' }} /> Alternative routes</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#188038' }} /> Crossing — accessible</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#d93025' }} /> Crossing — missing features</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#f9ab00' }} /> Crossing — unknown / partial</div>
        <div className="legend-item"><span className="support-marker-badge toilet legend-badge">WC</span> Toilet near chosen route</div>
        <div className="legend-item"><span className="support-marker-badge seating legend-badge">B</span> Seating near chosen route</div>
        <div className="legend-item"><span className="support-marker-badge station legend-badge">ST</span> Station access near chosen route</div>
        <div className="legend-item"><span className="support-marker-badge report legend-badge">!</span> Accessibility report near chosen route</div>
        <div className="legend-note">Support markers are lettered, and nearby ones are fanned apart slightly on the map so they do not sit on top of each other.</div>
      </div>
    </details>
  );
}
