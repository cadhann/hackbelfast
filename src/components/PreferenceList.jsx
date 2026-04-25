export default function PreferenceList({ filters, filterOptions, onChange }) {
  return (
    <div className="prefs-section">
      <div className="section-title">Accessibility preferences</div>
      <div className="chip-row">
        {filterOptions.map(f => {
          const active = !f.disabled && !!filters[f.id];
          return (
            <button
              key={f.id}
              type="button"
              className={`chip${active ? ' active' : ''}${f.disabled ? ' disabled' : ''}`}
              disabled={!!f.disabled}
              onClick={() => !f.disabled && onChange(f.id, !filters[f.id])}
              title={f.desc}
              aria-pressed={active}
            >
              <span className="chip-label">{f.title}</span>
              {f.disabled && <span className="chip-pill">soon</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
