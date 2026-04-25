function PointValue({ point, selectedPlace, emptyText }) {
  if (!point) return <span className="point-empty">{emptyText}</span>;
  if (!selectedPlace) return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  return (
    <>
      <strong>{selectedPlace.name}</strong>
      <span className="point-detail">{selectedPlace.area}</span>
    </>
  );
}

export default function PointsPanel({
  start,
  end,
  selectedStart,
  selectedDestination,
  loading,
  onReset,
  onRecompute
}) {
  return (
    <div className="section">
      <h2>Points</h2>
      <div className="point-row">
        <span className="point-dot start" aria-hidden="true" />
        <span className="point-coords">
          <PointValue point={start} selectedPlace={selectedStart} emptyText="search or click map to set start" />
        </span>
      </div>
      <div className="point-row">
        <span className="point-dot end" aria-hidden="true" />
        <span className="point-coords">
          <PointValue point={end} selectedPlace={selectedDestination} emptyText="search or click map to set destination" />
        </span>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={onReset} disabled={!start && !end}>Clear</button>
        <button className="btn primary" onClick={onRecompute} disabled={!start || !end || loading}>
          {loading ? 'Routing…' : 'Recompute'}
        </button>
      </div>
    </div>
  );
}
