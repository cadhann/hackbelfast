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
        <div className="legend-item"><span className="legend-dot legend-ring" style={{ background: '#00897b' }} /> Toilet near chosen route</div>
        <div className="legend-item"><span className="legend-dot legend-ring" style={{ background: '#ef6c00' }} /> Seating near chosen route</div>
        <div className="legend-item"><span className="legend-dot legend-ring" style={{ background: '#5e35b1' }} /> Station access near chosen route</div>
        <div className="legend-item"><span className="legend-dot legend-ring" style={{ background: '#b3261e' }} /> Accessibility report near chosen route</div>
      </div>
    </details>
  );
}
