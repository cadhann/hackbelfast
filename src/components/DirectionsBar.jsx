import { samePoint } from '../utils/geo';

const compactText = (...values) => values
  .flatMap((value) => {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') {
      return [value.name, value.label, value.text];
    }
    return [value];
  })
  .map(value => `${value}`.trim())
  .filter(Boolean);

function uniqueText(values) {
  return [...new Set(values)];
}

function parseCoord(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resultPoint(result) {
  const lat = parseCoord(result?.lat);
  const lng = parseCoord(result?.lng ?? result?.lon);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function getResultName(result) {
  return uniqueText(compactText(
    result?.name,
    result?.label,
    result?.title,
    result?.displayName,
    result?.display_name
  ))[0] || 'Unnamed place';
}

function getResultSecondary(result, name) {
  const secondary = uniqueText(compactText(
    result?.subtitle,
    result?.address,
    result?.displayAddress,
    result?.context,
    result?.description
  )).find(value => value !== name);

  if (secondary) return secondary;

  const lat = parseCoord(result?.lat);
  const lng = parseCoord(result?.lng ?? result?.lon);
  if (lat != null && lng != null) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  return null;
}

function getResultBadges(result) {
  return uniqueText(compactText(
    result?.typeLabel ?? result?.type,
    result?.area ?? result?.locality ?? result?.district ?? result?.neighbourhood ?? result?.neighborhood,
    result?.sourceLabel ?? result?.source
  )).slice(0, 3);
}

function getResultTrailing(result) {
  return uniqueText(compactText(
    result?.distanceText,
    result?.matchLabel,
    result?.confidenceLabel
  ))[0] || null;
}

function ResultsState({ tone = 'neutral', loading = false, title, detail }) {
  return (
    <div className="dir-results dir-results-state">
      <div
        className={`dir-state${tone === 'error' ? ' error' : ''}`}
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {loading ? (
          <span className="dir-state-spinner" aria-hidden="true" />
        ) : (
          <span className="dir-state-icon" aria-hidden="true">{tone === 'error' ? '!' : '•'}</span>
        )}
        <span className="dir-state-copy">
          <span className="dir-state-title">{title}</span>
          {detail ? <span className="dir-state-detail">{detail}</span> : null}
        </span>
      </div>
    </div>
  );
}

function ResultsList({
  query = '',
  results = [],
  searchState,
  errorMessage,
  promptMessage,
  emptyMessage,
  otherSelectedId,
  otherPoint,
  onSelect
}) {
  if (searchState === 'loading') {
    return (
      <ResultsState
        loading
        title="Searching Belfast…"
        detail="Finding places, streets, and landmarks near your query."
      />
    );
  }

  if (searchState === 'error') {
    return (
      <ResultsState
        tone="error"
        title="Search is unavailable"
        detail={errorMessage || 'Try again in a moment or pick a point on the map.'}
      />
    );
  }

  if (results.length === 0) {
    return (
      <ResultsState
        title={query.trim() ? 'No Belfast match found' : 'Search Belfast'}
        detail={query.trim() ? emptyMessage : promptMessage}
      />
    );
  }

  return (
    <div className="dir-results" role="listbox">
      {errorMessage ? (
        <div className="dir-state dir-state-inline" role="status" aria-live="polite">
          <span className="dir-state-icon" aria-hidden="true">•</span>
          <span className="dir-state-copy">
            <span className="dir-state-detail">{errorMessage}</span>
          </span>
        </div>
      ) : null}
      {results.map(d => {
        const point = resultPoint(d);
        const disabledReason = otherSelectedId === d.id
          ? 'Already selected'
          : (point && samePoint(point, otherPoint) ? 'Same point' : null);
        const disabled = Boolean(disabledReason);
        const name = getResultName(d);
        const secondary = getResultSecondary(d, name);
        const badges = getResultBadges(d);
        const trailing = getResultTrailing(d);
        return (
          <button
            key={d.id || `${name}-${d.lat ?? 'x'}-${d.lng ?? d.lon ?? 'x'}`}
            type="button"
            className="dir-result"
            role="option"
            disabled={disabled}
            onClick={() => onSelect(d)}
            aria-disabled={disabled}
          >
            <span className="dir-result-icon" aria-hidden="true">{d.icon || '📍'}</span>
            <span className="dir-result-text">
              <span className="dir-result-topline">
                <span className="dir-result-name">{name}</span>
                {trailing ? <span className="dir-result-trailing">{trailing}</span> : null}
              </span>
              {secondary ? <span className="dir-result-secondary">{secondary}</span> : null}
              {badges.length > 0 && (
                <span className="dir-result-badges">
                  {badges.map((badge) => (
                    <span key={badge} className="dir-result-badge">{badge}</span>
                  ))}
                </span>
              )}
              {disabledReason ? <span className="dir-result-state">{disabledReason}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function DirectionsBar({
  startQuery, startSearchOpen, startResults, selectedStart, start,
  destinationQuery, destinationSearchOpen, destinationResults, selectedDestination, end,
  startSearchState = 'idle', startSearchError = '',
  destinationSearchState = 'idle', destinationSearchError = '',
  onStartChange, onStartFocus, onStartSubmit, onStartClear, onSelectStart,
  onDestChange, onDestFocus, onDestSubmit, onDestClear, onSelectDestination,
  onSwap
}) {
  const showStartResults = startSearchOpen;
  const showDestResults = destinationSearchOpen;

  return (
    <div className="directions-bar">
      <div className="dir-rail" aria-hidden="true">
        <span className="dir-rail-dot start" />
        <span className="dir-rail-line" />
        <span className="dir-rail-dot end" />
      </div>

      <div className="dir-fields">
        <div className="dir-field">
          <input
            id="start-search"
            className="dir-input"
            type="search"
            value={startQuery}
            placeholder={selectedStart ? selectedStart.name : (start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : 'Search any Belfast start point')}
            autoComplete="off"
            onChange={(e) => onStartChange(e.target.value)}
            onFocus={onStartFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onStartSubmit) {
                e.preventDefault();
                onStartSubmit();
              }
            }}
            aria-label="Starting point"
          />
          {(startQuery || start) && (
            <button type="button" className="dir-clear" onClick={onStartClear} aria-label="Clear start">×</button>
          )}
        </div>

        <div className="dir-divider" aria-hidden="true" />

        <div className="dir-field">
          <input
            id="destination-search"
            className="dir-input"
            type="search"
            value={destinationQuery}
            placeholder={selectedDestination ? selectedDestination.name : (end ? `${end.lat.toFixed(4)}, ${end.lng.toFixed(4)}` : 'Search any Belfast destination')}
            autoComplete="off"
            onChange={(e) => onDestChange(e.target.value)}
            onFocus={onDestFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onDestSubmit) {
                e.preventDefault();
                onDestSubmit();
              }
            }}
            aria-label="Destination"
          />
          {(destinationQuery || end) && (
            <button type="button" className="dir-clear" onClick={onDestClear} aria-label="Clear destination">×</button>
          )}
        </div>
      </div>

      <button
        type="button"
        className="dir-swap"
        onClick={onSwap}
        disabled={!start && !end && !selectedStart && !selectedDestination}
        aria-label="Swap start and destination"
        title="Swap"
      >
        <span aria-hidden="true">⇅</span>
      </button>

      {showStartResults && (
        <ResultsList
          query={startQuery}
          results={startResults}
          searchState={startSearchState}
          errorMessage={startSearchError}
          promptMessage="Type a Belfast place, street, postcode, or landmark."
          emptyMessage="No Belfast start point matched that search."
          otherSelectedId={selectedDestination?.id}
          otherPoint={end}
          onSelect={onSelectStart}
        />
      )}
      {showDestResults && (
        <ResultsList
          query={destinationQuery}
          results={destinationResults}
          searchState={destinationSearchState}
          errorMessage={destinationSearchError}
          promptMessage="Search for a Belfast destination, address, or landmark."
          emptyMessage="No Belfast destination matched that search."
          otherSelectedId={selectedStart?.id}
          otherPoint={start}
          onSelect={onSelectDestination}
        />
      )}
    </div>
  );
}
