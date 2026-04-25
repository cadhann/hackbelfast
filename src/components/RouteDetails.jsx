import { formatDistance, formatDuration } from '../utils/format';
import TurnByTurn from './TurnByTurn';

export default function RouteDetails({ chosen, selectedMode, featureStats, filters }) {
  if (!chosen || !selectedMode) return null;

  return (
    <>
      <div className="section">
        <h2>{selectedMode.title} detail</h2>
        <div className="summary">
          <div className="stat"><span className="stat-label">Mode</span><span className="stat-value">{selectedMode.shortLabel}</span></div>
          <div className="stat"><span className="stat-label">Distance</span><span className="stat-value">{formatDistance(chosen.route.distance)}</span></div>
          <div className="stat"><span className="stat-label">Walking time</span><span className="stat-value">{formatDuration(chosen.route.duration)}</span></div>
          <div className="stat"><span className="stat-label">Crossings near route</span><span className="stat-value">{featureStats.crossings}</span></div>
          <div className="stat"><span className="stat-label">Tactile paving (yes)</span><span className="stat-value">{featureStats.tactileYes}</span></div>
          <div className="stat"><span className="stat-label">Tactile paving (no)</span><span className="stat-value">{featureStats.tactileNo}</span></div>
          <div className="stat"><span className="stat-label">Low / flush kerbs</span><span className="stat-value">{featureStats.lowKerbs}</span></div>
          {filters.avoid_busy && (
            <div className="stat"><span className="stat-label">Busy-road meters</span><span className="stat-value">{Math.round(chosen.busyMeters)} m</span></div>
          )}
          {(filters.avoid_steps || chosen.stepsMeters > 0) && (
            <div className="stat"><span className="stat-label">Steps along route</span><span className="stat-value">{Math.round(chosen.stepsMeters || 0)} m</span></div>
          )}
          {(filters.pavement_width || chosen.narrowMeters > 0) && (
            <div className="stat"><span className="stat-label">Narrow pavement (&lt; 1.5 m)</span><span className="stat-value">{Math.round(chosen.narrowMeters || 0)} m</span></div>
          )}
          {filters.streetlights && (
            <>
              <div className="stat"><span className="stat-label">Lit segments</span><span className="stat-value">{Math.round(chosen.litMeters || 0)} m</span></div>
              <div className="stat"><span className="stat-label">Unlit segments</span><span className="stat-value">{Math.round(chosen.unlitMeters || 0)} m</span></div>
              <div className="stat"><span className="stat-label">Street lamps nearby</span><span className="stat-value">{chosen.streetLampCount || 0}</span></div>
            </>
          )}
          {chosen.forbiddenMeters > 0 && (
            <div className="stat"><span className="stat-label">Restricted-way proximity</span><span className="stat-value">{Math.round(chosen.forbiddenMeters)} m</span></div>
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
          {selectedMode.reasons?.length > 0 && (
            <div className="route-mode-detail-notes">
              {selectedMode.reasons.map(reason => <div key={reason}>{reason}</div>)}
            </div>
          )}
        </div>
      </div>
      <TurnByTurn steps={chosen.route.steps} />
    </>
  );
}
