import { samePoint } from '../utils/geo';

export default function PlaceSearch({
  title,
  inputId,
  query,
  placeholder,
  isOpen,
  results,
  emptyMessage,
  selectedOtherPlace,
  otherPoint,
  clearLabel,
  clearDisabled,
  onQueryChange,
  onFocus,
  onSelect,
  onClear
}) {
  return (
    <div className="section">
      <h2>{title}</h2>
      <label className="field-label" htmlFor={inputId}>
        Search venues, stations, stops, or landmarks
      </label>
      <input
        id={inputId}
        className="destination-input"
        type="search"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
      />
      {isOpen && (
        <div className="destination-results" role="list" aria-label={`${title} suggestions`}>
          {results.length > 0 ? results.map(destination => (
            <button
              key={destination.id}
              type="button"
              className="destination-result"
              disabled={selectedOtherPlace?.id === destination.id || samePoint(destination, otherPoint)}
              onClick={() => onSelect(destination)}
            >
              <span className="destination-name">{destination.name}</span>
              <span className="destination-meta">{destination.type} · {destination.area}</span>
            </button>
          )) : (
            <div className="destination-empty">{emptyMessage}</div>
          )}
        </div>
      )}
      <div className="destination-actions">
        <button className="btn" type="button" onClick={onClear} disabled={clearDisabled}>
          {clearLabel}
        </button>
      </div>
    </div>
  );
}
