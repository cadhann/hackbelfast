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
      </div>
    </details>
  );
}
