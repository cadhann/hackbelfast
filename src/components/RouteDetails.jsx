import { formatDistance, formatDuration } from '../utils/format';

export default function RouteDetails({ chosen, featureStats, filters }) {
  if (!chosen) return null;

  return (
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
  );
}
