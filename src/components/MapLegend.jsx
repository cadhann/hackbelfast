export default function MapLegend() {
  return (
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
  );
}
