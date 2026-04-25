import { formatDistance, formatDuration } from '../utils/format';

export default function RouteModeCards({ modes, selectedModeId, onSelect }) {
  if (modes.length === 0) return null;

  return (
    <div className="section">
      <h2>Route modes</h2>
      <div className="route-mode-list">
        {modes.map(mode => {
          const s = mode.scoredRoute;
          const selected = mode.id === selectedModeId;
          return (
            <button
              key={mode.id}
              type="button"
              className={`route-mode-card${selected ? ' selected' : ''}`}
              onClick={() => onSelect(mode.id)}
            >
              <span className="route-mode-header">
                <span>
                  <span className="route-mode-title">{mode.title}</span>
                  <span className="route-mode-subtitle">{mode.shortLabel}</span>
                </span>
                <span className="route-mode-badges">
                  <span className="route-mode-candidate">{mode.candidateLabel}</span>
                  {mode.sameAsFastest && <span className="route-mode-candidate muted">Same as Fastest</span>}
                  {!mode.accessibilityEvidence && mode.id !== 'fastest' && (
                    <span className="route-mode-candidate muted">No access data</span>
                  )}
                  {selected && <span className="route-mode-selected">Chosen</span>}
                </span>
              </span>
              <span className="route-mode-description">{mode.description}</span>
              {s && (
                <>
                  <span className="route-mode-stats">
                    <span><strong>{formatDistance(s.route.distance)}</strong> distance</span>
                    <span><strong>{formatDuration(s.route.duration)}</strong> walk</span>
                    <span>
                      <strong>{s.blocked ? 'excluded' : formatDistance(mode.effectiveLength)}</strong> mode score
                    </span>
                    {s.forbiddenMeters > 0 && (
                      <span><strong>{formatDistance(s.forbiddenMeters)}</strong> near restricted ways</span>
                    )}
                  </span>
                  <span className="route-mode-reasons">
                    {mode.reasons.map(reason => <span key={reason}>• {reason}</span>)}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
