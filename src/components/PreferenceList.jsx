export default function PreferenceList({ filters, filterOptions, onChange }) {
  return (
    <div className="section">
      <h2>Accessibility preferences</h2>
      <div className="toggle-list">
        {filterOptions.map(f => (
          <label key={f.id} className={`toggle${f.disabled ? ' toggle-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={f.disabled ? false : !!filters[f.id]}
              disabled={!!f.disabled}
              onChange={(e) => !f.disabled && onChange(f.id, e.target.checked)}
            />
            <span className="toggle-text">
              <span className="toggle-title">
                {f.title}
                {f.disabled && <span className="toggle-pill">soon</span>}
              </span>
              <span className="toggle-desc">{f.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
