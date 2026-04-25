import { formatDistance, formatDuration } from '../utils/format';

function formatAccessibilityScore(score) {
  if (score === null) return '—';
  return `${Math.round(score * 100)}`;
}

export default function RouteModeCards({ modes, selectedModeId, onSelect }) {
  if (modes.length === 0) return null;

  return (
    <div className="mode-section">
      <div className="section-title">Routes</div>
      <div className="mode-row">
        {modes.map(mode => {
          const s = mode.scoredRoute;
          const selected = mode.id === selectedModeId;
          return (
            <button
              key={mode.id}
              type="button"
              className={`mode-card${selected ? ' selected' : ''}`}
              onClick={() => onSelect(mode.id)}
              aria-pressed={selected}
            >
              <div className="mode-card-top">
                <span className="mode-card-title">{mode.title}</span>
                {selected && <span className="mode-chosen-pill">Selected</span>}
              </div>
              {s ? (
                <>
                  <div className="mode-card-time">{formatDuration(s.route.duration)}</div>
                  <div className="mode-card-meta">
                    <span>{formatDistance(s.route.distance)}</span>
                    <span className="mode-dot" aria-hidden="true">·</span>
                    <span>Score {formatAccessibilityScore(s.score)}</span>
                  </div>
                  <div className="mode-card-sub">{mode.shortLabel}</div>
                  {mode.sameAsFastest && (
                    <div className="mode-card-flag">Same path as Fastest</div>
                  )}
                </>
              ) : (
                <div className="mode-card-meta">No candidate</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
