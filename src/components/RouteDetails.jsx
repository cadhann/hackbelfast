import { formatDistance, formatDuration } from '../utils/format';
import TurnByTurn from './TurnByTurn';

function Stat({ label, value }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export default function RouteDetails({ chosen, selectedMode, featureStats, filters }) {
  if (!chosen || !selectedMode) return null;

  return (
    <>
      <div className="details-section">
        <div className="section-title">{selectedMode.title} detail</div>
        <div className="details-card">
          <Stat label="Mode" value={selectedMode.shortLabel} />
          <Stat label="Distance" value={formatDistance(chosen.route.distance)} />
          <Stat label="Walking time" value={formatDuration(chosen.route.duration)} />
          <Stat label="Crossings near route" value={featureStats.crossings} />
          <Stat label="Tactile paving (yes)" value={featureStats.tactileYes} />
          <Stat label="Tactile paving (no)" value={featureStats.tactileNo} />
          <Stat label="Low / flush kerbs" value={featureStats.lowKerbs} />
          {filters.avoid_busy && <Stat label="Busy-road meters" value={`${Math.round(chosen.busyMeters)} m`} />}
          {(filters.avoid_steps || chosen.stepsMeters > 0) && (
            <Stat label="Steps along route" value={`${Math.round(chosen.stepsMeters || 0)} m`} />
          )}
          {(filters.pavement_width || chosen.narrowMeters > 0) && (
            <Stat label="Narrow pavement (< 1.5 m)" value={`${Math.round(chosen.narrowMeters || 0)} m`} />
          )}
          {filters.streetlights && (
            <>
              <Stat label="Lit segments" value={`${Math.round(chosen.litMeters || 0)} m`} />
              <Stat label="Unlit segments" value={`${Math.round(chosen.unlitMeters || 0)} m`} />
              <Stat label="Street lamps nearby" value={chosen.streetLampCount || 0} />
            </>
          )}
          {chosen.forbiddenMeters > 0 && (
            <Stat label="Restricted-way proximity" value={`${Math.round(chosen.forbiddenMeters)} m`} />
          )}
          {chosen.score !== null && (
            <>
              <div className="stat-row" style={{ marginTop: 4 }}>
                <span className="stat-label">Accessibility score</span>
                <span className="stat-value">{Math.round(chosen.score * 100)} / 100</span>
              </div>
              <div className="score-bar" aria-hidden="true">
                <div className="score-fill" style={{ width: `${chosen.score * 100}%` }} />
              </div>
            </>
          )}
          {selectedMode.reasons?.length > 0 && (
            <div className="reasons-list">
              {selectedMode.reasons.map(reason => <div key={reason}>{reason}</div>)}
            </div>
          )}
        </div>
      </div>
      <TurnByTurn steps={chosen.route.steps} />
    </>
  );
}
