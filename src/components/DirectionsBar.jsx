import { samePoint } from '../utils/geo';

function ResultsList({ results, emptyMessage, otherSelectedId, otherPoint, onSelect }) {
  if (results.length === 0) {
    return <div className="dir-empty">{emptyMessage}</div>;
  }
  return (
    <div className="dir-results" role="listbox">
      {results.map(d => {
        const disabled = otherSelectedId === d.id || samePoint(d, otherPoint);
        return (
          <button
            key={d.id}
            type="button"
            className="dir-result"
            disabled={disabled}
            onClick={() => onSelect(d)}
          >
            <span className="dir-result-icon" aria-hidden="true">📍</span>
            <span className="dir-result-text">
              <span className="dir-result-name">{d.name}</span>
              <span className="dir-result-meta">{d.type} · {d.area}</span>
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
  onStartChange, onStartFocus, onStartClear, onSelectStart,
  onDestChange, onDestFocus, onDestClear, onSelectDestination,
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
            placeholder={selectedStart ? selectedStart.name : (start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : 'Choose starting point, or click on the map')}
            autoComplete="off"
            onChange={(e) => onStartChange(e.target.value)}
            onFocus={onStartFocus}
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
            placeholder={selectedDestination ? selectedDestination.name : (end ? `${end.lat.toFixed(4)}, ${end.lng.toFixed(4)}` : 'Choose destination')}
            autoComplete="off"
            onChange={(e) => onDestChange(e.target.value)}
            onFocus={onDestFocus}
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
          results={startResults}
          emptyMessage="No seeded Belfast start point found."
          otherSelectedId={selectedDestination?.id}
          otherPoint={end}
          onSelect={onSelectStart}
        />
      )}
      {showDestResults && (
        <ResultsList
          results={destinationResults}
          emptyMessage="No seeded Belfast destination found."
          otherSelectedId={selectedStart?.id}
          otherPoint={start}
          onSelect={onSelectDestination}
        />
      )}
    </div>
  );
}
