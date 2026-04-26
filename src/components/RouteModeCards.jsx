import { formatDistance, formatDuration } from '../utils/format';

function scoreClass(score) {
  if (score == null) return '';
  if (score >= 0.68) return 'good';
  if (score >= 0.42) return 'fair';
  return 'low';
}

function scoreLabel(score) {
  if (score == null) return null;
  const p = Math.round(score * 100);
  if (p >= 68) return `♿ ${p}`;
  if (p >= 42) return `♿ ${p}`;
  return `♿ ${p}`;
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

  const allUsable = candidates.map((c, i) => ({ c, i })).filter(({ c }) => !c.blocked);
  if (allUsable.length === 0) return null;

  // Show only routes that are actually walkable right now — no closed gates.
  // Cap at two: the picked option plus at most one alternative.
  const working = allUsable.filter(({ c }) => (c.blockingClosures?.length || 0) === 0);
  let visible;
  let allHaveClosures = false;
  if (working.length > 0) {
    // Pick which routes to show (cap at 2: selected/recommended + one alt)
    // but render them in their ORIGINAL candidate order so cards don't
    // shuffle as the user clicks.
    const pickedSet = new Set();
    if (selectedIndex >= 0 && working.some(({ i }) => i === selectedIndex)) {
      pickedSet.add(selectedIndex);
    }
    if (pickedSet.size < 2 && recommendedIndex >= 0 && working.some(({ i }) => i === recommendedIndex)) {
      pickedSet.add(recommendedIndex);
    }
    for (const { i } of working) {
      if (pickedSet.size >= 2) break;
      pickedSet.add(i);
    }
    visible = working.filter(({ i }) => pickedSet.has(i)); // already in candidate order
  } else {
    // Nothing fully open — fall back to the single best candidate so the
    // user always sees a solution. Suppress the closure pill in that case.
    allHaveClosures = true;
    const fallback = allUsable.find(({ i }) => i === selectedIndex)
      || allUsable.find(({ i }) => i === recommendedIndex)
      || allUsable[0];
    visible = [fallback];
  }

  return (
    <div className="mode-section">
      <div className="section-title">
        {visible.length === 1 ? 'Route' : `Routes (${visible.length})`}
      </div>

      <div className="route-options">
        {visible.map(({ c, i }) => {
          const isSelected    = i === selectedIndex;
          const isRecommended = i === recommendedIndex;
          const picks         = modePicksByIndex.get(i) || [];
          const sc            = scoreLabel(c.score);
          const cls           = scoreClass(c.score);

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
                  {sc && (
                    <>
                      <span className="mode-dot" aria-hidden="true">·</span>
                      <span
                        className={`route-score-badge ${cls}`}
                        aria-label={`Accessibility score ${Math.round((c.score || 0) * 100)} out of 100`}
                      >
                        {sc}
                      </span>
                    </>
                  )}
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
                {isRecommended && !c.blocked && <span className="route-pill recommended">Best match</span>}
                {isSelected    && !c.blocked && <span className="route-pill selected">Selected</span>}
                {c.blocked                   && <span className="route-pill warn">Restricted</span>}
                {!c.blocked && !allHaveClosures && c.blockingClosures?.length > 0 && (
                  <span
                    className="route-pill warn"
                    title={c.blockingClosures.map(t => `${t.place.name} (${t.hoursLabel || 'closed'})`).join('\n')}
                  >
                    Gates closed
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
