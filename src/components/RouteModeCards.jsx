import { formatDistance, formatDuration } from '../utils/format';

function formatScore(score) {
  if (score === null || score === undefined) return '—';
  return `${Math.round(score * 100)}`;
}

export default function RouteModeCards({
  candidates,
  modes,
  recommendedIndex,
  selectedIndex,
  activeModeId,
  onSelectRoute,
  onSelectMode
}) {
  if (!candidates || candidates.length === 0) return null;

  const modePicksByIndex = new Map();
  for (const mode of modes || []) {
    if (mode.routeIndex < 0) continue;
    if (!modePicksByIndex.has(mode.routeIndex)) modePicksByIndex.set(mode.routeIndex, []);
    modePicksByIndex.get(mode.routeIndex).push(mode);
  }

  const visible = candidates.map((c, i) => ({ c, i }));

  return (
    <div className="mode-section">
      <div className="section-title">
        {visible.length === 1 ? 'Route' : `Routes (${visible.length})`}
      </div>

      <div className="route-options">
        {visible.map(({ c, i }) => {
          const isSelected = i === selectedIndex;
          const isRecommended = i === recommendedIndex;
          const picks = modePicksByIndex.get(i) || [];
          return (
            <button
              key={i}
              type="button"
              className={`route-option${isSelected ? ' selected' : ''}${c.blocked ? ' restricted' : ''}`}
              onClick={() => !c.blocked && onSelectRoute(i)}
              aria-pressed={isSelected}
              aria-disabled={c.blocked || undefined}
            >
              <div className="route-option-main">
                <div className="route-option-time">{formatDuration(c.route.duration)}</div>
                <div className="route-option-meta">
                  <span>{formatDistance(c.route.distance)}</span>
                  <span className="mode-dot" aria-hidden="true">·</span>
                  <span>Score {formatScore(c.score)}</span>
                </div>
                {picks.length > 0 && (
                  <div className="route-option-tags">
                    {picks.map(p => (
                      <span key={p.id} className="route-option-tag">{p.title}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="route-option-side">
                {isRecommended && !c.blocked && <span className="route-pill recommended">Recommended</span>}
                {isSelected && !c.blocked && <span className="route-pill selected">Selected</span>}
                {c.blocked && <span className="route-pill warn">Restricted</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
