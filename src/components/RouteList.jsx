import { formatDistance } from '../utils/format';

export default function RouteList({ scored, chosenIndex }) {
  if (scored.length === 0) return null;

  return (
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
                {i === chosenIndex && !s.blocked && <span style={{ color: '#0066cc', marginLeft: 6 }}>● chosen</span>}
                {s.blocked && <span style={{ color: '#c0392b', marginLeft: 6 }}>● blocked</span>}
              </span>
              <span className="stat-value">{formatDistance(s.route.distance)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Penalty</span>
              <span className="stat-value">+{Math.round(s.penalty)} m</span>
            </div>
            {s.forbiddenMeters > 0 && (
              <div className="stat">
                <span className="stat-label" style={{ color: '#c0392b' }}>Motorway / no-access</span>
                <span className="stat-value" style={{ color: '#c0392b' }}>{Math.round(s.forbiddenMeters)} m</span>
              </div>
            )}
            <div className="stat">
              <span className="stat-label">Effective length</span>
              <span className="stat-value">{s.blocked ? '∞ (excluded)' : formatDistance(s.effective)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
