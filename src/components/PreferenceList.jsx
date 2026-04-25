export default function PreferenceList({ filters, filterOptions, onChange }) {
  return (
    <div className="section">
      <h2>Accessibility preferences</h2>
      <div className="toggle-list">
        {filterOptions.map(f => (
          <label key={f.id} className="toggle">
            <input
              type="checkbox"
              checked={filters[f.id]}
              onChange={(e) => onChange(f.id, e.target.checked)}
            />
            <span className="toggle-text">
              <span className="toggle-title">{f.title}</span>
              <span className="toggle-desc">{f.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
